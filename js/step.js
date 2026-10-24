'use strict';

/**
 * @file step.js - Simulation step
 *
 * One fixed 1/60 s tick of the whole simulation. Host/local only; online clients never call it.
 *
 * Depends on: everything above
 * Globals defined: step
 */

/* ===== Main step ===== */
/**
 * Advances the whole simulation by dt seconds (always 1/60 s). Only the host / a local game
 * calls this; online guests just display what the host sends.
 *
 * Order of work: scheduled actions -> Armageddon meteors -> active worm control -> passive
 * worm physics -> projectiles -> fire -> crates & drums -> water level -> phase logic
 * (the 'settle' phase waits for calm, resolves deaths, then starts the next turn).
 *
 * @param {number} dt seconds
 * @param {object[]} inputs one input record per team (index = team id)
 */
function step(dt, inputs) {
  G.time += dt;
  const w = activeWorm(),
    t = w ? teamOf(w) : null;
  curInp = t && (G.phase === 'turn' || G.phase === 'retreat') ? inputs[t.id] : null;
  // scheduled actions
  for (let i = G.sched.length - 1; i >= 0; i--) {
    const s = G.sched[i];
    s.t -= dt;
    if (s.t <= 0) {
      G.sched.splice(i, 1);
      s.fn();
    }
  }
  if (G.quake > 0) {
    G.quake -= dt;
    G.quakeT = (G.quakeT || 0) - dt;
    if (G.quakeT <= 0) {
      G.quakeT = 0.14;
      quakeTick();
    }
  }
  if (G.tsu) tsunamiTick(dt);
  if (G.arma > 0) {
    G.arma -= dt;
    G.armaT = (G.armaT || 0) - dt;
    if (G.armaT <= 0) {
      G.armaT = 0.11;
      spawnProj('meteor', rnd(0, T.w), -80, rnd(-60, 160), rnd(300, 420), null, { ow: -1 });
    }
  }
  // active worm control
  if (w && !w.dead && curInp) {
    const inp = curInp;
    if (G.phase === 'turn' || G.phase === 'retreat') {
      G.timer -= dt;
      if (G.weapon.ch === false || G.phase === 'retreat') {
      }
      handleFire(w, t, inp, dt);
      if (inp.tab) {
        cycleWorm(w, false);
        inp.tab = 0;
      }
      for (const c of inp.clicks.splice(0)) clickTarget(w, t, c.x, c.y);
      if (G.timer <= 0 && !(w.tool && TOOL_ATOMIC[w.tool.k])) {
        if (G.weapon.ch) {
          G.weapon.ch = false;
        }
        if (G.phase === 'turn' || G.phase === 'retreat') toSettle();
      }
      if (G.phase !== 'settle') {
        // While a steerable weapon (super sheep) is flying, the arrow keys steer it and the worm
        // stands still instead of walking and aiming at the same time.
        if (G.projs.some(p => PTYPES[p.t].ctl && p.ow === w.id)) physWorm(w, dt, false);
        else controlWorm(w, inp, dt);
      }
    }
  }
  for (const o of G.worms) {
    if (o === w && curInp && !o.dead && G.phase !== 'settle' && G.phase !== 'over') continue;
    if (o.dead && o.sunk) continue;
    if (o.tool && o !== w) o.tool = null;
    physWorm(o, dt, false);
  }
  // a worm marked by the Hokuto Hyakuretsu Ken dies when its countdown ends
  for (const o of G.worms)
    if (o.doom > 0 && !o.dead) {
      o.doom -= dt;
      if (o.doom <= 0) doomBlast(o);
    }
  for (const p of G.projs) {
    updateProj(p, dt);
    if (!p.dead && p.y > G.waterY + 2) {
      p.dead = true;
      emit({ e: 'splash', x: p.x, y: G.waterY });
    }
    if (p.x < -400 || p.x > T.w + 400 || p.y > T.h + 200) p.dead = true;
  }
  G.projs = G.projs.filter(p => !p.dead);
  for (const f of G.fires) {
    f.life -= dt;
    if (!f.rest) {
      f.vy += GRAV * 0.7 * dt;
      const c = stepBody(f, dt);
      if (c && Math.hypot(f.vx, f.vy) < 40) {
        f.rest = true;
        f.vx = f.vy = 0;
      }
    } else if (!groundBelow(f.x, f.y, 1.5)) f.rest = false;
    if (f.y > G.waterY) f.life = 0;
    for (const o of G.worms)
      if (!o.dead && Math.abs(o.x - f.x) < 8 && Math.abs(o.y - f.y) < 9) {
        o.burn -= dt;
        if (o.burn <= 0) {
          o.burn = 0.3;
          hurt(o, 1, {});
        }
      }
    if (Math.random() < 0.15) emit({ e: 'trail', x: f.x, y: f.y, k: 'fire', q: 1 });
  }
  G.fires = G.fires.filter(f => f.life > 0);
  // Radiation (Nuclear Test): an infected worm loses RAD_DMG health every RAD_EVERY seconds for RAD_TIME seconds, never dying of it.
  for (const o of G.worms)
    if (o.rad > 0 && !o.dead) {
      o.rad -= dt;
      o.radT -= dt;
      if (o.radT <= 0) {
        o.radT += RAD_EVERY;
        const d = Math.min(RAD_DMG, o.hp - 1);
        if (d > 0) {
          // applied and announced at once (not held back until the turn settles), so the health visibly drops every tick
          o.hp -= d;
          emit({ e: 'dmg', x: o.x, y: o.y - 14, v: d, c: '#9f6' });
          emit({ e: 'snd', s: 'hurt', q: 1 });
        }
        emit({ e: 'rad', x: o.x, y: o.y });
      }
    }
  updateObjs(dt);
  // water motion
  if (G.waterY > G.waterTarget) G.waterY = Math.max(G.waterTarget, G.waterY - 14 * dt);
  // phase logic
  if (G.phase === 'settle') {
    G.settleT += dt;
    // quiet() normally decides when the turn may change; the 10 s limit is a safety net so a stray
    // object can never freeze the match.
    if (G.settleT > 1 && (quiet() || G.settleT > 10)) {
      G.settleQ += dt;
      if (G.settleQ > 0.5) {
        flushDamage();
        if (processDeaths()) {
          G.settleQ = 0;
          G.settleT = 1.2;
        } else {
          const alive = G.teams.filter(teamAlive);
          if (alive.length <= 1) endGame();
          else if (G.gap === 0) {
            G.gap = 0.5;
          }
        }
      }
    } else G.settleQ = 0;
    if (G.gap > 0) {
      G.gap -= dt;
      if (G.gap <= 0) {
        G.gap = 0;
        if (!G.over) startTurn();
      }
    }
    if (G.settleT > 22) {
      G.fires.length = 0;
      G.projs = G.projs.filter(p => PTYPES[p.t].passive);
      G.arma = 0;
      G.quake = 0;
      G.tsu = null;
      G.sched.length = 0;
    }
  }
}
