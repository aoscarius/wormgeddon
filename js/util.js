'use strict';

/**
 * @file util.js - Utilities
 *
 * Dependency-free helpers shared by every module: DOM shortcut, math helpers, a seeded PRNG and
 * integer hashes.
 *
 * Depends on: none
 * Globals defined: TAU, clamp, rnd, rndi, pick, mulberry, hashStr, hash2
 */

/** Shorthand for document.getElementById. */
const $ = id => document.getElementById(id);
/** A full turn in radians. */
const TAU = Math.PI * 2;
/** Limits v to the range [a, b]. */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
/** Random float in [a, b). Uses Math.random, so it is NOT reproducible; use mulberry() for seeded data. */
const rnd = (a, b) => a + Math.random() * (b - a);
/** Random integer in [a, b] (inclusive). */
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
/** Random element of an array. */
const pick = a => a[Math.floor(Math.random() * a.length)];
/**
 * Seeded pseudo-random generator (mulberry32). Same seed => same sequence, which is what makes
 * levels reproducible and lets online clients rebuild the host's terrain from the seed alone.
 * @param {number} a 32-bit seed
 * @returns {() => number} function returning floats in [0, 1)
 */
function mulberry(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** FNV-1a string hash -> unsigned 32-bit integer (turns a text seed into a numeric seed). */
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
/** Deterministic 2D integer hash -> float in [0, 1). Used for per-pixel terrain texture noise. */
function hash2(x, y) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
