"""Thanos' Gauntlet: extremely rare (crates only), a snap animation, then every worm in range - the caster included -
turns to dust (dies for certain, no explosion, no grave) while the wind blows the dust away."""
from common import game_page, finish, BASE
from arena import ARENA_JS

JS = ARENA_JS + """
const run = ([base]) => {
  const w = window.__wh, out = {};
  w.newGame(Object.assign({seed: 'thanos'}, base, {arsenal: 'std'}), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
  const g = w.G;
  for (let i = 0; i < 30; i++) w.stepOnce(1/60);
  // rarity: no ammo to start with in the normal arsenals, a small chance in a weapon crate, never in restricted arsenals without the category
  out.ammoStd = g.teams[0].ammo.thanos;
  const t1 = {ammo: {}}, t2 = {ammo: {}}, t3 = {ammo: {}};
  initAmmo(t1, 'full'); initAmmo(t2, 'special'); initAmmo(t3, 'chaos');
  out.ammoFull = t1.ammo.thanos; out.ammoSpecial = t2.ammo.thanos;
  out.chaosOk = t3.ammo.thanos === 0 || t3.ammo.thanos === 1;
  out.rare = CRATE_RARE.thanos;
  out.inPool = CRATE_WEAP.includes('thanos');
  const orig = Math.random; let drops = 0;
  let q = 0; Math.random = () => [0.5, 0.5, 0.5, 0.005][q++ % 4];      // weapon crate, then below the chance: the gauntlet
  g.objs.length = 0; g.cfg.arsenal = 'std'; for (let i = 0; i < 40; i++) { spawnCrate(); }
  drops = g.objs.filter(o => o.type === 'weapon' && o.item === 'thanos').length;
  Math.random = orig; g.objs.length = 0;
  out.dropsWhenLucky = drops;
  let normal = 0; Math.random = () => 0.5; // 0.5 is above the chance
  g.objs.length = 0; for (let i = 0; i < 20; i++) spawnCrate();
  normal = g.objs.filter(o => o.item === 'thanos').length; Math.random = orig; g.objs.length = 0;
  out.dropsNormal = normal;
  g.cfg.arsenal = 'melee'; q = 0; Math.random = () => [0.5, 0.5, 0.5, 0.005][q++ % 4]; for (let i = 0; i < 20; i++) spawnCrate();
  out.dropsMelee = g.objs.filter(o => o.item === 'thanos').length; Math.random = orig; g.objs.length = 0; g.cfg.arsenal = 'std';
  // the snap
  arena(700);
  g.round = 9; g.wind = 0.8;
  const a = g.worms.find(x => x.id === g.active);
  g.worms.forEach((o, i) => stand(o, 300 + 220 * i));
  g.teams[a.team].ammo.thanos = 1;
  for (let i = 0; i < 10; i++) w.stepOnce(1/60);
  g.weapon.id = 'thanos';
  const ev = [], old = window.emit;
  window.emit = e => { ev.push(e.e + (e.s ? ':' + e.s : '')); return old(e); };
  const t0 = g.time, hp0 = g.worms.map(x => x.hp), n = g.worms.length;
  LOCAL.fireP = 1; w.stepOnce(1/60); LOCAL.fireP = 0;
  out.tool = a.tool && a.tool.k;
  out.inevitableAtLaunch = ev.includes('snd:inevitable');
  out.snapAt = SNAP_AT; out.snapT = SNAP_T; out.dustT = DUST_T;
  out.radius = THANOS_RADIUS === Infinity ? 'infinite' : THANOS_RADIUS;
  out.ammoUsed = g.teams[a.team].ammo.thanos;
  let early = null, dustAt = null, deadAt = null, snapshotFlags = null, sample = null;
  for (let i = 0; i < 60 * 12; i++) {
    w.stepOnce(1/60);
    const t = g.time - t0;
    if (t < SNAP_AT - 0.1 && g.worms.some(x => x.dust > 0)) early = t;
    if (dustAt === null && g.worms.every(x => x.dust > 0)) dustAt = t;
    if (dustAt !== null && t < dustAt + 1 && !snapshotFlags) { const s = snapshot(true).w; snapshotFlags = {flag: s.every(r => r[6] & 32), p: s.map(r => r[12])}; }
    if (dustAt !== null && !sample && t > dustAt + 1.5) {
      // dust grains: spawned by fxUpdate, drifting with the wind (positive here)
      FX.p.length = 0; for (let k = 0; k < 20; k++) fxUpdate(1/60);
      const dp = FX.p.filter(p => p.k === 'w');
      sample = {n: dp.length, vxMean: dp.reduce((s, p) => s + p.vx, 0) / Math.max(1, dp.length)};
    }
    if (deadAt === null && g.worms.every(x => x.dead)) { deadAt = t; break; }
  }
  window.emit = old;
  out.early = early; out.dustAt = dustAt; out.deadAt = deadAt; out.snapshotFlags = snapshotFlags; out.sample = sample;
  out.allDusted = g.worms.every(x => x.dusted && x.dead && x.hp === 0);
  out.casterDead = a.dead;
  out.ev = ev.filter(e => e.startsWith('snd:inevitable') || e.startsWith('snd:snap') || e === 'msg').slice(0, 4);
  out.craters = ev.filter(e => e === 'x').length;
  for (let i = 0; i < 60 * 8; i++) w.stepOnce(1/60);
  out.over = g.over; out.winner = g.winner; out.phase = g.phase;
  // negative wind: the grains drift the other way
  return out;
};
"""

with game_page(viewport={"width": 1100, "height": 700}) as (pg, errors):
    r = pg.evaluate("([b]) => {" + JS + "return run([b]); }", [BASE])
    print(r)
    assert r["ammoStd"] == 0 and r["ammoFull"] == 1 and r["ammoSpecial"] == 0 and r["chaosOk"], "no ammo unless Full / lucky Chaos"
    assert r["rare"] <= 0.05 and not r["inPool"], "extremely rare, outside the normal pool"
    assert r["dropsWhenLucky"] > 0 and r["dropsNormal"] == 0 and r["dropsMelee"] == 0, "only a lucky weapon crate, never in a restricted arsenal"
    assert r["tool"] == "snap" and r["ammoUsed"] == 0, "snap tool started, ammo spent"
    assert r["radius"] == "infinite", "the snap reaches every worm"
    assert r["early"] is None, "nobody dissolves before the snap"
    assert r["snapAt"] == 5.2 and r["snapT"] == 6.0, "snap timing"
    assert r["dustAt"] is not None and abs(r["dustAt"] - r["snapAt"]) <= 1 / 30, "every worm starts to dissolve at the snap"
    assert r["snapshotFlags"]["flag"] and max(r["snapshotFlags"]["p"]) > 0, "guests see the dust"
    assert r["allDusted"] and r["casterDead"], "all worms die, the caster too, without a grave"
    assert r["deadAt"] is not None and abs((r["deadAt"] - r["dustAt"]) - r["dustT"]) <= 1 / 30, f"dust lasts {r['dustT']} s: {r['deadAt']}"
    assert r["craters"] == 0, "no explosion"
    assert r["sample"] and r["sample"]["n"] > 5 and r["sample"]["vxMean"] > 20, "grains blow along the wind"
    assert r["inevitableAtLaunch"] and "snd:snap" in r["ev"], "inevitable and snap audio events play"
    assert "msg" in r["ev"]
    assert r["over"] and r["winner"] == -1, "everyone gone: a draw"
    # the weapon panel hides it until the team owns one
    h = pg.evaluate("""([base]) => {
      const w = window.__wh;
      w.newGame(Object.assign({seed: 'thanos2'}, base, {arsenal: 'std'}), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
      enterGame(); const t = G.teams[0], q = () => !!document.querySelector('#wgrid .wb[data-w="thanos"]');
      const show = () => { UI.tabsFor = null; setWeaponTab('destructive'); UI.sig = null; hud(); return q(); };
      t.ammo.thanos = 0; const without = show();
      t.ammo.thanos = 1; const withOne = show();
      return {without, withOne};
    }""", [BASE])
    assert not h["without"] and h["withOne"], h
    finish(errors)
