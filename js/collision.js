'use strict';

/**
 * @file collision.js - Collision & body physics
 *
 * Circle-vs-terrain collision, surface normals and the sub-stepped body integrator used by
 * projectiles, worms, crates and fire.
 *
 * Depends on: terrain
 * Globals defined: RING, hitC, normalAt, stepBody, findFree, groundBelow
 */

/* ===== Collision helpers ===== */
/** Eight unit vectors around a circle; hitC samples the terrain at these points. */
const RING = [];
for (let i = 0; i < 8; i++) RING.push([Math.cos((i * TAU) / 8), Math.sin((i * TAU) / 8)]);
/** True if a circle of radius r at (x, y) touches solid ground (centre + 8 perimeter samples). */
function hitC(x, y, r) {
  if (solid(x, y)) return true;
  for (let i = 0; i < 8; i++) if (solid(x + RING[i][0] * r, y + RING[i][1] * r)) return true;
  return false;
}
/**
 * Estimates the terrain surface normal near (x, y) by summing directions away from solid pixels
 * in a 7x7 window. Returns a unit vector pointing out of the ground ([0, -1] if none found).
 */
function normalAt(x, y) {
  let nx = 0,
    ny = 0;
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++)
      if (solid(x + dx, y + dy)) {
        nx -= dx;
        ny -= dy;
      }
  const l = Math.hypot(nx, ny);
  return l ? [nx / l, ny / l] : [0, -1];
}
/**
 * Moves a body for dt seconds, sub-stepping in <= 2 px increments so fast bodies cannot tunnel
 * through thin terrain.
 *
 *  - A body that starts embedded in the ground (a crater edge, girder or new terrain on top of
 *    it) is first pushed out to the nearest free spot, so nothing can stay wedged for ever.
 *  - On the first contact against the surface the velocity is reflected using the body's `bounce`
 *    (restitution) and `fric` (tangential damping) and the remaining sub-steps continue with the
 *    new velocity, so bodies slide off walls and out of corners instead of freezing.
 *  - A step that is blocked without moving into the surface (grazing a corner) is resolved by
 *    trying each axis on its own, which slides along the wall.
 *
 * @param {{x,y,vx,vy,r,bounce?,fric?}} b body, mutated in place
 * @returns {{n: number[], speed: number}|null} surface normal and impact speed of the first
 *     contact, or null if the body moved freely
 */
function stepBody(b, dt) {
  if (hitC(b.x, b.y, b.r)) {
    const f = findFree(b.x, b.y, b.r, 40);
    if (f) {
      b.x = f[0];
      b.y = f[1];
    } else {
      // buried deeper than we can search: move freely so the body can dig itself out
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      return null;
    }
  }
  const sp = Math.hypot(b.vx, b.vy) * dt,
    n = Math.max(1, Math.ceil(sp / 2));
  let sx = (b.vx * dt) / n,
    sy = (b.vy * dt) / n,
    res = null;
  for (let i = 0; i < n; i++) {
    const nx = b.x + sx,
      ny = b.y + sy;
    if (!hitC(nx, ny, b.r)) {
      b.x = nx;
      b.y = ny;
      continue;
    }
    const N = normalAt(nx, ny),
      vn = b.vx * N[0] + b.vy * N[1];
    if (vn < 0) {
      const e = 1 + (b.bounce || 0);
      b.vx -= e * vn * N[0];
      b.vy -= e * vn * N[1];
      const f = b.fric == null ? 0.85 : b.fric;
      const tx = -N[1],
        ty = N[0],
        vt = b.vx * tx + b.vy * ty;
      b.vx -= vt * (1 - f) * tx;
      b.vy -= vt * (1 - f) * ty;
      if (res) break; // second contact in the same tick: stop here
      res = { n: N, speed: -vn };
      sx = (b.vx * dt) / n;
      sy = (b.vy * dt) / n;
      continue;
    }
    // Blocked while not moving into the surface (corner graze): slide along one axis.
    if (!hitC(nx, b.y, b.r)) b.x = nx;
    else if (!hitC(b.x, ny, b.r)) b.y = ny;
    else {
      res = res || { n: N, speed: 0 };
      break;
    }
  }
  return res;
}
/** Spirals outwards from (x, y) to find the nearest spot where a circle of radius r fits. */
function findFree(x, y, r, maxR = 80) {
  if (!hitC(x, y, r)) return [x, y];
  for (let d = 2; d < maxR; d += 2)
    for (let a = 0; a < 16; a++) {
      const px = x + Math.cos((a * TAU) / 16) * d,
        py = y + Math.sin((a * TAU) / 16) * d;
      if (!hitC(px, py, r)) return [px, py];
    }
  return null;
}
/** True if there is ground just under a body's feet (checked at three x offsets). */
const groundBelow = (x, y, r) =>
  solid(x, y + r + 1.5) || solid(x - 3, y + r + 1.5) || solid(x + 3, y + r + 1.5);
