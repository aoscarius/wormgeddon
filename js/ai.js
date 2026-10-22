'use strict';

/**
 * @file ai.js - Bot AI
 *
 * Simple artillery bot: picks a target, optionally walks closer, brute-force simulates shots to
 * choose weapon/angle/power, then 'presses keys' through a normal input record.
 *
 * Depends on: core, weapons
 * Globals defined: AI_SHOTS, simShot, aiBegin, aiPlan, aiTick
 */

/** Projectile weapons the bot can aim: physics must mirror the real projectile types (gravity factor g, wind factor). */
const AI_SHOTS = [
  { id: 'bazooka', type: 'rocket', lo: 140, hi: 800, g: 0.3, wind: 1 },
  { id: 'mortar', type: 'mortar', lo: 150, hi: 780, g: 0.55, wind: 1 },
  { id: 'grenade', type: 'grenade', lo: 60, hi: 640, g: 1, wind: 0, fuse: 3 },
  { id: 'cluster', type: 'cluster', lo: 60, hi: 620, g: 1, wind: 0, fuse: 3 },
];
/**
 * Simulates a shot for a given aim angle and power and returns where it first hits the ground or
 * water. The bot calls this for many angle/power pairs and keeps the closest one.
 */
function simShot(w, face, aim, power, s) {
  const sp = s.lo + (s.hi - s.lo) * power,
    dt = 1 / 30;
  let x = w.x + face * Math.cos(aim) * 10,
    y = w.y - 2 + Math.sin(aim) * 10,
    vx = face * Math.cos(aim) * sp,
    vy = Math.sin(aim) * sp;
  for (let i = 0; i < 400; i++) {
    vy += GRAV * s.g * dt;
    vx += G.wind * WIND_ACC * s.wind * dt;
    x += vx * dt;
    y += vy * dt;
    if (solid(x, y) || y > G.waterY) return [x, y];
    if (x < -100 || x > T.w + 100) return [x, y];
  }
  return [x, y];
}
/** Starts a bot turn: it thinks for about a second before acting. */
function aiBegin(w) {
  const t = teamOf(w);
  t.aiInp = t.aiInp || makeInp();
  t.ai = {
    st: 'think',
    t: 0.9 + Math.random() * 0.8,
    plan: null,
    moved: 0,
    mt: 0,
    flee: Math.random() < 0.5 ? -1 : 1,
  };
}
/**
 * Chooses target and weapon. Priorities: punch when adjacent, shotgun when level and close,
 * air strike on far targets (sometimes), otherwise brute-force the best bazooka/mortar/grenade/
 * cluster shot. If even the best shot is poor it walks towards the target first.
 */
function aiPlan(w, t) {
  const foes = G.worms.filter(o => !o.dead && o.team !== w.team);
  if (!foes.length) return null;
  foes.sort((a, b) => Math.hypot(a.x - w.x, a.y - w.y) - Math.hypot(b.x - w.x, b.y - w.y));
  const tg = Math.random() < 0.7 ? foes[0] : foes[Math.min(foes.length - 1, 1)],
    face = tg.x >= w.x ? 1 : -1,
    dist = Math.hypot(tg.x - w.x, tg.y - w.y);
  const plan = { tg, face, move: 0, weapon: 'bazooka', aim: -0.5, power: 0.6, err: 999 };
  if (dist < 26 && avail(t, 'firepunch')) {
    plan.weapon = 'firepunch';
    plan.aim = -0.3;
    plan.err = 0;
    return plan;
  }
  if (dist < 260 && Math.abs(tg.y - w.y) < 40 && avail(t, 'shotgun') && Math.random() < 0.45) {
    plan.weapon = 'shotgun';
    plan.aim = Math.atan2(tg.y - w.y, Math.abs(tg.x - w.x));
    plan.err = 0;
    return plan;
  }
  if (dist > 220 && avail(t, 'airstrike') && Math.random() < 0.5) {
    plan.weapon = 'airstrike';
    plan.click = { x: tg.x, y: tg.y };
    plan.err = 0;
    return plan;
  }
  // Sky weapons: click on the target; the earthquake needs no target at all.
  if (dist > 130 && Math.random() < 0.35) {
    const sky = ['thunder', 'dragonfire', 'tornado', 'hammer'].filter(id => avail(t, id));
    if (sky.length) {
      plan.weapon = pick(sky);
      plan.click = { x: tg.x, y: tg.y };
      plan.err = 0;
      return plan;
    }
  }
  // Tsunami: the shore is wiped out, so only when the bot stands well inland.
  if (avail(t, 'tsunami') && w.x > T.w * 0.4 && w.x < T.w * 0.6 && Math.random() < 0.25) {
    plan.weapon = 'tsunami';
    plan.err = 0;
    return plan;
  }
  if (avail(t, 'earthquake') && Math.random() < 0.2) {
    plan.weapon = 'earthquake';
    plan.err = 0;
    return plan;
  }
  let best = null;
  for (const s of AI_SHOTS) {
    if (!avail(t, s.id)) continue;
    for (let a = -1.4; a <= 1.4; a += 0.06)
      for (let p = 0.15; p <= 1.001; p += 0.07) {
        const [ix, iy] = simShot(w, face, a, p, s),
          e = Math.hypot(ix - tg.x, iy - tg.y),
          self = Math.hypot(ix - w.x, iy - w.y);
        if (self < 55) continue;
        const score =
          e + (s.id === 'grenade' || s.id === 'cluster' ? 30 : 0) - (s.id === 'mortar' ? 10 : 0);
        if (!best || score < best.err)
          best = { err: score, weapon: s.id, aim: a, power: p, fuse: s.fuse };
      }
  }
  if (best) Object.assign(plan, best);
  if (plan.err > 70 && !(t.ai && t.ai.moved)) plan.move = clamp(tg.x - w.x, -220, 220) * 0.7;
  return plan;
}
/**
 * Runs the bot as a small state machine that produces ordinary input (as if keys were pressed):
 * think -> (move) -> aim -> fire -> done, then it runs away during the retreat phase.
 */
function aiTick(t, dt) {
  const w = activeWorm(),
    inp = t.aiInp,
    ai = t.ai;
  if (!w || !ai) return;
  inp.l = inp.r = inp.u = inp.d = 0;
  if (G.phase === 'retreat') {
    inp.l = ai.flee < 0 ? 1 : 0;
    inp.r = ai.flee > 0 ? 1 : 0;
    if (w.grounded && Math.random() < 0.01) inp.jump = 1;
    inp.fire = 0;
    return;
  }
  if (G.phase !== 'turn') {
    inp.fire = 0;
    return;
  }
  ai.t -= dt;
  if (ai.st === 'think') {
    if (ai.t > 0) return;
    const p = aiPlan(w, t);
    if (!p) {
      ai.st = 'skip';
      return;
    }
    ai.plan = p;
    if (p.move && Math.abs(p.move) > 20) {
      ai.st = 'move';
      ai.mx = w.x + p.move;
      ai.mt = 2.2;
      ai.moved = 1;
    } else ai.st = 'aim';
  } else if (ai.st === 'move') {
    ai.mt -= dt;
    const dx = ai.mx - w.x;
    if (Math.abs(dx) < 5 || ai.mt <= 0) {
      ai.st = 'think';
      ai.t = 0.4;
      return;
    }
    if (dx < 0) inp.l = 1;
    else inp.r = 1;
    if (w.grounded && Math.random() < 0.02) inp.jump = 1;
  } else if (ai.st === 'aim') {
    const p = ai.plan;
    ai.aT = (ai.aT || 0) + dt;
    if (ai.aT > 5) {
      // Could not reach the planned angle in time: shoot with what we have.
      ai.st = 'fire';
      ai.t = 0;
      return;
    }
    w.face = p.face;
    if (!ai.sel) {
      selectWeapon(t.id, p.weapon, p.fuse);
      ai.sel = 1;
      ai.t = 0.5;
      return;
    }
    if (ai.t > 0) return;
    const df = p.aim - w.aim;
    if (Math.abs(df) < 0.04) {
      ai.st = 'fire';
      ai.t = 0.3;
      w.aim = p.aim + (Math.random() - 0.5) * 0.05;
    } else if (df < 0) inp.u = 1;
    else inp.d = 1;
  } else if (ai.st === 'fire') {
    if (ai.t > 0) return;
    const p = ai.plan,
      d = WEAPONS[p.weapon];
    if (p.click) {
      inp.clicks.push({ x: p.click.x, y: p.click.y });
      ai.st = 'done';
      return;
    }
    if (d.charge) {
      if (!ai.ch) {
        inp.fire = 1;
        inp.fireP = 1;
        ai.ch = 1;
      } else if (G.weapon.pw >= p.power * (0.97 + Math.random() * 0.06)) {
        inp.fire = 0;
        ai.st = 'done';
      } else inp.fire = 1;
    } else {
      inp.fire = 1;
      inp.fireP = 1;
      ai.st = 'done';
    }
  } else if (ai.st === 'skip') {
    selectWeapon(t.id, 'skip');
    inp.fireP = 1;
    ai.st = 'done';
  } else if (ai.st === 'done') {
    inp.fire = 0;
    ai.dT = (ai.dT || 0) + dt;
    const cur = WEAPONS[G.weapon.id];
    if (cur && cur.shots && G.weapon.shots > 0 && G.weapon.shots < cur.shots) {
      // A multi-shot weapon (shotgun) is not finished after the first shot: take the next one.
      ai.st = 'fire';
      ai.t = 0.45;
      ai.dT = 0;
    } else if (ai.dT > 1.5) {
      // Watchdog: the shot did not happen (weapon not selectable, shot cancelled ...). Re-plan up to
      // twice, then give up the turn instead of idling until the timer runs out.
      ai.retry = (ai.retry || 0) + 1;
      ai.dT = 0;
      if (ai.retry <= 2) {
        ai.st = 'think';
        ai.t = 0.2;
        ai.sel = 0;
        ai.ch = 0;
        ai.moved = 1;
      } else ai.st = 'skip';
    }
  }
}
