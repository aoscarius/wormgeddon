"""Avada Kedavra: the incantation track plays with the wand raised, then a green lightning bolt shoots from the wand straight
at the target. The first thing on its line decides: a worm dies on the spot (no blast, nobody else hurt), a mine or an oil
drum explodes, the ground stops it and nothing happens."""
from common import game_page, finish, BASE
from arena import ARENA_JS

JS = ARENA_JS + """
const run = ([base]) => {
  const w = window.__wh, out = {};
  const setup = seed => {
    w.newGame(Object.assign({seed}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
    const g = w.G;
    for (let i = 0; i < 30; i++) w.stepOnce(1/60);
    arena(700); g.round = 9;
    const a = g.worms.find(x => x.id === g.active), foe = g.worms.find(x => x.team !== a.team);
    const others = g.worms.filter(x => x !== a && x !== foe);
    g.teams[a.team].ammo.avada = 2;
    stand(a, 700); a.face = 1;
    stand(foe, 1300);
    others.forEach((o, i) => stand(o, 200 + 40 * i));
    for (let i = 0; i < 10; i++) w.stepOnce(1/60);
    g.weapon.id = 'avada';
    return {g, a, foe, others};
  };
  const shoot = (s, click, extra) => {
    const g = s.g, ev = [], old = window.emit, oldMp3 = window.mp3Sfx, mp3 = [];
    window.emit = e => { ev.push(e.e + (e.s ? ':' + e.s : '') + (e.e === 'avada' ? ':' + e.hit : '')); return old(e); };
    window.mp3Sfx = (src) => { mp3.push(src); };
    const hp0 = s.others.map(o => o.hp), t0 = g.time;
    s.a.tool = null;
    LOCAL.clicks.push(click);
    w.stepOnce(1/60);
    const r = {tool: s.a.tool && s.a.tool.k, ammo: g.teams[s.a.team].ammo.avada, mp3};
    let launchAt = null, endAt = null, snap = null, grown = 0, tipOk = null, zapSeen = false, zapFrozen = false, zapDeadEarly = false;
    for (let i = 0; i < 60 * 8; i++) {
      w.stepOnce(1/60);
      const t = g.time - t0, b = g.projs.find(p => p.t === 'avada');
      if (b) { if (launchAt === null) { launchAt = t; const tp = wandTip(s.a); tipOk = Math.hypot(b.net[0] - tp[0], b.net[1] - tp[1]) < 0.5; }
        if (s.foe.zap > 0) { zapSeen = true; zapFrozen = s.foe.vx === 0 && s.foe.vy === 0; zapDeadEarly = zapDeadEarly || s.foe.dead; } if (!snap) snap = snapshot(true).p.find(q => q[1] === 'avada'); grown = Math.max(grown, b.net[5]); }
      if (launchAt !== null && !b && endAt === null) endAt = t;
    }
    window.emit = old; window.mp3Sfx = oldMp3;
    Object.assign(r, {flash: ev.includes('flash'), tipOk, zapSeen, zapFrozen, zapDeadEarly, launchAt, endAt, grown, evAll: ev, ev: ev.filter(e => e.startsWith('avada') || e === 'x' || e === 'snd:avada' || e === 'msg'), foeDead: s.foe.dead, foeHp: s.foe.hp, othersOk: s.others.every((o, i) => o.hp === hp0[i] && !o.dead), snap: snap && snap[9] && snap[9].length === 7, aAlive: !s.a.dead});
    return r;
  };
  let s = setup('avada1');
  out.open = shoot(s, {x: s.foe.x, y: s.foe.y});
  // another worm stands in the way: it dies instead
  s = setup('avada2');
  const mid = s.others[0]; stand(mid, 1000);
  for (let i = 0; i < 20; i++) w.stepOnce(1/60);
  out.block = shoot(s, {x: s.foe.x, y: s.foe.y}); out.block.midDead = mid.dead;
  // the ground in the way: a miss
  s = setup('avada3');
  for (let y = 100; y < 700; y++) T.mask.fill(1, y * T.w + 900, y * T.w + 960);
  out.wall = shoot(s, {x: s.foe.x, y: s.foe.y});
  // a mine on the line explodes, and the bolt goes no further; so does an oil drum
  s = setup('avada4');
  spawnProj('mine', 1000, 696, 0, 0, null, { armed: true });
  for (let i = 0; i < 40; i++) w.stepOnce(1/60);
  const mine = s.g.projs.find(p => p.t === 'mine');
  out.mine = shoot(s, {x: s.foe.x, y: s.foe.y}); out.mine.gone = !s.g.projs.some(p => p.t === 'mine');
  s = setup('avada5');
  s.g.objs.push({id: s.g.nid++, k: 'drum', x: 1000, y: 692, vx: 0, vy: 0, r: 7, lit: 0, bounce: 0, fric: 0.5});
  for (let i = 0; i < 20; i++) w.stepOnce(1/60);
  out.drum = shoot(s, {x: s.foe.x, y: s.foe.y}); out.drum.gone = !s.g.objs.some(o => o.k === 'drum');
  s = setup('avada6');
  out.empty = shoot(s, {x: 1700, y: 300});      // click on nothing: no shot, no ammo spent
  out.delay = WAND_DELAY; out.listed = MP3_FILES.includes('sounds/avadakedavra.mp3');
  return out;
};
"""

with game_page(viewport={"width": 1100, "height": 700}) as (pg, errors):
    r = pg.evaluate("([b]) => {" + JS + "return run([b]); }", [BASE])
    for k, v in r.items(): print(k, v)
    o, bl, wl, mn, dr, em = r["open"], r["block"], r["wall"], r["mine"], r["drum"], r["empty"]
    assert r["listed"] and o["tool"] == "wand" and o["ammo"] == 1, "wand raised, ammo spent"
    assert o["mp3"] == ["sounds/avadakedavra.mp3"], "the incantation plays"
    assert o["launchAt"] is not None and abs(o["launchAt"] - r["delay"]) <= 1 / 30, "the bolt leaves after the incantation"
    assert o["grown"] == 1 and o["endAt"] is not None, "the bolt reaches the end and goes out"
    assert o["tipOk"], "the bolt starts exactly at the wand tip"
    assert o["zapSeen"] and o["zapFrozen"] and not o["zapDeadEarly"], "the victim hangs frozen in the bubble before it dies"
    assert o["flash"], "a flash of light lights the whole scene on impact"
    assert o["foeDead"] and o["othersOk"] and o["aAlive"], "the target dies, nobody else is touched"
    assert "avada:1" in o["ev"] and "x" not in o["ev"], "a hit, with no explosion"
    assert o["snap"], "guests get the bolt geometry"
    assert bl["midDead"] and not bl["foeDead"], "a worm in the way perishes instead of the target"
    assert not wl["foeDead"] and wl["foeHp"] == 100 and wl["othersOk"] and "avada:0" in wl["ev"] and "avada:1" not in wl["ev"], "the ground stops it: a miss"
    assert mn["gone"] and "x" in mn["ev"] and not mn["foeDead"], "a mine on the line explodes"
    assert dr["gone"] and not dr["foeDead"], "an oil drum on the line explodes"
    assert em["tool"] is None and em["ammo"] == 2 and "msg" in em["ev"], "no worm clicked: nothing happens, ammo kept"
    finish(errors)
