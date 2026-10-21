"""Fires every weapon once and checks nothing throws and every turn eventually ends."""
from common import game_page, finish, BASE

JS = """(ids, base) => {
  const w = window.__wh, out = [];
  for (const id of ids) {
    try {
      w.newGame(Object.assign({seed: 'wt'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
      const g = w.G, a = g.worms.find(x => x.id === g.active), t = g.teams[a.team];
      for (const k in t.ammo) t.ammo[k] = 5;
      const foe = g.worms.find(x => x.team !== a.team);
      for (let i = 0; i < 120; i++) w.stepOnce(1/60);
      const d = WEAPONS[id];
      g.weapon.id = id; if (d.onSelect) d.onSelect(a, t);
      a.face = 1; a.aim = -0.5;
      Object.assign(LOCAL, {l:0,r:0,u:0,d:0,fire:0,fireP:0,jump:0,back:0});
      if (d.click) { LOCAL.clicks.push({x: foe.x, y: foe.y - 30}); w.stepOnce(1/60); }
      else if (d.charge) { LOCAL.fire = 1; edge('fireP'); for (let i = 0; i < 40; i++) w.stepOnce(1/60); LOCAL.fire = 0; w.stepOnce(1/60); }
      else { edge('fireP'); w.stepOnce(1/60); }
      const ti = g.ti, round = g.round;
      let changed = false;
      for (let i = 0; i < 60 * 60 && !changed; i++) {
        w.stepOnce(1/60);
        if (g.phase === 'turn' && (g.ti !== ti || g.round !== round)) changed = true;
        if (g.over) changed = true;
        if (i === 120 && (a.tool || a.jet)) edge('fireP');   // second press releases jet pack / tools
        if (i === 180 && a.rope) edge('jump');
      }
      out.push({id, changed});
    } catch (e) { out.push({id, exception: String(e && e.stack || e)}); }
  }
  return out;
}"""

with game_page(viewport={"width": 1100, "height": 700}) as (pg, errors):
    ids = pg.evaluate("() => WLIST.map(x => x.id)")
    res = pg.evaluate("([ids, b]) => (" + JS + ")(ids, b)", [ids, BASE])
    bad = [r for r in res if r.get("exception") or not r.get("changed")]
    print(f"{len(res)} weapons fired, {len(bad)} problems")
    for r in bad:
        print("  ", r)
    assert not bad
    finish(errors)
