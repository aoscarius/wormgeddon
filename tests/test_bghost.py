"""Background hosting: when animation frames stop (hidden tab) the host keeps simulating through a Web Worker timer, unless the
'Keep hosting in the background' option is off or the page is not the host; with frames running the worker never steps twice."""
from common import game_page, finish, BASE

JS = """
async (base) => {
  const w = window.__wh, out = {};
  w.newGame(Object.assign({seed: 'bg'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const g = w.G;
  NET.role = 'host'; UI.bgHost = true;
  await sleep(300);                       // frames run: the worker is created and stays idle
  out.worker = !!bgWorker;
  const t0 = g.time; await sleep(1000);
  out.visibleRate = (g.time - t0) / 1.0;  // ~1 s of game time per second, not 2
  // frames stop (hidden tab): the worker takes over
  const realRaf = window.requestAnimationFrame; window.requestAnimationFrame = () => 0;
  await sleep(300);
  const t1 = g.time; await sleep(1000);
  out.hiddenAdvance = g.time - t1;
  // option off: nothing runs
  UI.bgHost = false; bgSync(); out.workerOff = !bgWorker;
  const t2 = g.time; await sleep(600);
  out.offAdvance = g.time - t2;
  // not the host: nothing runs either
  UI.bgHost = true; NET.role = 'local'; bgSync(); out.workerLocal = !bgWorker;
  NET.role = 'host'; bgSync();
  window.requestAnimationFrame = realRaf; requestAnimationFrame(frame);
  return out;
}
"""

with game_page(viewport={"width": 1100, "height": 700}) as (pg, errors):
    r = pg.evaluate(JS, BASE)
    print(r)
    assert r["worker"], "the host starts the background worker"
    assert 0.8 < r["visibleRate"] < 1.25, f"frames running: the simulation is not stepped twice ({r['visibleRate']})"
    assert r["hiddenAdvance"] > 0.8, f"the match keeps running without animation frames ({r['hiddenAdvance']})"
    assert r["workerOff"] and r["offAdvance"] < 0.05, "option off: the match pauses with the tab"
    assert r["workerLocal"], "only a host gets the worker"
    finish(errors)
