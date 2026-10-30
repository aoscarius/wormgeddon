"""Rasenshuriken: a charged throw makes a spinning shuriken that, on impact or on a second press of Fire in flight, grows into
a vortex that erodes the terrain to dust inside it, hurts worms there and blows them outward; worms outside are not touched."""
from common import game_page, finish, BASE
from arena import ARENA_JS

JS = ARENA_JS + """
const run = ([base]) => {
  const w = window.__wh, out = {};
  const setup = seed => {
    w.newGame(Object.assign({seed}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
    const g = w.G;
    for (let i = 0; i < 30; i++) w.stepOnce(1/60);
    arena(700); g.round = 9; g.wind = 0;
    const a = g.worms.find(x => x.id === g.active), foe = g.worms.find(x => x.team !== a.team), far = g.worms.find(x => x !== a && x !== foe);
    g.worms.forEach((o, i) => { if (o !== a && o !== foe && o !== far) stand(o, 60 + 25 * i); });
    g.teams[a.team].ammo.rasenshuriken = 2;
    stand(a, 400); a.face = 1; a.aim = 0; stand(far, 1500); stand(foe, 1200);
    for (let i = 0; i < 10; i++) w.stepOnce(1/60);
    g.weapon.id = 'rasenshuriken';
    return {g, a, foe, far};
  };
  const throwIt = (s) => {
    LOCAL.fireP = 1; LOCAL.fire = 1; w.stepOnce(1/60); LOCAL.fireP = 0;
    for (let i = 0; i < 6; i++) w.stepOnce(1/60);
    LOCAL.fire = 0; w.stepOnce(1/60);
  };
  const ev = [], old = window.emit;
  window.emit = e => { ev.push(e.e + (e.s ? ':' + e.s : '')); return old(e); };
  const solidCount = (x0, y0, x1, y1) => { let n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) n += T.mask[y * T.w + x]; return n; };
  // A: lands on the ground
  let s = setup('ra1');
  throwIt(s);
  out.thrown = s.g.projs.some(p => p.t === 'rasen' || p.t === 'vortex'); out.ammo = s.g.teams[s.a.team].ammo.rasenshuriken;
  let v = null;
  for (let i = 0; i < 60 * 6 && !v; i++) { w.stepOnce(1/60); v = s.g.projs.find(p => p.t === 'vortex'); }
  out.vortex = !!v;
  if (v) {
    const vx = v.x, vy = v.y;
    stand(s.foe, Math.round(vx + 30)); s.foe.vx = 0; s.foe.hp = 1000;
    const x0 = s.foe.x, hp0 = s.foe.hp, farHp = s.far.hp, before = solidCount(Math.round(vx) - 70, Math.round(vy) - 10, Math.round(vx) + 70, Math.round(vy) + 70);
    let maxR = 0, maxD = 0;
    for (let i = 0; i < 60 * 6; i++) { w.stepOnce(1/60); const q = s.g.projs.find(p => p.t === 'vortex'); if (q && q.net) maxR = Math.max(maxR, q.net[0]); maxD = Math.max(maxD, Math.hypot(s.foe.x - vx, s.foe.y - vy)); }
    out.maxR = maxR; out.foeDx = maxD - 30; out.foeHp = hp0 - s.foe.hp; out.farHp = farHp - s.far.hp;
    out.eroded = before - solidCount(Math.round(vx) - 70, Math.round(vy) - 10, Math.round(vx) + 70, Math.round(vy) + 70);
    out.gone = !s.g.projs.some(p => p.t === 'vortex');
    out.dustEv = ev.includes('rdust'); out.splat = ev.includes('rsplat'); out.howl = ev.includes('snd:rasenhowl');
    out.R = RASEN_R;
  }
  // B: a second press in flight
  s = setup('ra2');
  s.a.aim = -0.6;
  throwIt(s);
  for (let i = 0; i < 20; i++) w.stepOnce(1/60);
  const sh = s.g.projs.find(p => p.t === 'rasen');
  out.inFlight = !!sh && sh.y < 690;
  LOCAL.fireP = 1; w.stepOnce(1/60); LOCAL.fireP = 0;
  w.stepOnce(1/60);
  const v2 = s.g.projs.find(p => p.t === 'vortex');
  out.pressed = !!v2 && !s.g.projs.some(p => p.t === 'rasen') && v2.y < 690;
  // C: the throw does not run into its own thrower, whatever the aim and the wind
  out.launch = !!WEAPONS.rasenshuriken.fire.launch && WEAPONS.rasenshuriken.fire.launch.type === 'rasen' && PTYPES.rasen.mark === RASEN_R;
  out.tries = [];
  for (const [aim, wind] of [[0, 0], [-0.2, 1], [-0.2, -1], [-0.6, 1], [-0.6, -1], [-1.0, 0]]) {
    s = setup('ra3');
    s.a.aim = aim; s.g.wind = wind;
    throwIt(s);
    let v = null, firstDist = null;
    for (let i = 0; i < 60 * 4 && !v; i++) { w.stepOnce(1/60); v = s.g.projs.find(p => p.t === 'vortex'); }
    out.tries.push({aim, wind, dist: v ? Math.round(Math.abs(v.x - s.a.x)) : -1, hp: s.a.hp});
  }
  window.emit = old;
  return out;
};
"""

with game_page(viewport={"width": 1100, "height": 700}) as (pg, errors):
    r = pg.evaluate("([b]) => {" + JS + "return run([b]); }", [BASE])
    print(r)
    assert r["thrown"] and r["ammo"] == 1, "a charged throw spends ammo and flies"
    assert r["vortex"] and r["howl"], "it turns into a vortex with the howl on impact"
    assert abs(r["maxR"] - r["R"]) < 2, "the vortex grows to RASEN_R"
    assert r["eroded"] > 1500 and r["dustEv"], "the terrain is eroded to dust"
    assert r["foeHp"] >= 12, f"heavy continuous damage: {r['foeHp']}"
    assert r["foeDx"] > 30, f"worms are pushed outward: {r['foeDx']}"
    assert r["splat"], "worms in the vortex are splattered with blood"
    assert r["farHp"] == 0, "worms outside are untouched"
    assert r["gone"], "the vortex ends"
    assert r["inFlight"] and r["pressed"], "a second press of Fire in flight makes the vortex in mid-air"
    assert r["launch"], "the debug view (F4) predicts the flight"
    for t in r["tries"]:
        assert t["dist"] >= 0 and t["hp"] == 100, f"no hit on the thrower: {t}"
        assert t["dist"] >= 90, f"it lands clear of the thrower: {t}"
    finish(errors)
