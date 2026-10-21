"""Chat: sanitising, host stamping, flood control, offline behaviour, lobby and in-game UI."""
from common import game_page, finish

SETUP = """() => {
  window.__sent = [];
  const fake = () => ({open: true, send(m) { window.__sent.push(m); }});
  window.__fake = fake;
}"""

with game_page(viewport={"width": 1100, "height": 700}) as (pg, errors):
    pg.evaluate(SETUP)

    # -- offline: no chat at all
    assert pg.evaluate("chatAvailable()") is False
    assert pg.evaluate("chatSend('hello')") is False
    assert pg.evaluate("$('hostChat').hidden && $('joinChat').hidden && $('wchat').hidden")

    # -- cleaning
    assert pg.evaluate("chatClean('  a\\n\\tb   c\\u0007 ')") == "a b c"
    assert pg.evaluate("chatClean('x'.repeat(500)).length") == 140

    # -- host: own message is logged and broadcast; guest message is re-stamped (no spoofing)
    r = pg.evaluate("""() => {
      NET.role = 'host'; const c = window.__fake(); NET.conns = [c]; chatSync();
      chatSend('hi all');
      const g = {conn: c, name: 'Bob', team: -1};
      chatHostMsg(g, {t: 'chat', x: '<img src=x onerror=alert(1)>', n: 'Admin', k: 3});
      const spoof = window.__sent.at(-1);
      chatHostMsg(g, {t: 'chat', x: 'too fast'});          // inside the 350 ms window: dropped
      g.lastChat = 0; chatHostMsg(g, {t: 'chat', x: '   '}); // empty: dropped
      return {log: CHAT.log.map(l => l.n + ':' + l.x), sent: window.__sent.length, spoof,
              lobbyVisible: !$('hostChat').hidden, html: $('hostChatLog').innerHTML};
    }""")
    print(r)
    assert r["log"][0].endswith(":hi all") and len(r["log"]) == 2
    assert r["spoof"]["n"] == "Bob" and r["spoof"]["k"] == -1, "sender must be stamped by the host"
    assert r["sent"] == 2 and r["lobbyVisible"]
    assert "<img" not in r["html"], "text must never be parsed as HTML"
    assert pg.locator("#hostChatLog img").count() == 0

    # -- host UI: typing in the lobby box sends and clears the input
    pg.evaluate("window.__sent.length = 0")
    pg.evaluate("document.getElementById('menu').style.display='flex'")
    pg.click("[data-tab=host]")
    pg.fill("#hostChatIn", "from the box")
    pg.press("#hostChatIn", "Enter")
    assert pg.evaluate("window.__sent.at(-1).x") == "from the box"
    assert pg.input_value("#hostChatIn") == ""

    # -- guest: sends only {t:'chat', x}; shows what the host broadcasts
    r = pg.evaluate("""() => {
      chatReset(); NET.role = 'client'; const c = window.__fake(); NET.conn = c; window.__sent.length = 0;
      chatSend('guest says'); const out = window.__sent[0];
      chatReceive({t: 'chat', n: 'Host', k: 0, x: 'welcome'});
      chatReceive({t: 'chat', n: 5, x: 'bad'});             // malformed: ignored
      return {out, log: CHAT.log.map(l => l.n + ':' + l.x)};
    }""")
    print(r)
    assert r["out"] == {"t": "chat", "x": "guest says"} and r["log"] == ["Host:welcome"]

    # -- in game: overlay, T key, Esc
    pg.evaluate("""() => {
      NET.role = 'host'; NET.conns = [window.__fake()];
      window.__wh.newGame({seed: 'c', style: 'hills', theme: 'grass', size: 'm', hp: 100, turnTime: 45, arsenal: 'std',
        mines: 0, drums: 0, crates: 0, sd: 0, worms: 2}, [{name: 'A', ctrl: 'local'}, {name: 'B', ctrl: 'ai'}]);
      enterGame && enterGame(); chatSync();
    }""")
    assert pg.evaluate("!$('wchat').hidden")
    pg.keyboard.press("t")
    assert pg.evaluate("!$('chatform').hidden && document.activeElement === $('chatin')")
    pg.keyboard.type("gg")
    pg.keyboard.press("Enter")
    assert pg.evaluate("$('chatform').hidden")
    assert pg.evaluate("CHAT.log.at(-1).x") == "gg"
    assert pg.locator("#chatlog .cl").count() >= 1
    pg.keyboard.press("t"); pg.keyboard.press("Escape")
    assert pg.evaluate("$('chatform').hidden")
    pg.screenshot(path="/tmp/chat-ingame.png")

    # -- closing the room wipes the conversation
    pg.evaluate("NET.close()")
    assert pg.evaluate("CHAT.log.length") == 0 and pg.evaluate("chatAvailable()") is False
    finish(errors)
