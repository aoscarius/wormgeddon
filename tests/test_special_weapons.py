"""Earthquake, Dragon Fire, Thunderstorm, Tornado, Thor's Hammer and Time Car: each does what it says and the turn still ends."""
from common import game_page, finish, BASE

JS = """(id) => {
  const w = window.__wh, out = {id, ev: {}};
  w.newGame(Object.assign({seed: 'sp'}, %s), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
  const g = w.G, a = g.worms.find(x => x.id === g.active), foe = g.worms.find(x => x.team !== a.team);
  for (let i = 0; i < 120; i++) w.stepOnce(1/60);
  const old = window.emit; window.emit = e => { out.ev[e.e] = (out.ev[e.e] || 0) + 1; return old(e); };
  const solidCount = () => { let s = 0; for (let i = 0; i < T.mask.length; i++) s += T.mask[i]; return s; };
  const s0 = solidCount(), hp0 = g.worms.reduce((s, x) => s + x.hp, 0), foeY0 = foe.y;
  const d = WEAPONS[id]; const dir = a.x > T.w / 2 ? -1 : 1; g.weapon.id = id; a.face = dir;
  Object.assign(LOCAL, {l:0,r:0,u:0,d:0,fire:0,fireP:0,jump:0,back:0});
  // put the foe in the open, well away from the shooter, and the click on it
  foe.x = a.x + 260 * dir; foe.y = (surfaceAt(foe.x, a.y - 40) || foe.y) - 10; foe.vx = foe.vy = 0;
  for (let i = 0; i < 60; i++) w.stepOnce(1/60);
  const fy0 = foe.y;
  if (d.click) { LOCAL.clicks.push({x: foe.x, y: foe.y}); w.stepOnce(1/60); } else { edge('fireP'); w.stepOnce(1/60); }
  out.fired = g.phase !== 'turn';
  const ti = g.ti, round = g.round; let t = 0;
  out.maxFires = 0; out.minFoeY = foe.y; out.sawDragon = out.sawTornado = false; out.seen = {}; const foeX0 = foe.x;
  while (t < 40 && !(g.phase === 'turn' && (g.ti !== ti || g.round !== round)) && !g.over) {
    w.stepOnce(1/60); t += 1/60;
    out.maxFires = Math.max(out.maxFires, g.fires.length);
    out.minFoeY = Math.min(out.minFoeY, foe.y);
    for (const p of g.projs) out.seen[p.t] = (out.seen[p.t] || 0) + 1;
    if (g.projs.some(p => p.t === 'dragon')) out.sawDragon = true;
    if (g.projs.some(p => p.t === 'tornado')) out.sawTornado = true;
  }
  window.emit = old;
  out.turnEnded = g.phase === 'turn' && (g.ti !== ti || g.round !== round) || g.over;
  out.secs = +t.toFixed(1);
  out.carved = s0 - solidCount();
  out.hpLost = hp0 - g.worms.reduce((s, x) => s + x.hp, 0);
  out.lift = fy0 - out.minFoeY;
  out.quake = g.quake || 0;
  out.pushed = (foe.x - foeX0) * dir;
  return out;
}""" % ("{" + ", ".join(f"{k}: {v!r}".replace("'", '"') for k, v in BASE.items()) + "}")

with game_page(viewport={"width": 1100, "height": 700}) as (pg, errors):
    r = {i: pg.evaluate(JS, i) for i in ("earthquake", "dragonfire", "thunder", "tornado", "hammer", "timecar")}
    for v in r.values():
        print({k: v[k] for k in v if k != "ev"}, v["ev"])
        assert v["fired"] and v["turnEnded"], v
    assert r["earthquake"]["ev"].get("quake") == 1 and r["earthquake"]["ev"].get("cv", 0) >= 10 and r["earthquake"]["carved"] > 100
    assert r["earthquake"]["quake"] <= 0, "the quake must end"
    assert r["dragonfire"]["sawDragon"] and r["dragonfire"]["maxFires"] >= 25
    assert r["thunder"]["ev"].get("bolt") == 5 and r["thunder"]["hpLost"] > 0
    assert r["tornado"]["sawTornado"] and r["tornado"]["lift"] > 25, "the tornado must lift the worm"
    assert r["hammer"]["seen"].get("mjolnir", 0) > 60 and r["hammer"]["ev"].get("storm") == 1, "the hammer charges first"
    assert r["hammer"]["ev"].get("bolt", 0) >= 5 and r["hammer"]["hpLost"] > 20 and r["hammer"]["secs"] > 1.8, r["hammer"]
    assert r["timecar"]["seen"].get("timecar", 0) > 20 and r["timecar"]["hpLost"] > 10 and r["timecar"]["pushed"] > 15, r["timecar"]
    finish(errors)
