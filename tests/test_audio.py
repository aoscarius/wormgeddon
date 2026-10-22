"""Sound: the Holy Hand Grenade choir ends with the blast, MP3s respect mute, the dragon does not sing."""
from common import game_page, finish, BASE

JS = """([fuse, base]) => {
  const w = window.__wh;
  w.newGame(Object.assign({seed: 'au'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
  const g = w.G; for (let i = 0; i < 100; i++) w.stepOnce(1/60);
  const ev = [], old = window.emit; window.emit = e => { if (e.e === 'snd' && e.s === 'holy' || e.e === 'x') ev.push([e.e, g.time]); return old(e); };
  const p = w.spawnProj('holy', 600, 100, 0, 0, null, {fuse, ow: 0});
  const t0 = g.time;
  for (let i = 0; i < 60 * (fuse + 2); i++) w.stepOnce(1/60);
  window.emit = old;
  return {songs: ev.filter(x => x[0] === 'snd').map(x => +(x[1] - t0).toFixed(2)), booms: ev.filter(x => x[0] === 'x').map(x => +(x[1] - t0).toFixed(2))};
}"""

with game_page() as (pg, errors):
    for fuse in (1, 3, 5):
        r = pg.evaluate(JS, [fuse, BASE])
        print("fuse", fuse, r)
        assert len(r["songs"]) == 1 and r["booms"], r
        # the choir starts with HOLY_SONG (2.0 s) of fuse left, or at once for a shorter fuse
        want = max(0, fuse - 2.0)
        assert abs(r["songs"][0] - want) < 0.1, (fuse, r)
        assert r["songs"][0] <= r["booms"][0]

    # mp3 voices: counted through the <audio> fallback (file:// has no fetch/decode)
    r = pg.evaluate("""() => {
      let plays = 0;
      HTMLMediaElement.prototype.play = function () { plays++; return Promise.resolve(); };
      muted = false; SFX.holy(); SFX.holy();
      const two = plays;
      muted = true; const none = mp3Sfx('sounds/hallelujah.mp3'); const after = plays;
      muted = false; const v = mp3Sfx('sounds/hallelujah.mp3'); mp3Stop();
      return {two, none, after, handle: typeof v.stop, preloaded: !!MP3['sounds/hallelujah.mp3']};
    }""")
    print(r)
    assert r["two"] == 2 and r["none"] is None and r["after"] == 2 and r["handle"] == "function" and r["preloaded"]

    # a boom without radius (Concrete Donkey) must not throw
    pg.evaluate("() => { ac(); SFX.boom(); SFX.boom(0); noiseBurst(0); noiseBurst(NaN); }")

    # the dragon uses its own roar, not the choir
    r = pg.evaluate("""([base]) => {
      const w = window.__wh;
      w.newGame(Object.assign({seed: 'au'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
      const g = w.G; for (let i = 0; i < 100; i++) w.stepOnce(1/60);
      const snd = [], old = window.emit; window.emit = e => { if (e.e === 'snd') snd.push(e.s); return old(e); };
      g.weapon.id = 'dragonfire'; const a = g.worms.find(x => x.id === g.active);
      LOCAL.clicks.push({x: a.x + 200, y: a.y}); w.stepOnce(1/60);
      window.emit = old; return snd;
    }""", [BASE])
    print(r)
    assert "roar" in r and "holy" not in r
    finish(errors)
