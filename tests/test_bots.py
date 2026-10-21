"""Bots must act every turn: count turns that ran out of time with the bot still 'thinking'."""
from common import game_page, finish

JS = """() => {
  const w = window.__wh, out = {timeouts: 0, turns: 0};
  const styles = ['hills','islands','caves','plateau','canyon','mountains','archipelago'];
  for (let k = 0; k < 14; k++) {
    w.newGame({seed:'b'+k, style: styles[k%7], theme:'grass', size:'m', hp:100, turnTime:30, arsenal: k%2 ? 'full':'std',
               mines:3, drums:3, crates:3, sd:0, worms:3, rise:0},
              [{name:'A',ctrl:'ai'},{name:'B',ctrl:'ai'},{name:'C',ctrl:'ai'}]);
    const g = w.G; let t = 0, last = 'turn';
    while (t < 900 && !g.over) {
      w.stepOnce(1/60); t += 1/60;
      if (last === 'turn' && g.phase === 'settle') { out.turns++; if (g.timer <= 0.05) out.timeouts++; }
      if (last === 'turn' && g.phase === 'retreat') out.turns++;
      last = g.phase;
    }
  }
  return out;
}"""

with game_page() as (pg, errors):
    r = pg.evaluate(JS)
    print(r)
    assert r["turns"] > 100
    assert r["timeouts"] <= r["turns"] * 0.03, "bots idle too often: %s" % r
    finish(errors)
