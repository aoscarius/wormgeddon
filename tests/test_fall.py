"""Fall damage: ordinary jumps and back-flips never hurt; a long drop still does."""
from common import game_page, finish, BASE

JS = """([base]) => {
  const w = window.__wh, r = {};
  w.newGame(Object.assign({seed: 'fall'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
  const g = w.G, a = g.worms.find(x => x.id === g.active);
  for (let i = 0; i < 120; i++) w.stepOnce(1/60);
  const trial = (vx, vy, lift) => {
    const sy = surfaceAt(a.x, 0); a.y = sy - 8 - lift; a.vx = vx; a.vy = vy; a.grounded = lift > 0 ? false : true;
    a.dead = false; a.hp = 100; a.pend = 0; g.timer = 99;
    if (lift === 0) { a.grounded = false; }
    for (let i = 0; i < 240; i++) { w.stepOnce(1/60); if (a.grounded && i > 20) break; }
    return 100 - a.hp;
  };
  r.jump = trial(90, -285, 0);
  r.flip = trial(-60, -400, 0);
  r.fall150 = trial(0, 0, 150);
  r.fall260 = trial(0, 0, 260);
  return r;
}"""

with game_page() as (pg, errors):
    r = pg.evaluate(JS, [BASE]); print(r)
    assert r["jump"] == 0 and r["flip"] == 0 and r["fall150"] == 0, r
    assert r["fall260"] > 5, r
    finish(errors)
