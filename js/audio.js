'use strict';

/**
 * @file audio.js - Audio
 *
 * Tiny Web-Audio synthesiser. No audio assets: every sound is a short oscillator or noise burst.
 *
 * Depends on: none
 * Globals defined: AC, muted, ac, tone, noiseBurst, SFX
 */

/* ===== Audio (tiny synth, no assets) ===== */
/** Lazily created AudioContext (browsers only allow audio after a user gesture) and the mute flag. */
let AC = null,
  muted = false;
/** Returns the shared AudioContext, creating it on first use (null if unsupported). */
function ac() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {}
  }
  return AC;
}
/**
 * Plays a short oscillator note whose pitch glides from f1 to f2 Hz.
 * @param {number} dur seconds
 * @param {OscillatorType} type waveform
 * @param {number} vol peak gain (0..1)
 */
function tone(f1, f2, dur, type = 'square', vol = 0.08) {
  const a = ac();
  if (!a || muted) return;
  const o = a.createOscillator(),
    g = a.createGain(),
    t = a.currentTime;
  o.type = type;
  o.frequency.setValueAtTime(f1, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(a.destination);
  o.start(t);
  o.stop(t + dur);
}
/**
 * Plays a burst of low-passed white noise that fades out (explosions, gunshots, splashes).
 * @param {number} dur seconds
 * @param {number} vol gain (0..1)
 * @param {number} lp low-pass cutoff in Hz (lower = deeper boom)
 */
function noiseBurst(dur, vol = 0.2, lp = 800) {
  const a = ac();
  if (!a || muted) return;
  const n = Math.floor(a.sampleRate * dur),
    buf = a.createBuffer(1, n, a.sampleRate),
    d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = a.createBufferSource(),
    f = a.createBiquadFilter(),
    g = a.createGain();
  s.buffer = buf;
  f.type = 'lowpass';
  f.frequency.value = lp;
  g.gain.value = vol;
  s.connect(f);
  f.connect(g);
  g.connect(a.destination);
  s.start();
}
/**
 * Creates an MP3 sound-effect function. Each call plays a separate voice so
 * overlapping playback is supported.
 * @param {string} src URL or path to the MP3 file
 * @param {number} [vol=1] Playback volume from 0 (silent) to 1 (full volume)
 * @returns {() => void} Function that plays the sound effect
 */
function mp3Sfx(src, vol = 0.5) {
    const b = new Audio(src);
    b.preload = 'auto';
    if (muted) return;
    const m = b.cloneNode();
    m.volume = Math.max(0, Math.min(1.0, vol));
    m.play().catch(() => {});
}
/**
 * Sound effects by name. Simulation events refer to these names ({e:'snd', s:'boom'}), so adding
 * a new sound only needs a new entry here. Each takes an optional numeric argument (e.g. radius).
 */
const SFX = {
  boom: r => noiseBurst(0.35 + r / 120, 0.35, 250 + r * 6),
  shot: () => noiseBurst(0.1, 0.18, 3000),
  jump: () => tone(220, 520, 0.12, 'sine', 0.1),
  hurt: () => tone(500, 120, 0.25, 'sawtooth', 0.06),
  splash: () => noiseBurst(0.4, 0.14, 1400),
  beep: () => tone(900, 900, 0.05, 'square', 0.05),
  rumble: () => noiseBurst(0.5, 0.22, 160),
  zap: () => {
    noiseBurst(0.3, 0.3, 5000);
    tone(2600, 180, 0.25, 'sawtooth', 0.07);
  },
  launch: () => tone(150, 60, 0.3, 'sawtooth', 0.07),
  pick: () => {
    tone(600, 900, 0.1, 'triangle', 0.1);
    setTimeout(() => tone(900, 1300, 0.12, 'triangle', 0.1), 90);
  },
  tele: () => tone(1200, 200, 0.35, 'sine', 0.1),
  sheep: () => tone(420, 380, 0.12, 'triangle', 0.08),
  holy: () => mp3Sfx('sounds/hallelujah.mp3'),
  turn: () => {
    tone(500, 700, 0.12, 'triangle', 0.08);
  },
  win: () => {
    [523, 659, 784, 1046].forEach((f, i) =>
      setTimeout(() => tone(f, f, 0.2, 'triangle', 0.1), i * 140)
    );
  },
};
