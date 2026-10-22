"""Damage display: a hit shows "-N" first; the shown health only drops afterwards (label, team bars, guests)."""
from common import game_page, finish, BASE

with game_page() as (pg, errors):
    pg.evaluate("""([base]) => {
      const w = window.__wh;
      w.newGame(Object.assign({seed: 'dd'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
      enterGame(); for (let i = 0; i < 60; i++) w.stepOnce(1/60);
      const g = w.G, a = g.worms.find(x => x.id === g.active), v = g.worms.find(x => x.team !== a.team);
      window.__v = v; window.__ev = []; const old = window.emit; window.emit = e => { window.__ev.push(e); return old(e); };
      hurt(v, 30, {noEnd: true});
    }""", [BASE])
    s = pg.evaluate("({hp: __v.hp, pend: __v.pend, shown: shownHp(__v)})")
    print("right after the hit:", s)
    assert s["hp"] == 70 and s["pend"] == 30 and s["shown"] == 100, "health must not change on screen yet"

    # team bar uses the shown value too
    bar = pg.evaluate("""() => { render(); hudTeams(null); const i = [...document.querySelectorAll('#teamsbar .tb')].reduce((m, e) => (m[+e.dataset.t] = e.querySelector('.bar i'), m), []);
      const t = G.teams[__v.team], total = t.worms.reduce((s, id) => s + wById(id).hp, 0);
      return {pct: parseFloat(i[__v.team].style.width), real: total / (G.cfg.hp * G.cfg.worms) * 100}; }""")
    print(bar)
    assert bar["pct"] > bar["real"] + 5, "team bar must still show the old total"

    # a guest receives the pending damage in the snapshot and shows the same
    g = pg.evaluate("""() => { const s = snapshot(true); const idx = G.worms.indexOf(__v);
      const sent = s.w[idx][10]; __v.pend = 0; __v.sh = undefined; applySnapshot(s); return {sent, pend: __v.pend, shown: shownHp(__v)}; }""")
    print(g)
    assert g["sent"] == 30 and g["pend"] == 30 and g["shown"] == 100

    # the damage is announced: "-30" appears, health still old for ~0.9 s, then counts down to 70
    pg.evaluate("flushDamage()")
    ev = pg.evaluate("__ev.filter(e => e.e === 'dmg').map(e => e.v)")
    assert ev == [30], ev
    assert pg.evaluate("shownHp(__v)") == 100
    pg.wait_for_timeout(500)
    assert pg.evaluate("shownHp(__v)") == 100, "still held"
    pg.wait_for_timeout(300)
    mid = 0
    for _ in range(40):
        pg.wait_for_timeout(60)
        v = pg.evaluate("shownHp(__v)")
        if v < 100:
            mid = v
            break
    assert 70 <= mid < 100, mid
    pg.wait_for_timeout(1500)
    assert pg.evaluate("shownHp(__v)") == 70
    # heals show immediately
    assert pg.evaluate("() => { __v.hp = 95; return shownHp(__v); }") == 95
    finish(errors)
