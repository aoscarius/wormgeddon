"""Thor's Hammer: the lightning stops at the first obstacle between the hammer and the target (like the Thunderstorm's
bolts): terrain or another worm. With a clear line it still reaches the target."""
from common import game_page, finish, BASE, ARENA_JS

JS = ARENA_JS + """
const run = ([base]) => {
  const w = window.__wh, out = {};
  const strike = (setup) => {
    w.newGame(Object.assign({seed: 'hc'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
    const g = w.G;
    for (let i = 0; i < 30; i++) w.stepOnce(1/60);
    arena(700);
    const a = g.worms.find(x => x.id === g.active);
    const foe = g.worms.find(x => x.team !== a.team);
    const mid = g.worms.find(x => x !== a && x !== foe);
    g.worms.forEach((o, i) => { if (o !== a && o !== foe && o !== mid) stand(o, 60 + 25 * i); });
    // a raised plateau (top y=660) on the right: target and blocker stand level with the hammer, so the bolt is flat
    for (let y = 660; y < 700; y++) T.mask.fill(1, y * T.w + 880, y * T.w + 1500);
    const top = (o, x) => { o.x = x; o.y = 660 - o.r - 1; o.vx = o.vy = 0; o.grounded = true; return o; };
    stand(a, 800); a.face = 1; top(foe, 1100); stand(mid, 100);
    setup(g, a, foe, mid, top);
    for (let i = 0; i < 20; i++) w.stepOnce(1/60);
    const hp0 = {foe: foe.hp, mid: mid.hp}, foeX0 = foe.x;
    const ev = {x: [], arc: []}, old = window.emit;
    window.emit = e => { if (e.e === 'x') ev.x.push({x: e.x, y: e.y}); if (e.e === 'arc' && !e.soft) ev.arc.push({x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2}); return old(e); };
    g.weapon.id = 'hammer';
    LOCAL.clicks.push({x: foe.x, y: foe.y}); w.stepOnce(1/60);
    for (let i = 0; i < 60 * 4; i++) w.stepOnce(1/60);
    window.emit = old;
    return {foeLost: hp0.foe - foe.hp, midLost: hp0.mid - mid.hp, x: ev.x, arc: ev.arc, foeX0, midX: mid.x, aX: a.x};
  };
  out.clear = strike(() => {});
  // a steel wall (vertical girder, 200 px high) halfway: it must take the hit
  out.wall = strike(() => { emit({e: 'gd', x: 950, y: 620, a: Math.PI / 2, l: 200}); });
  // another worm standing in the line of fire
  out.worm = strike((g, a, foe, mid, top) => { top(mid, 1000); });
  return out;
};
"""

with game_page(viewport={"width": 1100, "height": 700}) as (pg, errors):
    r = pg.evaluate("([b]) => {" + JS + "return run([b]); }", [BASE])
    for k, v in r.items():
        print(k, v)

    # the main bolt is the first non-soft arc (it starts at the hammer); the impact then scatters short branch arcs
    for v in r.values():
        assert v["arc"] and v["arc"][0]["x1"] < 830, v
        v["main"] = v["arc"][0]
        assert all(a["x1"] == v["main"]["x2"] for a in v["arc"][1:]), "branches start where the main bolt ended"
    c = r["clear"]
    assert abs(c["main"]["x2"] - c["foeX0"]) < 14, "clear line: the bolt reaches the target"
    assert c["foeLost"] > 15 and c["midLost"] == 0, c

    w = r["wall"]
    assert 935 < w["main"]["x2"] < 955, f"the bolt must end at the wall (x~950), ended at {w['arc'][0]['x2']}"
    assert w["x"] and 900 < w["x"][0]["x"] < 960, "the main explosion happens at the wall"
    assert w["foeLost"] == 0, "the worm behind the wall must be untouched"

    m = r["worm"]
    assert 980 < m["main"]["x2"] < 1005, f"the bolt must end at the worm in between (x~1000), ended at {m['arc'][0]['x2']}"
    assert m["midLost"] > 10, "the worm in the way is struck"
    assert m["foeLost"] == 0, "the marked worm is shielded by the worm in front of it"
    finish(errors)
