"""Smoke test: every level style, bot-only matches (2 and 8 teams), translations, weapon count, donkey."""
from common import game_page, finish

with game_page() as (pg, errors):
    styles = pg.evaluate("""() => ['hills','islands','caves','plateau','canyon','mountains','archipelago'].map(st => {
      generateTerrain({style: st, theme: 'grass', seed: 'smoke', size: 'm'});
      let s = 0; for (let i = 0; i < T.mask.length; i++) s += T.mask[i];
      return [st, +(s / T.mask.length).toFixed(2)];
    })""")
    print("styles:", styles)
    assert all(0.08 < f < 0.7 for _, f in styles), styles

    for n in (2, 8):
        r = pg.evaluate("""n => {
          const w = window.__wh;
          const defs = [...Array(n)].map((_, i) => ({name: 'T' + i, ctrl: 'ai', worms: ['a','b','c','d']}));
          w.newGame({seed: 'smoke' + n, style: 'hills', theme: 'meadow', size: 'm', hp: 100, turnTime: 30,
                     arsenal: 'standard', mines: 3, drums: 3, crates: 2, sd: 0, worms: 4}, defs);
          let turns = 0, last = -2;
          for (let i = 0; i < 60 * 300; i++) { w.stepOnce(1/60); if (w.G.ti !== last) { last = w.G.ti; turns++; } }
          return {teams: w.G.teams.length, worms: w.G.worms.length, turns, phase: w.G.phase};
        }""", n)
        print(n, "teams ->", r)
        assert r["teams"] == n and r["turns"] > 2, r

    missing = pg.evaluate("window.__wh.missingTranslations()")
    print("untranslated page texts:", missing)
    assert not missing, "add these to js/lang-it.js"
    assert pg.evaluate("window.__wh.setLang('it'), window.__wh.tr('Draw!')") == "Pareggio!"
    pg.evaluate("window.__wh.setLang('en')")

    n = pg.evaluate("window.__wh.WLIST.length")
    print("weapons:", n)
    assert n >= 36

    hops = pg.evaluate("""() => {
      const w = window.__wh;
      w.newGame({seed:'donkey', style:'plateau', theme:'meadow', size:'m', hp:100, turnTime:30, arsenal:'standard',
                 mines:0, drums:0, crates:0, sd:0, worms:2}, [{name:'A',ctrl:'ai'},{name:'B',ctrl:'ai'}]);
      const g = w.G;
      g.worms.forEach(x => { x.x = 40; x.y = 40; });
      const dk = w.spawnProj('donkey', 600, 100, 0, 0, null, {face: 1, ow: 0});
      let hops = 0;
      for (let i = 0; i < 60*20; i++) { w.stepOnce(1/60); if (g.projs.indexOf(dk) < 0) break; hops = dk.hops || 0; }
      return hops;
    }""")
    print("donkey hops:", hops)
    assert hops > 2, "donkey should keep hopping"
    finish(errors)
