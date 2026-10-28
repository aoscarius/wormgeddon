"""Kamehameha power levels: each further press of Fire during the charge widens the beam (x2, then x3, never more):
tunnel radius, hit width, drawn width, the charge ball, and the level reaches guests."""
from common import game_page, finish, BASE
from arena import ARENA_JS

JS = ARENA_JS + """
const run = ([base]) => {
  const w = window.__wh, out = {};
  const shoot = (presses, ammo = 5) => {
    w.newGame(Object.assign({seed: 'khp'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
    const g = w.G;
    for (let i = 0; i < 30; i++) w.stepOnce(1/60);
    arena(700); g.round = 9;
    const a = g.worms.find(x => x.id === g.active), t = g.teams[a.team];
    t.ammo.kamehameha = ammo;
    g.worms.forEach((o, i) => { if (o !== a) stand(o, 60 + 25 * i); });
    // blocks of terrain above the beam line (y ~ 691): 40 px and 65 px from it
    for (const y of [651, 626]) T.mask.fill(1, y * T.w + 1000, y * T.w + 1200);
    // a worm hanging 55 px above the line: only the x3 beam (R 75) reaches it, x2 (R 50 + worm radius) does not... or does; see asserts
    const foe = g.worms.find(x => x.team !== a.team);
    stand(a, 800); a.face = 1; a.aim = 0;
    T.mask.fill(1, 633 * T.w + 1290, 633 * T.w + 1310); T.mask.fill(1, 634 * T.w + 1290, 634 * T.w + 1310); for (let y = 635; y <= 640; y++) T.mask.fill(1, y * T.w + 1290, y * T.w + 1310);
    foe.x = 1300; foe.y = 625; foe.vx = foe.vy = 0; foe.grounded = true; foe.hp = 100;
    for (let i = 0; i < 10; i++) w.stepOnce(1/60);
    g.weapon.id = 'kamehameha';
    const hp0 = foe.hp;
    LOCAL.fireP = 1; w.stepOnce(1/60); LOCAL.fireP = 0;
    const lvs = [a.tool.lv], ammoAfterFire = t.ammo.kamehameha;
    for (let k = 0; k < presses; k++) {
      for (let i = 0; i < 20; i++) w.stepOnce(1/60);
      LOCAL.fireP = 1; w.stepOnce(1/60); LOCAL.fireP = 0;
      lvs.push(a.tool.lv);
    }
    let beam = null, snap = null;
    for (let i = 0; i < 60 * 8 && !beam; i++) { w.stepOnce(1/60); beam = g.projs.find(p => p.t === 'kamebeam'); if (a.tool && !snap) snap = snapshot(true).w.find(r => r[0] === a.id)[13]; }
    const lvBeam = beam ? beam.net[6] : null;
    for (let i = 0; i < 60 * 3; i++) w.stepOnce(1/60);
    CAM.x = 1100; CAM.y = 650; CAM.z = 1; CAM.s = 1; render();
    const mk = (x, y) => T.mask[y * T.w + x];
    return {lvs, lvBeam, snap, ammoAfterFire, ammoEnd: t.ammo.kamehameha, c40: mk(1100, 651), c65: mk(1100, 626), foeLost: hp0 - foe.hp, foeDead: foe.dead};
  };
  out.p0 = shoot(0); out.p1 = shoot(1); out.p2 = shoot(2); out.p4 = shoot(4);
  out.lowAmmo = shoot(2, 2);   // only 2 charges: the x3 press is refused
  out.unl = shoot(2, -1);
  return out;
};
"""

with game_page(viewport={"width": 1100, "height": 700}) as (pg, errors):
    r = pg.evaluate("([b]) => {" + JS + "return run([b]); }", [BASE])
    for k, v in r.items(): print(k, v)
    p0, p1, p2, p4 = r["p0"], r["p1"], r["p2"], r["p4"]
    assert p0["lvs"] == [1] and p1["lvs"] == [1, 2] and p2["lvs"] == [1, 2, 3] and p4["lvs"] == [1, 2, 3, 3, 3], "levels 1..3, capped"
    assert [p0["lvBeam"], p1["lvBeam"], p2["lvBeam"], p4["lvBeam"]] == [1, 2, 3, 3], "the beam carries the level"
    assert p0["snap"] == 1 and p2["snap"] in (1, 2, 3), "guests get the level"
    assert (p0["ammoEnd"], p1["ammoEnd"], p2["ammoEnd"], p4["ammoEnd"]) == (4, 3, 2, 2), "level n costs n ammo"
    assert r["lowAmmo"]["lvs"] == [1, 2, 2] and r["lowAmmo"]["ammoEnd"] == 0, "with 2 charges only x2 is possible"
    assert r["unl"]["lvs"] == [1, 2, 3] and r["unl"]["ammoEnd"] == -1, "unlimited ammo stays unlimited"
    # tunnel width: x1 carves neither block, x2 only the near one (40 px), x3 both (65 px)
    assert (p0["c40"], p0["c65"]) == (1, 1), "x1 leaves both blocks"
    assert (p1["c40"], p1["c65"]) == (0, 1), "x2 carves the 40 px block only"
    assert (p2["c40"], p2["c65"]) == (0, 0), "x3 carves both"
    # hit width: the worm 58 px off the line is only caught by the x3 beam
    assert p0["foeLost"] == 0 and p1["foeLost"] == 0 and p2["foeLost"] > 0, (p0["foeLost"], p1["foeLost"], p2["foeLost"])
    finish(errors)
