"""Splatter Mode displays blood particles only when enabled."""
from common import game_page, finish, BASE

JS = """([base]) => {
  const w = window.__wh;
  w.newGame(Object.assign({seed: 'splatter'}, base), [
    {name:'A', ctrl:'local'}, {name:'B', ctrl:'local'}
  ]);

  FX.p.length = 0;
  UI.splatterMode = true;
  applyEvent({e: 'blood', x: 100, y: 100});
  const enabledCount = FX.p.length;
  const redParticles = FX.p.filter(p =>
    ['#7d1020', '#b5122b', '#d21f3c'].includes(p.c)
  ).length;

  FX.p.length = 0;
  UI.splatterMode = false;
  applyEvent({e: 'blood', x: 100, y: 100});
  const disabledCount = FX.p.length;

  return {enabledCount, redParticles, disabledCount};
}"""

with game_page() as (pg, errors):
    result = pg.evaluate(JS, [BASE])
    print(result)
    assert result["enabledCount"] > 0, result
    assert result["redParticles"] == result["enabledCount"], result
    assert result["disabledCount"] == 0, result
    # Hokuto Hyakuretsu Ken extras (Splatter Mode only): the marked worm swells, then bursts in a blood shower
    r = pg.evaluate("""([base]) => {
      const w = window.__wh;
      w.newGame(Object.assign({seed: 'splatter2'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
      enterGame(); for (let i = 0; i < 60; i++) w.stepOnce(1/60);
      const v = G.worms[1]; CAM.x = v.x; CAM.y = v.y; CAM.s = 4; CAM.z = 4;
      const count = () => { render(); const d = ctx2.getImageData(0, 0, cvs.width, cvs.height).data; let n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] > 150 && d[i+1] < 70 && d[i+2] < 90) n++; return n; };
      const out = {};
      UI.splatterMode = true; v.doom = 3;
      v._doomT = G.time - Math.max(0, HYAKU_SWELL - 0.1);   out.fresh = count();
      v._doomT = G.time - (HYAKU_SWELL + HYAKU_FUSE);        out.swollen = count();
      UI.splatterMode = false; v._doomT = G.time - 6;      out.off = count();
      // the burst event
      UI.splatterMode = true; FX.p.length = 0; applyEvent({e: 'burst', x: v.x, y: v.y}); out.on = FX.p.length;
      UI.splatterMode = false; FX.p.length = 0; applyEvent({e: 'burst', x: v.x, y: v.y}); out.offP = FX.p.length;
      // doomBlast emits it exactly once
      v.doom = 0.05; v.doomBy = G.worms[0].id; let n = 0; const old = window.emit;
      window.emit = e => { if (e.e === 'burst') n++; return old(e); };
      doomBlast(v); window.emit = old; out.emitted = n;
      return out;
    }""", [BASE])
    print(r)
    assert r["swollen"] > r["fresh"] * 1.5 and r["swollen"] > r["off"] * 1.5, "the worm swells and reddens"
    assert r["on"] >= 150 and r["offP"] == 0 and r["emitted"] == 1
    # Oni Giri extras (Splatter Mode only): the sliced worm splits in two halves, blood spurts from the cut
    r = pg.evaluate("""([base]) => {
      const w = window.__wh;
      w.newGame(Object.assign({seed: 'splatter3'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
      enterGame(); for (let i = 0; i < 60; i++) w.stepOnce(1/60);
      const v = G.worms[1]; CAM.x = v.x; CAM.y = v.y; CAM.s = 5; CAM.z = 5;
      const shot = () => { render(); return ctx2.getImageData(0, 0, cvs.width, cvs.height).data; };
      const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i+1] - b[i+1]) > 60) n++; return n; };
      const out = {};
      const whole = shot();
      // off: nothing happens
      UI.splatterMode = false; FX.p.length = 0; FX.spurts = [];
      applyEvent({e: 'slash', x: v.x, y: v.y - 2, f: 1});
      out.offCut = !!v._cut; out.offSpurts = FX.spurts.length; out.offP = FX.p.length;
      // on: the worm is marked, a spurt starts
      UI.splatterMode = true; FX.p.length = 0; FX.spurts = [];
      applyEvent({e: 'slash', x: v.x, y: v.y - 2, f: 1});
      out.cut = !!v._cut; out.spurts = FX.spurts.length; out.drops = FX.p.length;
      v._cut.t0 = G.time - 0.3;                       // halves apart
      out.apart = diff(whole, shot());
      v._cut.t0 = G.time - 1.5; shot();               // finished: the worm is whole again and the mark is gone
      out.cleared = v._cut === null;
      // the fountain keeps spraying for about a second, then stops
      FX.p.length = 0; for (let i = 0; i < 20; i++) fxUpdate(1/60); out.spray = FX.p.length;
      for (let i = 0; i < 120; i++) fxUpdate(1/60); out.spursEnd = FX.spurts.length;
      // a dead worm is not split
      v.dead = true; v._cut = {t0: G.time, ang: 0.9}; shot(); out.deadKept = !!v._cut; v.dead = false;
      return out;
    }""", [BASE])
    print(r)
    assert not r["offCut"] and r["offSpurts"] == 0 and r["offP"] <= 10, "off: only the normal slash puff"
    assert r["cut"] and r["spurts"] == 1 and r["drops"] >= 30
    assert r["apart"] > 40, "the two halves are drawn apart"
    assert r["cleared"] and r["spray"] > 20 and r["spursEnd"] == 0
    finish(errors)