"""Force Choke: the clicked worm is lifted and held in the air while the track plays, loses health with blood, is flung
against the caster's facing and takes impact damage when it hits the terrain."""
from common import game_page, finish, BASE
from arena import ARENA_JS

JS = ARENA_JS + """
const run = ([base]) => {
  const w = window.__wh, out = {};
  const setup = (seed, foeX) => {
    w.newGame(Object.assign({seed}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
    const g = w.G;
    for (let i = 0; i < 30; i++) w.stepOnce(1/60);
    arena(700); g.round = 9;
    const a = g.worms.find(x => x.id === g.active), foe = g.worms.find(x => x.team !== a.team);
    g.worms.forEach((o, i) => { if (o !== a && o !== foe) stand(o, 60 + 25 * i); });
    g.teams[a.team].ammo.forcechoke = 2;
    stand(a, 700); a.face = 1; stand(foe, foeX);
    // terrain on both sides: the flung worm hits it
    for (let y = 300; y < 700; y++) T.mask.fill(1, y * T.w + 1500, y * T.w + 1560);
    for (let i = 0; i < 10; i++) w.stepOnce(1/60);
    g.weapon.id = 'forcechoke';
    return {g, a, foe};
  };
  let s = setup('fc1', 1000);
  const g = s.g, a = s.a, foe = s.foe;
  const ev = [], old = window.emit, oldMp3 = window.mp3Sfx, mp3 = [];
  window.emit = e => { ev.push(e.e + (e.s ? ':' + e.s : '') + (e.hit ? ':hit' : '')); return old(e); };
  window.mp3Sfx = (src) => { mp3.push(src); };
  const y0 = foe.y, hp0 = foe.hp;
  LOCAL.clicks.push({x: foe.x, y: foe.y}); w.stepOnce(1/60);
  out.tool = a.tool && a.tool.k; out.ammo = g.teams[a.team].ammo.forcechoke; out.mp3 = mp3.slice();
  let minY = y0, heldAt = null, hpMid = null, flung = null, hitAt = null, snapHeld = null, t0 = g.time;
  for (let i = 0; i < 60 * 9; i++) {
    w.stepOnce(1/60);
    const t = g.time - t0;
    minY = Math.min(minY, foe.y);
    if (foe.held && heldAt === null) heldAt = t;
    if (foe.held && t > 2 && hpMid === null) { hpMid = foe.hp; snapHeld = snapshot(true).w.find(r => r[0] === foe.id)[6] & 128; out.xDuring = foe.x; }
    if (flung === null && foe.fly) flung = {t, vx: foe.vx, vy: foe.vy, hp: foe.hp};
    if (flung && hitAt === null && !foe.fly) hitAt = {t, hp: foe.hp, x: foe.x, y: foe.y};
  }
  window.emit = old; window.mp3Sfx = oldMp3;
  Object.assign(out, {y0, minY, heldAt, hp0, hpMid, flung, hitAt, snapHeld, chokes: ev.filter(e => e === 'choke').length, hitEv: ev.includes('choke:hit'), whoosh: ev.includes('snd:whoosh'), foeEnd: {x: foe.x, y: foe.y, hp: foe.hp, dead: foe.dead}, toolDone: !a.tool, aHp: a.hp});
  // too far / nothing clicked: nothing happens
  s = setup('fc2', 1500);   // 800 px away: out of range
  LOCAL.clicks.push({x: s.foe.x, y: s.foe.y}); w.stepOnce(1/60);
  out.far = {tool: s.a.tool, ammo: s.g.teams[s.a.team].ammo.forcechoke};
  LOCAL.clicks.push({x: 100, y: 100}); w.stepOnce(1/60);
  out.empty = {tool: s.a.tool, ammo: s.g.teams[s.a.team].ammo.forcechoke};
  // the target dies while held: the grip ends
  s = setup('fc3', 1000);
  LOCAL.clicks.push({x: s.foe.x, y: s.foe.y}); w.stepOnce(1/60);
  for (let i = 0; i < 90; i++) w.stepOnce(1/60);
  s.foe.hp = 1;
  for (let i = 0; i < 60 * 2; i++) w.stepOnce(1/60);
  out.killed = {dead: s.foe.dead, held: !!s.foe.held, tool: !!s.a.tool};
  out.delay = FORCE_CHOKE; out.listed = MP3_FILES.includes('sounds/darthvader.mp3');
  return out;
};
"""

with game_page(viewport={"width": 1100, "height": 700}) as (pg, errors):
    r = pg.evaluate("([b]) => {" + JS + "return run([b]); }", [BASE])
    for k, v in r.items(): print(k, v)
    assert r["listed"] and r["tool"] == "force" and r["ammo"] == 1 and r["mp3"] == ["sounds/darthvader.mp3"], "track plays, ammo spent"
    assert r["heldAt"] is not None and r["y0"] - r["minY"] >= 60, "the worm is lifted ~70 px"
    assert r["hpMid"] is not None and r["hpMid"] < r["hp0"] and r["chokes"] >= 3, "choke damage with blood events"
    assert r["snapHeld"], "guests see it held"
    assert abs(r["xDuring"] - 1000) < 1, "held in place"
    f = r["flung"]
    assert f and abs(f["t"] - r["delay"]) < 0.1 and f["vx"] < -600, f"flung against the caster's facing at the end of the track: {f}"
    assert r["whoosh"] and r["hitEv"], "whoosh when thrown, impact effect on collision"
    assert r["hitAt"] and r["hitAt"]["hp"] < f["hp"] - 15, "impact damage on collision"
    assert r["hitAt"]["x"] < 1000, "it flew in the direction opposite to the caster's facing"
    assert r["toolDone"] and r["aHp"] == 100, "the caster is fine"
    assert r["far"]["tool"] is None and r["far"]["ammo"] == 2, "out of range: nothing happens"
    assert r["empty"]["tool"] is None and r["empty"]["ammo"] == 2, "no worm clicked: nothing happens"
    assert r["killed"]["dead"] and not r["killed"]["held"] and not r["killed"]["tool"], "a dead target ends the grip"
    finish(errors)
