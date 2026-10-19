'use strict';

/**
 * @file main.js - Main loop
 *
 * Fixed-timestep loop for host/local play, snapshot interpolation for clients, rendering and
 * boot sequence.
 *
 * Depends on: everything
 * Globals defined: lastT, acc, snapC, hudAcc, stepOnce, frame
 */

/* ===== Main loop ===== */
/** Loop timing: `acc` accumulates real time for the fixed 1/60 s simulation steps. */
let lastT = performance.now(),
  acc = 0,
  snapC = 0,
  hudAcc = 0;
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
/**
 * requestAnimationFrame callback. Offline/host: up to 6 fixed steps per frame, snapshots sent every
 * second frame. Guests: only smoothing. Then camera, HUD (about 12 Hz) and rendering.
 */
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
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
          acc += dt;
          let n = 0;
          while (acc >= 1 / 60 && n < 6) {
            acc -= 1 / 60;
            n++;
            stepOnce(1 / 60);
          }
          if (n >= 6) acc = 0;
          if (NET.role === 'host' && NET.conns.length && ++snapC % 2 === 0)
            NET.bcast(snapshot(snapC % 10 === 0));
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
