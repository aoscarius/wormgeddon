"""Shadow Clone Jutsu: CLONE_N clones of the caster appear on standing spots across the map; they are not in the team roster
(no turn, the team's survival does not depend on them), always show full health, and vanish when hit; an enemy whose active
turn is spent hitting one loses the turn. Clones fade after CLONE_LIFE s."""
from common import game_page, finish, BASE
from arena import ARENA_JS

JS = ARENA_JS + """
const run = ([base]) => {
  const w = window.__wh, out = {};
  const setup = seed => {
    w.newGame(Object.assign({seed}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
    const g = w.G;
    for (let i = 0; i < 30; i++) w.stepOnce(1/60);
    g.round = 9;
    const a = g.worms.find(x => x.id === g.active);
    g.teams[a.team].ammo.shadowclone = 2;
    for (let i = 0; i < 10; i++) w.stepOnce(1/60);
    g.weapon.id = 'shadowclone';
    return {g, a};
  };
  const ev = [], old = window.emit;
  window.emit = e => { ev.push(e.e + (e.s ? ':' + e.s : '')); return old(e); };
  let {g, a} = setup('sc1');
  const n0 = g.worms.length, roster0 = g.teams.map(t => t.worms.length);
  LOCAL.fireP = 1; w.stepOnce(1/60); LOCAL.fireP = 0;
  for (let i = 0; i < 120; i++) w.stepOnce(1/60);
  const clones = g.worms.filter(o => o.clone);
  out.count = clones.length; out.n = CLONE_N; out.ammo = g.teams[a.team].ammo.shadowclone; out.phase = g.phase;
  out.roster = JSON.stringify(g.teams.map(t => t.worms.length)) === JSON.stringify(roster0);
  out.team = clones.every(c => c.team === a.team && c.name === a.name);
  out.spread = Math.max(...clones.map(c => c.x)) - Math.min(...clones.map(c => c.x));
  out.grounded = clones.every(c => c.grounded && !c.dead && c.y < g.waterY);
  out.poofs = ev.filter(e => e === 'poof').length; out.snd = ev.includes('snd:poof');
  out.hp = clones.every(c => c.hp === g.cfg.hp);
  // snapshot lists them
  out.snap = snapshot(false).cl.length;
  // an enemy attacks a clone: it vanishes and the turn is wasted
  const c0 = clones[0];
  g.active = g.worms.find(o => o.team !== a.team && !o.clone).id; g.phase = 'turn'; g.timer = 30;
  const att = g.worms.find(o => o.id === g.active);
  hurt(c0, 40, { src: att.id });
  out.vanished = c0.dead; out.turnLost = g.phase === 'settle';
  for (let i = 0; i < 5; i++) w.stepOnce(1/60);
  out.removed = !g.worms.includes(c0) && g.worms.filter(o => o.clone).length === CLONE_N - 1;
  out.clonesLeft = g.worms.filter(o => o.clone).length;
  // an explosion next to a clone
  const c1 = g.worms.find(o => o.clone);
  explode(c1.x, c1.y, 30, 50, 100, { src: att.id });
  out.exploded = c1.dead;
  // own clone hit by its owner's team: no turn lost
  ({g, a} = setup('sc2'));
  LOCAL.fireP = 1; w.stepOnce(1/60); LOCAL.fireP = 0;
  for (let i = 0; i < 90; i++) w.stepOnce(1/60);
  const c2 = g.worms.find(o => o.clone);
  g.phase = 'turn'; g.timer = 30;
  hurt(c2, 10, { src: a.id });
  out.ownKeeps = g.phase === 'turn' && c2.dead;
  // roster survival: killing the caster's real worms ends the team although clones remain
  g.worms.filter(o => !o.clone && o.team === a.team).forEach(o => { o.dead = true; });
  out.teamGone = !teamAlive(g.teams[a.team]);
  // at the end of the turn the caster swaps places with one of its clones
  ({g, a} = setup('sc4'));
  const px = a.x, py = a.y;
  LOCAL.fireP = 1; w.stepOnce(1/60); LOCAL.fireP = 0;
  for (let i = 0; i < 90; i++) w.stepOnce(1/60);
  const before = g.worms.filter(o => o.clone).map(o => [o.x, o.y]), ax = a.x, ay = a.y;
  const turn0 = g.active; let swapped = false;
  for (let i = 0; i < 60 * 10 && g.active === turn0; i++) { w.stepOnce(1/60); }
  out.turnOver = g.active !== turn0;
  const spot = before.find(b => Math.hypot(b[0] - a.x, b[1] - a.y) < 25);
  out.swapped = !!spot && Math.hypot(ax - a.x, ay - a.y) > 60;
  out.cloneAtOld = g.worms.some(o => o.clone && Math.hypot(o.x - ax, o.y - ay) < 25);
  out.cloneCount = g.worms.filter(o => o.clone).length; out.swapEv = ev.includes('poof');
  // no clones left: nothing to swap with
  ({g, a} = setup('sc5'));
  LOCAL.fireP = 1; w.stepOnce(1/60); LOCAL.fireP = 0;
  for (let i = 0; i < 90; i++) w.stepOnce(1/60);
  g.worms.filter(o => o.clone).forEach(o => hurt(o, 1, {})); // (the caster's own turn: no turn lost, clones vanish)
  for (let i = 0; i < 5; i++) w.stepOnce(1/60);
  const bx = a.x, by = a.y, t1 = g.active;
  for (let i = 0; i < 60 * 10 && g.active === t1; i++) w.stepOnce(1/60);
  out.noClones = g.active !== t1 && Math.abs(a.x - bx) < 40 && g.worms.filter(o => o.clone).length === 0;
  // the original dies: every clone it made vanishes in smoke, those of other casters stay
  ({g, a} = setup('sc6'));
  LOCAL.fireP = 1; w.stepOnce(1/60); LOCAL.fireP = 0;
  for (let i = 0; i < 90; i++) w.stepOnce(1/60);
  const other = g.worms.find(o => !o.clone && o.team !== a.team);
  spawnClone(other, 500, 300); other.clonist = true;
  const n6 = g.worms.filter(o => o.clone && o.owner === a.id).length, pf0 = ev.filter(e => e === 'poof').length;
  a.hp = 0; a.dead = true;
  for (let i = 0; i < 5; i++) w.stepOnce(1/60);
  out.orphans = [n6, g.worms.filter(o => o.clone && o.owner === a.id).length, g.worms.filter(o => o.clone && o.owner === other.id).length, ev.filter(e => e === 'poof').length - pf0];
  // expiry
  ({g, a} = setup('sc3'));
  LOCAL.fireP = 1; w.stepOnce(1/60); LOCAL.fireP = 0;
  for (let i = 0; i < 90; i++) w.stepOnce(1/60);
  g.worms.filter(o => o.clone).forEach(o => { o.life = 0.5; });
  for (let i = 0; i < 60; i++) w.stepOnce(1/60);
  out.expired = g.worms.filter(o => o.clone).length === 0;
  window.emit = old;
  return out;
};
"""

with game_page(viewport={"width": 1100, "height": 700}) as (pg, errors):
    r = pg.evaluate("([b]) => {" + JS + "return run([b]); }", [BASE])
    print(r)
    assert r["count"] == r["n"] == 10 and r["ammo"] == 1, "ten clones, ammo spent"
    assert r["phase"] == "retreat", "casting uses up the turn"
    assert r["roster"], "clones are not in the team roster"
    assert r["team"] and r["hp"], "same team and name, full health"
    assert r["spread"] > 300 and r["grounded"], f"scattered over standing spots: {r['spread']}"
    assert r["poofs"] >= 11 and r["snd"], "smoke for the caster and every clone"
    assert r["snap"] == 10, "guests are told about the clones"
    assert r["vanished"] and r["turnLost"] and r["removed"], "an attacked clone vanishes and the attacker's turn is lost"
    assert r["exploded"], "explosions pop clones too"
    assert r["ownKeeps"], "hitting your own clone costs no turn"
    assert r["teamGone"], "clones do not keep a team alive"
    assert r["turnOver"] and r["swapped"] and r["cloneAtOld"] and r["cloneCount"] == 10, "the caster swaps places with a clone at the end of its turn"
    assert r["noClones"], "no clones left: no swap"
    assert r["orphans"][0] == 10 and r["orphans"][1] == 0 and r["orphans"][2] == 1 and r["orphans"][3] >= 10, f"clones vanish with their original: {r['orphans']}"
    assert r["expired"], "clones fade after their time"
    finish(errors)
