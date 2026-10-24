'use strict';

/**
 * @file net.js - Networking
 *
 * Host-authoritative multiplayer over PeerJS. The host runs the simulation and streams snapshots
 * + events; guests send key states and commands. See README for the message table.
 *
 * Depends on: core, fx
 * Globals defined: NET, r1, snapshot, applySnapshot, clientSmooth, startClientGame, drainEvents,
 *     lobby, renderLobby, hostCreate, hostMsg, hostStart, joinRoom, clientMsg
 */

/* ===== Networking (PeerJS, host-authoritative) ===== */
/**
 * Network state: role is 'local' (offline), 'host' or 'client'. The host runs the simulation and
 * sends snapshots (type 's', ~30 per second) and events (type 'v'); guests send key states
 * ('k'), key edges ('e'), map clicks ('c'), weapon choices ('w') and fuse changes ('f').
 */
const NET = {
  role: 'local',
  peer: null,
  conns: [],
  conn: null,
  code: '',
  send(m) {
    try {
      if (this.conn && this.conn.open) this.conn.send(m);
    } catch (e) {}
  },
  sendKeys() {
    if (this.role === 'client')
      this.send({ t: 'k', l: LOCAL.l, r: LOCAL.r, u: LOCAL.u, d: LOCAL.d, f: LOCAL.fire });
  },
  bcast(m) {
    for (const c of this.conns)
      try {
        if (c.open) c.send(m);
      } catch (e) {}
  },
  close() {
    try {
      if (this.peer) this.peer.destroy();
    } catch (e) {}
    this.peer = null;
    this.conns = [];
    this.conn = null;
    this.role = 'local';
    if (typeof chatReset === 'function') chatReset();
    if (typeof inviteSync === 'function') inviteSync();
  },
};
const r1 = v => Math.round(v * 10) / 10;
/** Packs the dynamic part of the match (worms, projectiles, fire, objects, weapon, phase) into compact arrays. */
function snapshot(withAmmo) {
  const s = {
    t: 's',
    ph: G.phase,
    ac: G.active,
    ti: G.ti,
    tm: +G.timer.toFixed(2),
    wd: +G.wind.toFixed(3),
    wy: r1(G.waterY),
    rd: G.round,
    ov: G.over ? 1 : 0,
    win: G.winner,
    sd: G.sdOn ? 1 : 0,
    w: G.worms.map(w => [
      w.id,
      r1(w.x),
      r1(w.y),
      Math.round(w.hp),
      w.face,
      +w.aim.toFixed(2),
      (w.grounded ? 1 : 0) | (w.dead ? 2 : 0) | (w.sunk ? 4 : 0) | (w.chute ? 8 : 0) | (w.doom > 0 ? 16 : 0),
      w.rope ? [w.rope.ax | 0, w.rope.ay | 0] : 0,
      w.jet ? (w.jet.on ? 2 : 1) : 0,
      w.tool ? w.tool.k : 0,
      Math.round(w.pend || 0), // damage not announced yet (the shown health lags behind hp)
      w.tool && w.tool.p ? w.tool.p : 0, // phase of a multi-stage tool (Hokuto Hyakuretsu Ken, ...)
    ]),
    p: G.projs.map(p => [
      p.id,
      p.t,
      r1(p.x),
      r1(p.y),
      +p.a.toFixed(2),
      p.fuse == null ? -1 : +p.fuse.toFixed(1),
      p.face,
      +(p.walk || 0).toFixed(1),
      p.age > 1.2 ? 1 : 0,
    ]),
    f: G.fires.map(f => [f.x | 0, f.y | 0]),
    o: G.objs.map(o => [o.id, o.k, r1(o.x), r1(o.y), o.type || 0, o.landed ? 1 : 0, o.lit ? 1 : 0]),
    wp: {
      id: G.weapon.id,
      fuse: G.weapon.fuse,
      pw: +G.weapon.pw.toFixed(2),
      ch: G.weapon.ch ? 1 : 0,
      tx: G.weapon.tx,
      ty: G.weapon.ty,
    },
  };
  if (withAmmo) s.am = G.teams.map(t => [t.ammo, t.unl]);
  return s;
}
/** Guest side: unpacks a snapshot into the local match object, keeping a smoothing target (nx, ny) for each moving entity. */
function applySnapshot(s) {
  G.phase = s.ph;
  G.active = s.ac;
  G.ti = s.ti;
  G.timer = s.tm;
  G.wind = s.wd;
  G.waterY = s.wy;
  G.round = s.rd;
  G.over = !!s.ov;
  G.winner = s.win;
  G.sdOn = !!s.sd;
  for (const a of s.w) {
    const w = wById(a[0]);
    if (!w) continue;
    w.nx = a[1];
    w.ny = a[2];
    if (w.x === undefined || Math.hypot(w.x - w.nx, w.y - w.ny) > 90) {
      w.x = w.nx;
      w.y = w.ny;
    }
    w.hp = a[3];
    w.face = a[4];
    w.aim = a[5];
    w.grounded = !!(a[6] & 1);
    w.dead = !!(a[6] & 2);
    w.sunk = !!(a[6] & 4);
    w.chute = !!(a[6] & 8);
    w.doom = a[6] & 16 ? 1 : 0;
    w.rope = a[7] ? { ax: a[7][0], ay: a[7][1] } : null;
    w.jet = a[8] ? { on: a[8] === 2 } : null;
    w.tool = a[9] ? { k: a[9], p: a[11] || 0 } : null;
    w.pend = a[10] || 0;
  }
  const old = new Map(G.projs.map(p => [p.id, p]));
  G.projs = s.p.map(a => {
    let p = old.get(a[0]);
    if (!p) {
      p = { id: a[0], t: a[1], x: a[2], y: a[3], r: 3, age: 0 };
    }
    p.nx = a[2];
    p.ny = a[3];
    p.a = a[4];
    p.fuse = a[5] < 0 ? null : a[5];
    p.face = a[6];
    p.walk = a[7];
    if (a[8]) p.age = 2;
    else if (!old.has(a[0])) p.age = 0;
    return p;
  });
  G.fires = s.f.map(a => ({ x: a[0], y: a[1] }));
  const oo = new Map(G.objs.map(o => [o.id, o]));
  G.objs = s.o.map(a => {
    let o = oo.get(a[0]);
    if (!o) o = { id: a[0], k: a[1], x: a[2], y: a[3] };
    o.nx = a[2];
    o.ny = a[3];
    o.type = a[4];
    o.landed = !!a[5];
    o.lit = a[6];
    return o;
  });
  Object.assign(G.weapon, {
    id: s.wp.id,
    fuse: s.wp.fuse,
    pw: s.wp.pw,
    ch: !!s.wp.ch,
    tx: s.wp.tx,
    ty: s.wp.ty,
  });
  if (s.am)
    s.am.forEach((a, i) => {
      G.teams[i].ammo = a[0];
      G.teams[i].unl = a[1];
    });
}
/** Guest side: eases rendered positions towards the latest snapshot and spawns local trails/flames. */
function clientSmooth(dt) {
  const k = 1 - Math.exp(-28 * dt);
  for (const o of [...G.worms, ...G.projs, ...G.objs])
    if (o.nx !== undefined) {
      o.x += (o.nx - o.x) * k;
      o.y += (o.ny - o.y) * k;
    }
  for (const p of G.projs)
    if (PTYPES[p.t] && PTYPES[p.t].trail && Math.random() < 0.8)
      applyEvent({ e: 'trail', x: p.x, y: p.y, k: PTYPES[p.t].trail });
  for (const f of G.fires)
    if (Math.random() < 0.1) applyEvent({ e: 'trail', x: f.x, y: f.y, k: 'fire' });
}
/** Guest side: builds the local match from the host's 'start' message (terrain is regenerated from the seed). */
function startClientGame(m) {
  Object.assign(window, {});
  generateTerrain(m.cfg);
  G = {
    cfg: m.cfg,
    teams: m.teams.map(t => ({
      id: t.id,
      name: t.name,
      color: TEAM_COLORS[t.id],
      ctrl: t.ctrl,
      worms: [],
      ammo: {},
      unl: {},
    })),
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
    waterY: T.waterBase,
    over: false,
    winner: -1,
    weapon: { id: 'bazooka', fuse: 3, pw: 0, ch: false, shots: 0, ang: 0, tx: null, ty: null },
  };
  for (const w of m.worms) {
    G.worms.push({
      id: w.id,
      team: w.team,
      name: w.name,
      r: WORM_R,
      hp: m.cfg.hp,
      face: 1,
      aim: 0,
      grounded: true,
      dead: false,
      vx: 0,
      vy: 0,
    });
    G.teams[w.team].worms.push(w.id);
  }
  UI.myTeam = m.my;
  NET.role = 'client';
  enterGame();
}
/** Handles all events produced by the last tick locally and forwards the non-cosmetic ones (no `q` flag) to guests. */
function drainEvents() {
  if (!G.ev.length) return;
  const evs = G.ev.splice(0);
  for (const e of evs) applyEvent(e);
  if (NET.role === 'host') {
    const out = evs.filter(e => !e.q);
    if (out.length) NET.bcast({ t: 'v', ev: out });
  }
}

/* ---- Host side ---- */
/** Connected guests waiting in the lobby. */
const lobby = { guests: [] };
/** Refreshes the lobby list in the Host tab. */
function renderLobby() {
  const nm = ($('teamRows').querySelector('input') || {}).value || tr('Host');
  $('lobbyList').innerHTML =
    `<li>${esc(tr('{0} (host)', nm))}</li>` +
    lobby.guests.map(g => `<li>${esc(tr('{0} (online)', g.name))}</li>`).join('');
  $('bHostStart').disabled = !NET.peer;
  if (typeof chatSync === 'function') chatSync();
  if (typeof inviteSync === 'function') inviteSync();
}
/** Opens a PeerJS room with a short random code (ids look like 'wormgeddon-ABCDE') and accepts guest connections. */
function hostCreate() {
  if (typeof Peer === 'undefined') {
    $('hostNote').textContent = tr('The PeerJS library did not load. Check your connection.');
    return;
  }
  NET.close();
  lobby.guests = [];
  NET.role = 'host';
  const tryId = () => {
    const code = Array.from(
      { length: 5 },
      () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]
    ).join('');
    const peer = new Peer('wormgeddon-' + code);
    NET.peer = peer;
    peer.on('open', () => {
      NET.code = code;
      $('hostCode').textContent = code;
      renderLobby();
      $('hostNote').textContent = tr(
        'Room open. Share the code. Up to {0} friends can join.',
        MAX_TEAMS - 1
      );
    });
    peer.on('error', err => {
      if (err.type === 'unavailable-id') {
        try {
          peer.destroy();
        } catch (e) {}
        tryId();
      } else $('hostNote').textContent = tr('Connection problem: {0}', err.type);
    });
    peer.on('connection', conn => {
      conn.on('open', () => {
        if (lobby.guests.length >= MAX_TEAMS - 1 || (G && !G.demo)) {
          conn.send({ t: 'full' });
          setTimeout(() => conn.close(), 300);
          return;
        }
        const g = { conn, name: 'Guest', team: -1 };
        lobby.guests.push(g);
        NET.conns.push(conn);
        renderLobby();
        conn.on('data', m => hostMsg(g, m));
        conn.on('close', () => {
          lobby.guests = lobby.guests.filter(x => x !== g);
          NET.conns = NET.conns.filter(c => c !== conn);
          renderLobby();
          if (G && g.team >= 0) {
            const t = G.teams[g.team];
            t.ctrl = 'ai';
            t.remoteInp = null;
            addLog(tr('{0} disconnected (bot takes over)', t.name), t.color);
          }
        });
      });
    });
  };
  tryId();
}
/** Host side: applies a guest message, but only for that guest's team and only during its own turn. */
function hostMsg(g, m) {
  if (m.t === 'hello') {
    g.name = String(m.name || 'Guest').slice(0, 14);
    renderLobby();
    return;
  }
  if (m.t === 'chat') {
    chatHostMsg(g, m);
    return;
  }
  if (!G || g.team < 0) return;
  const t = G.teams[g.team];
  if (!t.remoteInp) t.remoteInp = makeInp();
  const inp = t.remoteInp;
  const act = activeWorm();
  if (m.t === 'k') {
    inp.l = m.l;
    inp.r = m.r;
    inp.u = m.u;
    inp.d = m.d;
    inp.fire = m.f;
  } else if (m.t === 'e') {
    if (['fireP', 'jump', 'back', 'tab'].includes(m.k) && act && act.team === t.id)
      inp[m.k] = (inp[m.k] || 0) + 1;
  } else if (m.t === 'c') {
    if (act && act.team === t.id && isFinite(m.x) && isFinite(m.y)) {
      G.weapon.ang = m.a | 0;
      inp.clicks.push({ x: m.x, y: m.y });
    }
  } else if (m.t === 'w') selectWeapon(t.id, m.id, m.f);
  else if (m.t === 'f') {
    if (act && act.team === t.id) G.weapon.fuse = clamp(m.v | 0, 1, 5);
  }
}
/** Starts the online match: seat 0 = host, then guests, remaining seats = bots; sends 'start' + first snapshot. */
function hostStart() {
  const cfg = readCfg(),
    rows = readTeamRows();
  const n = clamp(Math.max(rows.length, 1 + lobby.guests.length), 2, MAX_TEAMS);
  const defs = [];
  let gi = 0;
  for (let i = 0; i < n; i++) {
    if (i === 0) defs.push({ name: rows[0].name, ctrl: 'local' });
    else if (gi < lobby.guests.length) {
      const g = lobby.guests[gi++];
      g.team = i;
      defs.push({ name: g.name, ctrl: 'remote' });
    } else defs.push({ name: (rows[i] && rows[i].name) || tr('Bot {0}', i), ctrl: 'ai' });
  }
  NET.role = 'host';
  // Custom pictures travel with the start message so guests build the identical level.
  if (cfg.style === 'custom' && MAPS.custom) cfg.mapData = MAPS.custom.dataURL;
  newGame(cfg, defs);
  const base = {
    t: 'start',
    cfg,
    teams: G.teams.map(t => ({ id: t.id, name: t.name, ctrl: t.ctrl })),
    worms: G.worms.map(w => ({ id: w.id, team: w.team, name: w.name })),
  };
  for (const g of lobby.guests) {
    try {
      g.conn.send(Object.assign({ my: g.team }, base));
    } catch (e) {}
  }
  UI.myTeam = 0;
  enterGame();
  NET.bcast(snapshot(true));
}

/* ---- Client side ---- */
/** Guest side: connects to a room by code and waits for the host to start. */
function joinRoom() {
  if (typeof Peer === 'undefined') {
    $('joinNote').textContent = tr('The PeerJS library did not load.');
    return;
  }
  const code = $('jCode')
    .value.trim()
    .toUpperCase()
    .replace(/^WORMGEDDON-/, '');
  if (!code) {
    $('joinNote').textContent = tr('Enter the room code.');
    return;
  }
  NET.close();
  NET.role = 'client';
  chatSync();
  $('joinNote').textContent = tr('Connecting...');
  const peer = new Peer();
  NET.peer = peer;
  peer.on('error', err => {
    $('joinNote').textContent =
      err.type === 'peer-unavailable'
        ? tr('Room not found.')
        : tr('Connection problem: {0}', err.type);
  });
  peer.on('open', () => {
    const conn = peer.connect('wormgeddon-' + code, { reliable: true });
    NET.conn = conn;
    conn.on('open', () => {
      conn.send({ t: 'hello', name: $('jName').value || tr('Player') });
      $('joinNote').textContent = tr('Connected. Waiting for the host to start.');
    });
    conn.on('data', clientMsg);
    conn.on('close', () => {
      if (G && !G.demo && !G.over) {
        showMsg(tr('Host disconnected'), 4000);
        setTimeout(backToMenu, 3500);
      } else $('joinNote').textContent = tr('Disconnected.');
    });
  });
}
/** Guest side: dispatches host messages (start, snapshot, events, full). */
function clientMsg(m) {
  if (m.t === 'start') {
    if (m.cfg.style === 'custom' && m.cfg.mapData)
      loadMapImage(m.cfg.mapData, 'host map')
        .then(() => startClientGame(m))
        .catch(() => {
          $('joinNote').textContent = tr('Could not load the host map.');
        });
    else startClientGame(m);
  } else if (m.t === 's' && G && NET.role === 'client' && !G.demo) applySnapshot(m);
  else if (m.t === 'v' && G && !G.demo)
    for (const e of m.ev) {
      applyTerrain(e);
      applyEvent(e);
    }
  else if (m.t === 'chat') chatReceive(m);
  else if (m.t === 'full') {
    $('joinNote').textContent = tr('Room is full or already started.');
  }
}
