"""Weapon panel: every weapon has a category, tabs filter the grid, 'All' shows everything, Italian labels, choice remembered."""
from common import game_page, finish, BASE

JS = """([base]) => {
  const w = window.__wh, r = {};
  w.newGame(Object.assign({seed: 'tabs'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
  for (let i = 0; i < 60; i++) w.stepOnce(1/60);
  r.cats = WEAPON_CATS.slice();
  r.bad = WLIST.filter(d => !(d.cat === 'special' || WEAPON_CATS.includes(d.cat))).map(d => d.id);
  r.uncat = WLIST.filter(d => !WEAPON_CAT[d.id]).map(d => d.id);       // fall back to special: should be none for built-ins
  r.empty = WEAPON_CATS.filter(c => !WLIST.some(d => d.cat === c));
  const grid = () => [...document.querySelectorAll('#wgrid .wb')].map(b => b.dataset.w);
  const show = () => { hud(); return grid(); };
  UI.sig = null; r.all = show().length; r.total = WLIST.length;
  r.tabs = [...document.querySelectorAll('#wtabs [data-cat]')].map(b => b.dataset.cat);
  r.byCat = {};
  for (const c of WEAPON_CATS) {
    document.querySelector('#wtabs [data-cat="' + c + '"]').click();
    const ids = show();
    r.byCat[c] = ids.length;
    if (!ids.every(id => WEAPONS[id].cat === c)) r.mixed = c;
    r.on = document.querySelector('#wtabs .on').dataset.cat;
  }
  document.querySelector('#wtabs [data-cat="all"]').click();
  r.back = show().length;
  document.querySelector('#wtabs [data-cat="anime"]').click();
  r.saved = localStorage.getItem('wormgeddon.wtab');
  return r;
}"""

with game_page(viewport={"width": 1000, "height": 700}) as (pg, errors):
    r = pg.evaluate(JS, [BASE]); print(r)
    assert not r["bad"] and not r["uncat"] and not r["empty"], r
    assert r["tabs"] == ["all"] + r["cats"], r
    assert r["all"] == r["total"] and r["back"] == r["total"], r
    assert sum(r["byCat"].values()) == r["total"] and "mixed" not in r, r
    assert r["on"] == r["cats"][-1] and r["saved"] == "anime", r
    # Italian labels
    pg.evaluate("setLang('it')")
    labels = pg.evaluate("[...document.querySelectorAll('#wtabs [data-cat]')].map(b => b.textContent)")
    assert "Tutte" in labels and "Corto raggio" in labels, labels
    finish(errors)
