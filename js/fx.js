'use strict';

/**
 * @file fx.js - Effects & event handling
 *
 * Particles, floating text and the applyEvent() switch that turns simulation events (explosions,
 * damage, messages ...) into visuals and sound. Runs on host and clients.
 *
 * Depends on: view, audio
 * Globals defined: addP, puff, showMsg, addLog, applyEvent, fxUpdate
 */

/* ---- FX spawners ---- */
/** Adds a particle (capped at 1600; the oldest is dropped). */
function addP(p) {
  if (FX.p.length > 1600) FX.p.shift();
  FX.p.push(p);
}
/**
 * Spawns `n` particles in all directions.
 * @param {number} spd max speed; cols colours; life seconds; size radius; g gravity;
 * @param {'c'|'s'|'d'} k circle, expanding smoke, or square debris that dies on terrain
 */
function puff(x, y, n, spd, cols, life, size, g, k) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU,
      s = Math.random() * spd;
    addP({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      l: life * (0.5 + Math.random() * 0.8),
      m: life,
      c: cols[(Math.random() * cols.length) | 0],
      s: size * (0.6 + Math.random() * 0.8),
      g: g || 0,
      k: k || 'c',
    });
  }
}
/** Shows a big centred message for `ms` milliseconds. */
function showMsg(t, ms = 2200) {
  const m = $('msg');
  m.textContent = t;
  m.classList.add('on');
  clearTimeout(showMsg.h);
  showMsg.h = setTimeout(() => m.classList.remove('on'), ms);
}
/** Adds a line to the small event log at the top of the screen (last 5 lines, 6 s each). */
function addLog(t, c) {
  FX.logs.push({ t, c, l: 6 });
  if (FX.logs.length > 5) FX.logs.shift();
}

/**
 * Turns one simulation event into visuals and sound. Runs on the host and on every guest.
 * Event types: x (explosion), dmg (floating damage), msg, log, nuke (background mushroom cloud), splash, snd, shot (tracer),
 * punch, tele, plane, flash, mark (homing target), turn, over, trail (particle trail).
 * Terrain edits (x, cv, gd) are applied separately by applyTerrain().
 */
function applyEvent(e) {
  switch (e.e) {
    case 'x': {
      const r = e.r,
        k = r / 40 + 0.5;
      puff(
        e.x,
        e.y,
        (r * 0.9) | 0,
        260 * k,
        ['#fff3a0', '#ffb02e', '#ff6a1f', '#d83a0b'],
        0.7,
        5 * k,
        0
      );
      puff(e.x, e.y, (8 + r / 4) | 0, 70, ['#555', '#777', '#999'], 1.4, 7 * k, -40, 's');
      const dc = T.theme.dirt,
        col = `rgb(${dc[0]},${dc[1]},${dc[2]})`;
      puff(
        e.x,
        e.y,
        (r / 2.5) | 0,
        330 * k,
        [col, '#3a2a1e', `rgb(${T.theme.top[0]},${T.theme.top[1]},${T.theme.top[2]})`],
        1.2,
        3,
        700,
        'd'
      );
      FX.rings.push({ x: e.x, y: e.y, r, t: 0, big: e.k === 1 });
      UI.shake = Math.min(16, UI.shake + r / 7);
      SFX.boom(r);
      CAM.fx = e.x;
      CAM.fy = e.y;
      CAM.fT = G.time || 0;
      break;
    }
    case 'dmg':
      FX.txt.push({ x: e.x, y: e.y, t: '-' + e.v, c: e.c, l: 1.8 });
      break;
    case 'msg':
      showMsg(tr(e.t, ...(e.a || []), e.w ? wname(e.w) : ''));
      break;
    case 'log':
      addLog(tr(e.t, ...(e.a || [])), e.c);
      break;
    case 'splash':
      puff(e.x, e.y, 24, 160, ['#cfe9ff', '#8cc4ee', '#fff'], 0.8, 3, 520, 'd');
      SFX.splash();
      break;
    case 'snd':
      if (SFX[e.s]) SFX[e.s](e.r);
      break;
    case 'shot':
      FX.tracers.push({ x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2, l: 0.12 });
      puff(e.x2, e.y2, 5, 120, ['#ffe9a0', '#fff'], 0.3, 1.6, 300, 'd');
      break;
    case 'punch':
      puff(
        e.x,
        e.y,
        14,
        160,
        e.k === 'bat' ? ['#fff', '#cdb48a'] : ['#ffd23f', '#ff7a1f', '#fff'],
        0.4,
        3,
        0,
        'c'
      );
      SFX.hurt();
      break;
    case 'tele':
      puff(e.x, e.y, 26, 140, ['#9fe', '#fff', '#7bf'], 0.7, 2.5, -120, 'c');
      break;
    case 'plane':
      FX.planes.push({ x: e.x - e.dir * 380, dir: e.dir, t: 0 });
      break;
    case 'nuke':
      FX.nuke = { t: 0 };
      break;
    case 'flash':
      UI.flash = e.c;
      UI.flashA = 1;
      break;
    case 'mark':
      FX.marks.push({ x: e.x, y: e.y, l: 3 });
      break;
    case 'turn': {
      const t = G.teams[e.team],
        w = wById(e.worm);
      showMsg(t.name + ' - ' + w.name, 1800);
      CAM.fx = null;
      UI.panT = -9;
      break;
    }
    case 'over':
      showOver(e.w);
      break;
    case 'trail':
      if (e.k === 'smoke')
        addP({
          x: e.x,
          y: e.y,
          vx: rnd(-10, 10),
          vy: rnd(-20, 0),
          l: 0.8,
          m: 0.8,
          c: '#aaa',
          s: 3,
          g: 0,
          k: 's',
        });
      else if (e.k === 'fire')
        addP({
          x: e.x,
          y: e.y,
          vx: rnd(-30, 30),
          vy: rnd(-10, 60),
          l: 0.4,
          m: 0.4,
          c: pick(['#ffd23f', '#ff7a1f']),
          s: 2.5,
          g: 0,
          k: 'c',
        });
      else
        addP({
          x: e.x,
          y: e.y,
          vx: rnd(-20, 20),
          vy: rnd(-20, 20),
          l: 0.5,
          m: 0.5,
          c: '#fff',
          s: 1.8,
          g: 0,
          k: 'c',
        });
      break;
  }
}
/** Ages and moves all particles, texts, tracers, planes and rings; decays screen shake and flash. */
function fxUpdate(dt) {
  for (let i = FX.p.length - 1; i >= 0; i--) {
    const p = FX.p[i];
    p.l -= dt;
    if (p.l <= 0) {
      FX.p.splice(i, 1);
      continue;
    }
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.k === 'd' && solid(p.x, p.y)) {
      p.l = 0;
    }
    if (p.k === 's') {
      p.s += dt * 6;
      p.vx *= 0.98;
    }
  }
  for (const t of FX.txt) {
    t.l -= dt;
    t.y -= 22 * dt;
  }
  FX.txt = FX.txt.filter(t => t.l > 0);
  for (const t of FX.tracers) t.l -= dt;
  FX.tracers = FX.tracers.filter(t => t.l > 0);
  for (const p of FX.planes) {
    p.t += dt;
    p.x += p.dir * 520 * dt;
  }
  FX.planes = FX.planes.filter(p => p.t < 2.4);
  for (const r of FX.rings) r.t += dt;
  FX.rings = FX.rings.filter(r => r.t < 0.45);
  for (const m of FX.marks) m.l -= dt;
  FX.marks = FX.marks.filter(m => m.l > 0);
  for (const l of FX.logs) l.l -= dt;
  FX.logs = FX.logs.filter(l => l.l > 0);
  UI.shake *= Math.pow(0.02, dt);
  UI.flashA = Math.max(0, UI.flashA - dt * 1.6);
  if (FX.nuke && (FX.nuke.t += dt) > NUKE_TIME) FX.nuke = null;
}
