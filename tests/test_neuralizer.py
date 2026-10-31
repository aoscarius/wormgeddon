"""Men in Black Neuralizer: the caster puts on sunglasses and raises the device (tool 'neu'), a full-screen white flash with a
camera-flash sound hits the map, every living worm becomes confused and the turn ends at once. A confused worm plays its next
whole turn with inverted movement / aim controls (random), and is back to normal afterwards."""
from common import game_page, finish, BASE
from arena import ARENA_JS

JS = ARENA_JS + """
const run = ([base]) => {
  const w = window.__wh, out = {};
  w.newGame(Object.assign({seed: 'neu'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
  const g = w.G;
  for (let i = 0; i < 30; i++) w.stepOnce(1/60);
  arena(700);
  const a = g.worms.find(x => x.id === g.active);
  g.worms.forEach((o, i) => stand(o, 300 + 120 * i));
  g.teams[a.team].ammo.neuralizer = 1;
  for (let i = 0; i < 10; i++) w.stepOnce(1/60);
  g.weapon.id = 'neuralizer';
  const evs = [], oldEmit = window.emit;
  window.emit = e => { evs.push(e); return oldEmit(e); };
  LOCAL.fireP = 1; w.stepOnce(1/60); LOCAL.fireP = 0;
  out.tool = a.tool && a.tool.k; out.ammo = g.teams[a.team].ammo.neuralizer;
  out.confBefore = g.worms.filter(o => o.conf).length;
  for (let i = 0; i < 60 * 3 && g.phase === 'turn'; i++) w.stepOnce(1/60);
  out.phase = g.phase;
  out.flash = evs.filter(e => e.e === 'flash').map(e => e.a);
  out.snd = evs.some(e => e.e === 'snd' && e.s === 'neuralizer');
  out.confAll = g.worms.every(o => o.conf === 1);
  window.emit = oldEmit;
  // next turn of a confused worm: inverted controls
  let guard = 0;
  while (guard++ < 60 * 30 && !(g.phase === 'turn' && g.worms.find(o => o.id === g.active).conf === 2)) w.stepOnce(1/60);
  const b = g.worms.find(o => o.id === g.active);
  out.confActive = b.conf; out.inv = !!g.confInv && (g.confInv.mv || g.confInv.aim);
  g.confInv = {mv: true, aim: false};
  stand(b, 800); b.face = 1;
  for (let i = 0; i < 5; i++) w.stepOnce(1/60);
  const x0 = b.x;
  LOCAL.r = 1; for (let i = 0; i < 30; i++) w.stepOnce(1/60); LOCAL.r = 0;
  out.dx = b.x - x0;
  g.confInv = {mv: false, aim: false};
  let aim0 = b.aim;
  LOCAL.u = 1; for (let i = 0; i < 20; i++) w.stepOnce(1/60); LOCAL.u = 0;
  out.aimNormal = b.aim - aim0;
  g.confInv = {mv: false, aim: true};
  aim0 = b.aim;
  LOCAL.u = 1; for (let i = 0; i < 20; i++) w.stepOnce(1/60); LOCAL.u = 0;
  out.aimUp = b.aim - aim0;
  // turn over: the confusion is gone
  g.timer = 0.01;
  guard = 0;
  while (guard++ < 60 * 30 && g.active === b.id) w.stepOnce(1/60);
  out.after = b.conf;
  return out;
};
"""

with game_page(viewport={"width": 1100, "height": 700}) as (pg, errors):
    r = pg.evaluate("([b]) => {" + JS + "return run([b]); }", [BASE])
    print(r)
    assert r["tool"] == "neu" and r["ammo"] == 0 and r["confBefore"] == 0, "starts as a tool and spends its ammo"
    assert r["phase"] != "turn", "the turn ends right after the flash"
    assert r["flash"] and max(r["flash"]) > 1.5 and r["snd"], "full-screen flash and camera sound"
    assert r["confAll"], "every worm on the map is confused"
    assert r["confActive"] == 2 and r["inv"], "the confused worm starts its turn with a random inversion"
    assert r["dx"] < -5, f"left/right inverted: {r['dx']}"
    assert r["aimNormal"] * r["aimUp"] < 0, f"up/down inverted: {r['aimNormal']} vs {r['aimUp']}"
    assert r["after"] == 0, "the confusion lasts one turn only"
    finish(errors)
