"""Mind Transfer Jutsu: click an enemy worm, a spirit travels to it (tool 'mind'), then the target becomes the active worm and
sits in the caster's team for the rest of the turn: the caster's player moves it, fires the caster's arsenal with it, and
the worm is handed back to its team at the next turn (the state also travels in the snapshot as 'mt')."""
from common import game_page, finish, BASE
from arena import ARENA_JS

JS = ARENA_JS + """
const run = ([base]) => {
  const w = window.__wh, out = {};
  w.newGame(Object.assign({seed: 'mind'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
  const g = w.G;
  for (let i = 0; i < 30; i++) w.stepOnce(1/60);
  arena(700);
  const a = g.worms.find(x => x.id === g.active), foe = g.worms.find(x => x.team !== a.team);
  g.worms.forEach((o, i) => { if (o !== a && o !== foe) stand(o, 60 + 25 * i); });
  stand(a, 500); stand(foe, 900);
  const home = foe.team, ct = a.team;
  g.teams[ct].ammo.mindtransfer = 1;
  for (let i = 0; i < 10; i++) w.stepOnce(1/60);
  g.weapon.id = 'mindtransfer';
  // clicking an ally / empty ground does nothing
  LOCAL.clicks.push({x: 300, y: 600}); w.stepOnce(1/60);
  out.missTool = a.tool; out.missAmmo = g.teams[ct].ammo.mindtransfer;
  LOCAL.clicks.push({x: foe.x, y: foe.y}); w.stepOnce(1/60);
  out.tool = a.tool && a.tool.k; out.ammo = g.teams[ct].ammo.mindtransfer; out.lv = a.tool && a.tool.lv === foe.id + 1;
  out.active0 = g.active === a.id;
  let t0 = g.time;
  for (let i = 0; i < 60 * 3 && g.active === a.id; i++) w.stepOnce(1/60);
  out.animT = g.time - t0;
  out.active = g.active === foe.id; out.team = foe.team === ct; out.mind = !!g.mind && g.mind.home === home;
  out.snap = JSON.stringify(snapshot(true).mt);
  out.phase = g.phase; out.fired = g.fired;
  // the caster's player moves it and fires the caster's arsenal
  const x0 = foe.x; LOCAL.r = 1; for (let i = 0; i < 30; i++) w.stepOnce(1/60); LOCAL.r = 0;
  out.dx = foe.x - x0;
  out.sameAmmo = teamOf(foe) === g.teams[ct];
  g.weapon.id = 'bazooka'; foe.aim = -0.3;
  const am = g.teams[ct].ammo.bazooka;
  LOCAL.fire = 1; LOCAL.fireP = 1; w.stepOnce(1/60); LOCAL.fireP = 0; for (let i = 0; i < 20; i++) w.stepOnce(1/60); LOCAL.fire = 0;
  w.stepOnce(1/60);
  out.shot = g.projs.some(p => p.ow === foe.id) || g.teams[ct].ammo.bazooka < am || g.phase !== 'turn';
  // next turn: handed back
  let guard = 0;
  while (guard++ < 60 * 40 && g.phase !== 'turn') w.stepOnce(1/60);
  out.back = foe.team === home && !g.mind; out.next = g.active !== foe.id;
  return out;
};
"""

with game_page(viewport={"width": 1100, "height": 700}) as (pg, errors):
    r = pg.evaluate("([b]) => {" + JS + "return run([b]); }", [BASE])
    print(r)
    assert r["missTool"] is None and r["missAmmo"] == 1, "no enemy worm clicked: nothing happens"
    assert r["tool"] == "mind" and r["ammo"] == 0 and r["lv"] and r["active0"], "the spirit leaves the caster"
    assert 1.0 < r["animT"] < 1.8, f"projection animation: {r['animT']}"
    assert r["active"] and r["team"] and r["mind"], "the target becomes active, in the caster's team"
    assert r["snap"] != "0", "the state is sent to guests"
    assert r["phase"] == "turn" and not r["fired"], "the turn goes on"
    assert r["dx"] > 20 and r["sameAmmo"], "the caster's player moves it and uses the caster's arsenal"
    assert r["shot"], "the possessed worm can fire"
    assert r["back"], "control reverts at the next turn"
    finish(errors)
