"""Lightsaber: with an enemy within reach the attacker and the target draw a blue and a red saber and fight a 5 s automated
duel (custom track + hum), the blades clashing at every beat; from LS_SPIN the attacker spins round and at LS_STRIKE delivers
a lethal strike (the target dies and is knocked away), then both stow their sabers at the end of the 5 s. Without a worm in
reach nothing happens and the ammo is kept."""
from common import game_page, finish, BASE
from arena import ARENA_JS

JS = ARENA_JS + """
const run = ([base]) => {
  const w = window.__wh, out = {};
  w.newGame(Object.assign({seed: 'saber'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
  const g = w.G;
  for (let i = 0; i < 30; i++) w.stepOnce(1/60);
  arena(700);
  const a = g.worms.find(x => x.id === g.active), foe = g.worms.find(x => x.team !== a.team);
  g.worms.forEach((o, i) => { if (o !== a && o !== foe) stand(o, 60 + 25 * i); });
  stand(a, 800); a.face = 1; stand(foe, 1000);
  g.teams[a.team].ammo.lightsaber = 1;
  for (let i = 0; i < 10; i++) w.stepOnce(1/60);
  g.weapon.id = 'lightsaber';
  LOCAL.fireP = 1; w.stepOnce(1/60); LOCAL.fireP = 0;
  out.farTool = a.tool; out.farAmmo = g.teams[a.team].ammo.lightsaber;
  stand(foe, 835); foe.hp = 100; const hp0 = foe.hp;
  for (let i = 0; i < 5; i++) w.stepOnce(1/60);
  const evs = [], old = window.emit; window.emit = e => { evs.push(e.e + (e.s ? ':' + e.s : '')); return old(e); };
  const mp3 = [], oldM = window.mp3Sfx; window.mp3Sfx = (s) => { mp3.push(s); };
  LOCAL.fireP = 1; w.stepOnce(1/60); LOCAL.fireP = 0;
  out.tool = a.tool && a.tool.k; out.ammo = g.teams[a.team].ammo.lightsaber; out.lv = a.tool && a.tool.lv === foe.id + 1;
  out.foeFace = foe.face === -a.face;
  const t0 = g.time; let end = null, mid = null, hitAt = null, spinAt = null;
  for (let i = 0; i < 60 * 7 && end === null; i++) {
    w.stepOnce(1/60);
    if (g.time - t0 > 2.5 && mid === null) mid = {hp: foe.hp, pend: foe.pend, tool: a.tool && a.tool.k, snap: snapshot(true).w.find(r => r[0] === a.id)[9]};
    if (hitAt === null && (foe.pend > 0 || foe.hp < hp0)) hitAt = g.time - t0;
    if (spinAt === null && evs.includes('snd:whoosh')) spinAt = g.time - t0;
    if (!a.tool) end = g.time - t0;
  }
  out.end = end; out.hitAt = hitAt; out.spinAt = spinAt; out.mid = mid; out.clashes = evs.filter(e => e === 'saberclash').length;
  out.snd = evs.includes('snd:saber'); out.off = evs.includes('snd:saberoff');
  out.listed = MP3_FILES.includes('sounds/lightsaber.mp3');
  for (let i = 0; i < 60 * 9 && !foe.dead; i++) w.stepOnce(1/60);
  out.dead = foe.dead; out.pushed = foe.x - 835;
  window.emit = old; window.mp3Sfx = oldM;
  out.consts = {time: LS_TIME, spin: LS_SPIN, strike: LS_STRIKE};
  return out;
};
"""

with game_page(viewport={"width": 1100, "height": 700}) as (pg, errors):
    r = pg.evaluate("([b]) => {" + JS + "return run([b]); }", [BASE])
    print(r)
    c = r["consts"]
    assert r["farTool"] is None and r["farAmmo"] == 1, "no worm in reach: nothing happens"
    assert r["tool"] == "saber" and r["ammo"] == 0 and r["lv"] and r["foeFace"], "the duel starts, the target faces the attacker"
    assert r["listed"] and r["snd"] and r["off"], "track and sound effects"
    assert r["mid"]["tool"] == "saber" and r["mid"]["hp"] == 100 and r["mid"]["snap"] == "saber", "no damage during the duel"
    assert abs(r["end"] - c["time"]) < 0.1, f"the duel lasts exactly {c['time']} s: {r['end']}"
    assert r["clashes"] >= 7, f"the blades clash at every beat: {r['clashes']}"
    assert r["spinAt"] is not None and abs(r["spinAt"] - c["spin"]) < 0.1, f"the finishing spin starts at LS_SPIN: {r['spinAt']}"
    assert r["hitAt"] is not None and abs(r["hitAt"] - c["strike"]) < 0.1, f"the strike lands just before the sabers go off: {r['hitAt']}"
    assert r["dead"], "the strike is lethal"
    assert r["pushed"] > 30, "the target is knocked away"
    finish(errors)
