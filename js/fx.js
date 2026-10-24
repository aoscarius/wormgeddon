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

/** Spawns `n` particles from `(x, y)` with randomized direction, speed, lifespan, and size. */
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
/** Spawns a brief burst of red droplets when a worm takes damage. */
function bloodSplat(x, y) {
  const cols = ['#7d1020', '#b5122b', '#d21f3c'];
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * TAU,
      speed = 45 + Math.random() * 155,
      life = 0.35 + Math.random() * 0.35;
    addP({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - 35,
      l: life,
      m: life,
      c: cols[(Math.random() * cols.length) | 0],
      s: 1.5 + Math.random() * 2.5,
      g: 520,
      k: 'c',
    });
  }
}

/**
 * Turns one simulation event into visuals and sound. Runs on the host and on every guest.
 * Event types: x (explosion), dmg (floating damage), msg, log, nuke (background mushroom cloud), splash, snd, shot (tracer),
 * punch, tele, plane, quake, tsunami, bolt (lightning), flash, mark (homing target), turn, over, trail (particle trail).
 * Terrain edits (x, cv, gd) are applied separately by applyTerrain().
 */
function applyEvent(e) {
  switch (e.e) {
    case 'blood':
      if (UI.splatterMode) bloodSplat(e.x, e.y);
      break;
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
      camImpact(e.x, e.y);
      break;
    }
    case 'dmg':
      FX.txt.push({ x: e.x, y: e.y, t: '-' + e.v, c: e.c, l: 1.8 });
      break;
    case 'say':
      FX.txt.push({ x: e.x, y: e.y, t: e.t, c: '#ffd23f', l: 2.4 });
      showMsg(tr(e.t), 1800);
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
      if (e.k === 'hyaku') {
        puff(e.x, e.y, 4, 110, ['#fff', '#ffd23f'], 0.25, 2, 0, 'c');
        SFX.thud();
        break;
      }
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
    case 'rad':
      puff(e.x, e.y - 6, 10, 60, ['#9f6', '#cf8', '#6c3'], 0.8, 2, -50, 'c');
      break;
    case 'tele':
      camImpact(e.x, e.y);
      puff(e.x, e.y, 26, 140, ['#9fe', '#fff', '#7bf'], 0.7, 2.5, -120, 'c');
      break;
    case 'quake':
      FX.quake = e.t;
      break;
    case 'tsunami':
      FX.waves.push({ dir: e.dir, D: e.D, H0: e.H0, t: 0 });
      FX.quake = Math.max(FX.quake, 2);
      break;
    case 'bolt': {
      // jagged line from above the map down to the strike point
      const pts = [],
        n = 9;
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        pts.push([e.x + (i === n ? 0 : rnd(-16, 16) * (1 - k * 0.4)), -40 + (e.y + 40) * k]);
      }
      FX.bolts.push({ pts, t: 0 });
      camImpact(e.x, e.y);
      puff(e.x, e.y, 16, 220, ['#ffffff', '#bfe3ff', '#7fc4ff'], 0.45, 2.5, 0);
      UI.flash = '#dfeeff';
      UI.flashA = 0.5;
      UI.shake = Math.min(16, UI.shake + 4);
      SFX.zap();
      break;
    }
    case 'storm':
      FX.storms.push({ x: e.x, l: e.l, t: 0 });
      break;
    case 'arc': {
      // jagged lightning between two points (Thor's Hammer: sky -> hammer while charging, hammer -> target)
      const pts = [],
        n = 8;
      for (let i = 0; i <= n; i++) {
        const k = i / n,
          j = i === 0 || i === n ? 0 : rnd(-9, 9);
        pts.push([e.x1 + (e.x2 - e.x1) * k + j, e.y1 + (e.y2 - e.y1) * k + (i === 0 || i === n ? 0 : rnd(-9, 9))]);
      }
      FX.bolts.push({ pts, t: 0 });
      puff(e.x2, e.y2, e.soft ? 4 : 16, 220, ['#ffffff', '#bfe3ff', '#7fc4ff'], 0.4, 2.5, 0);
      if (!e.soft) {
        UI.flash = '#dfeeff';
        UI.flashA = 0.5;
        UI.shake = Math.min(16, UI.shake + 4);
        camImpact(e.x2, e.y2);
      }
      SFX.zap();
      break;
    }
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
  for (const wv of FX.waves) wv.t += dt;
  FX.waves = FX.waves.filter(wv => TSU_START + TSU_SPEED * wv.t < wv.D + 150);
  for (const s of FX.storms) s.t += dt;
  FX.storms = FX.storms.filter(s => s.t < s.l);
  for (const b of FX.bolts) b.t += dt;
  FX.bolts = FX.bolts.filter(b => b.t < 0.35);
  if (FX.quake > 0) {
    FX.quake -= dt;
    UI.shake = Math.max(UI.shake, 5);
    FX.qs = (FX.qs || 0) - dt;
    if (FX.qs <= 0) {
      FX.qs = 0.35;
      SFX.rumble();
    }
  }
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
