"""Avada Kedavra: the incantation track plays with the wand raised, then a green beam finds its way through the open air
around the terrain to the target and kills it at once (nobody else is hurt, no blast); when the target is walled in the
beam dies against the terrain and nothing happens."""
from common import game_page, finish, BASE
from arena import ARENA_JS

JS = ARENA_JS + """
const run = ([base]) => {
  const w = window.__wh, out = {};
  const setup = (seed, walled) => {
    w.newGame(Object.assign({seed}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
    const g = w.G;
    for (let i = 0; i < 30; i++) w.stepOnce(1/60);
    arena(700); g.round = 9;
    const a = g.worms.find(x => x.id === g.active), foe = g.worms.find(x => x.team !== a.team);
    const others = g.worms.filter(x => x !== a && x !== foe);
    g.teams[a.team].ammo.avada = 2;
    stand(a, 700); a.face = 1;
    // a wall between them (x 900-960, from the floor up to y 100): the beam has to go over it (sky is open)
    for (let y = 100; y < 700; y++) T.mask.fill(1, y * T.w + 900, y * T.w + 960);
    stand(foe, 1300);
    others.forEach((o, i) => stand(o, 200 + 40 * i));
    if (walled) {
      // the target sits in a closed box of ground
      for (let y = 600; y < 700; y++) T.mask.fill(1, y * T.w + 1200, y * T.w + 1400);
      for (let y = 640; y < 700; y++) T.mask.fill(0, y * T.w + 1250, y * T.w + 1350);
      foe.x = 1300; foe.y = 690; foe.vx = foe.vy = 0; foe.grounded = true;
    }
    for (let i = 0; i < 10; i++) w.stepOnce(1/60);
    g.weapon.id = 'avada';
    return {g, a, foe, others};
  };
  const shoot = (s, click) => {
    const g = s.g, ev = [], old = window.emit, oldMp3 = window.mp3Sfx, mp3 = [];
    window.emit = e => { ev.push(e.e + (e.s ? ':' + e.s : '') + (e.e === 'avada' ? ':' + e.hit : '')); return old(e); };
    window.mp3Sfx = (src) => { mp3.push(src); };
    const hp0 = s.others.map(o => o.hp), t0 = g.time;
    s.a.tool = null;
    LOCAL.clicks.push(click);
    w.stepOnce(1/60);
    const r = {tool: s.a.tool && s.a.tool.k, ammo: g.teams[s.a.team].ammo.avada, mp3};
    let launchAt = null, endAt = null, path = null, maxY = 1e9, snap = null;
    for (let i = 0; i < 60 * 14; i++) {
      w.stepOnce(1/60);
      const t = g.time - t0, b = g.projs.find(p => p.t === 'avada');
      if (b) { if (launchAt === null) { launchAt = t; path = b.path.map(q => [Math.round(q[0]), Math.round(q[1])]); r.ok = b.ok; snap = snapshot(true).p.find(q => q[1] === 'avada'); } maxY = Math.min(maxY, b.y); }
      if (launchAt !== null && !b && endAt === null) endAt = t;
    }
    window.emit = old; window.mp3Sfx = oldMp3;
    Object.assign(r, {launchAt, endAt, path, maxY, ev: ev.filter(e => e.startsWith('avada') || e === 'x' || e === 'snd:avada' || e === 'msg'), foeDead: s.foe.dead, foeHp: s.foe.hp, othersOk: s.others.every((o, i) => o.hp === hp0[i] && !o.dead), snap: !!snap, aAlive: !s.a.dead});
    return r;
  };
  let s = setup('avada1', false);
  out.open = shoot(s, {x: s.foe.x, y: s.foe.y});
  s = setup('avada2', true);
  out.walled = shoot(s, {x: s.foe.x, y: s.foe.y});
  s = setup('avada3', false);
  out.empty = shoot(s, {x: 1700, y: 300});      // click on nothing: no shot, no ammo spent
  out.delay = WAND_DELAY; out.listed = MP3_FILES.includes('sounds/avadakedavra.mp3');
  return out;
};
"""

with game_page(viewport={"width": 1100, "height": 700}) as (pg, errors):
    r = pg.evaluate("([b]) => {" + JS + "return run([b]); }", [BASE])
    for k, v in r.items(): print(k, v)
    o, wl, em = r["open"], r["walled"], r["empty"]
    assert r["listed"] and o["tool"] == "wand" and o["ammo"] == 1, "wand raised, ammo spent"
    assert o["mp3"] == ["sounds/avadakedavra.mp3"], "the incantation plays"
    assert o["launchAt"] is not None and abs(o["launchAt"] - r["delay"]) <= 1 / 30, "the beam leaves after the incantation"
    assert o["ok"] and len(o["path"]) >= 3 and o["maxY"] < 100, f"an open path exists and goes over the wall: {o['path']}"
    assert o["foeDead"] and o["othersOk"] and o["aAlive"], "the target dies, nobody else is touched"
    assert "avada:1" in o["ev"] and "x" not in o["ev"], "a hit, with no explosion"
    assert o["snap"], "guests see the beam"
    assert not wl["ok"] and wl["launchAt"] is not None, "walled in: no path"
    assert not wl["foeDead"] and wl["foeHp"] == 100 and wl["othersOk"], "the beam has no effect on a walled-in worm"
    assert "avada:0" in wl["ev"] and "avada:1" not in wl["ev"] and "x" not in wl["ev"], "it fizzles without a blast"
    assert wl["endAt"] is not None, "the beam is gone"
    assert em["tool"] is None and em["ammo"] == 2 and "msg" in em["ev"], "no worm clicked: nothing happens, ammo kept"
    finish(errors)
