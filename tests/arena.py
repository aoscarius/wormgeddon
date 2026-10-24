"""Shared JS helper for tests that need a predictable battlefield (import ARENA_JS and put it in front of the test's JS).

`arena(floorY)` empties the level and adds a flat floor (the solidity mask is the only thing physics reads), and
clears projectiles / flames / objects / scheduled actions. `stand(worm, x)` parks a worm on that floor."""

ARENA_JS = """
const arena = (floor = 700) => {
  T.mask.fill(0);
  T.mask.fill(1, floor * T.w);
  if (T.ctx) { T.ctx.clearRect(0, 0, T.w, T.h); T.ctx.fillStyle = '#6a4'; T.ctx.fillRect(0, floor, T.w, T.h - floor); }
  G.projs.length = 0; G.fires.length = 0; G.objs.length = 0; G.sched.length = 0;
  window.__floor = floor;
};
const stand = (o, x) => { o.x = x; o.y = window.__floor - o.r - 1; o.vx = o.vy = 0; o.grounded = true; return o; };
"""
