"""Gandalf's Staff: the track starts with the weapon, the slam comes STAFF_DELAY s later with a thud, and the ground in
front (within STAFF_R px of the point STAFF_DIST px ahead) collapses completely into the sea; the worm itself, and the
ground outside the section, stay."""
from common import game_page, finish, BASE
from arena import ARENA_JS

JS = ARENA_JS + """
const run = ([base]) => {
  const w = window.__wh, out = {};
  w.newGame(Object.assign({seed: 'gandalf'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
  const g = w.G;
  for (let i = 0; i < 30; i++) w.stepOnce(1/60);
  arena(700); g.round = 9;
  const a = g.worms.find(x => x.id === g.active), foe = g.worms.find(x => x.team !== a.team), mate = g.worms.find(x => x !== a && x !== foe);
  g.worms.forEach((o, i) => { if (o !== a) stand(o, 60 + 25 * i); });
  g.teams[a.team].ammo.gandalf = 2;
  stand(a, 800); a.face = 1; a.aim = 0;
  const cx = 800 + STAFF_DIST;
  stand(foe, cx);                       // on the ground that will collapse
  stand(mate, cx + STAFF_R + 40);       // beyond it
  for (let i = 0; i < 10; i++) w.stepOnce(1/60);
  g.weapon.id = 'gandalf';
  const ev = [], old = window.emit, mp3 = [], oldMp3 = window.mp3Sfx;
  window.emit = e => { ev.push(e.e + (e.s ? ':' + e.s : '')); return old(e); };
  window.mp3Sfx = (src) => { mp3.push(src); };
  const mk = (x, y) => T.mask[y * T.w + x];
  const before = {front: mk(cx, 705), edgeIn: mk(cx + STAFF_R - 2, 705), edgeOut: mk(cx + STAFF_R + 8, 705), under: mk(800, 705), behind: mk(700, 705), deep: mk(cx, T.h - 5)};
  const t0 = g.time;
  LOCAL.fireP = 1; w.stepOnce(1/60); LOCAL.fireP = 0;
  out.tool = a.tool && a.tool.k; out.ammoUsed = g.teams[a.team].ammo.gandalf;
  let slamAt = null, early = null;
  for (let i = 0; i < 60 * 8; i++) {
    w.stepOnce(1/60);
    const t = g.time - t0;
    if (t < STAFF_DELAY - 0.1 && mk(cx, 705) === 0) early = t;
    if (slamAt === null && ev.includes('snd:thud')) slamAt = t;
  }
  window.emit = old; window.mp3Sfx = oldMp3;
  out.slamAt = slamAt; out.early = early; out.delay = STAFF_DELAY; out.mp3 = mp3;
  out.sfx = ev.filter(e => e === 'snd:gandalf' || e === 'snd:thud' || e === 'rc');
  out.after = {front: mk(cx, 705), edgeIn: mk(cx + STAFF_R - 2, 705), edgeOut: mk(cx + STAFF_R + 8, 705), under: mk(800, 705), behind: mk(700, 705), deep: mk(cx, T.h - 5), above: mk(cx, 700 - STAFF_R - 5)};
  out.before = before;
  out.foeDead = foe.dead; out.foeSunk = !!foe.sunk || foe.y > g.waterY; out.mateAlive = !mate.dead; out.aAlive = !a.dead;
  out.toolDone = !a.tool;
  // the track: the sound exists and is registered
  out.mp3Listed = MP3_FILES.includes('sounds/shallnotpass.mp3');
  return out;
};
"""

with game_page(viewport={"width": 1100, "height": 700}) as (pg, errors):
    r = pg.evaluate("([b]) => {" + JS + "return run([b]); }", [BASE])
    print(r)
    assert r["tool"] == "staff" and r["ammoUsed"] == 1 and r["toolDone"], "staff tool, ammo spent, tool ends"
    assert r["mp3Listed"] and r["sfx"][0] == "snd:gandalf", "the track starts with the weapon"
    assert r["early"] is None, "the ground holds until the slam"
    assert r["slamAt"] is not None and abs(r["slamAt"] - r["delay"]) <= 1 / 30, f"slam at STAFF_DELAY: {r['slamAt']}"
    assert "snd:thud" in r["sfx"] and "rc" in r["sfx"]
    b, a = r["before"], r["after"]
    assert all(v == 1 for v in b.values()), b
    assert a["front"] == 0 and a["edgeIn"] == 0 and a["deep"] == 0 and a["above"] == 0, "the section collapses completely"
    assert a["edgeOut"] == 1 and a["under"] == 1 and a["behind"] == 1, "nothing outside it is touched"
    assert r["foeDead"] and r["foeSunk"], "the worm standing on it falls into the sea"
    assert r["mateAlive"] and r["aAlive"], "worms off the section and the caster are safe"
    finish(errors)
