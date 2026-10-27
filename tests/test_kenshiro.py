"""Hokuto Hyakuretsu Ken: gatling punches on the worm in front, a dash past it to a safe distance with
"You're already dead!" (the MP3 verdict line, only when a worm was really hit; the "ata" cry plays at the start of every barrage), and HYAKU_FUSE s after the last blow the
victim explodes and dies. Misses mark nobody and do not play the voice line."""
from common import game_page, finish, BASE
from arena import ARENA_JS

JS = ARENA_JS + """
const run = ([base]) => {
  const w = window.__wh, out = {};
  const spoken = []; const realMp3 = window.mp3Sfx; window.mp3Sfx = (src, v) => { spoken.push(src); };
  const setup = (victimX) => {
    w.newGame(Object.assign({seed: 'hk'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
    const g = w.G;
    for (let i = 0; i < 30; i++) w.stepOnce(1/60);
    arena(700);
    g.round = 9;
    const a = g.worms.find(x => x.id === g.active), t = g.teams[a.team];
    t.ammo.hokuto = 3;
    const others = g.worms.filter(x => x !== a);
    const v = others.find(x => x.team !== a.team);
    const behind = others.find(x => x !== v && x.team === a.team) || others[1];
    const far = others.find(x => x !== v && x !== behind);
    others.forEach((o, i) => stand(o, 60 + 25 * i));
    stand(a, 800); a.face = 1; a.aim = 0; stand(v, victimX); stand(behind, 700); if (far) stand(far, 1700);
    for (let i = 0; i < 10; i++) w.stepOnce(1/60);
    spoken.length = 0;
    return {g, a, v, behind, far, t};
  };
  const play = (s, secs, hook) => {
    const r = {ev: {punch: 0, ata: 0, dead: 0, say: 0, x: []}, phases: new Set(), doomAt: null, deadAt: null, blockers: [], t0: s.g.time};
    const old = window.emit;
    window.emit = e => {
      if (e.e === 'punch' && e.k === 'hyaku') r.ev.punch++;
      if (e.e === 'snd' && e.s === 'ata') r.ev.ata++;
      if (e.e === 'snd' && e.s === 'dead') r.ev.dead++;
      if (e.e === 'say') r.ev.say++;
      if (e.e === 'x') r.ev.x.push({x: e.x, y: e.y, r: e.r, t: s.g.time - r.t0});
      return old(e);
    };
    for (let i = 0; i < 60 * secs; i++) {
      if (hook) hook(i, r);
      w.stepOnce(1/60);
      if (i % 4 === 0) { CAM.x = s.a.x; CAM.y = s.a.y; CAM.z = 1; CAM.s = 3; render(); }   // the fists / dash lines / doom aura must draw without errors
      if (s.a.tool) r.phases.add(s.a.tool.ph);
      if (r.doomAt === null && s.v.doom > 0) { r.doomAt = s.g.time; r.snap = snapshot(true).w.find(q => q[0] === s.v.id); }
      if (s.v.doom > 0) { const b = quietBlocker(); if (!r.blockers.includes(b)) r.blockers.push(b); }
      if (r.deadAt === null && s.v.dead) r.deadAt = s.g.time;
      if (s.a.tool && s.a.tool.ph === 1 && !r.dashSnap) r.dashSnap = snapshot(true).w.find(q => q[0] === s.a.id);
    }
    window.emit = old; r.phases = [...r.phases]; return r;
  };

  // A) a worm right in front is hit
  let s = setup(822);
  const hp0 = {v: s.v.hp, a: s.a.hp, b: s.behind.hp, f: s.far && s.far.hp}, x0 = s.a.x;
  s.g.weapon.id = 'hokuto'; LOCAL.fireP = 1;
  out.A = play(s, 9);
  out.A.vLost = hp0.v - s.v.hp; out.A.aLost = hp0.a - s.a.hp; out.A.bLost = hp0.b - s.behind.hp; out.A.fLost = s.far ? hp0.f - s.far.hp : 0;
  out.A.dash = s.a.x - x0; out.A.pastVictim = s.a.x - s.v.x0; out.A.vDead = s.v.dead; out.A.vHp = s.v.hp; out.A.vX = s.v.x;
  out.A.spoken = spoken.slice(); out.A.aliveAtEnd = !s.a.dead; out.A.tool = !!s.a.tool;
  // muted: nothing is spoken
  spoken.length = 0; SFX.dead(); SFX.ata(); out.voiceSrc = spoken.slice(); spoken.length = 0;

  // B) nobody in reach: no mark, no damage, still dashes forward
  s = setup(1100); spoken.length = 0;
  const x1 = s.a.x, hv = s.v.hp; s.g.weapon.id = 'hokuto'; LOCAL.fireP = 1;
  out.B = play(s, 6); out.B.spoken = spoken.slice(); out.B.dash = s.a.x - x1; out.B.vLost = hv - s.v.hp; out.B.vDoom = s.v.doom || 0; out.B.vDead = s.v.dead;

  // C) Space does not stop it and the turn clock does not cut it
  s = setup(822); s.g.timer = 0.3; const x2 = s.a.x; s.g.weapon.id = 'hokuto'; LOCAL.fireP = 1;
  out.C = play(s, 5, (i) => { if (i === 20 || i === 40) LOCAL.fireP = 1; });
  out.C.dash = s.a.x - x2; out.C.vDoomed = !!s.v.doomBy || s.v.dead;
  out.icon = !!weaponIconURL('hokuto');
  return out;
};
"""

with game_page(viewport={"width": 1100, "height": 700}) as (pg, errors):
    r = pg.evaluate("([b]) => {" + JS + "return run([b]); }", [BASE])
    A, B, C = r["A"], r["B"], r["C"]
    print({k: v for k, v in A.items() if k not in ("ev", "phases", "snap", "dashSnap")}, A["ev"]["punch"], A["ev"]["x"][:3])
    print("B", {k: v for k, v in B.items() if k not in ("ev", "phases")}); print("C", {k: v for k, v in C.items() if k not in ("ev", "phases")})

    # --- A: the barrage
    assert 15 <= A["ev"]["punch"] <= 24, f"gatling of punches: {A['ev']['punch']}"
    assert A["vLost"] >= 20 or A["vDead"], "the punches hurt the victim"
    assert A["ev"]["ata"] == 1 and A["ev"]["dead"] == 1 and A["ev"]["say"] == 1
    sp = A["spoken"]
    assert sp == ["sounds/atatatatata.mp3", "sounds/omaewamoushindeiru.mp3"], sp   # the "ata" barrage at the start, the verdict once a worm was hit
    assert r["voiceSrc"] == ["sounds/omaewamoushindeiru.mp3", "sounds/atatatatata.mp3"]
    # --- A: the dash goes past the victim to a safe distance (blast reach is r+14 = 62 px)
    assert 0 in A["phases"] and 1 in A["phases"] and 2 in A["phases"]
    assert A["dash"] >= 22 + 85, f"dashed {A['dash']} px: not past the victim"
    assert A["dashSnap"][11] == 1, "guests get the tool phase"
    # --- A: the 3 s countdown, the block on the turn change, the lethal blast
    assert A["doomAt"] is not None and A["snap"][6] & 16, "marked worm is flagged in the snapshot"
    assert any(b and "doomed" in b for b in A["blockers"]) and None not in A["blockers"], A["blockers"]   # the turn cannot end while the countdown runs
    assert A["deadAt"] is not None and abs((A["deadAt"] - A["doomAt"]) - 6.0) < 0.15, f"dies 6 s after the hit: {A['deadAt'] - A['doomAt']}"
    assert A["vDead"] and A["vHp"] == 0
    big = [e for e in A["ev"]["x"] if e["r"] >= 48]
    assert big and abs(big[0]["t"] - (A["deadAt"] - 0)) >= 0, "a lethal explosion"
    assert A["aLost"] == 0 and A["bLost"] == 0 and A["fLost"] == 0, "nobody else is hurt (attacker is at a safe distance)"
    assert A["aliveAtEnd"] and not A["tool"]

    # --- B: a miss marks nobody but the worm still dashes
    assert B["vDoom"] == 0 and not B["vDead"] and B["vLost"] == 0 and B["doomAt"] is None
    assert 100 < B["dash"] < 140, B["dash"]
    assert B["ev"]["ata"] == 1 and B["ev"]["dead"] == 0 and B["ev"]["say"] == 0 and B["spoken"] == ["sounds/atatatatata.mp3"], "a miss has the barrage cry but no verdict"

    # --- C: not cancellable, not cut by the turn clock
    assert C["dash"] >= 22 + 85 and C["vDoomed"], C
    assert r["icon"], "weapon icon"
    finish(errors)
