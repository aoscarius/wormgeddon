"""Tsunami: from a random side, wipes out the coast on that side and spares the middle of the map."""
from common import game_page, finish, BASE

JS = """([rnd]) => {
  const w = window.__wh;
  w.newGame(Object.assign({seed: 'tsu'}, %s), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
  const g = w.G; for (let i = 0; i < 120; i++) w.stepOnce(1/60);
  const a = g.worms.find(x => x.id === g.active);
  const others = g.worms.filter(x => x !== a);
  // a: middle of the map; two others near the left and the right coast, the rest far inland
  const put = (o, x) => { const y = surfaceAt(x); o.x = x; o.y = (y == null ? 300 : y) - 10; o.vx = o.vy = 0; o.grounded = true; return y != null; };
  const ok = [put(a, T.w / 2), put(others[0], 160), put(others[1], T.w - 160)];
  for (let i = 0; i < 5; i++) w.stepOnce(1/60);
  const left = others[0], right = others[1], mid = a;
  g.weapon.id = 'tsunami';
  const old = Math.random; Math.random = () => rnd; edge('fireP'); w.stepOnce(1/60); Math.random = old;
  const dir = g.tsu && g.tsu.dir;
  let t = 0, ti = g.ti, round = g.round;
  while (t < 30 && !(g.phase === 'turn' && (g.ti !== ti || g.round !== round)) && !g.over) { w.stepOnce(1/60); t += 1/60; }
  return {ok, dir, leftDead: left.dead, rightDead: right.dead, midDead: mid.dead, over: g.over, ended: !g.tsu};
}""" % ("{" + ", ".join(f"{k}: {v!r}".replace("'", '"') for k, v in BASE.items()) + "}")

with game_page() as (pg, errors):
    fromLeft = pg.evaluate(JS, [0.1])
    fromRight = pg.evaluate(JS, [0.9])
    print(fromLeft, fromRight)
    assert all(fromLeft["ok"]) and all(fromRight["ok"]), "test setup: ground must exist at the chosen x"
    assert fromLeft["dir"] == 1 and fromLeft["leftDead"] and not fromLeft["rightDead"] and not fromLeft["midDead"] and fromLeft["ended"]
    assert fromRight["dir"] == -1 and fromRight["rightDead"] and not fromRight["leftDead"] and not fromRight["midDead"] and fromRight["ended"]
    finish(errors)
