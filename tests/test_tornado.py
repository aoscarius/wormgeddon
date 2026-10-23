"""Tornado: really hurts worms in the funnel and lifts / flings mines and oil drums."""
from common import game_page, finish, BASE

JS = """([base]) => {
  const w = window.__wh;
  w.newGame(Object.assign({seed: 'tor'}, base, {mines: 0, drums: 0}), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
  const g = w.G, a = g.worms.find(x => x.id === g.active), foe = g.worms.find(x => x.team !== a.team);
  for (let i = 0; i < 100; i++) w.stepOnce(1/60);
  const x = T.w / 2, gy = surfaceAt(x);
  const tor = w.spawnProj('tornado', x, gy, 0, 0, a, {ow: a.id, face: 1});
  foe.x = x + 10; foe.y = gy - 10; foe.vx = foe.vy = 0; foe.hp = 100;
  const mine = w.spawnProj('mine', x - 20, gy - 6, 0, 0, null, {armed: true});
  const drum = {id: g.nid++, k: 'drum', x: x + 25, y: gy - 8, vx: 0, vy: 0, r: 7, lit: 0, bounce: 0, fric: 0.5};
  g.objs.push(drum);
  let minMine = mine.y, minDrum = drum.y, minFoe = foe.y;
  for (let i = 0; i < 240 && !tor.dead; i++) {
    w.stepOnce(1/60);
    minMine = Math.min(minMine, mine.y); minDrum = Math.min(minDrum, drum.y); minFoe = Math.min(minFoe, foe.y);
    if (g.phase !== 'turn') g.phase = 'turn';
  }
  return {gy, lostFoe: 100 - foe.hp, mineLift: gy - minMine, drumLift: gy - minDrum, foeLift: gy - minFoe, drumExploded: !g.objs.includes(drum)};
}"""

with game_page(viewport={"width": 1000, "height": 700}) as (pg, errors):
    r = pg.evaluate(JS, [BASE]); print(r)
    assert r["lostFoe"] >= 15, r
    assert r["mineLift"] > 40 and r["foeLift"] > 40, r
    assert r["drumLift"] > 40 or r["drumExploded"], r
    finish(errors)
