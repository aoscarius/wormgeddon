"""Proton Stream: click an enemy worm; the caster and up to two living teammates nearest to it shoulder proton rifles
and burn that one worm. Streams that reach it cross (more damage per tick as more of them do, and a blast at the end);
a stream stopped by ground or another worm does not reach it; out of range does not reach it; no teammate / no enemy
under the click = miss."""
from common import game_page, finish, BASE
from arena import ARENA_JS

JS = ARENA_JS + """
const run = ([base]) => {
  const w = window.__wh, out = {};
  // o.mates: x of each teammate, nearest-first order is up to the test; o.foeX; o.worms: team size
  const setup = (o = {}) => {
    w.newGame(Object.assign({seed: 'pr'}, base, o.worms ? {worms: o.worms} : {}), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
    const g = w.G;
    for (let i = 0; i < 30; i++) w.stepOnce(1/60);
    arena(700);
    g.round = 9;
    const a = g.worms.find(x => x.id === g.active), t = g.teams[a.team];
    t.ammo.proton = 3;
    const mates = g.worms.filter(x => x !== a && x.team === a.team), foes = g.worms.filter(x => x.team !== a.team);
    g.worms.forEach((q, i) => stand(q, 60 + 25 * i));
    stand(a, 800); a.face = 1;
    const mx = o.mates || [760, 100];
    mates.forEach((m, i) => stand(m, mx[i] ?? 40 + 20 * i));
    stand(foes[0], o.foeX ?? 1100); foes.slice(1).forEach((f, i) => stand(f, 1800 + 30 * i));
    for (let i = 0; i < 10; i++) w.stepOnce(1/60);
    g.weapon.id = 'proton';
    return {g, a, t, mates, mate: mates[0], far: mates[1], foe: foes[0], blocker: foes[1], hp: {foe: foes[0].hp, mate: mates[0].hp, a: a.hp, blocker: foes[1].hp}};
  };
  const shoot = (s, secs, click, hook) => {
    const r = {msgs: [], x: [], dmg: [], firstDmgAt: null, proj: null, snap: null, t0: s.g.time, lockedX: true, rig: null};
    const old = window.emit; let last = s.foe.hp; const x0 = s.a.x;
    window.emit = e => { if (e.e === 'msg') r.msgs.push(e.t); if (e.e === 'x') r.x.push({x: e.x, y: e.y, r: e.r, t: s.g.time - r.t0}); if (e.e === 'cv') r.cv.push({x: e.x, y: e.y, r: e.r, s: e.s}); if (e.e === 'say') r.say.push(e.t); return old(e); };
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
      if (p && !r.proj) r.proj = {net: p.net.slice()};
      if (p && !r.snap && p.life > 1) {
        const q = snapshot(true).p.find(q => q[1] === 'proton'); r.snap = q && q[9];
        r.toolK = snapshot(true).w.find(q => q[0] === s.a.id)[9];
        r.rig = [s.a, ...s.mates].map(m => !!protonRig(m));
      }
      if (s.foe.hp < last) { if (r.firstDmgAt === null) r.firstDmgAt = t; r.dmg.push(last - s.foe.hp); last = s.foe.hp; }
      if (p && Math.abs(s.a.x - x0) > 0.5) r.lockedX = false;     // only while the streams are on
      if (i % 5 === 0 && p) { CAM.x = (s.a.x + s.foe.x) / 2; CAM.y = 650; CAM.z = 1; CAM.s = 1; render(); }
    }
    LOCAL.r = 0; window.emit = old;
    r.ammoUsed = ammo0 - s.t.ammo.proton; r.toolAtEnd = !!s.a.tool; r.projGone = !s.g.projs.some(q => q.t === 'proton');
    r.foeLost = s.hp.foe - s.foe.hp; r.mateLost = s.hp.mate - s.mate.hp; r.aLost = s.hp.a - s.a.hp; r.blockerLost = s.hp.blocker - s.blocker.hp;
    r.ids = {a: s.a.id, mates: s.mates.map(m => m.id), foe: s.foe.id}; r.moved = s.a.x - x0;
    r.foeDead = s.foe.dead; r.faces = [s.a.face, s.mate.face];
    return r;
  };
  // A) team of 3, clear line for the near partner; the third is out of range: two crossed streams
  let s = setup();
  out.A = shoot(s, 6);
  // B) the partner's stream is stopped by a steel wall right in front of it: only the caster's reaches the target
  s = setup({mates: [700, 100]});
  emit({e: 'gd', x: 722, y: 620, a: Math.PI / 2, l: 200});
  out.B = shoot(s, 6);
  // C) out of range (> 450 px)
  s = setup({foeX: 1330});
  out.C = shoot(s, 6);
  // D) a worm in the way takes the streams instead of the target
  s = setup(); stand(s.blocker, 950);
  out.D = shoot(s, 6);
  // E) lone worm: no teammate -> miss, nothing consumed
  s = setup(); s.mates.forEach(m => { m.dead = true; });
  out.E = shoot(s, 1);
  // F) click on empty ground / on a teammate -> miss
  s = setup(); out.F1 = shoot(s, 1, {x: 1500, y: 600});
  s = setup(); out.F2 = shoot(s, 1, {x: s.mate.x, y: s.mate.y});
  // G) target dies mid-stream: it just stops
  s = setup();
  out.G = shoot(s, 4, null, (i) => { if (i === 90) { s.foe.hp = 0; s.foe.dead = true; } });
  // H) the partner stands between the caster and the target: the streams pass through their own shooters
  s = setup({mates: [860, 100]});
  out.H = shoot(s, 6);
  // I) all three shooters in range: three crossed streams
  s = setup({mates: [760, 700]});
  out.I = shoot(s, 6);
  // M) a stream hits a mine: it detonates.
  s = setup();
  const mine = spawnProj('mine', 850, s.a.y - 4, 0, 0, null, {grounded: true});
  out.M = shoot(s, 1.5);
  out.M.mineDead = mine.dead;
  // N) a stream hits an oil drum: it ignites and explodes.
  s = setup();
  const drumX = 850, drumY = s.a.y - 4;
  const drum = {id: s.g.nid++, k: 'drum', x: drumX, y: drumY, r: 7, kill: false, lit: 0, vx: 0, vy: 0, grounded: true, air: 0};
  s.g.objs.push(drum);
  out.N = shoot(s, 2);
  out.N.drumExploded = out.N.x.some(e => Math.abs(e.x - drumX) < 20 && Math.abs(e.y - drumY) < 20);
  // J) a team of 5: only the caster + the two NEAREST teammates shoot; the farther two get no rifle
  s = setup({worms: 5, mates: [700, 500, 760, 100]});     // nearest to the caster: 760 (idx 2), 700 (idx 0)
  out.J = shoot(s, 6);
  // K) 'or the remaining ones': one of the two partners is dead -> caster + the one left
  s = setup({mates: [760, 700]}); s.far.dead = true;
  out.K = shoot(s, 6);
  // L) a shooter dies mid-stream: it drops out, the others carry on
  s = setup({mates: [760, 700]});
  out.L = shoot(s, 6, null, (i) => { if (i === 100) { s.far.hp = 0; s.far.dead = true; } });
  out.icon = !!weaponIconURL('proton'); out.cat = WEAPONS.proton.cat;
  return out;
};
"""

with game_page(viewport={"width": 1100, "height": 700}) as (pg, errors):
    r = pg.evaluate("([b]) => {" + JS + "return run([b]); }", [BASE])
    for k in "ABCDEGHIJKL": print(k, {a: b for a, b in r[k].items() if a in ("dmg", "proj", "snap", "foeLost", "foeDead", "rig", "msgs", "mateLost", "aLost", "blockerLost")})
    A, B, C, D, E, G, H, I, J, K, L = (r[k] for k in "ABCDEGHIJKL")

    # --- A: team of 3 -> three shooters (caster + both partners, nearest first); two streams reach the target: crossed
    assert A["proj"] and A["ammoUsed"] == 1 and "Proton stream" in A["msgs"]
    assert A["proj"]["net"][0] == A["ids"]["foe"] and A["proj"]["net"][2:] == [A["ids"]["a"]] + A["ids"]["mates"], (A["proj"], A["ids"])
    assert A["firstDmgAt"] is not None and A["firstDmgAt"] >= 0.69, f"rifles are raised first: {A['firstDmgAt']}"
    ticks = [d for d in A["dmg"] if d <= 6.5]
    assert len(ticks) >= 7 and all(d == 6 for d in ticks[:7]), f"6 damage per tick with two streams: {A['dmg']}"
    big = [e for e in A["x"] if e["r"] >= 30]
    assert big and abs(big[0]["x"] - 1100) < 25 and 2.9 < big[0]["t"] < 3.4, f"blast at the crossing at the end: {big}"
    assert A["foeLost"] >= 60, A["foeLost"]
    assert A["aLost"] == 0 and A["mateLost"] == 0, "shooters are unharmed"
    assert A["lockedX"] and A["faces"] == [1, 1], "caster cannot walk off; shooters face the target"
    assert A["projGone"] and not A["toolAtEnd"], "streams end, caster released"
    assert 5 < A["moved"] < 60, f"once the streams are gone the caster can walk again (retreat): {A['moved']}"
    assert A["snap"] and len(A["snap"]) == 5 and A["toolK"] == "proton", "guests get the lock and the shooter list"
    assert A["rig"] == [True, True, True], "every shooter carries a rifle"
    # --- B: one stream blocked: 2 per tick, no crossed blast
    assert 10 <= B["foeLost"] <= 22, f"single stream only: {B['foeLost']}"
    assert all(d <= 2.5 for d in B["dmg"]) and not [e for e in B["x"] if e["r"] >= 30 and abs(e["x"] - 1100) < 40], B["dmg"]
    assert any(e["r"] == 2 for e in B["cv"]), f"ground impact should emit a small crater: {B['cv']}"
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
    # --- I: three streams cross: 10 per tick and a bigger blast, which kills
    assert I["dmg"][:7] == [10] * 7 and I["foeLost"] >= 100, I["dmg"]      # lethal (dead is flagged when the turn settles)
    assert [e for e in I["x"] if e["r"] >= 40], "bigger blast with three streams"
    assert "We came, we saw, we kicked its ass!" in I["say"], I["say"]
    # --- M: a stream hits a mine: it detonates.
    assert M["mineDead"] and M["x"], f"the hit mine should detonate: {M}"
    # --- M: a stream hits an oil drum: it ignites and explodes.
    assert N["drumExploded"], f"the hit oil drum should explode: {N}"
    # --- J: a team of 5: the caster and the two nearest only
    ids = J["ids"]["mates"]            # mates in placement order: x = 700, 500, 760, 100
    assert J["proj"]["net"][2:] == [J["ids"]["a"], ids[2], ids[0]], (J["proj"], J["ids"])
    assert J["rig"] == [True, True, False, True, False], J["rig"]       # [caster, 700, 500, 760, 100]
    assert J["dmg"][:7] == [10] * 7, J["dmg"]
    # --- K: only one partner left: two shooters
    assert len(K["proj"]["net"]) == 4 and K["dmg"][:7] == [6] * 7, (K["proj"], K["dmg"])
    # --- L: a shooter dies mid-stream: it drops out (10 -> 6 per tick), the rest carry on
    assert L["dmg"][0] == 10 and 6 in L["dmg"] and L["projGone"] and not L["toolAtEnd"], L["dmg"]
    assert r["icon"] and r["cat"] == "anime", r["cat"]   # shown on the 'anime' tab of the weapon panel
    finish(errors)
