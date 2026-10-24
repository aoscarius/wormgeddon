"""Homing missile: a target point in empty sky next to a worm's head, or a worm itself, ends in an explosion (no endless circling)."""
from common import game_page, finish, BASE

JS = """([base, mode]) => {
  const w = window.__wh;
  w.newGame(Object.assign({seed: 'hom'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
  const g = w.G, a = g.worms.find(x => x.id === g.active), foe = g.worms.find(x => x.team !== a.team);
  for (let i = 0; i < 100; i++) w.stepOnce(1/60);
  const fx = foe.x, fy = foe.y, hp0 = foe.hp;
  const tgt = mode === 'sky' ? [fx + 4, 120] : [fx, fy];           // sky: a point in free sky (the head of a worm in the sky behaves the same)
  // start 70 px to the side of the target heading up: its turning circle is wider than that, so it would orbit
  const sx = tgt[0] + 70, sy = tgt[1];
  const p = w.spawnProj('homing', sx, sy, 0, -120, a, {tx: tgt[0], ty: tgt[1], ow: a.id});
  p.a = -Math.PI / 2;
  let exploded = 0; const old = window.emit; window.emit = e => { if (e.e === 'x') exploded++; return old(e); };
  let t = 0;
  while (t < 9 && !p.dead) { w.stepOnce(1/60); t += 1/60; g.timer = 99; }
  window.emit = old;
  return {t: +t.toFixed(2), exploded, hp: hp0 - foe.hp};
}"""

with game_page() as (pg, errors):
    for mode in ("sky", "worm"):
        r = pg.evaluate(JS, [BASE, mode]); print(mode, r)
        assert r["exploded"] >= 1 and r["t"] < 6, r
    finish(errors)
