"""Team bars: sorted by total health (highest first), rows swap with a slide animation, bars follow health."""
from common import game_page, finish, BASE

JS = """([base]) => {
  const w = window.__wh, r = {};
  w.newGame(Object.assign({seed: 'tb'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'},{name:'C',ctrl:'local'}]);
  const g = w.G; for (let i = 0; i < 60; i++) w.stepOnce(1/60);
  const order = () => [...document.querySelectorAll('#teamsbar .tb')].map(e => +e.dataset.t);
  const set = (team, hp) => { for (const id of g.teams[team].worms) { const o = wById(id); o.hp = hp; o.pend = 0; o.sh = undefined; } };
  document.getElementById('hud').hidden = false;
  set(0, 50); set(1, 100); set(2, 20); hudTeams(null);
  r.o1 = order();
  set(2, 100); set(0, 10); hudTeams(null);
  const row = document.querySelector('#teamsbar .tb[data-t="2"]');
  r.o2 = order(); r.moving = row.style.transition.includes('transform') || row.style.transform !== '';
  set(0, 100); hudTeams(null); r.o3 = order();   // ties keep team order
  r.rows = document.querySelectorAll('#teamsbar .tb').length;
  return r;
}"""

with game_page(viewport={"width": 1000, "height": 700}) as (pg, errors):
    r = pg.evaluate(JS, [BASE]); print(r)
    assert r["o1"] == [1, 0, 2], r
    assert r["o2"][-1] == 0 and set(r["o2"][:2]) == {1, 2}, r
    assert r["moving"] and r["o3"] == [0, 1, 2] and r["rows"] == 3, r
    pg.wait_for_timeout(600)
    assert pg.evaluate("document.querySelector('#teamsbar .tb').style.transform") == ""
    finish(errors)
