'use strict';

/**
 * @file combat.js - Damage & explosions
 *
 * hurt() applies damage; explode() carves terrain, damages and launches worms, triggers
 * mines/drums and spawns fire.
 *
 * Depends on: core
 * Globals defined: CLONE_N, CLONE_LIFE, findSpot, cloneOrphan, cloneSwap, spawnClone, clonePoof, hurt, explode
 */

/* ===== Shadow clones ===== */
/** Shadow Clone Jutsu: how many clones one cast makes, and how long (s) they last if nobody attacks them. */
const CLONE_N = 10,
  CLONE_LIFE = 300;
/**
 * A standing spot anywhere on the map for a spawned body: a random point in the air is dropped onto the first ground
 * below it (caves and lower tiers included); it needs firm footing, headroom and `gap` px to every point in `taken`.
 * Returns [x, y], or null when nothing fits.
 */
function findSpot(taken, gap) {
  const limit = T.waterBase - 40;
  for (let a = 0; a < 800; a++) {
    const x = 50 + Math.random() * (T.w - 100),
      y0 = 20 + Math.random() * (limit - 20);
    if (hitC(x, y0, 8)) continue;
    let y = y0;
    while (y < limit && !hitC(x, y + 2, 8)) y += 2;
    if (y >= limit) continue;
    if (!solid(x - 9, y + 10) || !solid(x + 9, y + 10)) continue;
    if (hitC(x, y - 14, 8)) continue;
    if (taken.some(s => Math.hypot(s[0] - x, s[1] - y) < gap)) continue;
    return [x, y];
  }
  return null;
}
/**
 * Adds a shadow clone of worm `o` at (x, y): a worm of the same team and name that is not in the team roster (so it
 * never takes a turn and does not count for the team being alive), always shows full health and vanishes in a poof
 * of smoke the moment anything hurts it, or after CLONE_LIFE s.
 */
function spawnClone(o, x, y) {
  const w = {
    id: G.nid++,
    team: o.team,
    name: o.name,
    x,
    y,
    vx: 0,
    vy: 0,
    r: WORM_R,
    hp: G.cfg.hp,
    face: Math.random() < 0.5 ? 1 : -1,
    aim: -0.3,
    grounded: false,
    dead: false,
    pend: 0,
    bounce: 0.2,
    fric: 0.6,
    rope: null,
    jet: null,
    tool: null,
    chute: false,
    burn: 0,
    clone: true,
    owner: o.id,
    life: CLONE_LIFE,
  };
  G.worms.push(w);
  emit({ e: 'poof', x, y: y - 4 });
  return w;
}
/** True when the worm that made clone `c` is dead (or gone): the clone cannot outlive it. */
function cloneOrphan(c) {
  const o = wById(c.owner);
  return !o || o.dead;
}
/**
 * Called when a turn is over: a worm that used Shadow Clone Jutsu swaps places with one of its living clones, picked at
 * random (nothing happens when none is left), so nobody knows which one is the original.
 */
function cloneSwap(w) {
  if (!w || w.dead || !w.clonist) return;
  const cs = G.worms.filter(c => c.clone && !c.dead && c.owner === w.id);
  if (!cs.length) return;
  const c = cs[(Math.random() * cs.length) | 0],
    x = w.x,
    y = w.y;
  emit({ e: 'poof', x, y: y - 4 });
  emit({ e: 'poof', x: c.x, y: c.y - 4 });
  w.x = c.x;
  w.y = c.y;
  c.x = x;
  c.y = y;
  w.vx = w.vy = c.vx = c.vy = 0;
  w.grounded = c.grounded = false;
  w.rope = null;
  w.jet = null;
  [w.face, c.face] = [c.face, w.face];
}
/**
 * A clone vanishes. When an enemy worm that is taking its turn is the one who hit it (`src` = its id), the strike is
 * intercepted and that worm's turn is over: the shot is wasted.
 */
function clonePoof(w, src) {
  if (w.dead) return;
  w.dead = true;
  w.gone = true;
  emit({ e: 'poof', x: w.x, y: w.y - 4 });
  const a = src == null ? null : wById(src);
  if (a && !a.dead && a.team !== w.team && a.id === G.active && (G.phase === 'turn' || G.phase === 'retreat')) {
    emit({ e: 'msg', t: 'It was a shadow clone!' });
    G.fired = true;
    toSettle();
  }
}

/* ===== Damage & explosions ===== */
/**
 * Applies damage to a worm. Damage taken during your own turn ends that turn (unless
 * o.noEnd), and is collected in w.pend to be shown as one number when the turn settles.
 */
function hurt(w, amt, o = {}) {
  if (w.dead || amt <= 0) return;
  if (w.clone) {
    clonePoof(w, o.src);
    return;
  }
  if (btShield(w)) {
    emit({ e: 'btdefl', x: w.x, y: w.y - 4 });
    return;
  }
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
    if (btShield(w)) {
      emit({ e: 'btdefl', x: w.x, y: w.y - 4 });
      continue;
    }
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
