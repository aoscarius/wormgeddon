'use strict';

/**
 * @file main.js - Main loop
 *
 * Fixed-timestep loop for host/local play, snapshot interpolation for clients, rendering and
 * boot sequence.
 *
 * Depends on: everything
 * Globals defined: lastT, acc, snapC, hudAcc, frameAt, bgWorker, stepOnce, hostSim, bgSync, bgTick, frame
 */

/* ===== Main loop ===== */
/** Loop timing: `acc` accumulates real time for the fixed 1/60 s simulation steps. */
let lastT = performance.now(),
  acc = 0,
  snapC = 0,
  hudAcc = 0,
  frameAt = performance.now(), // when the last animation frame ran (rAF stops completely in a hidden tab)
  bgWorker = null;
/** One fixed simulation tick: builds the per-team inputs, runs the bot, steps the simulation and dispatches events. */
function stepOnce(dt) {
  const inputs = G.teams.map(t =>
    t.ctrl === 'local'
      ? LOCAL
      : t.ctrl === 'ai'
        ? (t.aiInp = t.aiInp || makeInp())
        : (t.remoteInp = t.remoteInp || makeInp())
  );
  const aw = activeWorm(),
    cur = aw ? inputs[aw.team] : null;
  inputs.forEach(inp => {
    if (inp !== cur) {
      inp.fireP = inp.jump = inp.back = inp.tab = 0;
      inp.clicks.length = 0;
    }
  });
  if (aw && G.teams[aw.team].ctrl === 'ai') aiTick(G.teams[aw.team], dt);
  step(dt, inputs);
  drainEvents();
}
/** Advances the offline/host simulation by `dt` real seconds (fixed 1/60 s steps, at most 6) and broadcasts snapshots to the guests. */
function hostSim(dt) {
  acc += dt;
  let n = 0;
  while (acc >= 1 / 60 && n < 6) {
    acc -= 1 / 60;
    n++;
    stepOnce(1 / 60);
  }
  if (n >= 6) acc = 0;
  if (NET.role === 'host' && NET.conns.length && ++snapC % 2 === 0) NET.bcast(snapshot(snapC % 10 === 0));
}
/**
 * Background hosting. Browsers stop requestAnimationFrame in a hidden tab or an occluded window, which would freeze the match for
 * every guest; timers of a dedicated Web Worker are not throttled, so while the host is hosting (and the "Keep hosting in the
 * background" option is on) a worker ticks every 16 ms and bgTick() runs the simulation whenever no frame has run for a while
 * (nothing is drawn). While frames run normally the worker does nothing, so the simulation is never stepped twice.
 */
function bgSync() {
  const want = UI.bgHost && NET.role === 'host' && typeof Worker !== 'undefined';
  if (want && !bgWorker) {
    try {
      const url = URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 16);'], { type: 'text/javascript' }));
      bgWorker = new Worker(url);
      URL.revokeObjectURL(url);
      bgWorker.onmessage = bgTick;
    } catch (e) {
      bgWorker = null;
    }
  } else if (!want && bgWorker) {
    bgWorker.terminate();
    bgWorker = null;
  }
}
/** Worker tick: if animation frames have stopped (hidden tab), run the host simulation and the effects, but do not render. */
function bgTick() {
  const now = performance.now();
  if (now - frameAt < 120) return;
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  if (!G || G.demo || paused || NET.role !== 'host') return;
  try {
    hostSim(dt);
    fxUpdate(dt);
  } catch (err) {
    console.error(err);
  }
}
/**
 * requestAnimationFrame callback. Offline/host: up to 6 fixed steps per frame, snapshots sent every
 * second frame. Guests: only smoothing. Then camera, HUD (about 12 Hz) and rendering.
 */
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  frameAt = performance.now();
  bgSync();
  try {
    if (G) {
      if (G.demo) {
        G.time += dt;
        CAM.x = T.w / 2 + Math.sin(G.time * 0.08) * T.w * 0.3;
        CAM.y = T.h * 0.5;
        CAM.s = CAM.z * clamp(VW / 1000, 0.7, 1.5);
        fxUpdate(dt);
      } else if (!paused) {
        if (NET.role === 'client') {
          G.time += dt;
          clientSmooth(dt);
        } else {
          hostSim(dt);
        }
        fxUpdate(dt);
        camFocus(dt);
        hudAcc += dt;
        if (hudAcc > 0.08) {
          hudAcc = 0;
          hud();
        }
      }
    }
    touchFx();
    render();
  } catch (err) {
    console.error(err);
  }
  requestAnimationFrame(frame);
}
setLang(initLang());
resize();
showDemo();
renderLobby();
inviteBoot();
requestAnimationFrame(frame);
// Handy handle for debugging and automated tests.
window.__wh = {
  get G() {
    return G;
  },
  newGame,
  step,
  stepOnce,
  spawnProj,
  WLIST,
  WEAPONS,
  PTYPES,
  setLang,
  tr,
  /** Static page texts that have no Italian translation (for tests). */
  missingTranslations() {
    const rep = {};
    const keep = LANG;
    LANG = 'it';
    translateDom(document.body, rep);
    LANG = keep;
    translateDom();
    return Object.keys(rep);
  },
};
