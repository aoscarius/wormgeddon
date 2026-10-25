"""Arsenal game modes (Special / Anime / Melee / Artillery only): ammo table, crates, weapon panel tabs,
bots that still play every turn with weapons from the set, menu option and Italian labels."""
from common import game_page, finish, BASE

MODES = ("special", "anime", "melee", "artillery")
with game_page(viewport={"width": 1000, "height": 640}) as (pg, errors):
    for mode in MODES:
        r = pg.evaluate("""([mode, base]) => {
          const w = window.__wh;
          w.newGame(Object.assign({}, base, {seed: 'ars-' + mode, arsenal: mode, crates: 0}),
                    [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
          const g = w.G, t = g.teams[0];
          const have = WLIST.filter(d => t.ammo[d.id] !== 0).map(d => d.id);
          const outside = have.filter(id => !ARSENAL_ALWAYS.includes(id) && !arsenalHas(mode, id));
          const avl = WLIST.filter(d => avail(t, d.id)).map(d => d.id);
          // crates only carry weapons of the set
          const items = new Set();
          for (let i = 0; i < 80; i++) { g.objs.length = 0; spawnCrate(); const c = g.objs.find(o => o.k === 'crate'); items.add(c.type === 'health' ? 'health' : c.item); }
          const crateBad = [...items].filter(x => x !== 'health' && !arsenalHas(mode, x));
          // limited weapons have at least ARSENAL_MIN_AMMO, available in round 0 (no unlock delays)
          const low = have.filter(id => t.ammo[id] > 0 && t.ammo[id] < ARSENAL_MIN_AMMO);
          // panel: only weapons of the set, tabs without weapons are hidden
          enterGame(); UI.tabsFor = null; setWeaponTab('all'); UI.sig = null; hud();
          const shown = [...document.querySelectorAll('#wgrid .wb')].map(b => b.dataset.w);
          hud(); // second call must not change anything
          const tabs = [...document.querySelectorAll('#wtabs [data-cat]')].filter(b => !b.hidden).map(b => b.dataset.cat);
          return {n: have.length, outside, avl: avl.length, crateBad, low, shown: shown.length,
                  shownBad: shown.filter(id => !arsenalHas(mode, id)), tabs, items: items.size, skip: have.includes('skip')};
        }""", [mode, BASE])
        print(mode, r)
        assert r["n"] >= 3 and not r["outside"], f"{mode}: ammo outside the set {r['outside']}"
        assert not r["crateBad"], f"{mode}: crate items {r['crateBad']}"
        assert not r["low"], f"{mode}: low ammo {r['low']}"
        assert r["shown"] == r["n"] and not r["shownBad"], f"{mode}: panel shows {r['shown']}"
        assert r["skip"] and r["avl"] >= 3
        assert "all" in r["tabs"] and len(r["tabs"]) <= 6
    # exact membership of the headline modes
    m = pg.evaluate("""() => ({
      anime: ['dragonfire', 'thunder', 'hammer', 'kamehameha', 'proton', 'timecar', 'tornado', 'hokuto', 'onigiri', 'dragonball'].every(id => arsenalHas('anime', id)) && !arsenalHas('anime', 'bazooka') && !arsenalHas('anime', 'nuke'),
      special: ['earthquake', 'tsunami', 'nuke', 'armageddon', 'holy', 'thunder'].every(id => arsenalHas('special', id)) && !arsenalHas('special', 'bazooka') && !arsenalHas('special', 'shotgun'),
      plain: ['std', 'full', 'bazooka', 'chaos'].every(k => arsenalHas(k, 'bazooka') && !isRestrictedArsenal(k)),
    })""")
    print(m)
    assert m["anime"] and m["special"] and m["plain"]
    # old modes still work and show every tab again
    ok = pg.evaluate("""([base]) => { const w = window.__wh;
      w.newGame(Object.assign({}, base, {seed: 'x', arsenal: 'full'}), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
      enterGame(); hud(); return [...document.querySelectorAll('#wtabs [data-cat]')].every(b => !b.hidden); }""", [BASE])
    assert ok, "tabs come back for unrestricted arsenals"

    # bots play every turn with weapons of the set
    for mode in MODES:
        r = pg.evaluate("""([mode, base]) => {
          const w = window.__wh, used = {}, out = {turns: 0, idle: 0, bad: []};
          for (let k = 0; k < 3; k++) {
            w.newGame(Object.assign({}, base, {seed: mode + k, arsenal: mode, crates: 2, turnTime: 30, worms: 3, rise: 0}),
                      [{name:'A',ctrl:'ai'},{name:'B',ctrl:'ai'},{name:'C',ctrl:'ai'}]);
            const g = w.G; let t = 0, last = 'turn';
            while (t < 600 && !g.over) {
              w.stepOnce(1/60); t += 1/60;
              if (g.phase === 'turn' && g.weapon) used[g.weapon.id] = 1;
              if (last === 'turn' && g.phase === 'settle') { out.turns++; if (g.timer <= 0.05) out.idle++; }
              if (last === 'turn' && g.phase === 'retreat') out.turns++;
              last = g.phase;
            }
          }
          out.bad = Object.keys(used).filter(id => id !== 'bazooka' && !arsenalHas(mode, id));
          out.badBazooka = mode !== 'artillery' && !!used.bazooka;
          out.used = Object.keys(used).sort().join();
          return out;
        }""", [mode, BASE])
        print(mode, r)
        assert r["turns"] >= 12, f"{mode}: too few turns {r['turns']}"
        assert r["idle"] <= r["turns"] * 0.25, f"{mode}: bots idle {r}"
        assert not r["bad"], f"{mode}: bot used {r['bad']}"
    # menu: values and Italian labels
    vals = pg.evaluate("[...$('oArs').options].map(o => o.value)")
    assert all(k in vals for k in MODES), vals
    pg.evaluate("setLang('it')")
    names = pg.evaluate("[...$('oArs').options].map(o => o.textContent)")
    assert "Solo armi speciali" in names and "Solo armi anime" in names, names
    finish(errors)
