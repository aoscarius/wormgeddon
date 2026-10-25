"""Mobile weapon panel: swiping left / right over the grid changes the category tab; short, vertical or
mouse drags do not; a swipe does not arm the weapon under the finger; the active tab scrolls into view."""
from common import game_page, finish, BASE

SWIPE = """([x0, y0, x1, y1, type]) => {
  const g = $('wgrid'), r = g.getBoundingClientRect();
  const ev = (t, x, y) => g.dispatchEvent(new PointerEvent(t, {pointerId: 7, pointerType: type, clientX: r.left + x, clientY: r.top + y, bubbles: true}));
  ev('pointerdown', x0, y0); ev('pointermove', (x0 + x1) / 2, (y0 + y1) / 2); ev('pointerup', x1, y1);
  const b = document.elementFromPoint(r.left + x1, r.top + y1);
  if (b) b.dispatchEvent(new MouseEvent('click', {bubbles: true}));   // browsers send a click when down and up hit the same button
  return {cat: UI.wcat, armed: G.weapon.id, open: $('wpanel').classList.contains('on')};
}"""

with game_page(mobile=True, viewport={"width": 740, "height": 360}) as (pg, errors):
    pg.evaluate("""([base]) => { const w = window.__wh;
      w.newGame(Object.assign({}, base, {seed: 'sw'}), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
      enterGame(); for (let i = 0; i < 60; i++) w.stepOnce(1/60); hud(); setWeaponTab('all'); togglePanel(true); hud(); }""", [BASE])
    pg.wait_for_timeout(300)
    order = pg.evaluate("[...document.querySelectorAll('#wtabs [data-cat]')].filter(b => !b.hidden).map(b => b.dataset.cat)")
    armed = pg.evaluate("G.weapon.id")
    print(order, armed)
    r = pg.evaluate(SWIPE, [200, 100, 60, 105, "touch"]); print("left", r)
    assert r["cat"] == order[1], "swipe left -> next tab"
    assert r["armed"] == armed and r["open"], "a swipe does not arm the weapon under the finger"
    r = pg.evaluate(SWIPE, [60, 100, 200, 98, "touch"]); print("right", r)
    assert r["cat"] == order[0], "swipe right -> previous tab"
    r = pg.evaluate(SWIPE, [60, 100, 200, 98, "touch"])
    assert r["cat"] == order[-1], "wraps around to the last tab"
    pg.evaluate("setWeaponTab('all')")
    for name, args in (("short", [100, 100, 80, 100, "touch"]), ("vertical", [100, 40, 140, 160, "touch"]), ("mouse", [200, 100, 60, 100, "mouse"])):
        r = pg.evaluate(SWIPE, args); print(name, r)
        assert r["cat"] == "all", f"{name} drag must not change the tab"
    # the tab strip follows: the active tab is inside the visible strip
    pg.evaluate(SWIPE, [200, 100, 60, 100, "touch"]); pg.evaluate(SWIPE, [200, 100, 60, 100, "touch"]); pg.evaluate(SWIPE, [200, 100, 60, 100, "touch"])
    pg.wait_for_timeout(600)
    vis = pg.evaluate("""() => { const t = document.querySelector('#wtabs .on').getBoundingClientRect(), s = $('wtabs').getBoundingClientRect();
      return t.left >= s.left - 1 && t.right <= s.right + 1; }""")
    assert vis, "active tab is scrolled into view"
    assert pg.evaluate("getComputedStyle($('wgrid')).touchAction") == "pan-y"
    finish(errors)
