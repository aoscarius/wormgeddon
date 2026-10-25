"""Seasonal / special themes: Halloween, Christmas, Manga (palette, texture, props, hats, overlays),
the modular registry, the 'Seasonal' menu choice and online determinism."""
from common import game_page, finish, BASE

THEMES = ("halloween", "christmas", "manga")
with game_page(viewport={"width": 900, "height": 600}) as (pg, errors):
    imgs = {}
    for th in ("grass",) + THEMES:
        r = pg.evaluate("""([th, base]) => {
          const w = window.__wh;
          w.newGame(Object.assign({}, base, {seed: 'themes', theme: th}), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
          enterGame(); for (let i = 0; i < 90; i++) w.stepOnce(1/60);
          render();
          const d = ctx2.getImageData(0, 0, cvs.width, cvs.height).data; let h = 0;
          for (let i = 0; i < d.length; i += 4 * 97) h = (h * 31 + d[i] + d[i+1] * 3 + d[i+2] * 7) >>> 0;
          return {name: T.themeName, fx: T.theme.fx || null, props: (T.props || []).length, hash: h,
                  kinds: [...new Set((T.props || []).map(p => p.kind))].sort()};
        }""", [th, BASE])
        print(th, r)
        assert r["name"] == th
        imgs[th] = r["hash"]
        if th == "grass":
            assert r["props"] == 0 and r["fx"] is None, "plain themes have no props"
        else:
            assert r["fx"] == th and r["props"] >= 10 and len(r["kinds"]) >= 3, f"{th} props"
    assert len(set(imgs.values())) == 4, "every theme looks different"

    out = pg.evaluate("""() => {
      const res = {};
      // registry
      res.reg = ['halloween', 'christmas', 'manga'].every(n => THEMES[n] && THEMES[n].special && THEME_FX[THEMES[n].fx]);
      // props are deterministic for a seed (online guests) and differ between seeds
      const cfg = s => ({seed: s, style: 'hills', theme: 'halloween', size: 'm'});
      generateTerrain(cfg('a')); const a = JSON.stringify(T.props);
      generateTerrain(cfg('a')); const a2 = JSON.stringify(T.props);
      generateTerrain(cfg('b')); const b = JSON.stringify(T.props);
      res.det = a === a2 && a !== b;
      // props disappear with their ground
      generateTerrain(cfg('a')); const p = T.props[0]; carve(p.x, p.y + 4, 30, false);
      G = {time: 0, waterY: 99999, wind: 0}; CAM.x = p.x; CAM.y = p.y; CAM.s = 1; VW = 900; VH = 600;
      themeFxWorld(); res.gone = p.gone === true; G = null;
      // texture hook changes pixels (manga is grey) and the 'random' theme never picks a special one
      generateTerrain({seed: 'm', style: 'hills', theme: 'manga', size: 'm'});
      const px = T.ctx.getImageData(0, T.h - 120, 200, 1).data; let grey = true;
      for (let i = 0; i < px.length; i += 4) if (px[3 + i] && (px[i] !== px[i+1] || px[i+1] !== px[i+2])) grey = false;
      res.grey = grey;
      const picks = new Set(); for (let i = 0; i < 60; i++) { generateTerrain({seed: 'r' + i, style: 'hills', theme: 'random', size: 's'}); picks.add(T.themeName); }
      res.random = [...picks].sort().join();
      // hats
      const c = document.createElement('canvas').getContext('2d'); T.theme = THEMES.christmas;
      res.hat = themeFxHat(c, '#f00', 0, 0, 1, 0); T.theme = THEMES.grass; res.nohat = themeFxHat(c, '#f00', 0, 0, 1, 0);
      // seasonal choice
      const S = (m, d) => seasonalTheme(new Date(2026, m - 1, d), () => 0);
      res.season = [S(10, 31), S(12, 25), S(1, 3), S(7, 1), S(10, 14), S(11, 3)];
      $('oTheme').value = 'seasonal'; res.cfgTheme = readCfg().theme;
      return res;
    }""")
    print(out)
    assert out["reg"] and out["det"] and out["gone"] and out["grey"]
    assert "halloween" not in out["random"] and "manga" not in out["random"] and "christmas" not in out["random"]
    assert out["hat"] is True and out["nohat"] is False
    assert out["season"] == ["halloween", "christmas", "christmas", "grass", "grass", "grass"], out["season"]
    assert out["cfgTheme"] in ("grass", "desert", "snow", "hell", "neon", "halloween", "christmas")
    # menu options and Italian names
    opts = pg.evaluate("[...$('oTheme').options].map(o => o.value)")
    assert all(x in opts for x in THEMES + ("seasonal",)), opts
    pg.evaluate("setLang('it')")
    names = pg.evaluate("[...$('oTheme').options].map(o => o.textContent)")
    assert "Natale" in names and "Stagionale" in names, names
    finish(errors)
