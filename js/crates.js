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
  'airstrike',
  'napalm',
  'minestrike',
  'donkey',
  'armageddon',
  'nuke',
  'scales',
  'dragonball',
];
/** Drops a crate (35% health, 40% weapon, 25% utility) at a random x above the map. */
function spawnCrate() {
  const x = 80 + Math.random() * (T.w - 160),
    r = Math.random();
  const type = r < 0.35 ? 'health' : r < 0.75 ? 'weapon' : 'util';
  const item = type === 'health' ? null : pick(type === 'weapon' ? CRATE_WEAP : CRATE_UTIL);
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
        // Any terrain contact counts as landing (a slope or wall must not keep the crate "falling"
        // forever, which would stall the turn change); a hard time limit is the last resort.
        if (c || o.age > 25) {
          o.landed = true;
          o.vy = 0;
        }
      } else if (!groundBelow(o.x, o.y, 6)) {
        o.landed = false;
      }
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
      if (!groundBelow(o.x, o.y, o.r)) {
        o.vy += GRAV * dt;
        const c = stepBody(o, dt);
        if (c) o.vx = 0;
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
