"""Proton Stream: click an enemy worm; the caster and its closest living teammate shoulder proton rifles and burn that
one worm. Both streams reaching it = crossed streams (more damage per tick + a blast at the end); a stream stopped by
ground or another worm does not reach it; out of range does not reach it; no teammate / no enemy under the click = miss."""
from common import game_page, finish, BASE
from arena import ARENA_JS

JS = ARENA_JS + """
const run = ([base]) => {
  const w = window.__wh, out = {};
  const setup = (o = {}) => {
    w.newGame(Object.assign({seed: 'pr'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
    const g = w.G;
    for (let i = 0; i < 30; i++) w.stepOnce(1/60);
    arena(700);
    g.round = 9;
    const a = g.worms.find(x => x.id === g.active), t = g.teams[a.team];
    t.ammo.proton = 3;
    const mates = g.worms.filter(x => x !== a && x.team === a.team), foes = g.worms.filter(x => x.team !== a.team);
    g.worms.forEach((q, i) => stand(q, 60 + 25 * i));
    stand(a, 800); a.face = 1;
    stand(mates[0], o.mateX ?? 760); stand(mates[1], 100);
    stand(foes[0], o.foeX ?? 1100); stand(foes[1], 1800);
    for (let i = 0; i < 10; i++) w.stepOnce(1/60);
    g.weapon.id = 'proton';
    return {g, a, t, mate: mates[0], far: mates[1], foe: foes[0], blocker: foes[1], hp: {foe: foes[0].hp, mate: mates[0].hp, a: a.hp, blocker: foes[1].hp}};
  };
  const shoot = (s, secs, click, hook) => {
    const r = {msgs: [], x: [], dmg: [], firstDmgAt: null, proj: null, snap: null, t0: s.g.time, lockedX: true, toolAtEnd: null};
    const old = window.emit; let last = s.foe.hp; const x0 = s.a.x;
    window.emit = e => { if (e.e === 'msg') r.msgs.push(e.t); if (e.e === 'x') r.x.push({x: e.x, y: e.y, r: e.r, t: s.g.time - r.t0}); return old(e); };
    const ammo0 = s.t.ammo.proton;
    LOCAL.clicks.push(click || {x: s.foe.x, y: s.foe.y - 4});
    for (let i = 0; i < 60 * secs; i++) {
      if (hook) hook(i, r);
      if (i === 5) LOCAL.r = 1;                         // the caster tries to walk away while the streams are on: locked
      if (i === 100) LOCAL.r = 0;
      if (i === 230) LOCAL.r = 1;                       // ...and taps 'right' after they are gone (retreat): free again
      if (i === 260) LOCAL.r = 0;
      w.stepOnce(1/60);
      const t = s.g.time - r.t0, p = s.g.projs.find(q => q.t === 'proton');
      if (p && !r.proj) { r.proj = {net: p.net.slice(0, 3)}; }
      if (p && !r.snap && p.life > 1) { const q = snapshot(true).p.find(q => q[1] === 'proton'); r.snap = q && q[9]; r.toolK = snapshot(true).w.find(q => q[0] === s.a.id)[9]; }
      if (s.foe.hp < last) { if (r.firstDmgAt === null) r.firstDmgAt = t; r.dmg.push(last - s.foe.hp); last = s.foe.hp; }
      if (p && Math.abs(s.a.x - x0) > 0.5) r.lockedX = false;     // only while the streams are on
      if (i % 5 === 0 && p) { CAM.x = (s.a.x + s.foe.x) / 2; CAM.y = 650; CAM.z = 1; CAM.s = 1; render(); }
    }
    LOCAL.r = 0; window.emit = old;
    r.ammoUsed = ammo0 - s.t.ammo.proton; r.toolAtEnd = !!s.a.tool; r.projGone = !s.g.projs.some(q => q.t === 'proton');
    r.foeLost = s.hp.foe - s.foe.hp; r.mateLost = s.hp.mate - s.mate.hp; r.aLost = s.hp.a - s.a.hp; r.blockerLost = s.hp.blocker - s.blocker.hp;
    r.ids = {a: s.a.id, mate: s.mate.id, far: s.far.id, foe: s.foe.id}; r.moved = s.a.x - x0;
    r.foeDead = s.foe.dead; r.faces = [s.a.face, s.mate.face];
    return r;
  };
  // A) clear line for both: crossed streams
  let s = setup();
  out.A = shoot(s, 6);
  // B) the teammate's stream is stopped by a steel wall right in front of it: only one stream reaches the target
  s = setup({mateX: 700});
  emit({e: 'gd', x: 722, y: 620, a: Math.PI / 2, l: 200});
  out.B = shoot(s, 6);
  // C) out of range (> 450 px)
  s = setup({foeX: 1330});
  out.C = shoot(s, 6);
  // D) a worm in the way takes the streams instead of the target
  s = setup(); stand(s.blocker, 950);
  out.D = shoot(s, 6);
  // E) lone worm: no teammate -> miss, nothing consumed
  s = setup(); s.mate.dead = true; s.far.dead = true;
  out.E = shoot(s, 1);
  // F) click on empty ground / on a teammate -> miss
  s = setup(); out.F1 = shoot(s, 1, {x: 1500, y: 600});
  s = setup(); out.F2 = shoot(s, 1, {x: s.mate.x, y: s.mate.y});
  // G) target dies mid-stream: it just stops
  s = setup();
  out.G = shoot(s, 4, null, (i) => { if (i === 90) { s.foe.hp = 0; s.foe.dead = true; } });
  // H) the partner stands between the caster and the target: the streams pass through their own shooters
  s = setup({mateX: 860});
  out.H = shoot(s, 6);
  out.icon = !!weaponIconURL('proton'); out.cat = WEAPONS.proton.cat;
  return out;
};
"""

with game_page(viewport={"width": 1100, "height": 700}) as (pg, errors):
    r = pg.evaluate("([b]) => {" + JS + "return run([b]); }", [BASE])
    A, B, C, D, E, G, H = r["A"], r["B"], r["C"], r["D"], r["E"], r["G"], r["H"]
    for k in "ABCDEGH": print(k, {a: b for a, b in r[k].items() if a not in ("x",)}, [round(e["x"]) for e in r[k]["x"]][:4])

    # --- A: crossed streams
    assert A["proj"] and A["proj"]["net"][2] is not None and A["ammoUsed"] == 1 and "Proton stream" in A["msgs"]
    assert A["firstDmgAt"] is not None and A["firstDmgAt"] >= 0.69, f"rifles are raised first: {A['firstDmgAt']}"
    ticks = [d for d in A["dmg"] if d <= 6.5]
    assert len(ticks) >= 7 and all(d == 6 for d in ticks[:7]), f"6 damage per tick with both streams: {A['dmg']}"
    big = [e for e in A["x"] if e["r"] >= 30]
    assert big and abs(big[0]["x"] - 1100) < 25 and 2.9 < big[0]["t"] < 3.4, f"blast at the crossing at the end: {big}"
    assert A["foeLost"] >= 60, A["foeLost"]
    assert A["aLost"] == 0 and A["mateLost"] == 0, "shooters are unharmed"
    assert A["lockedX"] and A["faces"] == [1, 1], "caster cannot walk off; shooters face the target"
    assert A["projGone"] and not A["toolAtEnd"], "streams end, caster released"
    assert A["snap"] and len(A["snap"]) == 4 and A["toolK"] == "proton", "guests get the lock"
    # the closest living teammate (760), not the far one (100), is the second shooter
    assert A["proj"]["net"] == [A["ids"]["a"], A["ids"]["mate"], A["ids"]["foe"]], (A["proj"], A["ids"])
    assert 5 < A["moved"] < 60, f"once the streams are gone the caster can walk again (retreat): {A['moved']}"
    # --- B: one stream blocked: 2 per tick, no crossed blast
    assert 10 <= B["foeLost"] <= 22, f"single stream only: {B['foeLost']}"
    assert all(d <= 2.5 for d in B["dmg"]) and not [e for e in B["x"] if e["r"] >= 30 and abs(e["x"] - 1100) < 40], B["dmg"]
    # --- C: out of range
    assert C["foeLost"] == 0 and C["projGone"], "out of range: nothing reaches the target"
    # --- D: the worm in the way is burnt instead
    assert D["foeLost"] == 0 and D["blockerLost"] >= 20, (D["foeLost"], D["blockerLost"])
    # --- E/F: misses consume nothing and start nothing
    for k, msg in (("E", "Needs a teammate"), ("F1", "Click an enemy worm"), ("F2", "Click an enemy worm")):
        assert msg in r[k]["msgs"] and r[k]["ammoUsed"] == 0 and r[k]["proj"] is None and r[k]["foeLost"] == 0, (k, r[k])
    # --- G: target dies: the stream stops, no hang
    assert G["foeDead"] and G["projGone"] and not G["toolAtEnd"]
    # --- H: shooters never block or burn each other
    assert H["dmg"][:7] == [6] * 7 and H["mateLost"] == 0 and H["aLost"] == 0, (H["dmg"], H["mateLost"], H["aLost"])
    assert r["icon"] and r["cat"] == "anime", r["cat"]   # shown on the 'anime' tab of the weapon panel
    finish(errors)
