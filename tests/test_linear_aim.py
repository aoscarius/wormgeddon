"""Kamehameha keeps the aim chosen before the charge (Up / Down held during the charge change nothing, the beam leaves
along the locked line from the muzzle), and the F4 debug view draws the impact line of the straight-line weapons."""
from common import game_page, finish, BASE
from arena import ARENA_JS

JS = ARENA_JS + """
const run = ([base]) => {
  const w = window.__wh, out = {};
  w.newGame(Object.assign({seed: 'lin'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
  const g = w.G;
  for (let i = 0; i < 30; i++) w.stepOnce(1/60);
  arena(700);
  g.round = 9;
  const a = g.worms.find(x => x.id === g.active), foe = g.worms.find(x => x.team !== a.team);
  g.worms.forEach((o, i) => { if (o !== a && o !== foe) stand(o, 60 + 25 * i); });
  g.teams[a.team].ammo.kamehameha = 3;
  stand(a, 800); a.face = 1; a.aim = -0.4; stand(foe, 1500);
  for (let i = 0; i < 10; i++) w.stepOnce(1/60);
  g.weapon.id = 'kamehameha';
  const aim0 = a.aim;
  // fire, then hold Up for the whole charge
  LOCAL.fireP = 1; w.stepOnce(1/60); LOCAL.fireP = 0;
  out.tool = a.tool ? {k: a.tool.k, a: a.tool.a} : null;
  LOCAL.u = 1;
  let beam = null;
  for (let i = 0; i < 60 * 8 && !beam; i++) { w.stepOnce(1/60); beam = g.projs.find(p => p.t === 'kamebeam'); }
  LOCAL.u = 0;
  out.aim0 = aim0; out.aimAfter = a.aim;
  out.beam = beam ? {ang: beam.net[2], ox: beam.net[0], oy: beam.net[1]} : null;
  out.expect = {ang: aim0, ox: a.x + Math.cos(aim0) * 10, oy: a.y - 2 + Math.sin(aim0) * 10};
  out.aw = [a.x, a.y];
  // F4 overlay: the linear-weapon impact line exists and matches the weapon geometry
  g.projs.length = 0; a.tool = null; g.phase = 'turn'; a.aim = -0.2; a.dead = false;
  const lin = {};
  for (const id of ['shotgun', 'handgun', 'uzi', 'kamehameha', 'firepunch', 'dragonball', 'bat', 'rope', 'supersheep', 'kamikaze', 'blowtorch', 'drill', 'onigiri', 'hokuto', 'gigantaxe']) lin[id] = linearShot(a, id);
  UI.mx = foe.x; UI.my = foe.y;
  lin.hammer = linearShot(a, 'hammer'); lin.proton = linearShot(a, 'proton'); lin.grenade = linearShot(a, 'grenade');
  out.lin = lin; out.T = [T.w, T.h];
  // drawing it does not throw and strokes pixels
  UI.debug = true; UI.traj = true; g.weapon.id = 'kamehameha'; CAM.x = a.x + 300; CAM.y = a.y; CAM.z = 1; CAM.s = 1;
  render();
  out.drawn = true;
  return out;
};
"""

with game_page(viewport={"width": 1100, "height": 700}) as (pg, errors):
    r = pg.evaluate("([b]) => {" + JS + "return run([b]); }", [BASE])
    print({k: v for k, v in r.items() if k != 'lin'}); print(r["lin"])
    assert r["tool"] and r["tool"]["k"] == "kame" and abs(r["tool"]["a"] - r["aim0"]) < 1e-9, "aim stored when the charge starts"
    assert abs(r["aimAfter"] - r["aim0"]) < 1e-9, "Up held during the charge does not move the aim"
    b, e = r["beam"], r["expect"]
    assert b and abs(b["ang"] - e["ang"]) < 1e-6 and abs(b["ox"] - e["ox"]) < 0.02 and abs(b["oy"] - e["oy"]) < 0.02, (b, e)
    L = r["lin"]
    for k_ in ("shotgun", "handgun", "uzi", "kamehameha", "firepunch", "dragonball", "bat", "rope", "supersheep", "kamikaze", "blowtorch", "drill", "onigiri", "hokuto", "gigantaxe", "hammer", "proton"):
        assert L[k_] and all(isinstance(L[k_][q], (int, float)) for q in ("x1", "y1", "x2", "y2")), f"{k_} has an impact line"
    assert abs(L["bat"]["x2"] - L["bat"]["x1"]) > 15 and L["drill"]["y2"] > L["drill"]["y1"] and L["onigiri"]["x2"] > L["onigiri"]["x1"], "melee / dash / drill lines go the right way"
    assert L["gigantaxe"]["y2"] > L["gigantaxe"]["y1"] and L["gigantaxe"]["w"] == 50, "axe drops on its spot"
    assert L["grenade"] is None, "arced weapons have none"
    k = L["kamehameha"]
    assert abs(k["x1"] - r["aw"][0] - 10 * 0.98006) < 0.05 and k["w"] == 25 and k["x2"] <= r["T"][0] + 1 and abs(k["mx"] - k["x2"]) < 1, "kamehameha line ends at the map border"
    assert L["shotgun"]["hit"] is None and abs(L["shotgun"]["x2"] - L["shotgun"]["x1"]) > 300 or L["shotgun"]["hit"], L["shotgun"]
    assert L["proton"]["hit"] in ("worm", None)
    assert r["drawn"]
    finish(errors)
