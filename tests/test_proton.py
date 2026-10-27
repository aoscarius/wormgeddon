"""Proton Stream: click an enemy worm. It needs a living teammate, and the caster plus at least one teammate must stand
within PROTON_MAX_DIST (250 px) of the target; the caster and the (up to) two in-range teammates nearest to the caster
shoulder proton rifles and burn that one worm. Streams that reach it cross (more damage per tick as more of them do,
and a blast at the end); a stream stopped by ground or another worm does not reach it (ground hits leave a small
crater, mines and oil drums in a stream's way go off); no teammate / nobody in range / no enemy under the click = a
miss that costs nothing."""
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
    const mx = o.mates || [760, 100];      // the second teammate starts far away: out of range, never a shooter
    mates.forEach((m, i) => stand(m, mx[i] ?? 40 + 20 * i));
    stand(foes[0], o.foeX ?? 1000); foes.slice(1).forEach((f, i) => stand(f, 1800 + 30 * i));
    for (let i = 0; i < 10; i++) w.stepOnce(1/60);
    g.weapon.id = 'proton';
    return {g, a, t, mates, mate: mates[0], far: mates[1], foe: foes[0], blocker: foes[1], hp: {foe: foes[0].hp, mate: mates[0].hp, a: a.hp, blocker: foes[1].hp}};
  };
  const shoot = (s, secs, click, hook) => {
    const r = {hpStart: {a: s.a.hp, mate: s.mate.hp}, msgs: [], msgArgs: [], cv: [], say: [], x: [], dmg: [], firstDmgAt: null, proj: null, snap: null, t0: s.g.time, lockedX: true, rig: null};
    const old = window.emit; let last = s.foe.hp; const x0 = s.a.x;
    window.emit = e => { if (e.e === 'msg') { r.msgs.push(e.t); r.msgArgs.push(e.a ? e.a[0] : null); } if (e.e === 'x') r.x.push({x: e.x, y: e.y, r: e.r, t: s.g.time - r.t0}); if (e.e === 'cv') r.cv.push({x: e.x, y: e.y, r: e.r, s: e.s}); if (e.e === 'say') r.say.push(e.t); return old(e); };
    const ammo0 = s.t.ammo.proton;
    LOCAL.clicks.push(click || {x: s.foe.x, y: s.foe.y - 4});
    for (let i = 0; i < 60 * secs; i++) {
      if (hook) hook(i, r);
      if (i === 5) LOCAL.l = 1;                         // the caster tries to walk away while the streams are on: locked
      if (i === 100) LOCAL.l = 0;
      if (i === 230) LOCAL.l = 1;                       // ...and walks off (away from the blast's flames) once they are gone (retreat): free again
      if (i === 260) LOCAL.l = 0;
      w.stepOnce(1/60);
      const t = s.g.time - r.t0, p = s.g.projs.find(q => q.t === 'proton');
      if (p && !r.proj) r.proj = {net: p.net.slice()};
      if (p && p.life >= 3.0 && !r.hpEnd) r.hpEnd = {a: s.a.hp, mate: s.mate.hp};     // end of the burn: before the blast and its random flames
      if (p && !r.snap && p.life > 1) {
        const q = snapshot(true).p.find(q => q[1] === 'proton'); r.snap = q && q[9];
        r.toolK = snapshot(true).w.find(q => q[0] === s.a.id)[9];
        r.rig = [s.a, ...s.mates].map(m => !!protonRig(m));
        r.faces = [s.a.face, s.mate.face];                 // while the streams are on
      }
      if (s.foe.hp < last) { if (r.firstDmgAt === null) r.firstDmgAt = t; r.dmg.push(last - s.foe.hp); last = s.foe.hp; }
      if (p && Math.abs(s.a.x - x0) > 0.5) r.lockedX = false;     // only while the streams are on
      if (i % 5 === 0 && p) { CAM.x = (s.a.x + s.foe.x) / 2; CAM.y = 650; CAM.z = 1; CAM.s = 1; render(); }
    }
    LOCAL.l = 0; window.emit = old;
    r.ammoUsed = ammo0 - s.t.ammo.proton; r.toolAtEnd = !!s.a.tool; r.projGone = !s.g.projs.some(q => q.t === 'proton');
    r.foeLost = s.hp.foe - s.foe.hp; r.mateLost = s.hp.mate - s.mate.hp; r.aLost = s.hp.a - s.a.hp; r.blockerLost = s.hp.blocker - s.blocker.hp;
    r.ids = {a: s.a.id, mates: s.mates.map(m => m.id), foe: s.foe.id}; r.moved = x0 - s.a.x;
    r.foeDead = s.foe.dead;
    return r;
  };
  // A) team of 3: the far teammate (100) is out of range, so caster + the near teammate shoot: two crossed streams
  let s = setup();
  out.A = shoot(s, 6);
  // B) a thick block of terrain right in front of the teammate (700, exactly 250 px from the target) stops its stream: only the caster's reaches the
  // target. (Streams carve a 2 px crater at each ground hit every tick, so a thin wall would be bored through.)
  s = setup({mates: [700, 100], foeX: 950}); for (let y = 600; y < 700; y++) T.mask.fill(1, y * T.w + 712, y * T.w + 790);
  out.B = shoot(s, 6);
  // C) the gate: the caster must be within 250 px of the target (250 passes, 251 does not) ...
  s = setup({foeX: 1050, mates: [900, 100]}); out.C250 = shoot(s, 1);
  s = setup({foeX: 1051, mates: [900, 100]}); out.C251 = shoot(s, 1);
  // ... and so must at least one teammate (249 passes, 251 does not)
  s = setup({foeX: 1010, mates: [761, 100]}); out.T249 = shoot(s, 1);
  s = setup({foeX: 1010, mates: [759, 100]}); out.T251 = shoot(s, 1);
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
  // I) both teammates in range: three crossed streams
  s = setup({mates: [760, 850]});
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
  // J) a team of 5: the shooters are the caster and the two in-range teammates NEAREST TO THE CASTER (760, 900), not 1040 (on the far side of the target)
  s = setup({worms: 5, mates: [900, 760, 1040, 300]});
  out.J = shoot(s, 6);
  // K) one of the two partners is dead -> caster + the one left
  s = setup({mates: [760, 850]}); s.far.dead = true;
  out.K = shoot(s, 6);
  // L) a shooter dies mid-stream: it drops out, the others carry on
  s = setup({mates: [760, 850]});
  out.L = shoot(s, 6, null, (i) => { if (i === 100) { s.far.hp = 0; s.far.dead = true; } });
  // O) the target is thrown out of the streams' reach (450 px) mid-stream: they stop reaching it, nothing breaks
  s = setup();
  out.O = shoot(s, 6, null, (i) => { if (i === 100) { s.foe.x += 600; s.foe.vx = 0; } });
  out.icon = !!weaponIconURL('proton'); out.cat = WEAPONS.proton.cat;
  return out;
};
"""

with game_page(viewport={"width": 1100, "height": 700}) as (pg, errors):
    r = pg.evaluate("([b]) => {" + JS + "return run([b]); }", [BASE])
    for k in ("A", "B", "I", "J", "O"): print(k, {a: b for a, b in r[k].items() if a in ("dmg", "proj", "foeLost", "rig", "msgs", "mateLost", "aLost", "blockerLost")})
    A, B, D, E, G, H, I, J, K, L, M, N, O = (r[k] for k in ("A", "B", "D", "E", "G", "H", "I", "J", "K", "L", "M", "N", "O"))
    GATE = "At least two worms must be within {0} px of the target"

    # --- A: caster + the one in-range teammate; two streams reach the target: crossed
    assert A["proj"] and A["ammoUsed"] == 1 and "Proton stream" in A["msgs"]
    assert A["proj"]["net"][0] == A["ids"]["foe"] and A["proj"]["net"][2:] == [A["ids"]["a"], A["ids"]["mates"][0]], (A["proj"], A["ids"])
    assert A["firstDmgAt"] is not None and A["firstDmgAt"] >= 0.69, f"rifles are raised first: {A['firstDmgAt']}"
    ticks = [d for d in A["dmg"] if d <= 6.5]
    assert len(ticks) >= 7 and all(d == 6 for d in ticks[:7]), f"6 damage per tick with two streams: {A['dmg']}"
    big = [e for e in A["x"] if e["r"] >= 30]
    assert big and abs(big[0]["x"] - 1000) < 25 and 2.9 < big[0]["t"] < 3.4, f"blast at the crossing at the end: {big}"
    assert A["foeLost"] >= 60, A["foeLost"]
    assert A["hpEnd"] == A["hpStart"], f"the streams do not hurt the shooters: {A['hpStart']} -> {A['hpEnd']}"
    assert A["lockedX"] and A["faces"] == [1, 1], "caster cannot walk off; shooters face the target"
    assert A["projGone"] and not A["toolAtEnd"], "streams end, caster released"
    assert 5 < A["moved"] < 60, f"once the streams are gone the caster can walk again (retreat): {A['moved']}"
    assert A["snap"] and len(A["snap"]) == 4 and A["toolK"] == "proton", "guests get the lock and the shooter list"
    assert A["rig"] == [True, True, False], "only the shooters carry a rifle (the far teammate does not)"
    assert not A["say"], "the victory line is for three crossed streams only"
    # --- B: one stream blocked: 2 per tick, no crossed blast, the wall is cratered
    assert 10 <= B["foeLost"] <= 22, f"single stream only: {B['foeLost']}"
    assert all(d <= 2.5 for d in B["dmg"]) and not [e for e in B["x"] if e["r"] >= 30 and abs(e["x"] - 950) < 40], B["dmg"]
    assert any(e["r"] == 2 for e in B["cv"]), f"ground impact should emit a small crater: {B['cv']}"
    # --- C / T: the 250 px gate (caster, then a teammate)
    assert r["C250"]["proj"] and r["C250"]["ammoUsed"] == 1, "250 px from the target: in range"
    assert r["T249"]["proj"] and r["T249"]["ammoUsed"] == 1, "a teammate 249 px from the target: in range"
    for k in ("C251", "T251"):
        v = r[k]
        assert GATE in v["msgs"] and 250 in v["msgArgs"] and v["ammoUsed"] == 0 and v["proj"] is None and v["foeLost"] == 0, (k, v["msgs"], v["msgArgs"])
    # --- D: the worm in the way is burnt instead
    assert D["foeLost"] == 0 and D["blockerLost"] >= 20, (D["foeLost"], D["blockerLost"])
    # --- E/F: misses consume nothing and start nothing
    for k, msg in (("E", "Needs a teammate"), ("F1", "Click an enemy worm"), ("F2", "Click an enemy worm")):
        assert msg in r[k]["msgs"] and r[k]["ammoUsed"] == 0 and r[k]["proj"] is None and r[k]["foeLost"] == 0, (k, r[k])
    # --- G: target dies: the stream stops, no hang
    assert G["foeDead"] and G["projGone"] and not G["toolAtEnd"]
    # --- H: shooters never block or burn each other
    assert H["dmg"][:7] == [6] * 7 and H["hpEnd"] == H["hpStart"], (H["dmg"], H["hpStart"], H["hpEnd"])
    # --- I: three streams cross: 10 per tick and a bigger blast, which kills
    assert I["dmg"][:7] == [10] * 7 and I["foeLost"] >= 100, I["dmg"]      # lethal (dead is flagged when the turn settles)
    assert [e for e in I["x"] if e["r"] >= 40], "bigger blast with three streams"
    assert "We came, we saw, we kicked its ass!" in I["say"], I["say"]
    # --- M: a stream hits a mine: it detonates.
    assert M["mineDead"] and M["x"], f"the hit mine should detonate: {M}"
    # --- N: a stream hits an oil drum: it ignites and explodes.
    assert N["drumExploded"], f"the hit oil drum should explode: {N}"
    # --- J: a team of 5: the caster and the two in-range teammates nearest to the caster
    ids = J["ids"]["mates"]            # mates in placement order: x = 900, 760, 1040, 300
    assert J["proj"]["net"][2:] == [J["ids"]["a"], ids[1], ids[0]], (J["proj"], J["ids"])
    assert J["rig"] == [True, True, True, False, False], J["rig"]       # [caster, 900, 760, 1040, 300]
    assert J["dmg"][:7] == [10] * 7, J["dmg"]
    # --- K: only one partner left: two shooters
    assert len(K["proj"]["net"]) == 4 and K["dmg"][:7] == [6] * 7, (K["proj"], K["dmg"])
    # --- L: a shooter dies mid-stream: it drops out (10 -> 6 per tick), the rest carry on
    assert L["dmg"][0] == 10 and 6 in L["dmg"] and L["projGone"] and not L["toolAtEnd"], L["dmg"]
    # --- O: a target thrown out of reach stops being hurt, and no crossed blast follows
    assert O["dmg"][:3] == [6] * 3 and len(O["dmg"]) <= 5 and O["projGone"] and not O["toolAtEnd"], O["dmg"]
    assert not [e for e in O["x"] if e["r"] >= 30], "no blast at the thrown target"
    assert r["icon"] and r["cat"] == "anime", r["cat"]   # shown on the 'anime' tab of the weapon panel
    finish(errors)
