#!/usr/bin/env python3
"""Keeps every MP3 in sounds/ consistent: same format, loudness, bandwidth and tonal balance, no dead air at the end.

    python3 tools/audio_tool.py report              # measure every file (loudness, peak, spectrum, speech rate ...)
    python3 tools/audio_tool.py check               # exit 1 when a file in sounds/ is off target (CI / pre-commit)
    python3 tools/audio_tool.py normalize           # rebuild sounds/ from the pristine copies in tools/audio-src/
    python3 tools/audio_tool.py normalize --dry-run # show the plan (gains, EQ, tempo) without writing

Workflow: drop a new MP3 into sounds/, run `normalize`. The first run copies each file to tools/audio-src/ (the untouched
original, never overwritten), then writes the processed version to sounds/, so normalizing again always starts from the
original and never degrades it. Settings live in tools/audio-manifest.json (global targets and per-file overrides).

What `normalize` does to each file (ffmpeg + numpy):
  1. strips tags and cover art, converts to the common format (mono, 44.1 kHz, CBR MP3);
  2. band-limits it (high-pass / low-pass) so rumble and hiss do not differ from file to file;
  3. matches the tonal balance: the energy in the low / mid / high bands is measured on the active part of the sound and a
     gentle 3-band EQ (limited to +-5 dB) moves it towards the reference balance (the median of the voice files, or the
     values given in the manifest);
  4. trims silence at the END (the start is left alone: animations are synchronised to it);
  5. optional speed: `tempo` (pitch-preserving) per file, or `maxdur` which speeds a file up just enough to fit;
  6. loudness-normalizes to the target integrated loudness (EBU R128, two passes) with a true-peak ceiling.
See docs/AUDIO.md.
"""
import argparse, json, os, re, shutil, subprocess, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOUNDS = os.path.join(ROOT, 'sounds')
SRC = os.path.join(ROOT, 'tools', 'audio-src')
MANIFEST = os.path.join(ROOT, 'tools', 'audio-manifest.json')
SR = 44100
BANDS = {'low': (80, 400), 'mid': (400, 2500), 'high': (2500, 8000)}
DEFAULTS = {'lufs': -16.0, 'tp': -1.5, 'sr': 44100, 'channels': 1, 'bitrate': '96k', 'highpass': 90, 'lowpass': 9000,
            'tail_silence_db': -50, 'tail_keep': 0.08, 'eq_limit_db': 5.0, 'tempo': None, 'maxdur': None,
            'tolerance_lufs': 1.0, 'max_tail': 0.15, 'reference': None, 'kind': 'voice'}


def sh(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def have_ffmpeg():
    return shutil.which('ffmpeg') is not None and shutil.which('ffprobe') is not None


def load_manifest(path=None):
    m = {'defaults': {}, 'files': {}}
    path = path or MANIFEST
    if os.path.exists(path):
        with open(path, encoding='utf-8') as f:
            m.update(json.load(f))
    return m


def settings(m, name):
    s = dict(DEFAULTS)
    s.update(m.get('defaults', {}))
    s.update(m.get('files', {}).get(name, {}))
    return s


def decode(path):
    """Mono float32 samples at SR."""
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True)
    return np.frombuffer(r.stdout, dtype=np.float32)


def probe(path):
    r = sh(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate,channels:format=duration',
            '-of', 'json', path])
    j = json.loads(r.stdout)
    st = j['streams'][0]
    return int(st['sample_rate']), int(st['channels']), float(j['format']['duration'])


def loudness(path):
    """Integrated loudness (LUFS), loudness range and true peak (dB) from ffmpeg's ebur128 filter."""
    r = sh(['ffmpeg', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'])
    t = r.stderr
    i = re.findall(r'I:\s+(-?[\d.]+|-inf) LUFS', t)
    p = re.findall(r'Peak:\s+(-?[\d.]+|-inf) dBFS', t)
    lra = re.findall(r'LRA:\s+(-?[\d.]+) LU', t)
    f = lambda v: float(v[-1]) if v and v[-1] != '-inf' else -120.0
    return f(i), f(lra), f(p)


def envelope(x, win=0.02):
    n = max(1, int(SR * win))
    k = len(x) // n
    if k == 0:
        return np.zeros(1)
    return np.sqrt((x[:k * n].reshape(k, n) ** 2).mean(axis=1))


def active_mask(env, floor_db=-45):
    peak = env.max() if env.size else 0
    return env > max(1e-6, peak * 10 ** (floor_db / 20))


def spectrum_bands(x):
    """Energy (dB, relative to the total over 80 Hz - 8 kHz) in the low / mid / high bands of the active part."""
    n = int(SR * 0.04)
    k = len(x) // n
    if k == 0:
        return {b: 0.0 for b in BANDS}
    frames = x[:k * n].reshape(k, n)
    rms = np.sqrt((frames ** 2).mean(axis=1))
    frames = frames[active_mask(rms)]
    if len(frames) == 0:
        return {b: 0.0 for b in BANDS}
    spec = (np.abs(np.fft.rfft(frames * np.hanning(n), axis=1)) ** 2).mean(axis=0)
    freqs = np.fft.rfftfreq(n, 1 / SR)
    e = {b: spec[(freqs >= lo) & (freqs < hi)].sum() for b, (lo, hi) in BANDS.items()}
    tot = sum(e.values()) or 1.0
    return {b: float(10 * np.log10(max(v, 1e-12) / tot)) for b, v in e.items()}


def centroid(x):
    n = 2048
    if len(x) < n:
        return 0.0
    spec = np.abs(np.fft.rfft(x[:len(x) // n * n].reshape(-1, n) * np.hanning(n), axis=1)).mean(axis=0)
    f = np.fft.rfftfreq(n, 1 / SR)
    return float((spec * f).sum() / max(spec.sum(), 1e-9))


def speech_rate(x):
    """Rough syllable rate: peaks of the smoothed envelope per second of active sound."""
    env = envelope(x, 0.02)
    if env.size < 5:
        return 0.0
    s = np.convolve(env, np.ones(5) / 5, mode='same')
    thr = s.max() * 0.25
    peaks = ((s[1:-1] > s[:-2]) & (s[1:-1] >= s[2:]) & (s[1:-1] > thr)).sum()
    active = active_mask(env).sum() * 0.02
    return float(peaks / active) if active > 0 else 0.0


def tail_silence(x, db=-50):
    """Seconds of silence (below `db` relative to the peak) at the end of the signal."""
    env = envelope(x, 0.01)
    idx = np.nonzero(env > max(1e-6, env.max() * 10 ** (db / 20)))[0]
    return float((len(env) - 1 - idx[-1]) * 0.01) if idx.size else float(len(env) * 0.01)


def measure(path):
    sr, ch, dur = probe(path)
    x = decode(path)
    i, lra, tp = loudness(path)
    return {'sr': sr, 'channels': ch, 'duration': round(dur, 3), 'lufs': i, 'lra': lra, 'peak': tp,
            'bands': spectrum_bands(x), 'centroid': round(centroid(x)), 'rate': round(speech_rate(x), 2),
            'tail': round(tail_silence(x), 2)}


def sound_files(d=None):
    d = d or SOUNDS
    return sorted(f for f in os.listdir(d) if f.lower().endswith('.mp3')) if os.path.isdir(d) else []


def reference_bands(m, metrics):
    ref = m.get('defaults', {}).get('reference')
    if ref:
        return ref
    return {b: float(np.median([v['bands'][b] for v in metrics.values()])) for b in BANDS}


def eq_filters(bands, ref, limit):
    g = {b: float(np.clip(ref[b] - bands[b], -limit, limit)) for b in BANDS}
    out = []
    if abs(g['low']) >= 0.3:
        out.append(f"bass=g={g['low']:.2f}:f=220:w=0.7")
    if abs(g['mid']) >= 0.3:
        out.append(f"equalizer=f=1200:width_type=h:w=1800:g={g['mid']:.2f}")
    if abs(g['high']) >= 0.3:
        out.append(f"treble=g={g['high']:.2f}:f=3800:w=0.7")
    return out, g


def build_chain(s, bands, ref, dur_after_trim=None):
    eq, gains = eq_filters(bands, ref, s['eq_limit_db'])
    chain = [f"highpass=f={s['highpass']}", f"lowpass=f={s['lowpass']}"] + eq
    db, keep = s['tail_silence_db'], s['tail_keep']
    chain.append(f"areverse,silenceremove=start_periods=1:start_threshold={db}dB:start_silence={keep},areverse")
    tempo = s['tempo']
    if dur_after_trim and s['maxdur'] and dur_after_trim > s['maxdur']:
        tempo = max(tempo or 1.0, dur_after_trim / s['maxdur'])
    if tempo and abs(tempo - 1) > 0.005:
        chain.append(f"atempo={float(np.clip(tempo, 0.5, 2.0)):.4f}")
    return chain, gains, tempo


def normalize_one(src, dst, s, ref, dry=False):
    m = measure(src)
    x = decode(src)
    trimmed = len(x) / SR - max(0.0, tail_silence(x, s['tail_silence_db']) - s['tail_keep'])
    chain, gains, tempo = build_chain(s, m['bands'], ref, trimmed)
    pre = ','.join(chain)
    plan = {'eq_db': {k: round(v, 1) for k, v in gains.items()}, 'tempo': round(tempo, 3) if tempo else None,
            'from_lufs': m['lufs'], 'to_lufs': s['lufs']}
    if dry:
        return plan
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    tmp = dst + '.tmp.mp3'
    work = dst + '.work'
    os.makedirs(work, exist_ok=True)
    w1, w2, w3 = (os.path.join(work, n) for n in ('a.wav', 'b.wav', 'c.wav'))
    fmt = ['-ac', str(s['channels']), '-ar', str(s['sr']), '-c:a', 'pcm_f32le']

    def run(args):
        r = sh(['ffmpeg', '-y', '-v', 'error'] + args)
        if r.returncode:
            raise SystemExit(f'ffmpeg failed for {src}: {r.stderr}')

    try:
        run(['-i', src, '-map', '0:a:0', '-af', pre] + fmt + [w1])               # filtered, still at the original level
        # two-pass loudnorm: pass 1 measures, pass 2 applies a precise linear gain
        ln = f"loudnorm=I={s['lufs']}:TP={s['tp']}:LRA=11"
        r = sh(['ffmpeg', '-nostats', '-i', w1, '-af', ln + ':print_format=json', '-f', 'null', '-'])
        j = re.findall(r'\{[^{}]*"input_i"[^{}]*\}', r.stderr, re.S)
        if j:
            d = json.loads(j[-1])
            ln += (f":measured_I={d['input_i']}:measured_TP={d['input_tp']}:measured_LRA={d['input_lra']}"
                   f":measured_thresh={d['input_thresh']}:offset={d['target_offset']}:linear=true")
        run(['-i', w1, '-af', ln] + fmt + [w2])
        # loudnorm may stop short (peaky or very dynamic sounds): close the gap with a gain and a limiter at the peak ceiling
        got = loudness(w2)[0]
        cur = w2
        for _ in range(3):
            if abs(got - s['lufs']) <= 0.25:
                break
            lim = 10 ** (s['tp'] / 20)
            run(['-i', cur, '-af', f"volume={s['lufs'] - got:.2f}dB,alimiter=limit={lim:.4f}:level=disabled:attack=2:release=40"] + fmt + [w3])
            os.replace(w3, w2)
            cur = w2
            got = loudness(w2)[0]
        run(['-i', cur, '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', s['bitrate'], '-ac', str(s['channels']),
             '-ar', str(s['sr']), '-id3v2_version', '0', '-write_xing', '0', '-f', 'mp3', tmp])
    finally:
        shutil.rmtree(work, ignore_errors=True)
    os.replace(tmp, dst)
    return plan


def seed_sources(sounds=None, src=None):
    """Copies every sound that has no pristine original yet into tools/audio-src/ (never overwrites one)."""
    sounds, src = sounds or SOUNDS, src or SRC
    os.makedirs(src, exist_ok=True)
    new = []
    for f in sound_files(sounds):
        if not os.path.exists(os.path.join(src, f)):
            shutil.copy2(os.path.join(sounds, f), os.path.join(src, f))
            new.append(f)
    return new


def fmt_row(name, v):
    b = v['bands']
    return (f"{name:32s} {v['duration']:6.2f}s {v['sr']:6d}Hz {v['channels']}ch {v['lufs']:6.1f} LUFS tp {v['peak']:5.1f} "
            f"L/M/H {b['low']:6.1f}/{b['mid']:6.1f}/{b['high']:6.1f} dB  centroid {v['centroid']:5d} Hz  "
            f"rate {v['rate']:4.1f}/s  tail {v['tail']:.2f}s")


def check_files(m, d=None):
    d = d or SOUNDS
    metrics = {f: measure(os.path.join(d, f)) for f in sound_files(d)}
    problems = []
    for f, v in metrics.items():
        s = settings(m, f)
        if v['sr'] != s['sr']:
            problems.append(f"{f}: sample rate {v['sr']} (want {s['sr']})")
        if v['channels'] != s['channels']:
            problems.append(f"{f}: {v['channels']} channel(s) (want {s['channels']})")
        if abs(v['lufs'] - s['lufs']) > s['tolerance_lufs']:
            problems.append(f"{f}: loudness {v['lufs']:.1f} LUFS (want {s['lufs']} +-{s['tolerance_lufs']})")
        if v['peak'] > s['tp'] + 0.6:
            problems.append(f"{f}: true peak {v['peak']:.1f} dB (limit {s['tp']})")
        if v['tail'] > s['max_tail']:
            problems.append(f"{f}: {v['tail']:.2f} s of silence at the end")
        if s['maxdur'] and v['duration'] > s['maxdur'] + 0.1:
            problems.append(f"{f}: {v['duration']:.1f} s long (max {s['maxdur']})")
    return problems, metrics


def cmd_report(a, m):
    for d, label in ((SOUNDS, 'sounds/'), (SRC, 'tools/audio-src/ (originals)')):
        files = sound_files(d)
        if not files or (d == SRC and not a.all):
            continue
        print(f'== {label}')
        for f in files:
            print(fmt_row(f, measure(os.path.join(d, f))))
    return 0


def cmd_check(a, m):
    if not sound_files():
        print('no sounds')
        return 0
    problems, _ = check_files(m)
    for p in problems:
        print('FAIL', p)
    print('sounds are consistent' if not problems else f'{len(problems)} problem(s): run python3 tools/audio_tool.py normalize')
    return 1 if problems else 0


def cmd_normalize(a, m):
    if not a.dry_run:
        new = seed_sources()
        if new:
            print('saved originals:', ', '.join(new))
    srcs = sound_files(SRC) or sound_files(SOUNDS)
    base = SRC if sound_files(SRC) else SOUNDS
    metrics = {f: measure(os.path.join(base, f)) for f in srcs}
    voices = {f: v for f, v in metrics.items() if settings(m, f)['kind'] == 'voice'}
    ref = reference_bands(m, voices or metrics)
    print('reference balance (dB):', {k: round(v, 1) for k, v in ref.items()})
    for f in srcs:
        plan = normalize_one(os.path.join(base, f), os.path.join(SOUNDS, f), settings(m, f), ref, a.dry_run)
        print(('plan ' if a.dry_run else 'done ') + f, plan)
    if not a.dry_run:
        for p in check_files(m)[0]:
            print('WARN', p)
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('report')
    p.add_argument('--all', action='store_true', help='also measure the originals')
    sub.add_parser('check')
    p = sub.add_parser('normalize')
    p.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()
    if not have_ffmpeg():
        print('ffmpeg / ffprobe not found: install ffmpeg')
        return 2
    m = load_manifest()
    return {'report': cmd_report, 'check': cmd_check, 'normalize': cmd_normalize}[a.cmd](a, m)


if __name__ == '__main__':
    sys.exit(main())
