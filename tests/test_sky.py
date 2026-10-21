"""Sky options: day, night, cloudy, rainy, random. Same cfg gives the same sky (guests), each one renders."""
from common import game_page, finish, BASE

with game_page(viewport={"width": 900, "height": 600}) as (pg, errors):
    lum = {}
    for sky in ("day", "night", "cloudy", "rainy"):
        r = pg.evaluate("""([sky, base]) => {
          const w = window.__wh;
          w.newGame(Object.assign({seed: 'sky', sky}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
          enterGame(); for (let i = 0; i < 90; i++) { w.stepOnce(1/60); }
          render();
          const d = ctx2.getImageData(0, 0, cvs.width, 40).data; let s = 0, n = 0;
          for (let i = 0; i < d.length; i += 4) { s += d[i] + d[i+1] + d[i+2]; n += 3; }
          return {sky: T.sky, lum: s / n};
        }""", [sky, BASE])
        print(sky, r)
        assert r["sky"] == sky
        lum[sky] = r["lum"]
        pg.screenshot(path=f"/tmp/sky-{sky}.png")
    assert lum["night"] < lum["day"] * 0.5, "night must be much darker than day"
    assert lum["rainy"] < lum["cloudy"] and lum["rainy"] < lum["day"]
    # unknown / missing values fall back to day; 'random' in the form becomes a concrete sky for the cfg
    out = pg.evaluate("""() => {
      generateTerrain({seed: 'x', style: 'hills', theme: 'grass', size: 'm'});
      const none = T.sky;
      generateTerrain({seed: 'x', style: 'hills', theme: 'grass', size: 'm', sky: 'bogus'});
      const bogus = T.sky;
      $('oSky').value = 'random';
      const picks = new Set(); for (let i = 0; i < 80; i++) picks.add(readCfg().sky);
      return {none, bogus, picks: [...picks].sort()};
    }""")
    print(out)
    assert out["none"] == "day" and out["bogus"] == "day"
    assert out["picks"] == ["cloudy", "day", "night", "rainy"]
    finish(errors)
