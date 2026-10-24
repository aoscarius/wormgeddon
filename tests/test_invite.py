"""Invite link: host gets copy/share link; opening ?join=CODE joins the room straight away (fake PeerJS)."""
from common import ROOT, INDEX_URL, game_page, finish

FAKE_PEER = """
window.__peers = [];
window.Peer = class {
  constructor(id) { this.id = id; this.h = {}; this.conn = null; window.__peers.push(this); }
  on(ev, fn) { this.h[ev] = fn; }
  connect(id) { this.conn = {id, sent: [], h: {}, open: true, on(ev, fn) { this.h[ev] = fn; }, send(m) { this.sent.push(m); }}; return this.conn; }
  destroy() {}
};
"""

# --- 1) host side: link field and button (room opened through the fake peer)
with game_page(init_script=FAKE_PEER, viewport={"width": 1000, "height": 700}) as (pg, errors):
    pg.click("[data-tab=host]")
    assert pg.is_disabled("#bLink"), "no link before a room exists"
    pg.click("#bHost")
    pg.evaluate("window.__peers[0].h.open()")          # the broker accepted the id
    code = pg.evaluate("NET.code")
    link = pg.evaluate("inviteURL(NET.code)")       # the button is an icon: the link is built, not shown
    assert link.endswith("?join=" + code) and "?" not in link.split("?join=")[0]
    assert pg.is_enabled("#bLink") and pg.get_attribute("#bLink", "aria-label") == "Copy invite link"

    # desktop: copies (clipboard stubbed), shows a message
    pg.evaluate("window.__copied = []; Object.defineProperty(navigator, 'clipboard', {value: {writeText: t => (window.__copied.push(t), Promise.resolve())}, configurable: true});")
    pg.evaluate("Object.defineProperty(window, 'isSecureContext', {value: true, configurable: true})")
    pg.click("#bLink"); pg.wait_for_timeout(100)
    assert pg.evaluate("window.__copied") == [link]

    # phone: share sheet (touch + navigator.share) is used with title/text/url; closing it does not copy
    pg.evaluate("""() => { window.__shared = []; navigator.share = d => { window.__shared.push(d); return Promise.resolve(); };
      matchMedia = q => ({matches: q.includes('coarse'), addEventListener() {}, addListener() {}}); inviteSync(); }""")
    pg.click("#bLink"); pg.wait_for_timeout(100)
    sh = pg.evaluate("window.__shared")
    assert len(sh) == 1 and sh[0]["url"] == link and sh[0]["title"] == "Wormgeddon", sh
    pg.evaluate("() => { window.__copied.length = 0; navigator.share = () => Promise.reject(Object.assign(new Error('x'), {name: 'AbortError'})); }")
    pg.click("#bLink"); pg.wait_for_timeout(100)
    assert pg.evaluate("window.__copied.length") == 0
    # closing the room clears the link again
    pg.evaluate("NET.close()")
    assert pg.is_disabled("#bLink")
    # pasted links in the code box are reduced to the code
    pg.click("[data-tab=join]")
    pg.fill("#jCode", "https://example.org/game/?join=ab3k9")
    assert pg.input_value("#jCode") == "AB3K9"
    finish(errors)

# --- 2) guest side: ?join=CODE joins immediately, lands on the Join tab, keeps a name, drops the query
with game_page(url=INDEX_URL + "?join=zq7m2", init_script=FAKE_PEER) as (pg, errors):
    assert pg.is_visible("#tab-join") and pg.is_hidden("#tab-host")
    assert pg.input_value("#jCode") == "ZQ7M2"
    name = pg.input_value("#jName")
    assert name.startswith("Player") and len(name) > 6, name
    assert pg.evaluate("location.search") == "", "query must be removed"
    assert pg.evaluate("window.__peers.length") == 1 and pg.evaluate("NET.role") == "client"
    pg.evaluate("window.__peers[0].h.open()")
    assert pg.evaluate("window.__peers[0].conn.id") == "wormgeddon-ZQ7M2"
    pg.evaluate("window.__peers[0].conn.h.open()")
    sent = pg.evaluate("window.__peers[0].conn.sent")
    assert sent == [{"t": "hello", "name": name}], sent
    assert "Connected" in pg.inner_text("#joinNote")
    assert not pg.evaluate("document.getElementById('joinChat').hidden"), "lobby chat is there"
    finish(errors)
