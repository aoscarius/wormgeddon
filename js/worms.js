'use strict';

/**
 * @file worms.js - Worm physics & control
 *
 * Walking, jumping, falling, ninja rope, jet pack and digging tools for the active worm, plus
 * passive physics for every other worm.
 *
 * Depends on: core, collision, combat
 * Globals defined: TOOL_LOCKED, TOOL_ATOMIC, HYAKU_*, hyakuTick, kameTick, oniTick, ONI_*, doomBlast, walkStep, physBody, supported, physWorm, toolHurt, sinkWorm, ropePhys, controlWorm
 */

/* Generic grounded/airborne helper for walkers (worms, sheep) */
/**
 * Moves a walker (worm, sheep) horizontally by dx, climbing slopes of up to 5 px per step and
 * stepping down up to 8 px. Returns false if blocked by a wall; sets o.grounded = false when it
 * walks off a ledge.
 */
function walkStep(o, dx) {
  const nx = o.x + dx;
  for (let c = 0; c <= 6; c++) {
    if (!hitC(nx, o.y - c, o.r)) {
      o.x = nx;
      o.y -= c;
      let dn = 0;
      while (dn < 8 && !groundBelow(o.x, o.y, o.r)) {
        o.y += 1;
        dn++;
      }
      if (!groundBelow(o.x, o.y, o.r)) {
        o.grounded = false;
        o.vy = 0;
      }
      return true;
    }
  }
  return false;
}
/** Simple gravity + collision for walkers in the air; lands (grounded, vx = 0) on contact with a floor. */
function physBody(o, dt) {
  o.vy += GRAV * dt;
  const c = stepBody(o, dt);
  if (c && c.n[1] < -0.4 && o.vy > -40) {
    o.grounded = groundBelow(o.x, o.y, o.r);
    if (o.grounded) {
      o.vx = 0;
      o.vy = 0;
    }
  }
  return c;
}

/* ===== Worms ===== */
/**
 * Physics of one worm for one tick: sliding after knockback, falling, fall damage, parachute,
 * drowning and leaving the map sideways. Used for every worm; the active worm's own walking is
 * layered on top in controlWorm().
 * @param {boolean} active true for the worm being controlled (jet pack counts as no-fall-damage)
 */
/**
 * True when a worm is held up by the terrain: ground under its feet (groundBelow) or any solid
 * contact one pixel below its collision circle. The second test catches spikes and diagonal edges
 * that the circle touches but the three foot samples miss, which used to leave a worm "falling"
 * with zero velocity for ever.
 */
function supported(w) {
  return groundBelow(w.x, w.y, w.r) || hitC(w.x, w.y + 1, w.r);
}

function physWorm(w, dt, active) {
  if (w.rope) return ropePhys(w, dt, active);
  if (w.grounded) {
    if (!supported(w)) {
      w.grounded = false;
    } else if (Math.abs(w.vx) > 4) {
      walkStep(w, w.vx * dt);
      w.vx *= 0.9;
      if (hitC(w.x, w.y, w.r)) {
        const f = findFree(w.x, w.y - 1, w.r, 12);
        if (f) {
          w.x = f[0];
          w.y = f[1];
        }
      }
    } else w.vx = 0;
  }
  if (!w.grounded) {
    const jet = w.jet && active;
    w.vy += GRAV * dt;
    if (w.chute && w.vy > 70) w.vy = 70;
    if (w.chute && w.vx) w.vx *= 0.995;
    const c = stepBody(w, dt);
    if (c) {
      if (c.n[1] < -0.4) {
        if (c.speed > FALLV && !w.chute && !jet) {
          const dmg = Math.min(60, Math.round((c.speed - FALLV) / 7));
          hurt(w, dmg, { noEnd: false });
        }
        w.chute = false;
        if (w.vy > -90 || Math.abs(w.vy) < 110) {
          w.vx *= 0.4;
          w.vy = 0;
          w.grounded = supported(w);
        }
      } else if (c.speed > FALLV * 1.3) hurt(w, Math.round((c.speed - FALLV * 1.3) / 10));
    }
  }
  // Settle watchdog: a worm that is not grounded but is barely moving and has ground under it is
  // standing; one that has not made progress for 1.2 s (wedged in a crevice) is freed and grounded.
  if (!w.grounded && !w.rope && !w.jet && !w.tool && !w.dead) {
    if (supported(w) && Math.hypot(w.vx, w.vy) < 25) {
      w.grounded = true;
      w.vx = w.vy = 0;
    }
    w.wt = (w.wt || 0) + dt;
    if (w.wt >= 0.4) {
      const moved = Math.hypot(w.x - (w.wx === undefined ? w.x : w.wx), w.y - (w.wy || w.y));
      w.stuckN = moved < 1.5 ? (w.stuckN || 0) + 1 : 0;
      w.wx = w.x;
      w.wy = w.y;
      w.wt = 0;
      if (w.stuckN >= 3) {
        const f = findFree(w.x, w.y - 2, w.r, 30);
        if (f) {
          w.x = f[0];
          w.y = f[1];
        }
        w.grounded = true;
        w.vx = w.vy = 0;
        w.stuckN = 0;
      }
    }
  } else {
    w.stuckN = 0;
    w.wt = 0;
  }
  // Water and map edges: both kill the worm with a splash, a log line and a banner message.
  if (!w.sunk && w.y + w.r > G.waterY + 6) sinkWorm(w, '{0} drowned');
  else if (!w.sunk && !w.dead && (w.x < -40 || w.x > T.w + 40)) sinkWorm(w, '{0} fell off the map');
}
/**
 * Removes a worm that fell into the water or off the side of the map: splash at the nearest
 * point of the shore (clamped to the map so it is on screen), sound, log line and the usual
 * "died" banner, and the active worm's turn ends.
 * @param {string} text English log key with {0} = worm name
 */
function sinkWorm(w, text) {
  w.sunk = true;
  w.hp = 0;
  w.dead = true;
  w.rope = null;
  w.jet = null;
  w.tool = null;
  emit({ e: 'splash', x: clamp(w.x, 4, T.w - 4), y: G.waterY });
  emit({ e: 'log', t: text, a: [w.name], c: teamOf(w).color });
  emit({ e: 'msg', t: '{0} ({1}) died', a: [w.name, teamOf(w).name] });
  if (w.id === G.active && G.phase !== 'over') toSettle();
}
/** Pendulum physics for the ninja rope: gravity + swing input, then the worm is kept within the rope length. */
function ropePhys(w, dt, active) {
  const R = w.rope;
  w.grounded = false;
  w.vy += GRAV * dt;
  if (active && curInp) {
    if (curInp.l) {
      w.vx -= 330 * dt;
      w.face = -1;
    }
    if (curInp.r) {
      w.vx += 330 * dt;
      w.face = 1;
    }
    if (curInp.u) R.len = Math.max(24, R.len - 110 * dt);
    if (curInp.d) R.len = Math.min(320, R.len + 110 * dt);
  }
  w.vx *= 0.9985;
  stepBody(w, dt);
  let dx = w.x - R.ax,
    dy = w.y - R.ay,
    d = Math.hypot(dx, dy);
  if (d > R.len) {
    dx /= d;
    dy /= d;
    w.x = R.ax + dx * R.len;
    w.y = R.ay + dy * R.len;
    const vr = w.vx * dx + w.vy * dy;
    if (vr > 0) {
      w.vx -= vr * dx;
      w.vy -= vr * dy;
    }
  }
  if (w.y + w.r > G.waterY + 6) {
    w.rope = null;
  }
}
/**
 * Blowtorch / drill: every 0.25 s the other worms touching the tool's head (centre cx, cy, `reach` px) take
 * `dmg` damage and are shoved a little along `push` (-1, 0, 1). Damage never ends the user's turn.
 */
function toolHurt(w, tl, dt, cx, cy, reach, dmg, push) {
  tl.hc = (tl.hc || 0) - dt;
  if (tl.hc > 0) return;
  tl.hc = 0.25;
  for (const o of G.worms) {
    if (o.dead || o === w || Math.hypot(o.x - cx, o.y - cy) > reach) continue;
    hurt(o, dmg, { noEnd: true });
    o.vx += push * 70;
    o.grounded = false;
    o.vy = Math.min(o.vy, -40);
  }
}
/** Tools the player cannot stop with Space (they run their course), and those that must also outlast the turn clock. */
const TOOL_LOCKED = { kami: 1, hyaku: 1, oni: 1, kame: 1 };
const TOOL_ATOMIC = { hyaku: 1, oni: 1, kame: 1 };
/**
 * Hokuto Hyakuretsu Ken: reach of the barrage (px), its length and punch rate (s), damage per punch, dash speed (px/s),
 * how far past the victim the attacker ends (px), the dash when nobody was hit, the time between the last blow and the
 * victim's death (s), the lethal blast radius and how long the attacker stands after the voice line.
 */
const HYAKU_REACH = 34,
  HYAKU_TIME = 1.4,
  HYAKU_RATE = 0.07,
  HYAKU_DMG = 2,
  HYAKU_SPEED = 460,
  HYAKU_SAFE = 90,
  HYAKU_NOVIC = 120,
  HYAKU_FUSE = 3,
  HYAKU_BLAST = 48,
  HYAKU_SAY = 0.7;
/**
 * One tick of the Hokuto Hyakuretsu Ken. Phases (tl.ph, shown to guests as tl.p): 0 = gatling punches on the worm
 * right in front (picked on the first tick), 1 = dash past it to a safe distance (the victim is marked: `doom`),
 * 2 = the voice line. The tool ends by setting tl.t = 0.
 */
function hyakuTick(w, tl, dt) {
  tl.age = (tl.age || 0) + dt;
  if (tl.ph === undefined) {
    tl.ph = 0;
    tl.p = 0;
    tl.c = 0;
    tl.vic = null;
    let best = HYAKU_REACH + 1;
    for (const o of G.worms) {
      const rx = (o.x - w.x) * w.face;
      if (o.dead || o === w || Math.abs(o.y - w.y) > 18 || rx < -4 || rx > HYAKU_REACH) continue;
      if (rx < best) {
        best = rx;
        tl.vic = o.id;
      }
    }
  }
  const vic = tl.vic == null ? null : wById(tl.vic),
    live = vic && !vic.dead;
  if (tl.ph === 0) {
    physWorm(w, dt, false);
    tl.c += dt;
    while (tl.c >= HYAKU_RATE) {
      tl.c -= HYAKU_RATE;
      emit({ e: 'punch', x: w.x + w.face * rnd(10, 20), y: w.y - 2 + rnd(-7, 7), k: 'hyaku', f: w.face });
      if (live) hurt(vic, HYAKU_DMG, { src: w.id, noEnd: true });
    }
    if (live) vic.vx = 0;
    if (tl.age >= HYAKU_TIME) {
      tl.ph = 1;
      tl.p = 1;
      tl.d = Math.max(live ? (vic.x - w.x) * w.face + HYAKU_SAFE : HYAKU_NOVIC, 40);
      if (live) {
        vic.doom = HYAKU_FUSE;
        vic.doomBy = w.id;
      }
    }
  } else if (tl.ph === 1) {
    const step = Math.min(tl.d, HYAKU_SPEED * dt);
    let ok = true;
    if (w.grounded) {
      w.vx = 0;
      ok = walkStep(w, w.face * step);
    } else w.vx = w.face * HYAKU_SPEED;
    physWorm(w, dt, true);
    tl.d -= step;
    emit({ e: 'trail', x: w.x, y: w.y, k: 'smoke', q: 1 });
    if (tl.d <= 0.5 || !ok) {
      tl.ph = 2;
      tl.p = 2;
      tl.age = 0;
      w.vx = 0;
      emit({ e: 'snd', s: 'dead' });
      emit({ e: 'say', x: w.x, y: w.y - 24, t: tr('You\'re already dead!') });
    }
  } else {
    physWorm(w, dt, false);
    if (tl.age >= HYAKU_SAY) tl.t = 0;
  }
}
/**
 * Oni Giri: charge time (s), dash speed (px/s), how far ahead a worm counts as "in front" (px), how far past the last
 * worm the dash ends, the dash when nobody is in front, the slicing damage and how long the swords stay out afterwards.
 */
const ONI_CHARGE = 0.9,
  ONI_SPEED = 640,
  ONI_REACH = 260,
  ONI_SAFE = 60,
  ONI_NOVIC = 150,
  ONI_DMG = 38,
  ONI_SHEATH = 0.5;
/**
 * One tick of the Oni Giri. Phases (tl.ph, shown to guests as tl.p): 0 = three swords drawn, the worm gathers itself;
 * 1 = dash straight ahead through the worms on its level (each is sliced on the very tick the attacker passes through
 * it, once); 2 = swords lowered. The tool ends by setting tl.t = 0.
 */
function oniTick(w, tl, dt) {
  tl.age = (tl.age || 0) + dt;
  if (tl.ph === undefined) {
    tl.ph = 0;
    tl.p = 0;
    tl.cut = new Set();
    emit({ e: 'snd', s: 'draw' });
  }
  if (tl.ph === 0) {
    physWorm(w, dt, false);
    if (tl.age >= ONI_CHARGE) {
      let far = 0;
      for (const o of G.worms) {
        const rx = (o.x - w.x) * w.face;
        if (!o.dead && o !== w && Math.abs(o.y - w.y) <= 16 && rx > 0 && rx <= ONI_REACH) far = Math.max(far, rx);
      }
      tl.d = far ? far + ONI_SAFE : ONI_NOVIC;
      tl.ph = 1;
      tl.p = 1;
      emit({ e: 'snd', s: 'swoosh' });
    }
  } else if (tl.ph === 1) {
    const x0 = w.x,
      step = Math.min(tl.d, ONI_SPEED * dt);
    let ok = true;
    if (w.grounded) {
      w.vx = 0;
      ok = walkStep(w, w.face * step);
    } else w.vx = w.face * ONI_SPEED;
    physWorm(w, dt, true);
    tl.d -= step;
    for (const o of G.worms) {
      if (o.dead || o === w || tl.cut.has(o.id) || Math.abs(o.y - w.y) > 16) continue;
      if (((o.x - x0) * (o.x - w.x) <= 0 && (o.x - x0) * w.face > -7) || Math.abs(o.x - w.x) < 7) {
        tl.cut.add(o.id);
        hurt(o, ONI_DMG, { src: w.id, noEnd: true });
        emit({ e: 'slash', x: o.x, y: o.y - 2, f: w.face });
        o.vx += w.face * 140;
        o.vy -= 90;
        o.grounded = false;
      }
    }
    if (tl.d <= 0.5 || !ok) {
      tl.ph = 2;
      tl.p = 2;
      tl.age = 0;
      w.vx = 0;
    }
  } else {
    physWorm(w, dt, false);
    if (tl.age >= ONI_SHEATH) tl.t = 0;
  }
}
/**
 * One tick of the Kamehameha charge: the worm stands still while the energy ball grows (tl.p = 0..1, shown to guests);
 * when the charge is full the beam is released along the aim at that moment and the tool ends.
 */
function kameTick(w, tl, dt) {
  if (tl.age === undefined) {
    tl.age = 0;
    emit({ e: 'snd', s: 'charge' });
  }
  tl.age += dt;
  tl.p = +Math.min(1, tl.age / KAME_CHARGE).toFixed(2);
  physWorm(w, dt, false);
  if (tl.age >= KAME_CHARGE) {
    kameFire(w);
    tl.t = 0;
  }
}
/** The marked worm's time is up: a lethal explosion, and it dies on the spot. */
function doomBlast(o) {
  o.doom = 0;
  explode(o.x, o.y, HYAKU_BLAST, 60, 420, { k: 1, noEnd: true, src: o.doomBy });
  if (!o.dead) {
    o.pend = (o.pend || 0) + Math.max(0, o.hp);
    o.hp = 0;
  }
  processDeaths();
}
/**
 * Applies the active player's input to their worm for one tick, in priority order:
 * digging tools / kamikaze, jet pack, rope, then normal walking, jumping and aiming.
 * @param {object} inp input record (l, r, u, d, jump, back, fireP, ...)
 */
function controlWorm(w, inp, dt) {
  const retreat = G.phase === 'retreat';
  // tools (blowtorch / drill / kamikaze)
  // 1) Tools: blowtorch tunnels along the aim, drill digs down, kamikaze flies along the aim and explodes.
  if (w.tool) {
    const tl = w.tool;
    tl.t -= dt;
    const [dx, dy] = aimDir(w);
    if (inp.u) w.aim = clamp(w.aim - 1.2 * dt, -1.5, 1.5);
    if (inp.d) w.aim = clamp(w.aim + 1.2 * dt, -1.5, 1.5);
    if (tl.k === 'torch') {
      if (tl.dx === undefined) {
        tl.dx = dx; tl.dy = 0;
      }
      const tx = tl.dx, ty = tl.dy;
      tl.c = (tl.c || 0) + dt;
      if (tl.c > 0.04) {
        tl.c = 0;
        emit({ e: 'cv', x: w.x + tx * 11, y: w.y + ty * 11, r: 10, s: 0 });
      }
      // Always straight ahead; gravity keeps working, so a hole in the way makes the worm drop (still moving forward).
      const nx = w.x + tx * 38 * dt;
      if (!hitC(nx, w.y, w.r)) w.x = nx;
      w.grounded = false;
      w.vx = 0;
      physWorm(w, dt, true);
      toolHurt(w, tl, dt, w.x + tx * 12, w.y, 14, 4, tx);
    } else if (tl.k === 'drill') {
      tl.c = (tl.c || 0) + dt;
      if (tl.c > 0.03) {
        tl.c = 0;
        emit({ e: 'cv', x: w.x, y: w.y + 9, r: 10, s: 0 });
      }
      w.grounded = false;
      physWorm(w, dt, true);
      if (w.vy > 70) w.vy = 70;
      toolHurt(w, tl, dt, w.x, w.y + 10, 14, 5, 0);
    } else if (tl.k === 'kami') {
      w.vx = dx * 320;
      w.vy = dy * 320;
      w.grounded = false;
      const c = stepBody(w, dt);
      if (Math.random() < 0.6) emit({ e: 'trail', x: w.x, y: w.y, k: 'fire', q: 1 });
      if (c || tl.t <= 0) {
        w.tool = null;
        explode(w.x, w.y, 42, 50, 380, { k: 1, noEnd: true, src: w.id });
        hurt(w, 25, { noEnd: true });
        w.vx *= 0.2;
        toSettle();
      }
    } else if (tl.k === 'hyaku') hyakuTick(w, tl, dt);
    else if (tl.k === 'kame') kameTick(w, tl, dt);
    else if (tl.k === 'oni') oniTick(w, tl, dt);
    if (inp.fireP && !TOOL_LOCKED[tl.k]) {
      tl.t = 0;
      inp.fireP = 0;
    }
    if (tl.t <= 0 && w.tool) {
      w.tool = null;
      if (G.phase === 'turn') {
        G.phase = 'retreat';
        G.timer = 3;
      }
    }
    return;
  }
  // 2) Jet pack: Up = thrust, Left/Right = sideways, limited fuel.
  if (w.jet) {
    const j = w.jet;
    let thrust = false;
    if (inp.u && j.fuel > 0) {
      w.vy -= 1000 * dt;
      j.fuel -= 24 * dt;
      thrust = true;
    }
    if (inp.l && j.fuel > 0) {
      w.vx -= 650 * dt;
      w.face = -1;
      j.fuel -= 12 * dt;
      thrust = true;
    }
    if (inp.r && j.fuse !== 1 && j.fuel > 0) {
      w.vx += 650 * dt;
      w.face = 1;
      j.fuel -= 12 * dt;
      thrust = true;
    }
    w.vx = clamp(w.vx, -230, 230);
    w.vy = Math.max(w.vy, -230);
    w.grounded = false;
    j.on = thrust;
    if (thrust && Math.random() < 0.7)
      emit({ e: 'trail', x: w.x - 0, y: w.y + 7, k: 'fire', q: 1 });
    physWorm(w, dt, true);
    if (inp.fireP || j.fuel <= 0) {
      w.jet = null;
      inp.fireP = 0;
    }
    // Jump / back-flip do nothing in flight; drop them so they do not fire after landing.
    inp.jump = 0;
    inp.back = 0;
    return;
  }
  // 3) Ninja rope: Enter/Backspace lets go.
  if (w.rope) {
    if (inp.u === undefined) {
    }
    if (inp.jump) {
      w.rope = null;
      w.vy -= 80;
      inp.jump = 0;
    } else if (inp.back) {
      w.rope = null;
      inp.back = 0;
    }
    physWorm(w, dt, true);
    return;
  }
  // regular walking & aiming
  if (inp.u) w.aim = clamp(w.aim - 1.5 * dt, -1.5, 1.5);
  if (inp.d) w.aim = clamp(w.aim + 1.5 * dt, -1.5, 1.5);
  const charging = G.weapon.ch;
  if (w.grounded && !charging) {
    if (inp.l) {
      w.face = -1;
      walkStep(w, -52 * dt);
    } else if (inp.r) {
      w.face = 1;
      walkStep(w, 52 * dt);
    }
    if (inp.jump) {
      w.grounded = false;
      w.vy = -285;
      w.vx = w.face * 92;
      inp.jump = 0;
      emit({ e: 'snd', s: 'jump', q: 1 });
    } else if (inp.back) {
      w.grounded = false;
      w.vy = -400;
      w.vx = -w.face * 36;
      inp.back = 0;
      emit({ e: 'snd', s: 'jump', q: 1 });
    }
  }
  inp.jump = 0;
  inp.back = 0;
  physWorm(w, dt, true);
}
