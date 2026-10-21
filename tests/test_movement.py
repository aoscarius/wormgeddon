"""Map-edge death; on the rope / jet pack Jump fires the selected weapon and Space lets go."""
from common import game_page, finish

JS = """() => {
  const w = window.__wh, r = {};
  const mk = () => { w.newGame({seed:'t7', style:'hills', theme:'grass', size:'m', hp:100, turnTime:45, arsenal:'full',
    mines:0, drums:0, crates:0, sd:0, worms:2, rise:0}, [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
    for (let i = 0; i < 100; i++) w.stepOnce(1/60); return w.G; };
  let g = mk(); const a = g.worms.find(x => x.id === g.active);
  a.x = -60; a.y = 300; a.vx = -50; a.grounded = false; w.stepOnce(1/60);
  r.edge = {dead: a.dead, sunk: a.sunk};
  // jet pack + grenade: Space lets go (nothing fired), Jump fires the selected weapon and keeps the jet
  g = mk(); let b = g.worms.find(x => x.id === g.active);
  g.weapon.id = 'jetpack'; edge('fireP'); w.stepOnce(1/60); r.jetOn = !!b.jet;
  g.weapon.id = 'grenade'; edge('jump'); w.stepOnce(1/60);
  r.jetJump = {projs: g.projs.length, jet: !!b.jet};
  g = mk(); b = g.worms.find(x => x.id === g.active);
  g.weapon.id = 'jetpack'; edge('fireP'); w.stepOnce(1/60);
  g.weapon.id = 'grenade'; edge('fireP'); w.stepOnce(1/60);
  r.jetSpace = {projs: g.projs.length, jet: !!b.jet};
  // rope + dynamite
  g = mk(); b = g.worms.find(x => x.id === g.active);
  g.weapon.id = 'rope'; b.face = 1;
  for (const aim of [-1.2, -0.9, -0.6, -0.3, 0, 0.3]) { b.aim = aim; edge('fireP'); w.stepOnce(1/60); if (b.rope) break; }
  r.ropeOn = !!b.rope;
  g.weapon.id = 'dynamite'; edge('fireP'); w.stepOnce(1/60);
  r.ropeSpace = {projs: g.projs.length, rope: !!b.rope};
  b.aim = -1; g.weapon.id = 'rope';
  for (const aim of [-1.2, -0.9, -0.6, -0.3, 0, 0.3]) { b.aim = aim; edge('fireP'); w.stepOnce(1/60); if (b.rope) break; }
  g.weapon.id = 'dynamite'; edge('jump'); w.stepOnce(1/60);
  r.ropeJump = {projs: g.projs.length};
  // 'sprite' box is drawn without errors
  g = mk(); b = g.worms.find(x => x.id === g.active);
  g.weapon.id = 'jetpack'; edge('fireP'); w.stepOnce(1/60); g.weapon.id = 'bazooka'; w.stepOnce(1/60);
  r.box = typeof holdingOther === 'function' && holdingOther(b);
  return r;
}"""

with game_page() as (pg, errors):
    r = pg.evaluate(JS)
    print(r)
    assert r["edge"]["dead"] and r["edge"]["sunk"], "worm leaving the map must die"
    assert r["jetOn"] and r["jetJump"]["projs"] >= 1, "Jump fires the selected weapon from the jet pack"
    assert r["jetSpace"] == {"projs": 0, "jet": False}, "Space releases the jet pack and fires nothing"
    assert r["ropeOn"] and r["ropeSpace"] == {"projs": 0, "rope": False}, "Space releases the rope"
    assert r["ropeJump"]["projs"] >= 1, "Jump fires the selected weapon on the rope"
    assert r["box"]
    finish(errors)
