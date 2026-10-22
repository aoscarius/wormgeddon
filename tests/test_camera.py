"""Camera follows the action: impacts, flying worms of any team, projectiles; a manual view yields to action."""
from common import game_page, finish, BASE

JS = """([base]) => {
  const w = window.__wh, r = {};
  w.newGame(Object.assign({seed: 'cam'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
  const g = w.G, a = g.worms.find(x => x.id === g.active), foe = g.worms.find(x => x.team !== a.team);
  for (let i = 0; i < 120; i++) { w.stepOnce(1/60); camFocus(1/60); }
  CAM.z = 1.6;
  const run = n => { for (let i = 0; i < n; i++) { w.stepOnce(1/60); fxUpdate(1/60); camFocus(1/60); } };
  const far = (o) => Math.hypot(CAM.x - o.x, CAM.y - o.y);
  run(120); r.onActive = far(a);
  // 1) an impact far from the active worm pulls the camera there (turn phase, no projectile)
  const ix = a.x > T.w / 2 ? a.x - 700 : a.x + 700, iy = 400;
  applyEvent({e: 'x', x: ix, y: iy, r: 30, c: 0, k: 0}); run(90);
  r.toImpact = Math.hypot(CAM.x - ix, CAM.y - iy); r.impactDist = Math.hypot(a.x - ix, a.y - iy);
  // 2) it returns to the worm once the impact is old
  run(300); r.back = far(a);
  // 3) a foe sent flying is followed even though it is not the active worm
  foe.x = ix; foe.y = (surfaceAt(ix) || 500) - 60; foe.grounded = false; foe.vx = 0; foe.vy = -380; CAM.fx = null; run(30);
  r.toFoe = Math.hypot(CAM.x - foe.x, CAM.y - foe.y); r.foeDist = Math.hypot(a.x - foe.x, a.y - foe.y);
  // 4) a manual pan holds while nothing happens, and the action overrides it
  g.projs.length = 0; foe.vx = foe.vy = 0; run(400);
  UI.panT = Math.max(g.time, 0.001); CAM.x = 900; CAM.y = 300; run(10); r.pan = Math.abs(CAM.x - 900);
  applyEvent({e: 'x', x: ix, y: iy, r: 30, c: 0, k: 0}); run(60); r.override = UI.panT < 0;
  return r;
}"""

with game_page(viewport={"width": 900, "height": 600}) as (pg, errors):
    r = pg.evaluate(JS, [BASE]); print(r)
    assert r["toImpact"] < r["impactDist"] * 0.35, r
    assert r["back"] < r["onActive"] + 120, r
    assert r["toFoe"] < r["foeDist"] * 0.6, r
    assert r["pan"] < 30 and r["override"], r
    finish(errors)
