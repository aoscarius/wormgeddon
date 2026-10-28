'use strict';

/**
 * @file audio.js - Audio
 *
 * Tiny Web-Audio synthesiser (oscillator and noise bursts) plus a few MP3 effects from `sounds/`.
 *
 * Depends on: none
 * Globals defined: AC, muted, ac, tone, noiseBurst, MP3_FILES, mp3Entry, mp3Sfx, mp3Stop, voice, SFX
 */

/* ===== Audio ===== */
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
  const n = Math.max(1, Math.floor(a.sampleRate * dur) || 1), // never 0 frames (createBuffer throws)
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
/* ---- MP3 sound effects ---- */
/** Files preloaded at start-up (see mp3Entry). Paths are relative to the page; `sounds/` ships with the build. */
const MP3_FILES = [
  'sounds/hallelujah.mp3', 
  'sounds/kamehameha.mp3',
  'sounds/atatatatata.mp3',
  'sounds/omaewamoushindeiru.mp3',
  'sounds/onigiri.mp3',
  'sounds/wecamewesawwekickeditsass.mp3',
  'sounds/gomugomuno.mp3',
  'sounds/iaminevitable.mp3',
];
/** src -> {el: HTMLAudioElement (always), buf: AudioBuffer (once decoded)}; live voices for mute. */
const MP3 = {},
  MP3_VOICES = new Set();
/**
 * Loads (once) an MP3 and keeps it ready. An <audio> element is always created (it works from file://
 * too); on http(s) pages the file is additionally decoded into an AudioBuffer, which starts instantly
 * and exactly on cue. A single-file build can supply the bytes as `window.SOUNDS_BUNDLE[src]` (data URL).
 */
function mp3Entry(src) {
  if (MP3[src]) return MP3[src];
  const url = (window.SOUNDS_BUNDLE && window.SOUNDS_BUNDLE[src]) || src,
    e = (MP3[src] = { el: new Audio(url), buf: null });
  e.el.preload = 'auto';
  e.el.load();
  if (typeof fetch === 'function')
    fetch(url)
      .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
      .then(b => ac().decodeAudioData(b))
      .then(buf => (e.buf = buf))
      .catch(() => {}); // file:// or no Web Audio: the <audio> element is used instead
  return e;
}
/**
 * Plays an MP3 sound effect now, as its own voice (overlapping calls are fine). Does nothing while
 * muted. Returns a handle with stop(), or null.
 * @param {string} src path of the file (one of MP3_FILES, or any path: it is loaded on first use)
 * @param {number} [vol=0.6] volume 0..1
 */
function mp3Sfx(src, vol = 0.6) {
  if (muted) return null;
  const e = mp3Entry(src),
    a = AC;
  vol = Math.max(0, Math.min(1, vol));
  let v;
  if (e.buf && a) {
    if (a.state === 'suspended') a.resume();
    const s = a.createBufferSource(),
      g = a.createGain();
    s.buffer = e.buf;
    g.gain.value = vol;
    s.connect(g);
    g.connect(a.destination);
    s.onended = () => MP3_VOICES.delete(v);
    s.start();
    v = { stop: () => { try { s.stop(); } catch (err) {} } };
  } else {
    const m = e.el.cloneNode();
    m.volume = vol;
    m.onended = () => MP3_VOICES.delete(v);
    m.play().catch(() => MP3_VOICES.delete(v));
    v = { stop: () => m.pause() };
  }
  MP3_VOICES.add(v);
  return v;
}
/** Silences every MP3 sound that is still playing (used by the mute key). */
function mp3Stop() {
  for (const v of MP3_VOICES) v.stop();
  MP3_VOICES.clear();
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}
/**
 * Speaks `text` with the browser's speech synthesis (no sound files needed). Silent when muted or unsupported;
 * `lang` picks the voice (e.g. 'en-EN'), `rate` and `pitch` shape it.
 */
function voice(text, lang = 'en-EN', rate = 1, pitch = 1, vol = 0.6) {
  if (muted || typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    u.pitch = pitch;
    u.volume = Math.max(0, Math.min(1, vol));
    speechSynthesis.speak(u);
  } catch (err) {
    /* speech is a bonus: never break the game over it */
  }
}
MP3_FILES.forEach(mp3Entry);
/**
 * Sound effects by name. Simulation events refer to these names ({e:'snd', s:'boom'}), so adding
 * a new sound only needs a new entry here. Each takes an optional numeric argument (e.g. radius).
 */
const SFX = {
  boom: (r = 40) => noiseBurst(0.35 + r / 120, 0.35, 250 + r * 6),
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
  // Hokuto Hyakuretsu Ken: a short thud per punch, ata, and the verdict.
  ata: () => mp3Sfx('sounds/atatatatata.mp3'),
  thud: () => {
    noiseBurst(0.05, 0.12, 900);
    tone(110, 50, 0.06, 'square', 0.06);
  },
  // dead: () => voice('Omae wa mou shindeiru', 'ja-JP', 1.0, 0.5),
  dead: () => mp3Sfx('sounds/omaewamoushindeiru.mp3'),
  // Khameameah
  charge: () => tone(180, 900, 1.3, 'sine', 0.08),
  kame: () => {
    noiseBurst(1.4, 0.3, 700);
    tone(70, 240, 1.4, 'sawtooth', 0.1);
  },
  // kamevoice: () => voice('Kamehameha', 'ja-JP', 1.2, 1.0),
  kamevoice: () => mp3Sfx('sounds/kamehameha.mp3'),
  // Proton Stream: the packs power up, then a crackle on every damage tick.
  proton: () => tone(100, 160, 0.7, 'sawtooth', 0.06),
  zap: () => {
    noiseBurst(0.08, 0.12, 2500);
    tone(900, 300, 0.08, 'square', 0.04);
  },
  // murray: () => voice('We came, we saw, we kicked its ass!', 'en-EN', 1.0, 1.5),
  murray: () => mp3Sfx('sounds/wecamewesawwekickeditsass.mp3'),
  // Gomu Gomu no Gigant Axe: the shout and the rubber leg stretching, then the stomp.
  gigant: () => {
    // voice('Gomu Gomu no, Gigant Axe!', 'ja-JP', 1.0, 0.5);
    mp3Sfx('sounds/gomugomuno.mp3'),
    tone(150, 700, 1.1, 'sine', 0.06);
  },
  stomp: () => {
    noiseBurst(0.6, 0.45, 300);
    tone(80, 28, 0.6, 'sine', 0.25);
  },
  // Splatter Mode: a wet burst (a low thump with a splash of filtered noise)
  // Thanos' Gauntlet: the snap, a deep boom and a fading wind of dust.
  inevitable: () => mp3Sfx('sounds/iaminevitable.mp3'),
  snap: () => {
    noiseBurst(0.04, 0.5, 6000);
    tone(1800, 500, 0.05, 'square', 0.12);
    setTimeout(() => {
      tone(90, 30, 1.4, 'sine', 0.3);
      noiseBurst(1.6, 0.18, 500);
    }, 60);
  },
  squelch: () => {
    noiseBurst(0.35, 0.22, 700);
    tone(140, 40, 0.3, 'sine', 0.12);
    setTimeout(() => noiseBurst(0.18, 0.12, 1800), 90);
  },
  // Oni Giri: swords drawn, the dash, and a slice.
  oni: () => mp3Sfx('sounds/onigiri.mp3'),
  // draw: () => {
  //   for (let i = 0; i < 3; i++) setTimeout(() => tone(2200 + i * 500, 3400 + i * 500, 0.12, 'triangle', 0.05), i * 110);
  // },
  // swoosh: () => {
  //   noiseBurst(0.3, 0.15, 2500);
  //   tone(300, 1400, 0.3, 'sine', 0.05);
  // },
  slash: () => {
    noiseBurst(0.12, 0.2, 4000);
    tone(1800, 600, 0.12, 'sawtooth', 0.07);
  },
  pick: () => {
    tone(600, 900, 0.1, 'triangle', 0.1);
    setTimeout(() => tone(900, 1300, 0.12, 'triangle', 0.1), 90);
  },
  tele: () => tone(1200, 200, 0.35, 'sine', 0.1),
  sheep: () => tone(420, 380, 0.12, 'triangle', 0.08),
  // Holy Hand Grenade choir: ~2 s of singing; the projectile starts it so that it ends with the blast.
  holy: () => mp3Sfx('sounds/hallelujah.mp3'),
  roar: () => {
    noiseBurst(0.6, 0.25, 500);
    tone(110, 55, 0.6, 'sawtooth', 0.1);
  },
  turn: () => {
    tone(500, 700, 0.12, 'triangle', 0.08);
  },
  win: () => {
    [523, 659, 784, 1046].forEach((f, i) =>
      setTimeout(() => tone(f, f, 0.2, 'triangle', 0.1), i * 140)
    );
  },
};
