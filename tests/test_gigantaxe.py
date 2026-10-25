"""Gomu Gomu no Gigant Axe: the worm raises a foot that grows huge, then slams it straight down 60 px ahead. On impact
every worm within the crush radius (but the attacker) is flattened and dies on the spot; mines, oil drums and crates there are
destroyed; the ground is dented at the landing spot. Not cancellable, not cut by the turn clock."""
from common import game_page, finish, BASE
from arena import ARENA_JS

JS = ARENA_JS + """
const run = ([base]) => {
  const w = window.__wh, out = {};
  const spoken = []; speechSynthesis.speak = u => spoken.push({t: u.text, lang: u.lang});
  // o.foes = x of each enemy, o.mates = x of each teammate
  const setup = (o = {}) => {
    w.newGame(Object.assign({seed: 'ga'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
    const g = w.G;
    for (let i = 0; i < 30; i++) w.stepOnce(1/60);
    arena(700);
    g.round = 9;
    const a = g.worms.find(x => x.id === g.active), t = g.teams[a.team];
    t.ammo.gigantaxe = 3;
    const mates = g.worms.filter(x => x !== a && x.team === a.team), foes = g.worms.filter(x => x.team !== a.team);
    g.worms.forEach((q, i) => stand(q, 60 + 25 * i));
    stand(a, 800); a.face = 1;
    (o.mates || []).forEach((x, i) => stand(mates[i], x));
    (o.foes || []).forEach((x, i) => stand(foes[i], x));
    for (let i = 0; i < 10; i++) w.stepOnce(1/60);
    g.weapon.id = 'gigantaxe'; spoken.length = 0;
    return {g, a, t, mates, foes, hp: {a: a.hp}};
  };
  const play = (s, secs, hook) => {
    const r = {ps: [], phases: [], stompAt: null, stompR: null, flats: 0, dead: {}, deadAt: {}, x: [], t0: s.g.time, snap: null, toolDone: false};
    const old = window.emit;
    window.emit = e => { if (e.e === 'stomp') { r.stompAt = s.g.time - r.t0; r.stompR = e.r; } if (e.e === 'flat') r.flats++; if (e.e === 'x') r.x.push({x: e.x, y: e.y, r: e.r}); return old(e); };
    LOCAL.fireP = 1;
    for (let i = 0; i < 60 * secs; i++) {
      if (hook) hook(i, r);
      w.stepOnce(1/60);
      const t = s.g.time - r.t0;
      if (s.a.tool) { r.ps.push(s.a.tool.p); if (!r.phases.includes(s.a.tool.ph)) r.phases.push(s.a.tool.ph);
        if (!r.snap && s.a.tool.p > 0.5) { const q = snapshot(true).w.find(q => q[0] === s.a.id); r.snap = [q[9], q[11]]; } }
      for (const o of [...s.mates, ...s.foes]) if (o.dead && r.deadAt[o.id] === undefined) r.deadAt[o.id] = t;
      if (i % 3 === 0 && s.a.tool) { CAM.x = 900; CAM.y = 620; CAM.z = 1; CAM.s = 1; render(); }
    }
    window.emit = old; r.toolDone = !s.a.tool; r.aLost = s.hp.a - s.a.hp;
    return r;
  };
  const skinArea = () => {
    CAM.x = 900; CAM.y = 600; CAM.z = 1; CAM.s = 1; render();
    const hw = 80, hh = 130, x0 = Math.round(VW * DPR / 2 - hw * DPR), y0 = Math.round(VH * DPR / 2 - hh * DPR);
    const d = cvs.getContext('2d').getImageData(x0, y0, 2 * hw * DPR, 2 * hh * DPR).data; let n = 0;
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 244) < 16 && Math.abs(d[i+1] - 185) < 16 && Math.abs(d[i+2] - 168) < 16) n++;
    return n;
  };

  // A) impact centre 860: foes at 860, 895 (35 px), 930 (70 px: outside); own mate at 840 (friendly fire), another behind at 700
  let s = setup({foes: [860, 895, 930], mates: [840, 700]});
  out.A = play(s, 4);
  out.A.state = {f: s.foes.map(o => [o.dead, o.hp]), m: s.mates.map(o => [o.dead, o.hp])};
  out.A.ids = {f: s.foes.map(o => o.id), m: s.mates.map(o => o.id)};
  out.A.crater = {mid: T.mask[715 * T.w + 860], deep: T.mask[745 * T.w + 860], side: T.mask[705 * T.w + 930]};
  out.A.spoken = spoken.slice();
  // B) the radius edge: 54 px away is crushed, 59 px is not
  s = setup({foes: [914, 919]}); out.B = play(s, 3); out.B.state = s.foes.slice(0, 2).map(o => [o.dead, o.hp]);
  // C) objects, each alone (a blast would destroy its neighbours too): a mine, an oil drum, a crate inside; a crate outside
  const objScenario = (make) => {
    const s = setup({}); const o = make(s); const r = play(s, 4);
    r.gone = o.items.map(i => i.kind === 'mine' ? (i.p.dead || !s.g.projs.includes(i.p)) : !s.g.objs.includes(i.p));
    return r;
  };
  const crateAt = (s, x) => { const c = {id: s.g.nid++, k: 'crate', type: 'health', item: null, x, y: 692, vx: 0, vy: 0, r: 7, landed: true, bounce: 0, fric: 0.5}; s.g.objs.push(c); return c; };
  out.C1 = objScenario(s => ({items: [{kind: 'mine', p: w.spawnProj('mine', 890, 690, 0, 0, null, {armed: true})}]}));
  out.C2 = objScenario(s => { const d = {id: s.g.nid++, k: 'drum', x: 885, y: 692, vx: 0, vy: 0, r: 7, lit: 0, bounce: 0, fric: 0.5}; s.g.objs.push(d); return {items: [{kind: 'drum', p: d}]}; });
  out.C3 = objScenario(s => ({items: [{kind: 'crate', p: crateAt(s, 880)}, {kind: 'crate', p: crateAt(s, 1200)}]}));
  // D) Space and the turn clock do not interrupt it
  s = setup({foes: [890]}); s.g.timer = 0.3;
  out.D = play(s, 4, i => { if (i === 20 || i === 50) LOCAL.fireP = 1; });
  out.D.dead = s.foes[0].dead;
  // E) the foot really grows (screen pixels): small while rising, huge when it is up
  s = setup({}); let small = null, big = null; LOCAL.fireP = 1;
  for (let i = 0; i < 120 && !big; i++) {
    w.stepOnce(1/60);
    if (s.a.tool && s.a.tool.p >= 0.2 && small === null) small = skinArea();
    if (s.a.tool && s.a.tool.p >= 0.98) big = skinArea();
  }
  for (let i = 0; i < 120 && s.a.tool; i++) w.stepOnce(1/60);
  out.E = {small, big, crater: {mid: T.mask[715 * T.w + 860], deep: T.mask[745 * T.w + 860], side: T.mask[705 * T.w + 930], inner: T.mask[705 * T.w + 885], edge: T.mask[705 * T.w + 905]}};
  // F) geometry of the foot over the progress: rises and grows, then falls straight down onto the landing spot
  s = setup({}); const a = s.a, sp = axeSpot(a), geo = [];
  for (const p of [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]) geo.push(Object.assign({p}, axeFoot(a, p)));
  out.F = {spot: sp, geo, ax: a.x, ay: a.y};
  // G) a missing FX.flats (stale view.js) does not break anything
  delete FX.flats; out.G = {};
  for (const [k, f] of [['update', () => fxUpdate(0.016)], ['event', () => applyEvent({e: 'flat', x: 100, y: 100, t: 0})], ['render', () => render()]]) { try { f(); out.G[k] = 'ok'; } catch (e) { out.G[k] = e.message; } }
  out.icon = !!weaponIconURL('gigantaxe'); out.cat = WEAPONS.gigantaxe.cat;
  return out;
};
"""

with game_page(viewport={"width": 1100, "height": 700}) as (pg, errors):
    r = pg.evaluate("([b]) => {" + JS + "return run([b]); }", [BASE])
    A, B, D, E, F = r["A"], r["B"], r["D"], r["E"], r["F"]
    print("A", {k: v for k, v in A.items() if k in ("stompAt", "flats", "state", "deadAt", "crater", "snap", "phases")})
    print("B", B["state"], "C", [r[k]["gone"] for k in ("C1", "C2", "C3")], "D", D["dead"], D["stompAt"], "E", E, "G", r["G"])

    # --- A: timeline + crush
    assert A["phases"] == [0, 1, 2] and A["ps"][0] < 0.1 and A["ps"][-1] == 2 and A["toolDone"], A["phases"]
    assert all(b >= a for a, b in zip(A["ps"], A["ps"][1:])), "progress only grows"
    assert 1.15 < A["stompAt"] < 1.30 and A["stompR"] == 50, f"lands after the rise and the slam: {A['stompAt']}"
    f, m = A["state"]["f"], A["state"]["m"]
    assert f[0][0] and f[1][0] and f[0][1] <= 0 and f[1][1] <= 0, f"worms in the zone die: {f}"
    assert not f[2][0] and f[2][1] > 0, "70 px away: untouched"
    assert m[0][0], "friendly fire: your own worm in the zone is crushed too"
    assert not m[1][0] and m[1][1] == 100 and A["aLost"] == 0, "worm behind and the attacker are unharmed"
    for i in (0, 1):
        assert abs(A["deadAt"][str(A["ids"]["f"][i])] - A["stompAt"]) < 0.03, "dies on the very tick the foot lands"
        assert A["deadAt"][str(A["ids"]["f"][i])] > 1.1, "...not before"
    assert A["flats"] == 3, f"three worms flattened: {A['flats']}"
    assert A["snap"] == ["axe", A["snap"][1]] and 0.5 <= A["snap"][1] <= 2, "guests get the progress"
    sp = A["spoken"]
    assert len(sp) == 1 and sp[0]["t"].startswith("Gomu Gomu no Gigant Axe") and sp[0]["lang"] == "ja-JP", sp
    # --- B: the edge of the radius
    assert B["state"][0][0] and not B["state"][1][0], B["state"]
    # --- C: objects (each alone)
    assert r["C1"]["gone"] == [True] and r["C1"]["x"], "the mine is destroyed (and goes off)"
    assert r["C2"]["gone"] == [True] and r["C2"]["x"], "the oil drum is destroyed (and goes off)"
    assert r["C3"]["gone"] == [True, False] and not r["C3"]["x"] and r["C3"]["aLost"] == 0, "the crate inside is destroyed, the one outside is not"
    # --- D: not interruptible
    assert D["dead"] and D["stompAt"] > 1.1, "Space / the turn clock do not stop it"
    # --- E: the foot grows significantly (screen pixels)
    assert E["big"] > 300 and E["big"] > 5 * max(E["small"], 1), f"foot area small={E['small']} big={E['big']}"
    c = E["crater"]    # no victims here, so this dent is the foot's own: a bowl at the landing spot, nothing beyond it
    assert c["mid"] == 0 and c["inner"] == 0 and c["edge"] == 1 and c["deep"] == 1 and c["side"] == 1, f"ground dented at the landing spot only: {c}"
    # --- F: geometry: rises and grows, then straight down onto the landing spot
    g = F["geo"]; ix, iy = F["spot"]["x"], F["spot"]["y"]
    assert ix == F["ax"] + 60 and iy == 700, F["spot"]
    assert 0.1 < g[0]["sc"] < 0.15 and abs(g[4]["sc"] - 1) < 1e-9, "from a small foot to a full-size one"
    assert all(b["sc"] > a["sc"] for a, b in zip(g[:5], g[1:5])) and all(b["y"] < a["y"] for a, b in zip(g[:5], g[1:5])), "rises while growing"
    assert abs(g[4]["y"] - (iy - 170)) < 1e-9 and abs(g[4]["x"] - ix) < 1e-9
    assert all(abs(x["x"] - ix) < 1e-9 for x in g[4:]) and all(b["y"] > a["y"] for a, b in zip(g[4:], g[5:])), "then straight down"
    assert abs(g[8]["y"] - iy) < 1e-9 and all(x["sc"] == 1 for x in g[4:]), "planted on the ground"
    assert r["G"] == {"update": "ok", "event": "ok", "render": "ok"}, r["G"]
    assert r["icon"] and r["cat"] == "body", r["cat"]
    finish(errors)
