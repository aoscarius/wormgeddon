"""Environmental Chaos mode (cfg.env): Tornado, Thunderstorm, Tsunami, Earthquake and Armageddon cannot be chosen (no ammo, not in
the panel, never in crates), and instead strike by themselves at random places on random turns."""
from common import game_page, finish, BASE
from arena import ARENA_JS

JS = ARENA_JS + """
const run = ([base]) => {
  const w = window.__wh, out = {};
  const start = (env, arsenal = 'full', seed = 'env') => {
    w.newGame(Object.assign({seed}, base, {env, arsenal, crates: 1}), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
    for (let i = 0; i < 20; i++) w.stepOnce(1/60);
    return w.G;
  };
  // --- off: everything as before
  let g = start(0);
  out.offAmmo = ENV_WEAPONS.map(id => g.teams[0].ammo[id]);
  // --- on: no ammo in any arsenal, none in crates, hidden from the panel
  out.onAmmo = {}; out.hasArs = {};
  for (const ars of ['std', 'full', 'chaos', 'special']) {
    g = start(1, ars);
    out.onAmmo[ars] = ENV_WEAPONS.map(id => g.teams[0].ammo[id]);
    out.hasArs[ars] = ENV_WEAPONS.filter(id => arsenalHas(ars, id));
  }
  g = start(1);
  const items = new Set(); for (let i = 0; i < 300; i++) { g.objs.length = 0; spawnCrate(); const c = g.objs[0]; if (c.item) items.add(c.item); }
  out.crateEnv = [...items].filter(id => ENV_WEAPONS.includes(id));
  out.crateOther = items.size > 5;
  enterGame(); UI.tabsFor = null; setWeaponTab('all'); UI.sig = null; hud();
  const shown = [...document.querySelectorAll('#wgrid .wb')].map(b => b.dataset.w);
  out.shownEnv = shown.filter(id => ENV_WEAPONS.includes(id)); out.shownN = shown.length;
  // --- each disaster strikes without a caster and without errors
  const kinds = {};
  for (const k of ENV_WEAPONS) {
    g = start(1, 'full', 'env-' + k);
    g.sched.length = 0;
    envDisaster(k);
    for (let i = 0; i < 60; i++) w.stepOnce(1/60);
    kinds[k] = {tsu: !!g.tsu, quake: g.quake > 0 || g.quakeStarted, arma: g.arma > 0, tornado: g.projs.some(p => p.t === 'tornado'), bolts: FX.bolts.length, sched: g.sched.length};
  }
  out.kinds = kinds;
  // --- natural disasters pause only the active turn clock, then let it resume
  out.clock = {};
  for (const kind of ENV_WEAPONS) {
    g = start(1, 'full', 'env-clock-' + kind);
    g.sched.length = 0;
    g.timer = 20;
    envDisaster(kind);
    let ticks = 0, paused = true;
    while (g.envDisaster && ticks < 3600) {
      w.stepOnce(1/60);
      ticks++;
      if (g.envDisaster && Math.abs(g.timer - 20) >= 1e-9) paused = false;
    }
    const held = !g.envDisaster;
    let resumed = false;
    for (let i = 0; i < 3600 && !resumed; i++) {
      w.stepOnce(1/60);
      resumed = g.timer < 20;
    }
    out.clock[kind] = {held, paused, resumed: g.timer < 20, ticks};
  }
  // --- the scheduler: with a lucky roll a turn starts a disaster at a random moment; with an unlucky one nothing
  const orig = Math.random;
  g = start(1, 'full', 'env-sched'); g.round = 3; g.sched.length = 0;
  Math.random = () => 0.01; envChaos(); out.scheduled = g.sched.length;
  Math.random = () => 0.99; g.sched.length = 0; envChaos(); out.unlucky = g.sched.length;
  Math.random = orig;
  g.round = 1; g.sched.length = 0; Math.random = () => 0.01; envChaos(); out.round1 = g.sched.length; Math.random = orig;
  // --- over many turns, disasters of several kinds do happen (full game loop)
  g = start(1, 'full', 'env-turns');
  const seen = new Set(), oldMsg = window.emit;
  window.emit = e => { if (e.e === 'msg' && Object.values(ENV_NAMES).includes(e.t)) seen.add(e.t); return oldMsg(e); };
  for (let i = 0; i < 400; i++) { g.round = 3; g.sched.length = 0; envChaos(); for (const s of g.sched.splice(0)) s.fn(); }
  window.emit = oldMsg;
  out.seen = seen.size;
  out.menu = !!document.getElementById('oEnv');
  return out;
};
"""

with game_page(viewport={"width": 1100, "height": 700}) as (pg, errors):
    r = pg.evaluate("([b]) => {" + JS + "return run([b]); }", [BASE])
    for k, v in r.items(): print(k, v)
    assert all(a == -1 or a > 0 for a in r["offAmmo"]), "mode off: the weapons are available"
    for ars, a in r["onAmmo"].items():
        assert all(x == 0 for x in a), f"{ars}: no ammo"
        assert r["hasArs"][ars] == [], f"{ars}: not part of the arsenal"
    assert r["crateEnv"] == [] and r["crateOther"], "never in crates"
    assert r["shownEnv"] == [] and r["shownN"] > 10, "hidden from the panel"
    k = r["kinds"]
    assert k["tsunami"]["tsu"] and k["armageddon"]["arma"] and k["tornado"]["tornado"], k
    assert k["earthquake"]["quake"] and k["thunder"]["bolts"] >= 1, k
    bad_clock = {
        kind: result for kind, result in r["clock"].items()
        if not (result["held"] and result["paused"] and result["resumed"] and result["ticks"] < 3600)
    }
    assert not bad_clock, f"clock check failed: {bad_clock}"
    assert r["scheduled"] == 1 and r["unlucky"] == 0 and r["round1"] == 0, "a turn schedules a disaster only with the chance, from round 2"
    assert r["seen"] == 5, f"all five disasters strike over many turns: {r['seen']}"
    assert r["menu"], "menu option present"
    finish(errors)
