'use strict';

/**
 * @file match.js - Match setup & turn flow
 *
 * Creates a match (terrain, teams, worms, mines, drums), manages ammo/availability and drives
 * the turn state machine: turn -> retreat -> settle -> next turn / game over.
 *
 * Depends on: core, terrain, collision
 * Globals defined: newGame, initAmmo, avail, nextTeamIdx, startTurn, toSettle, quiet,
 *     processDeaths, flushDamage, endGame
 */

/**
 * Creates a new match on this machine (the host/local authority).
 *
 * Generates the terrain, creates teams with their ammo, spreads worms over the ground with a
 * minimum distance, scatters mines and oil drums and starts the first turn.
 *
 * @param {object} cfg level and rule options (see readCfg in menu.js)
 * @param {{name: string, ctrl: 'local'|'ai'|'remote'}[]} teamDefs 2-8 teams
 * @returns {object} the new match (also stored in the global G)
 */
function newGame(cfg, teamDefs) {
  // Keep the total worm count playable when many teams are selected.
  cfg.worms = Math.max(1, Math.min(cfg.worms, Math.floor(MAX_WORMS_TOTAL / teamDefs.length)));
  generateTerrain(cfg);
  // A separate seeded stream for spawning keeps worm placement reproducible from the seed too.
  const rng = mulberry(hashStr(cfg.seed + 'spawn'));
  G = {
    cfg,
    teams: [],
    worms: [],
    projs: [],
    fires: [],
    objs: [],
    ev: [],
    sched: [],
    nid: 1,
    phase: 'turn',
    active: -1,
    ti: -1,
    timer: 0,
    wind: 0,
    round: 0,
    time: 0,
    settleT: 0,
    settleQ: 0,
    waterY: T.waterBase,
    waterTarget: T.waterBase,
    sdOn: false,
    over: false,
    winner: -1,
    weapon: { id: 'bazooka', fuse: 3, pw: 0, ch: false, shots: 0, ang: 0, tx: null, ty: null },
    fired: false,
    switched: false,
    arma: 0,
    gap: 0,
    surr: 0,
  };
  const names = WORM_NAMES.slice().sort(() => rng() - 0.5);
  teamDefs.forEach((td, i) => {
    const t = {
      id: i,
      name: td.name,
      color: TEAM_COLORS[i],
      ctrl: td.ctrl,
      peer: td.peer || null,
      worms: [],
      ammo: {},
      unl: {},
      rot: 0,
    };
    initAmmo(t, cfg.arsenal);
    G.teams.push(t);
  });
  // Spawn worms spread across the ground
  const n = cfg.worms * G.teams.length,
    spots = [];
  // Finds a standing spot anywhere on the map: a random point in the air is dropped onto the first
  // ground below it, so spawns also land inside caves, on lower tiers and under overhangs (and on
  // imported maps), not only on the topmost surface. A spot needs a firm footing, headroom and
  // distance to every spot used so far (relaxed after 700 failed attempts).
  const tryPlace = () => {
    const limit = T.waterBase - 40,
      minGap = Math.max(90, T.w / (n * 1.6));
    for (let a = 0; a < 1500; a++) {
      const relax = a > 700,
        x = 50 + rng() * (T.w - 100),
        y0 = 20 + rng() * (limit - 20);
      if (hitC(x, y0, 8)) continue; // starts inside the ground
      let y = y0;
      while (y < limit && !hitC(x, y + 2, 8)) y += 2;
      if (y >= limit) continue; // would fall into the sea
      if (!relax && (!solid(x - 9, y + 10) || !solid(x + 9, y + 10))) continue; // needle or ledge edge
      if (hitC(x, y - 14, 8)) continue; // no headroom
      if (!relax && spots.some(s => Math.hypot(s[0] - x, s[1] - y) < minGap)) continue;
      return [x, y];
    }
    return [T.w / 2, 100];
  };
  // Worms are created round-robin so every team is spread across the whole map.
  for (let k = 0; k < cfg.worms; k++)
    G.teams.forEach(t => {
      const p = tryPlace();
      spots.push(p);
      const w = {
        id: G.nid++,
        team: t.id,
        name: names.pop() || 'Worm' + G.nid,
        x: p[0],
        y: p[1],
        vx: 0,
        vy: 0,
        r: WORM_R,
        hp: cfg.hp,
        face: rng() < 0.5 ? 1 : -1,
        aim: -0.3,
        grounded: false,
        dead: false,
        pend: 0,
        bounce: 0.2,
        fric: 0.6,
        rope: null,
        jet: null,
        tool: null,
        chute: false,
        burn: 0,
      };
      G.worms.push(w);
      t.worms.push(w.id);
    });
  // Mines and oil drums
  for (let i = 0; i < cfg.mines; i++) {
    const p = tryPlace();
    spawnProj('mine', p[0], p[1] - 4, 0, 0, null, { armed: true });
  }
  for (let i = 0; i < cfg.drums; i++) {
    const p = tryPlace();
    G.objs.push({
      id: G.nid++,
      k: 'drum',
      x: p[0],
      y: p[1] - 4,
      vx: 0,
      vy: 0,
      r: 7,
      lit: 0,
      bounce: 0,
      fric: 0.5,
    });
  }
  G.wind = rnd(-1, 1);
  startTurn();
  return G;
}

/**
 * Weapon-restricted arsenals ("game modes" of the Arsenal menu option). Each lists the weapon categories
 * (WEAPON_CATS in core.js) and extra weapon ids that are in play; nothing else is available, in the panel,
 * in crates or for the bots. Weapons in play are available from the first round, with their normal ammo
 * (at least ARSENAL_MIN_AMMO when limited). To add a mode: add an entry here, an <option> in index.html
 * (value = the key) and the Italian label in lang-it.js.
 */
const ARSENALS = {
  special: { cats: ['destructive', 'anime'], ids: ['holy', 'supersheep', 'banana', 'napalm'] }, // super weapons
  anime: { cats: ['anime'], ids: ['dragonball', 'hokuto', 'onigiri'] }, // fantasy / manga powers
  melee: { cats: ['body', 'short'], ids: [] }, // fists, blades and close-range guns
  artillery: { cats: ['long'], ids: [] }, // rockets, mortars and bombardments
};
/** Turn controls that every restricted arsenal keeps. */
const ARSENAL_ALWAYS = ['skip', 'surrender'];
const ARSENAL_MIN_AMMO = 2;
/** True when `mode` is one of the weapon-restricted arsenals above. */
const isRestrictedArsenal = mode => Object.prototype.hasOwnProperty.call(ARSENALS, mode);
/** Is weapon `id` part of arsenal `mode`? (Always true for the unrestricted modes.) */
function arsenalHas(mode, id) {
  if (envBlocked(id)) return false; // Environmental Chaos: the disasters are not the players' to use
  if (!isRestrictedArsenal(mode)) return true;
  const a = ARSENALS[mode],
    d = WEAPONS[id];
  return ARSENAL_ALWAYS.includes(id) || a.ids.includes(id) || (!!d && a.cats.includes(d.cat));
}

/** Fills a team's ammo table for the chosen arsenal: 'std', 'full', 'bazooka', 'chaos' or a key of ARSENALS. -1 = unlimited. */
function initAmmo(t, mode) {
  for (const d of WLIST) {
    if (envBlocked(d.id)) {
      t.ammo[d.id] = 0;
      continue;
    }
    if (d.rare) {
      // extremely rare: only from crates (and 1 in the Full arsenal, or by luck in Chaos)
      t.ammo[d.id] = mode === 'full' || (mode === 'chaos' && Math.random() < 0.1) ? 1 : 0;
      continue;
    }
    let a = d.ammo;
    if (isRestrictedArsenal(mode)) a = !arsenalHas(mode, d.id) ? 0 : a < 0 ? -1 : Math.max(a, ARSENAL_MIN_AMMO);
    else if (mode === 'full') a = a < 0 ? -1 : 99;
    else if (mode === 'bazooka') a = ['bazooka', 'skip', 'surrender'].includes(d.id) ? -1 : 0;
    else if (mode === 'chaos') a = a < 0 ? -1 : rndi(0, 5);
    t.ammo[d.id] = a;
  }
}
/** A weapon can be used when the team has ammo and (Standard arsenal) its unlock round has been reached or a crate unlocked it. */
function avail(t, id) {
  const d = WEAPONS[id],
    a = t.ammo[id];
  if (!d || a === 0 || a === undefined) return false;
  if (G.cfg.arsenal === 'std' && d.delay > G.round && !t.unl[id]) return false;
  return true;
}

/* ===== Turn flow ===== */
/** Index of the next team (after G.ti) that still has living worms, or -1 if none. */
function nextTeamIdx() {
  const n = G.teams.length;
  for (let i = 1; i <= n; i++) {
    const k = (G.ti + i) % n;
    if (teamAlive(G.teams[k])) return k;
  }
  return -1;
}
/**
 * Begins the next turn: advances round/sudden death when the team order wraps, picks the team's
 * next living worm (rotating), randomises the wind, resets the weapon selection, maybe drops a
 * crate and, for bots, plans the move.
 */
function startTurn() {
  const prev = G.ti,
    k = nextTeamIdx();
  if (k < 0) return endGame();
  if (k <= prev) {
    G.round++;
    const sd = +G.cfg.sd;
    if (sd && G.round >= sd) {
      if (!G.sdOn) {
        G.sdOn = true;
        for (const w of G.worms) if (!w.dead) w.hp = 1;
        emit({ e: 'msg', t: 'SUDDEN DEATH' });
      }
      G.waterTarget -= 34;
    } else {
      // Optional steady sea level rise every N rounds (before sudden death takes over).
      const rise = +G.cfg.rise || 0;
      if (rise && G.round % rise === 0) {
        G.waterTarget = Math.max(60, G.waterTarget - SEA_RISE_STEP);
        emit({ e: 'msg', t: 'The sea is rising' });
      }
    }
  }
  G.ti = k;
  const t = G.teams[k],
    alive = t.worms.map(wById).filter(w => !w.dead),
    w = alive[t.rot++ % alive.length];
  G.active = w.id;
  G.phase = 'turn';
  G.timer = +G.cfg.turnTime;
  G.fired = false;
  G.switched = false;
  G.surr = 0;
  G.gap = 0;
  G.wind = clamp(rnd(-1, 1) * 1.1, -1, 1);
  G.weapon = { id: 'bazooka', fuse: 3, pw: 0, ch: false, shots: 0, ang: 0, tx: null, ty: null };
  if (!avail(t, G.weapon.id)) G.weapon.id = WLIST.find(d => avail(t, d.id) && !d.noFire).id;
  if (Math.random() < +G.cfg.crates) spawnCrate();
  if (G.cfg.env) envChaos();
  emit({ e: 'turn', team: k, worm: w.id });
  emit({ e: 'snd', s: 'turn' });
  if (t.ctrl === 'ai') aiBegin(w);
}
/**
 * Environmental Chaos: at the start of a turn (from the second round on) a natural disaster strikes with probability
 * ENV_CHANCE, at a random moment of the turn, as one of ENV_WEAPONS at a random spot of the level.
 */
const ENV_CHANCE = 0.45;
const ENV_NAMES = { tornado: 'A tornado is coming', thunder: 'A thunderstorm is brewing', tsunami: 'A tsunami is coming', earthquake: 'The ground trembles', armageddon: 'Meteors are falling' };
function envChaos() {
  if (G.round < 2 || Math.random() >= ENV_CHANCE) return;
  const kind = pick(ENV_WEAPONS),
    delay = rnd(1.5, Math.max(2, +G.cfg.turnTime * 0.6));
  sched(delay, () => envDisaster(kind));
}
/** Sets off disaster `kind` now, at a random place, with no worm behind it (nobody is credited with it). */
function envDisaster(kind) {
  if (!G || G.over || !WEAPONS[kind]) return;
  const x = rnd(80, T.w - 80),
    caster = { id: -1, team: -1, face: Math.random() < 0.5 ? 1 : -1, x, y: 0, hp: 0, dead: true };
  emit({ e: 'msg', t: ENV_NAMES[kind] || kind });
  WEAPONS[kind].fire({ w: caster, wdef: WEAPONS[kind], target: { x, y: rnd(100, G.waterY - 100) }, power: 1 });
}
/** Ends player control. The match now waits for everything to come to rest (see quiet()). */
function toSettle() {
  const w = activeWorm();
  if (w) {
    // Everything the player was holding is dropped when the turn ends (rope included, otherwise
    // the worm would dangle and hold up the turn change).
    w.tool = null;
    w.jet = null;
    w.rope = null;
  }
  G.phase = 'settle';
  G.settleT = 0;
  G.settleQ = 0;
  G.weapon.ch = false;
  G.weapon.pw = 0;
}
/** True when nothing is moving or about to happen: no projectiles in flight, fires, scheduled actions or moving worms. */
function quietBlocker() {
  if (G.sched.length) return 'scheduled actions';
  if (G.arma > 0) return 'armageddon';
  if (G.quake > 0) return 'earthquake';
  if (G.tsu) return 'tsunami';
  for (const p of G.projs) {
    const d = PTYPES[p.t];
    if (!(d.passive && p.fuse == null)) return 'projectile ' + p.t;
  }
  for (const o of G.objs) if (o.lit) return 'burning drum';
  for (const w of G.worms) {
    if (w.doom > 0 && !w.dead) return 'worm ' + w.name + ' doomed';
    if (w.dust > 0 && !w.dead) return 'worm ' + w.name + ' turning to dust';
    if (w.dead && w.y > G.waterY) continue;
    if (!w.grounded) return 'worm ' + w.name + ' in the air';
    if (Math.abs(w.vx) > 6) return 'worm ' + w.name + ' sliding';
    if (w.tool) return 'worm ' + w.name + ' using a tool';
  }
  if (G.fires.length && G.settleT < 6) return 'fires burning';
  // (a crate still parachuting down never holds up the turn change: it keeps falling meanwhile)
  return null;
}
/** True when nothing is moving any more and the turn may change (see quietBlocker for why not). */
function quiet() {
  return quietBlocker() === null;
}
/** Kills worms whose health reached 0 (small death explosion each). Returns true if anyone died. */
function processDeaths() {
  let any = false;
  for (const w of G.worms)
    if (w.hp <= 0 && !w.dead) {
      w.dead = true;
      w.hp = 0;
      any = true;
      w.rope = null;
      w.jet = null;
      w.tool = null;
      emit({ e: 'msg', t: '{0} ({1}) died', a: [w.name, teamOf(w).name] });
      emit({ e: 'log', t: w.dusted ? '{0} turned to dust' : '{0} was eliminated', a: [w.name], c: teamOf(w).color });
      if (!w.dusted && !w.quiet) explode(w.x, w.y, 26, 18, 160, { k: 0, src: null, noEnd: true }); // dust leaves no crater
    }
  return any;
}
/** Shows the accumulated damage of this turn as floating numbers above each hurt worm. */
function flushDamage() {
  for (const w of G.worms)
    if (w.pend > 0) {
      emit({ e: 'dmg', x: w.x, y: w.y - 14, v: Math.round(w.pend), c: teamOf(w).color });
      w.pend = 0;
    }
}
/** Ends the match; G.winner is the surviving team, or -1 for a draw. */
function endGame() {
  G.phase = 'over';
  G.over = true;
  const alive = G.teams.filter(teamAlive);
  G.winner = alive.length === 1 ? alive[0].id : -1;
  emit({ e: 'over', w: G.winner });
  emit({ e: 'snd', s: 'win' });
}
