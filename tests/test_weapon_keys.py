"""Weapon panel with the keyboard only: W opens it with the cursor on the armed weapon, arrows move,
Enter / Space arm and close, Tab changes category, letters jump, Esc / W close, game keys are not triggered."""
from common import game_page, finish, BASE

with game_page(viewport={"width": 1100, "height": 700}) as (pg, errors):
    pg.evaluate("""([base]) => { const w = window.__wh;
      w.newGame(Object.assign({}, base, {seed: 'wk'}), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
      enterGame(); for (let i = 0; i < 90; i++) w.stepOnce(1/60); hud(); }""", [BASE])
    cur = lambda: pg.evaluate("({cur: UI.wcur, dom: [...document.querySelectorAll('#wgrid .kb')].map(b => b.dataset.w), armed: G.weapon.id, open: $('wpanel').classList.contains('on'), cat: UI.wcat, x: activeWorm().x})")
    pg.keyboard.press("w"); pg.wait_for_timeout(150)
    s = cur(); print(s)
    assert s["open"] and s["cur"] == s["armed"] and s["dom"] == [s["armed"]], "cursor starts on the armed weapon"
    x0 = s["x"]
    # arrows move the cursor, not the worm
    pg.keyboard.press("ArrowRight"); pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(100)
    s2 = cur(); assert s2["cur"] != s["cur"] and len(s2["dom"]) == 1
    pg.keyboard.press("ArrowDown"); pg.wait_for_timeout(100)
    s3 = cur(); assert s3["cur"] != s2["cur"], "down moves to the next row"
    pg.keyboard.press("ArrowUp"); pg.wait_for_timeout(100)
    assert cur()["cur"] == s2["cur"], "up comes back"
    pg.keyboard.press("End"); assert cur()["cur"] == pg.evaluate("[...document.querySelectorAll('#wgrid .wb')].pop().dataset.w")
    pg.keyboard.press("Home")
    # letter jump: 'k' -> Kamehameha
    seen = []
    for _ in range(3):  # repeated presses cycle through the weapons starting with the letter
        pg.keyboard.press("k"); pg.wait_for_timeout(80)
        seen.append(cur()["cur"])
        if seen[-1] == "kamehameha": break
    assert seen[-1] == "kamehameha" and seen[0] != seen[-1] or seen == ["kamehameha"], seen
    # Enter arms and closes
    pg.keyboard.press("Enter"); pg.wait_for_timeout(150)
    s4 = cur(); print(s4)
    assert s4["armed"] == "kamehameha" and not s4["open"], "Enter arms the weapon and closes the panel"
    assert abs(s4["x"] - x0) < 1, "the worm did not move"
    # Tab cycles categories (and does not switch worm), Shift+Tab goes back, Space arms
    pg.keyboard.press("w"); pg.wait_for_timeout(100)
    active = pg.evaluate("G.active")
    pg.keyboard.press("Tab"); pg.wait_for_timeout(150)
    t1 = cur(); assert t1["cat"] == "body" and t1["cur"] and t1["dom"] == [t1["cur"]], t1
    assert pg.evaluate("G.active") == active, "Tab changed the category, not the worm"
    pg.keyboard.press("Shift+Tab"); pg.wait_for_timeout(100)
    assert cur()["cat"] == "all"
    pg.keyboard.press("Tab"); pg.keyboard.press("Tab"); pg.wait_for_timeout(100)
    assert cur()["cat"] == "short"
    first = cur()["cur"]
    pg.keyboard.press(" "); pg.wait_for_timeout(150)
    s5 = cur(); assert s5["armed"] == first and not s5["open"], s5
    assert pg.evaluate("G.projs.length") == 0, "Space armed, it did not fire"
    # an unavailable weapon is not armed by Enter
    pg.evaluate("setWeaponTab('all'); G.teams[G.ti].ammo.nuke = 0; UI.sig = null; hud()")
    pg.keyboard.press("w"); pg.wait_for_timeout(100)
    pg.keyboard.press("n"); pg.keyboard.press("n")
    pg.evaluate("panelCursor('nuke')"); pg.keyboard.press("Enter"); pg.wait_for_timeout(100)
    s6 = cur(); assert s6["armed"] == first and s6["open"], "an empty weapon cannot be armed"
    # W and Esc close; game keys work again afterwards
    pg.keyboard.press("Escape"); pg.wait_for_timeout(100)
    assert not cur()["open"] and not pg.evaluate("$('pause') && $('pause').classList.contains('on')"), "Esc only closes the panel"
    xb = cur()["x"]; pg.keyboard.down("ArrowRight"); pg.wait_for_timeout(400); pg.keyboard.up("ArrowRight")
    assert abs(cur()["x"] - xb) > 1, "arrows walk again with the panel closed"
    finish(errors)
