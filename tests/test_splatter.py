"""Splatter Mode displays blood particles only when enabled."""
from common import game_page, finish, BASE

JS = """([base]) => {
  const w = window.__wh;
  w.newGame(Object.assign({seed: 'splatter'}, base), [
    {name:'A', ctrl:'local'}, {name:'B', ctrl:'local'}
  ]);

  FX.p.length = 0;
  UI.splatterMode = true;
  applyEvent({e: 'blood', x: 100, y: 100});
  const enabledCount = FX.p.length;
  const redParticles = FX.p.filter(p =>
    ['#7d1020', '#b5122b', '#d21f3c'].includes(p.c)
  ).length;

  FX.p.length = 0;
  UI.splatterMode = false;
  applyEvent({e: 'blood', x: 100, y: 100});
  const disabledCount = FX.p.length;

  return {enabledCount, redParticles, disabledCount};
}"""

with game_page() as (pg, errors):
    result = pg.evaluate(JS, [BASE])
    print(result)
    assert result["enabledCount"] > 0, result
    assert result["redParticles"] == result["enabledCount"], result
    assert result["disabledCount"] == 0, result
    finish(errors)