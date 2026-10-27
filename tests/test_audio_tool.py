"""tools/audio_tool.py: normalizes MP3s to one format / loudness / balance, trims trailing silence, keeps the originals,
is repeatable, honours tempo / maxdur, and the real sounds/ folder passes `check`. Needs ffmpeg (skipped without)."""
import os, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'tools'))
import numpy as np
import audio_tool as A

if not A.have_ffmpeg():
    print('SKIPPED: ffmpeg not installed')
    raise SystemExit(0)

fails = []
def check(c, msg):
    if not c:
        fails.append(msg)

def make(path, freq, secs, amp, sr, ch, tail=0.0):
    """A pulsing tone (speech-like envelope) with optional trailing silence, encoded as MP3."""
    t = np.arange(int(sr * secs)) / sr
    x = amp * np.sin(2 * np.pi * freq * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 4 * t)) ** 0.7
    x = np.concatenate([x, np.zeros(int(sr * tail))]).astype(np.float32)
    data = np.repeat(x[:, None], ch, axis=1).astype('<f4').tobytes()
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'f32le', '-ar', str(sr), '-ac', str(ch), '-i', '-', '-b:a', '128k', path],
                   input=data, check=True)

with tempfile.TemporaryDirectory() as d:
    snd, src = os.path.join(d, 'sounds'), os.path.join(d, 'src')
    os.makedirs(snd)
    make(os.path.join(snd, 'loud.mp3'), 440, 1.5, 0.95, 44100, 2)                  # loud, stereo
    make(os.path.join(snd, 'quiet.mp3'), 900, 1.5, 0.03, 22050, 2, tail=1.0)       # quiet, 22 kHz, a second of silence at the end
    make(os.path.join(snd, 'long.mp3'), 300, 4.0, 0.3, 44100, 1)                   # long
    A.SOUNDS, A.SRC = snd, src
    m = {'defaults': {}, 'files': {'long.mp3': {'maxdur': 2.0}}}
    before = A.check_files(m, snd)[0]
    check(len(before) >= 3, f'the raw files are reported as inconsistent: {before}')
    orig_sizes = {f: os.path.getsize(os.path.join(snd, f)) for f in A.sound_files(snd)}

    class Args: dry_run = False
    A.cmd_normalize(Args, m)
    check(sorted(A.sound_files(src)) == sorted(orig_sizes), 'originals saved')
    check(all(os.path.getsize(os.path.join(src, f)) == n for f, n in orig_sizes.items()), 'originals untouched')
    problems, met = A.check_files(m, snd)
    check(not problems, f'normalized files pass the check: {problems}')
    for f, v in met.items():
        check(v['sr'] == 44100 and v['channels'] == 1, f'{f}: mono 44.1 kHz')
        check(abs(v['lufs'] - -16) <= 1.0, f"{f}: {v['lufs']} LUFS")
        check(v['tail'] <= 0.15, f"{f}: tail {v['tail']}")
    check(met['quiet.mp3']['duration'] < 1.8, f"trailing silence trimmed: {met['quiet.mp3']['duration']}")
    check(met['long.mp3']['duration'] <= 2.15, f"maxdur speeds it up: {met['long.mp3']['duration']}")
    spread = max(v['lufs'] for v in met.values()) - min(v['lufs'] for v in met.values())
    check(spread < 1.2, f'loudness spread {spread:.2f} LU')
    # repeatable: running again starts from the originals and gives the same result
    first = {f: open(os.path.join(snd, f), 'rb').read() for f in A.sound_files(snd)}
    A.cmd_normalize(Args, m)
    check(all(open(os.path.join(snd, f), 'rb').read() == b for f, b in first.items()), 'normalize is repeatable')
    # a drifting file is caught
    make(os.path.join(snd, 'new.mp3'), 500, 1.0, 0.9, 44100, 2)
    check(any('new.mp3' in p for p in A.check_files(m, snd)[0]), 'check flags a new raw file')
    # dry run changes nothing
    snap = {f: os.path.getsize(os.path.join(snd, f)) for f in A.sound_files(snd)}
    Args.dry_run = True
    A.cmd_normalize(Args, m)
    check(snap == {f: os.path.getsize(os.path.join(snd, f)) for f in A.sound_files(snd)}, 'dry run writes nothing')

# the sounds shipped with the game
real = os.path.join(os.path.dirname(HERE), 'sounds')
A.SOUNDS = real
problems, _ = A.check_files(A.load_manifest(), real)
check(not problems, f'sounds/ is consistent: {problems}')

if fails:
    print('FAILED:', *fails, sep='\n  ')
    raise SystemExit(1)
print('OK')
