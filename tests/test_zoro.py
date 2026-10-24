"""Oni Giri (Zoro's Ogre Cutter): three swords, a short charge, then a dash straight ahead that slices every worm it
passes through the instant it passes - once each - and nobody else."""
from common import game_page, finish, BASE
from arena import ARENA_JS

JS = ARENA_JS + """
const run = ([base]) => {
  const w = window.__wh, out = {};
  const setup = (xs) => {
    w.newGame(Object.assign({seed: 'zr'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
    const g = w.G;
    for (let i = 0; i < 30; i++) w.stepOnce(1/60);
    arena(700);
    g.round = 9;
    const a = g.worms.find(x => x.id === g.active), t = g.teams[a.team];
    t.ammo.onigiri = 3;
    const others = g.worms.filter(x => x !== a);
    others.forEach((o, i) => stand(o, 60 + 25 * i));
    stand(a, 800); a.face = 1; a.aim = 0;
    const named = {};
    xs.forEach((x, i) => { named['w' + i] = stand(others[i], x); });
    for (let i = 0; i < 10; i++) w.stepOnce(1/60);
    g.weapon.id = 'onigiri';
    return {g, a, named, hp: Object.fromEntries(Object.entries(named).map(([k, o]) => [k, o.hp])), hpA: a.hp};
  };
  const play = (s, secs, hook) => {
    const r = {slash: 0, draw: 0, swoosh: 0, phases: [], moved: null, hit: {}, x0: s.a.x, toolAt: {}, snap: null};
    const old = window.emit; const t0 = s.g.time;
    window.emit = e => { if (e.e === 'slash') r.slash++; if (e.e === 'snd' && e.s === 'draw') r.draw++; if (e.e === 'snd' && e.s === 'swoosh') r.swoosh++; return old(e); };
    const last = Object.fromEntries(Object.entries(s.named).map(([k, o]) => [k, o.hp]));
    LOCAL.fireP = 1;
    for (let i = 0; i < 60 * secs; i++) {
      if (hook) hook(i);
      w.stepOnce(1/60);
      const t = s.g.time - t0;
      if (s.a.tool) { if (!r.phases.includes(s.a.tool.ph)) r.phases.push(s.a.tool.ph); r.toolAt[s.a.tool.ph] = r.toolAt[s.a.tool.ph] ?? t; }
      if (r.moved === null && Math.abs(s.a.x - r.x0) > 1) r.moved = t;
      for (const [k, o] of Object.entries(s.named)) if (o.hp < last[k]) { r.hit[k] = r.hit[k] || {n: 0, dmg: 0, gap: s.a.x - o.x, t}; r.hit[k].n++; r.hit[k].dmg += last[k] - o.hp; last[k] = o.hp; }
      if (s.a.tool && s.a.tool.ph === 1 && !r.snap) { const q = snapshot(true).w.find(q => q[0] === s.a.id); r.snap = [q[9], q[11]]; }
      if (i % 4 === 0) { CAM.x = s.a.x + 100; CAM.y = s.a.y; CAM.z = 1; CAM.s = 3; render(); }
    }
    window.emit = old;
    r.end = s.a.x; r.toolDone = !s.a.tool;
    r.lost = Object.fromEntries(Object.entries(s.named).map(([k, o]) => [k, s.hp[k] - o.hp]));
    r.aLost = s.hpA - s.a.hp;
    return r;
  };
  // A) two worms in line (950, 1010), one just behind the attacker (770), one far away ahead (1700, out of reach)
  let s = setup([950, 1010, 770, 1700]);
  out.A = play(s, 5, i => { if (i === 15 || i === 40) LOCAL.fireP = 1; });     // Space during the charge does nothing
  // B) nobody in front: it still dashes a fixed distance and cuts nobody
  s = setup([770, 1700]);
  out.B = play(s, 5);
  // C) the turn clock running out does not cut it short
  s = setup([950]); s.g.timer = 0.3;
  out.C = play(s, 5);
  // robustness: a missing FX.slashes (stale view.js) must not crash the frame loop, the event or the renderer
  w.newGame(Object.assign({seed: 'zr'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
  delete FX.slashes; out.noList = {};
  for (const [k, f] of [['update', () => fxUpdate(0.016)], ['event', () => applyEvent({e: 'slash', x: 100, y: 100, f: 1})], ['render', () => render()]]) {
    try { f(); out.noList[k] = 'ok'; } catch (e) { out.noList[k] = e.message; }
  }
  out.icon = !!weaponIconURL('onigiri');
  return out;
};
"""

with game_page(viewport={"width": 1100, "height": 700}) as (pg, errors):
    r = pg.evaluate("([b]) => {" + JS + "return run([b]); }", [BASE])
    A, B, C = r["A"], r["B"], r["C"]
    print("A", A); print("B", {k: v for k, v in B.items() if k != "hit"}); print("C", {k: v for k, v in C.items() if k != "hit"})
    DMG = 38
    # --- A
    assert A["draw"] == 1 and A["swoosh"] == 1 and A["phases"] == [0, 1, 2], A["phases"]
    assert 0.85 < A["moved"] < 1.1, f"charges for ~0.9 s before moving: {A['moved']}"
    for k in ("w0", "w1"):
        h = A["hit"].get(k)
        assert h and h["n"] == 1 and h["dmg"] == DMG, f"{k} sliced exactly once for {DMG}: {h}"
        assert -7.5 <= h["gap"] <= 19, f"{k}: sliced as the attacker passes through it (gap {h['gap']})"
    assert A["hit"]["w0"]["t"] < A["hit"]["w1"]["t"], "first worm is cut before the second"
    assert A["lost"]["w2"] == 0 and A["lost"]["w3"] == 0 and A["aLost"] == 0, "behind / out of reach / the attacker: unharmed"
    assert A["slash"] == 2
    assert 1010 + 50 <= A["end"] <= 1010 + 75, f"ends just past the last worm: {A['end']}"
    assert A["toolDone"] and A["snap"] == ["oni", 1], A["snap"]
    # --- B: a miss
    assert B["slash"] == 0 and all(v == 0 for v in B["lost"].values()) and B["aLost"] == 0
    assert 148 <= B["end"] - B["x0"] <= 152, B["end"] - B["x0"]
    # --- C
    assert C["hit"].get("w0") and C["end"] > 950 + 50, "turn clock does not interrupt the dash"
    assert r["noList"] == {"update": "ok", "event": "ok", "render": "ok"}, r["noList"]
    assert r["icon"]
    finish(errors)
