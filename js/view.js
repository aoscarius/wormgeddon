'use strict';

/**
 * @file view.js - View state
 *
 * Canvas/DPR sizing, camera, shared UI state and the per-team input record.
 *
 * Depends on: util
 * Globals defined: cvs, ctx2, VW, VH, DPR, CAM, UI, FX, NUKE_TIME, LOCAL, makeInp, applyTerrain, resize,
 *     camFocus, toWorld
 */

/** The canvas and its CSS size / device-pixel-ratio (set by resize()). */
const cvs = $('c'),
  ctx2 = cvs.getContext('2d');
let VW = 0,
  VH = 0,
  DPR = 1;
/** Camera: world position (x, y), user zoom z and effective scale s (px per world unit). */
const CAM = { x: 1000, y: 400, z: 1, s: 1 };
/**
 * Client-side UI state that is not part of the match: mouse position in world units, girder
 * angle (0-7, in steps of 22.5 degrees), screen shake, flash overlay, my team (online),
 * time of the last manual camera pan, and cached HUD signature.
 */
const UI = {
  mx: 0,
  my: 0,
  ang: 0,
  panel: false,
  panT: -9,
  shake: 0,
  flash: null,
  flashA: 0,
  myTeam: -1,
  sig: '',
  hudT: 0,
  over: false,
};
/** Visual effect lists: particles, floating texts, tracers, planes, shock rings, target marks, log lines. */
const FX = { p: [], txt: [], tracers: [], planes: [], rings: [], marks: [], logs: [], nuke: null };
/** Seconds the background mushroom cloud of the Nuclear Test stays on screen. */
const NUKE_TIME = 9;
/** Input record of the local keyboard / touch (shared by all human teams on this machine). */
const LOCAL = makeInp();
/** Creates an input record: l/r/u/d/fire are held states, fireP/jump/back/tab are one-shot edges, clicks is a queue of map clicks. */
function makeInp() {
  return { l: 0, r: 0, u: 0, d: 0, fire: 0, fireP: 0, jump: 0, back: 0, tab: 0, clicks: [] };
}

/** Applies the terrain part of an event ('x' crater, 'cv' carve, 'gd' girder). Shared by host and guests. */
function applyTerrain(e) {
  if (e.e === 'x') {
    if (e.c) carve(e.x, e.y, e.r, true);
  } else if (e.e === 'cv') carve(e.x, e.y, e.r, !!e.s);
  else if (e.e === 'gd') addGirder(e.x, e.y, e.a, e.l);
}

/* ---- Camera ---- */
/** Matches the canvas resolution to the window and device pixel ratio. */
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  VW = innerWidth;
  VH = innerHeight;
  cvs.width = VW * DPR;
  cvs.height = VH * DPR;
}
addEventListener('resize', resize);
/**
 * Moves the camera towards what matters: a moving projectile, else the last explosion (while the
 * match settles), else the active worm. Manual dragging pauses the auto-follow for 2.5 s.
 */
function camFocus(dt) {
  if (!G) return;
  let tx = CAM.x,
    ty = CAM.y;
  const w = activeWorm();
  if (G.time - UI.panT < 2.5 && UI.panT > 0) {
    /* user is panning */
  } else {
    const p = [...G.projs].reverse().find(q => !PTYPES[q.t].passive || q.fuse != null);
    if (p) {
      tx = p.x;
      ty = p.y;
    } else if (CAM.fx != null && G.phase === 'settle' && G.time - CAM.fT < 2.2) {
      tx = CAM.fx;
      ty = CAM.fy;
    } else if (w) {
      tx = w.x;
      ty = w.y - 20;
    }
  }
  const k = 1 - Math.pow(0.02, dt);
  CAM.x += (tx - CAM.x) * k;
  CAM.y += (ty - CAM.y) * k;
  CAM.s = CAM.z * clamp(VW / 1000, 0.7, 1.5);
  const vw = VW / CAM.s,
    vh = VH / CAM.s;
  CAM.x = vw >= T.w ? T.w / 2 : clamp(CAM.x, vw / 2, T.w - vw / 2);
  const lo = -260 + vh / 2,
    hi = T.h + 80 - vh / 2;
  CAM.y = lo >= hi ? (lo + hi) / 2 : clamp(CAM.y, lo, hi);
}
/** Screen (CSS px) -> world coordinates. */
const toWorld = (sx, sy) => [(sx - VW / 2) / CAM.s + CAM.x, (sy - VH / 2) / CAM.s + CAM.y];
