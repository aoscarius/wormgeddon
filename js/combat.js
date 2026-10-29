'use strict';

/**
 * @file combat.js - Damage & explosions
 *
 * hurt() applies damage; explode() carves terrain, damages and launches worms, triggers
 * mines/drums and spawns fire.
 *
 * Depends on: core
 * Globals defined: hurt, explode
 */

/* ===== Damage & explosions ===== */
/**
 * Applies damage to a worm. Damage taken during your own turn ends that turn (unless
 * o.noEnd), and is collected in w.pend to be shown as one number when the turn settles.
 */
function hurt(w, amt, o = {}) {
  if (w.dead || amt <= 0) return;
  w.hp -= amt;
  w.pend += amt;
  if (w.id === G.active && (G.phase === 'turn' || G.phase === 'retreat') && !o.noEnd) toSettle();
  emit({ e: 'snd', s: 'hurt', q: 1 });
}
/**
 * Central explosion routine.
 *
 * Emits an 'x' event (which carves the crater and plays effects), damages and launches every
 * worm in range (linear falloff to r + 14 px), sets off mines and oil drums, nudges loose
 * projectiles and optionally sprays burning fuel.
 *
 * @param {number} r crater radius;  dmg  damage at the centre;  push  knockback speed at the centre
 * @param {{k?: number, fire?: number, noCarve?: boolean, noEnd?: boolean, src?: number}} o
 *        k: effect style (1 = big flash), fire: number of flames to spawn, src: shooter worm id
 */
function explode(x, y, r, dmg, push, o = {}) {
  emit({ e: 'x', x, y, r, c: o.noCarve ? 0 : 1, k: o.k || 0 });
  const reach = r + 14;
  for (const w of G.worms) {
    if (w.dead && w.y > G.waterY) continue;
    const dx = w.x - x,
      dy = w.y - y - 2,
      d = Math.hypot(dx, dy);
    if (d >= reach) continue;
    const f = 1 - d / reach;
    const ux = d > 0.5 ? dx / d : 0,
      uy = d > 0.5 ? dy / d : -1;
    if (!w.dead) hurt(w, Math.round(dmg * f), o);
    const P = push * f;
    w.vx += ux * P;
    w.vy += uy * P - 40 * f;
    w.grounded = false;
    w.rope = null;
    if (P > 120) {
      w.tool = null;
      w.jet = null;
    }
  }
  for (const p of G.projs) {
    const dx = p.x - x,
      dy = p.y - y,
      d = Math.hypot(dx, dy);
    if (d >= reach) continue;
    const dd = PTYPES[p.t];
    if (dd.mine && p.fuse == null) {
      p.fuse = 0.15 + Math.random() * 0.5;
      p.trig = true;
    } else if (dd.passive || dd.ctl) continue;
    else {
      const f = 1 - d / reach;
      p.vx += (d > 0.5 ? dx / d : 0) * push * f * 0.7;
      p.vy += (d > 0.5 ? dy / d : -1) * push * f * 0.7 - 30;
    }
  }
  for (const ob of G.objs) {
    const d = Math.hypot(ob.x - x, ob.y - y);
    if (d >= reach) continue;
    if (ob.k === 'drum' && !ob.lit) ob.lit = 0.5 + Math.random() * 0.4;
    else if (ob.k === 'crate' && ob.type !== 'health' && d < r * 0.7) ob.kill = true;
  }
  if (o.fire)
    for (let i = 0; i < o.fire; i++) spawnFire(x, y - 4, rnd(-170, 170), rnd(-260, -60), rnd(3, 6));
}
