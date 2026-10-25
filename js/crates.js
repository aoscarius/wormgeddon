'use strict';

/**
 * @file crates.js - Crates & map objects
 *
 * Falling supply crates and oil drums: spawning, per-tick update and pickup.
 *
 * Depends on: core, combat
 * Globals defined: CRATE_UTIL, CRATE_WEAP, spawnCrate, updateObjs, collectCrate
 */

/* ===== Crates & objects ===== */
/** Items a utility crate can contain, and items a weapon crate can contain. */
const CRATE_UTIL = [
  'jetpack',
  'teleport',
  'rope',
  'girder',
  'blowtorch',
  'drill',
  'parachute',
  'select',
];
const CRATE_WEAP = [
  'homing',
  'mortar',
  'cluster',
  'banana',
  'holy',
  'dynamite',
  'mine',
  'sheep',
  'supersheep',
  'petrol',
  'uzi',
  'handgun',
  'bat',
  'kamikaze',
  'hokuto',
  'kamehameha',
  'onigiri',
  'proton',
  'airstrike',
  'napalm',
  'minestrike',
  'donkey',
  'armageddon',
  'nuke',
  'scales',
  'dragonball',
  'earthquake',
  'dragonfire',
  'thunder',
  'hammer',
  'timecar',
  'tornado',
  'tsunami',
];
/** Drops a crate (35% health, 40% weapon, 25% utility) at a random x above the map. */
function spawnCrate() {
  const x = 80 + Math.random() * (T.w - 160),
    r = Math.random();
  let type = r < 0.35 ? 'health' : r < 0.75 ? 'weapon' : 'util';
  // A restricted arsenal only drops its own weapons (and health when it has none to offer).
  const pool = (type === 'weapon' ? CRATE_WEAP : CRATE_UTIL).filter(id => arsenalHas(G.cfg.arsenal, id));
  if (!pool.length) type = 'health';
  const item = type === 'health' ? null : pick(pool);
  G.objs.push({
    id: G.nid++,
    k: 'crate',
    type,
    item,
    x,
    y: -60,
    vx: 0,
    vy: 40,
    r: 7,
    landed: false,
    bounce: 0,
    fric: 0.5,
  });
  emit({ e: 'msg', t: 'A crate is falling' });
}
/** Per-tick update of crates (parachute fall, pickup by the active worm) and oil drums (fall, fire ignition, explosion). */
function updateObjs(dt) {
  for (const o of G.objs) {
    if (o.k === 'crate') {
      if (!o.landed) {
        o.vy = Math.min(o.vy + 120 * dt, 90);
        o.vx *= 0.99;
        const c = stepBody(o, dt);
        o.age = (o.age || 0) + dt;
        // Progress watchdog: a crate that has not moved 1.5 px in half a second is wedged somewhere
        // (corner, crevice) and counts as landed so its parachute closes and the turn can go on.
        o.wt = (o.wt || 0) + dt;
        if (o.wt >= 0.5) {
          o.stuck = Math.hypot(o.x - (o.wx === undefined ? o.x : o.wx), o.y - (o.wy || o.y)) < 1.5;
          o.wx = o.x;
          o.wy = o.y;
          o.wt = 0;
        }
        // Any terrain contact (or being wedged, or a hard time limit) lands it.
        if (c || o.stuck || o.age > 25) {
          o.landed = true;
          o.vy = 0;
          o.vx = 0;
          o.air = 0;
          o.stuck = false;
        }
      } else if (!groundBelow(o.x, o.y, o.r + 1)) {
        // Landed but nothing under it (the ground was blown away): after a short grace period it
        // opens the parachute and falls again. The grace period stops the parachute flickering.
        o.air = (o.air || 0) + dt;
        if (o.air > 0.25) {
          o.landed = false;
          o.air = 0;
          o.age = 0;
          o.vy = 40;
        }
      } else o.air = 0;
      if (o.y > G.waterY + 4) o.kill = true;
      for (const w of G.worms)
        if (
          !w.dead &&
          Math.hypot(w.x - o.x, w.y - o.y) < 13 &&
          w.id === G.active &&
          (G.phase === 'turn' || G.phase === 'retreat')
        ) {
          collectCrate(w, o);
          o.kill = true;
          break;
        }
    } else if (o.k === 'drum') {
      // standing drums stay put; a falling one, or one lifted by a tornado (`air`), moves
      if (o.air > 0 || !groundBelow(o.x, o.y, o.r)) {
        o.air = Math.max(0, (o.air || 0) - dt);
        o.vy += GRAV * dt;
        const c = stepBody(o, dt);
        if (c) {
          if (c.speed > 280 && !o.lit) o.lit = 0.1; // a hard landing sets it off
          if (c.n[1] < -0.4) o.air = 0;
          o.vx *= 0.3;
        }
      }
      if (o.y > G.waterY + 4) o.kill = true;
      for (const f of G.fires)
        if (!o.lit && Math.abs(f.x - o.x) < 9 && Math.abs(f.y - o.y) < 10) {
          o.lit = 0.8;
          break;
        }
      if (o.lit) {
        o.lit -= dt;
        if (o.lit <= 0) {
          o.kill = true;
          explode(o.x, o.y, 36, 30, 240, { fire: 22, k: 1, noEnd: false });
        }
      }
    }
  }
  G.objs = G.objs.filter(o => !o.kill);
}
/** Gives the crate's contents to the worm's team (+30 health, or ammo for the item, unlocked immediately). */
function collectCrate(w, o) {
  const t = teamOf(w);
  if (o.type === 'health') {
    w.hp = Math.min(w.hp + 30, 300);
    emit({ e: 'msg', t: '{0} +30 health', a: [w.name] });
  } else {
    t.ammo[o.item] =
      t.ammo[o.item] < 0
        ? -1
        : (t.ammo[o.item] || 0) +
          (WEAPONS[o.item].ammo < 0 ? 1 : Math.max(1, Math.min(2, WEAPONS[o.item].ammo)));
    t.unl[o.item] = 1;
    emit({ e: 'msg', t: '{0} found {1}', a: [w.name], w: o.item });
  }
  emit({ e: 'snd', s: 'pick' });
}
