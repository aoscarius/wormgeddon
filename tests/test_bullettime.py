"""Matrix Bullet Time: the caster bends back and puts on sunglasses (tool 'bt'), then for BT_TIME s everything else runs at
BT_SLOW of its speed while the caster stays at full speed and takes no damage (hostile projectiles are deflected). Holding
Fire with the weapon selected sends fast rounds that freeze mid-air and accelerate back to full speed when the effect ends."""
from common import game_page, finish, BASE
from arena import ARENA_JS

JS = ARENA_JS + """
const run = ([base]) => {
  const w = window.__wh, out = {};
  w.newGame(Object.assign({seed: 'bt'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
  const g = w.G;
  for (let i = 0; i < 30; i++) w.stepOnce(1/60);
  arena(700);
  const a = g.worms.find(x => x.id === g.active), foe = g.worms.find(x => x.team !== a.team);
  g.worms.forEach((o, i) => { if (o !== a && o !== foe) stand(o, 60 + 25 * i); });
  g.teams[a.team].ammo.bullettime = 1;
  stand(a, 800); a.face = 1; a.aim = 0;
  stand(foe, 1000);
  for (let i = 0; i < 10; i++) w.stepOnce(1/60);
  g.weapon.id = 'bullettime';
  const hp0 = foe.hp, ahp0 = a.hp, timer0 = g.timer;
  const evs = [], oldEmit = window.emit;
  window.emit = e => { evs.push(e.e); return oldEmit(e); };
  LOCAL.fireP = 1; w.stepOnce(1/60); LOCAL.fireP = 0;
  out.tool = a.tool && a.tool.k; out.ammo = g.teams[a.team].ammo.bullettime; out.bt = !!g.bt && g.bt.id === a.id;
  let animEnd = null; const t0 = g.time;
  for (let i = 0; i < 60 * 2 && animEnd === null; i++) { w.stepOnce(1/60); if (!a.tool) animEnd = g.time - t0; }
  out.animEnd = animEnd; out.phase = g.phase;
  // the slow world: a free-falling foe covers BT_SLOW of the distance
  foe.y -= 120; foe.vy = 0; foe.grounded = false; const fy = foe.y;
  const ay = a.y; a.vy = 0;
  for (let i = 0; i < 30; i++) w.stepOnce(1/60);
  out.foeFall = foe.y - fy;
  // caster immune: damage and a hostile projectile
  hurt(a, 30);
  out.casterHp = a.hp === ahp0;
  const p = spawnProj('rocket', a.x + 45, a.y - 2, -300, 0, foe, {});
  let defl = false;
  for (let i = 0; i < 60 * 3 && !p.dead; i++) { w.stepOnce(1/60); if (p.ow === a.id) { defl = true; break; } }
  out.deflected = defl; out.casterSafe = a.hp === ahp0 && !a.dead;
  p.dead = true;
  stand(foe, 1100); foe.vy = 0;
  // barrage
  a.aim = 0; a.face = 1;
  LOCAL.fire = 1;
  for (let i = 0; i < 30; i++) w.stepOnce(1/60);
  LOCAL.fire = 0;
  out.dbg = [g.bt && g.bt.t, g.weapon.id, g.phase, a.tool && a.tool.k, g.projs.map(q => q.t)];
  const bl = () => g.projs.filter(q => q.t === 'btbullet');
  out.rounds = bl().length;
  for (let i = 0; i < 15; i++) w.stepOnce(1/60);
  const pos0 = bl().map(q => q.x + ',' + q.y).join('|');
  for (let i = 0; i < 20; i++) w.stepOnce(1/60);
  out.frozen = g.bt && pos0 === bl().map(q => q.x + ',' + q.y).join('|') && bl().length > 0;
  out.foeHpFrozen = foe.hp === hp0;
  // run the effect out
  while (g.bt) w.stepOnce(1/60);
  const x1 = bl().map(q => q.x);
  for (let i = 0; i < 60 * 3; i++) w.stepOnce(1/60);
  out.hit = foe.hp < hp0 || foe.pend > 0; out.splat = evs.includes('btsplat'); window.emit = oldEmit;
  out.after = !g.bt; out.btLeft = bl().length;
  hurt(a, 10); out.vulnerable = a.hp < ahp0;
  out.consts = {slow: BT_SLOW, time: BT_TIME, anim: BT_ANIM};
  return out;
};
"""

with game_page(viewport={"width": 1100, "height": 700}) as (pg, errors):
    r = pg.evaluate("([b]) => {" + JS + "return run([b]); }", [BASE])
    print(r)
    assert r["tool"] == "bt" and r["ammo"] == 0 and r["bt"], "Bullet Time starts, spends its ammo"
    assert r["animEnd"] is not None and abs(r["animEnd"] - r["consts"]["anim"]) < 0.1, "the sunglasses animation lasts BT_ANIM"
    assert r["phase"] == "turn", "the turn goes on so that the caster can shoot"
    assert 0 < r["foeFall"] < 12, f"the world is slowed: {r['foeFall']}"
    assert r["casterHp"] and r["deflected"] and r["casterSafe"], "the caster cannot be hurt, hostile projectiles are deflected"
    assert r["rounds"] >= 5, "holding Fire sends a barrage"
    assert r["frozen"] and r["foeHpFrozen"], "the rounds freeze in mid-air"
    assert r["after"] and r["hit"], "when the effect ends the rounds speed up and hit"
    assert r["splat"], "a round that hits a worm splatters blood"
    assert r["vulnerable"], "the caster is vulnerable again afterwards"
    finish(errors)
