# Audio: sounds, consistency tool and worm voices

Three layers, all in `js/audio.js`

| Layer | What | Where |
| --- | --- | --- |
| Synthesised effects | explosions, shots, clicks: oscillators and noise (`tone`, `noiseBurst`, the `SFX` table) | `audio.js` |
| MP3 voice lines and cues | recordings such as the Hokuto line, Kamehameha, the Holy Hand Grenade choir (`mp3Sfx`) | `sounds/*.mp3`, list in `MP3_FILES` |

## 1. Keeping the MP3s consistent (`tools/audio_tool.py`)

Recordings come from everywhere, so they used to differ a lot (one was at -2.5 LUFS and clipping, another at -21 LUFS,
mono / stereo, 22 / 44 kHz, 8 s with dead air at the end). The tool needs `ffmpeg`, `ffprobe` and `numpy`:

```bash
python3 tools/audio_tool.py report              # table: duration, format, loudness, peak, tonal balance, syllable rate, tail silence
python3 tools/audio_tool.py report --all        # ... and the untouched originals too
python3 tools/audio_tool.py check               # exit 1 when something in sounds/ is off target (CI / pre-commit)
python3 tools/audio_tool.py normalize           # rebuild sounds/ from the originals
python3 tools/audio_tool.py normalize --dry-run # show what it would do
```

**Workflow for a new sound:** put the MP3 in `sounds/`, add it to `MP3_FILES` in `audio.js`, list it in
`tools/audio-manifest.json` if it needs special treatment, run `normalize`. The first run saves the original in
`tools/audio-src/` (never overwritten) and writes the processed file to `sounds/`; running it again always starts from the
original, so the quality never degrades. `build/build.js` ships `sounds/` only.

What every file goes through:

1. tags and cover art removed; **mono, 44.1 kHz, 96 kbps CBR** MP3;
2. **band limits**: high-pass 90 Hz, low-pass 9 kHz (same bandwidth for all);
3. **timbre matching**: the energy in three bands (80-400, 400-2500, 2500-8000 Hz) is measured on the sound-bearing
   part of the file and a gentle 3-band EQ (at most +-5 dB) moves it towards the reference balance, the median of the
   *voice* files (override with `reference` in the manifest). `kind: "music"` files are only nudged (`eq_limit_db`);
4. **trailing silence** is trimmed (below -50 dB, keeping 80 ms). The *start* is never touched, because animations are
   synchronised to the beginning of each sound;
5. **speed** (off by default, so timings stay as they are): `tempo` (pitch-preserving, 0.5-2) per file, or `maxdur` which
   speeds a file up just enough to fit; the `rate` column of `report` shows the syllable rate to compare voices;
6. **loudness**: EBU R128 integrated **-16 LUFS** with a -1.5 dB true-peak ceiling (two-pass `loudnorm`, then a gain and
   limiter correction when a peaky file stops short), within +-1 LU after the MP3 encode.

`tools/audio-manifest.json`: `defaults` (any of `lufs`, `tp`, `sr`, `channels`, `bitrate`, `highpass`, `lowpass`,
`eq_limit_db`, `tempo`, `maxdur`, `reference`) and per-file overrides under `files`. `tests/test_audio_tool.py` builds
test sounds, checks the whole pipeline and fails if `sounds/` drifts.