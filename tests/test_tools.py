"""Blowtorch: straight ahead, falls into holes; blowtorch and drill hurt the worms they touch."""
from common import game_page, finish, BASE

JS = """([base]) => {
  const w = window.__wh, r = {};
  const mk = () => { w.newGame(Object.assign({seed: 'tools'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
    for (let i = 0; i < 100; i++) w.stepOnce(1/60); const g = w.G;
    return [g, g.worms.find(x => x.id === g.active), g.worms.find(x => x.id !== g.active)]; };
  const run = (g, n) => { for (let i = 0; i < n; i++) { w.stepOnce(1/60); g.timer = 99; } };
  // 1) torch in open air: keeps its heading (x grows, one direction) and drops
  let [g, a, foe] = mk();
  a.x = T.w / 2; a.y = 40; a.vx = a.vy = 0; a.grounded = false; a.face = 1; a.aim = -0.8;
  a.tool = {k: 'torch', t: 5}; const x0 = a.x, y0 = a.y;
  run(g, 60); r.air = {dx: a.x - x0, dy: a.y - y0};
  // 2) torch hurts a worm in front, drill hurts a worm underneath
  [g, a, foe] = mk();
  a.face = 1; a.aim = 0; a.tool = {k: 'torch', t: 5}; foe.x = a.x + 14; foe.y = a.y; foe.vx = foe.vy = 0; foe.hp = 100;
  run(g, 40); r.torchHurt = 100 - foe.hp; r.attacker = a.hp;
  [g, a, foe] = mk();
  a.tool = {k: 'drill', t: 5}; foe.x = a.x; foe.y = a.y + 14; foe.vx = foe.vy = 0; foe.hp = 100;
  run(g, 40); r.drillHurt = 100 - foe.hp; r.attacker2 = a.hp;
  return r;
}"""

with game_page() as (pg, errors):
    r = pg.evaluate(JS, [BASE]); print(r)
    assert r["air"]["dx"] > 20 and r["air"]["dy"] > 60, "the torch keeps going forward and gravity pulls it down"
    assert r["torchHurt"] >= 4 and r["drillHurt"] >= 5, r
    assert r["attacker"] == 100 and r["attacker2"] == 100, "the user is not hurt"
    finish(errors)
