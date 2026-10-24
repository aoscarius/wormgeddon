"""Kamehameha: a 1.3 s charge, then a beam along the aim across the whole map that carves a straight tunnel of a fixed
radius and damages / destroys worms, mines, oil drums and crates in its path - and nothing off its line."""
from common import game_page, finish, BASE
from arena import ARENA_JS

JS = ARENA_JS + """
const run = ([base]) => {
  const w = window.__wh, out = {};
  const setup = (aim) => {
    w.newGame(Object.assign({seed: 'kh'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
    const g = w.G;
    for (let i = 0; i < 30; i++) w.stepOnce(1/60);
    arena(700);
    g.round = 9;
    const a = g.worms.find(x => x.id === g.active), t = g.teams[a.team];
    t.ammo.kamehameha = 3;
    const others = g.worms.filter(x => x !== a);
    const foe = others.find(x => x.team !== a.team), mate = others.find(x => x !== foe && x.team === a.team) || others[1];
    others.forEach((o, i) => stand(o, 60 + 25 * i));
    // a terrain mound (x 1000-1200, top y 560) right in the line of fire
    for (let y = 560; y < 700; y++) T.mask.fill(1, y * T.w + 1000, y * T.w + 1200);
    stand(a, 800); a.face = 1; a.aim = aim;
    stand(foe, 1500);
    mate.x = 1100; mate.y = 560 - mate.r - 1; mate.vx = mate.vy = 0; mate.grounded = true;   // on top of the mound, off the line
    const mine = w.spawnProj('mine', 1300, 690, 0, 0, null, {armed: true});
    const drum = {id: g.nid++, k: 'drum', x: 1400, y: 692, vx: 0, vy: 0, r: 7, lit: 0, bounce: 0, fric: 0.5}; g.objs.push(drum);
    const crate = {id: g.nid++, k: 'crate', type: 'health', item: null, x: 1600, y: 692, vx: 0, vy: 0, r: 7, landed: true, bounce: 0, fric: 0.5}; g.objs.push(crate);
    for (let i = 0; i < 10; i++) w.stepOnce(1/60);
    g.weapon.id = 'kamehameha';
    return {g, a, foe, mate, mine, drum, crate, hp: {a: a.hp, foe: foe.hp, mate: mate.hp}};
  };
  const shot = (s, secs) => {
    const r = {firstBeamAt: null, toolP: [], mid: null, maxHd: 0, L: null, evx: [], snapNet: null, lastBeamAt: null, tolerated: 0};
    const old = window.emit, t0 = s.g.time;
    window.emit = e => { if (e.e === 'x') r.evx.push({x: e.x, y: e.y, r: e.r}); return old(e); };
    LOCAL.fireP = 1;
    for (let i = 0; i < 60 * secs; i++) {
      w.stepOnce(1/60);
      const t = s.g.time - t0, b = s.g.projs.find(p => p.t === 'kamebeam');
      if (s.a.tool && s.a.tool.p !== undefined && i % 6 === 0) r.toolP.push(s.a.tool.p);
      if (!b && r.firstBeamAt === null && i === 50) r.preBeamMask = T.mask[691 * T.w + 1100];     // still charging: nothing carved yet
      if (b) {
        if (r.firstBeamAt === null) { r.firstBeamAt = t; r.L = b.net[5]; r.ang = b.net[2]; r.o = [b.net[0], b.net[1]]; }
        r.maxHd = Math.max(r.maxHd, b.net[3]); r.lastBeamAt = t;
        if (r.snapNet === null && b.net[3] > 200) r.snapNet = snapshot(true).p.find(q => q[1] === 'kamebeam')[9];
        if (i % 5 === 0) { CAM.x = 1200; CAM.y = 600; CAM.z = 1; CAM.s = 1; render(); }
      } else if (s.a.tool && i % 5 === 0) { CAM.x = s.a.x; CAM.y = s.a.y; CAM.s = 3; render(); }   // charge ball
    }
    window.emit = old;
    r.beamGone = !s.g.projs.some(p => p.t === 'kamebeam');
    return r;
  };
  const mk = (x, y) => T.mask[Math.round(y) * T.w + Math.round(x)];

  // 1) horizontal shot through the mound
  let s = setup(0);
  const solidBefore = {a: mk(800, 705), behind: mk(700, 705), far: mk(2300, 705), mound: mk(1100, 691)};
  out.A = shot(s, 6);
  out.A.before = solidBefore;
  out.A.tunnel = {mid: mk(1100, 691), up15: mk(1100, 676), down15: mk(1100, 706), above26: mk(1100, 665), far: mk(2300, 705), edge: mk(T.w - 5, 705), behind: mk(700, 705), underShooter: mk(800, 700), x1050: mk(1050, 691), x1190: mk(1190, 691)};
  out.A.foeLost = s.hp.foe - s.foe.hp; out.A.foeDead = s.foe.dead; out.A.mateLost = s.hp.mate - s.mate.hp; out.A.aLost = s.hp.a - s.a.hp;
  out.A.mineGone = !s.g.projs.includes(s.mine) || s.mine.dead; out.A.drumGone = !s.g.objs.includes(s.drum); out.A.crateGone = !s.g.objs.includes(s.crate);
  out.A.boomMine = out.A.evx.some(e => Math.abs(e.x - 1300) < 40); out.A.boomDrum = out.A.evx.some(e => Math.abs(e.x - 1400) < 40);
  out.A.blocker = quietBlocker();

  // 2) shot aimed up: it flies out of the top of the map and leaves the mound alone
  s = setup(-1.0);
  const moundBefore = mk(1100, 691);
  out.B = shot(s, 6);
  out.B.moundAfter = mk(1100, 691); out.B.moundBefore = moundBefore; out.B.foeLost = s.hp.foe - s.foe.hp; out.B.mateLost = s.hp.mate - s.mate.hp;
  out.B.endY = out.B.o[1] + Math.sin(out.B.ang) * out.B.L; out.B.endX = out.B.o[0] + Math.cos(out.B.ang) * out.B.L;
  out.B.diag = mk(out.B.o[0] + Math.cos(out.B.ang) * 300, out.B.o[1] + Math.sin(out.B.ang) * 300);   // carved (it was air anyway)
  out.B.T = [T.w, T.h];
  return out;
};
"""

with game_page(viewport={"width": 1100, "height": 700}) as (pg, errors):
    r = pg.evaluate("([b]) => {" + JS + "return run([b]); }", [BASE])
    A, B = r["A"], r["B"]
    print({k: v for k, v in A.items() if k not in ("evx", "toolP", "snapNet")}); print("toolP", A["toolP"][:6], "snap", A["snapNet"]); print({k: v for k, v in B.items() if k not in ("evx", "toolP", "snapNet")})

    # charge: nothing happens for ~1.3 s, then the beam appears
    assert 1.2 < A["firstBeamAt"] < 1.45, A["firstBeamAt"]
    assert A["toolP"] and A["toolP"][0] < A["toolP"][-1] and max(A["toolP"]) <= 1, "charge progress grows"
    assert A["preBeamMask"] == 1, "no tunnel while charging"
    # whole map: the head reaches the full length, which ends beyond the right edge
    assert A["maxHd"] == A["L"] and A["o"][0] + A["L"] >= 2400 + 55, "beam spans the whole map"
    assert A["beamGone"] and A["lastBeamAt"] - A["firstBeamAt"] < 2.4, "beam ends after hold + fade"
    # tunnel: carved along the line with the fixed radius, intact elsewhere
    t, bf = A["tunnel"], A["before"]
    assert bf["mound"] == 1 and bf["far"] == 1 and bf["behind"] == 1
    assert t["mid"] == 0 and t["up15"] == 0 and t["down15"] == 0, "tunnel carved through the mound"
    assert t["above26"] == 1, "...but only as wide as its radius (20)"
    assert t["x1050"] == 0 and t["x1190"] == 0, "carved over the whole mound"
    assert t["far"] == 0 and t["edge"] == 0, "carved right up to the map edge"
    assert t["behind"] == 1 and t["underShooter"] == 1, "nothing carved behind or under the shooter"
    # victims
    assert A["foeLost"] >= 70 or A["foeDead"], f"worm in the beam: {A['foeLost']}"
    assert A["foeLost"] <= 100 or A["foeDead"]
    assert A["mateLost"] == 0 and A["aLost"] == 0, "worms off the line and the shooter are unharmed"
    assert A["mineGone"] and A["boomMine"], "mine destroyed"
    assert A["drumGone"] and A["boomDrum"], "oil drum blown up"
    assert A["crateGone"], "crate destroyed"
    assert A["blocker"] is None or "tool" not in A["blocker"]
    # guests receive the beam geometry
    assert A["snapNet"] and len(A["snapNet"]) == 6 and abs(A["snapNet"][0] - A["o"][0]) < 0.1
    # --- aimed up: straight line, out of the top, nothing else touched
    assert B["endY"] <= -419 and B["endX"] < B["T"][0] + 60, "beam ends where it leaves the map"
    assert B["moundBefore"] == 1 and B["moundAfter"] == 1, "the mound is not on the beam's line"
    assert B["diag"] == 0 and B["foeLost"] == 0 and B["mateLost"] == 0
    assert B["beamGone"]
    finish(errors)
