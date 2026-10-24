"""Nuclear Test: every worm is infected and loses RAD_DMG health every RAD_EVERY seconds for RAD_TIME seconds (and survives it).
The numbers are read from the game, so tuning the constants in core.js does not break the test."""
from common import game_page, finish, BASE

JS = """([base]) => {
  const w = window.__wh, r = {RD: RAD_DMG, RE: RAD_EVERY, RT: RAD_TIME};
  w.newGame(Object.assign({seed: 'rad', hp: 300}, base, {hp: 300}), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
  const g = w.G;
  for (let i = 0; i < 100; i++) w.stepOnce(1/60);
  let rads = 0; const old = window.emit; window.emit = e => { if (e.e === 'rad') rads++; return old(e); };
  g.weapon.id = 'nuke'; edge('fireP'); w.stepOnce(1/60);
  r.infected = g.worms.filter(x => x.rad > 0).length; r.n = g.worms.length;
  const hp0 = g.worms.map(x => x.hp), lost = () => g.worms.map((x, i) => hp0[i] - x.hp);
  const secs = s => { for (let i = 0; i < 60 * s; i++) w.stepOnce(1/60); };
  secs(RAD_EVERY - 0.5); r.t4 = lost();
  secs(1); r.t5 = lost(); r.shown = g.worms.map((x, i) => (x.sh = undefined, shownHp(x))); r.hpNow = g.worms.map(x => x.hp);
  secs(RAD_EVERY * 6 - RAD_EVERY - 0.5); r.t30 = lost();
  secs(RAD_TIME - RAD_EVERY * 6 + 1); r.end = lost();
  r.pend = g.worms.reduce((m, x) => m + (x.pend || 0), 0); r.rads = rads; r.alive = g.worms.every(x => !x.dead); r.cleared = g.worms.every(x => !(x.rad > 0));
  g.worms.forEach(x => { x.hp = RAD_DMG - 1 || 1; x.rad = RAD_TIME; x.radT = 1; });
  secs(RAD_EVERY * 4); r.survive = g.worms.every(x => !x.dead && x.hp >= 1);
  return r;
}"""

with game_page() as (pg, errors):
    r = pg.evaluate(JS, [BASE]); print(r)
    assert r["infected"] == r["n"]
    dmg, ticks = r["RD"], r["RT"] // r["RE"]
    assert all(d == 0 for d in r["t4"]) and all(d == dmg for d in r["t5"]), r   # first tick after RAD_EVERY s
    assert all(d == 6 * dmg for d in r["t30"]), r                               # 6 ticks
    assert all(d == ticks * dmg for d in r["end"]) and r["cleared"], r          # all ticks, then it stops
    assert r["pend"] == 0 and r["shown"] == r["hpNow"], r   # the drop is visible at once
    assert r["alive"] and r["survive"] and r["rads"] == ticks * r["n"], r
    finish(errors)
