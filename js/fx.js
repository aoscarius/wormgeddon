'use strict';

/**
 * @file fx.js - Effects & event handling
 *
 * Particles, floating text and the applyEvent() switch that turns simulation events (explosions,
 * damage, messages ...) into visuals and sound. Runs on host and clients.
 *
 * Depends on: view, audio
 * Globals defined: addP, puff, slabStart, slabRelease, slabUpdate, showMsg, addLog, applyEvent, fxUpdate
 */

/* ---- Gandalf's slab: the ground that cracks, breaks into shards and falls ---- */
const SLAB_GRAV = 700;
/** Cracks start running through the ground between x0 and x1 (the real terrain: only cells holding ground count); it breaks after t s. */
function slabStart(x0, x1, t) {
  x0 = Math.floor(x0);
  x1 = Math.ceil(x1);
  const { w, h, mask } = T,
    solidAt = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  let top = h;
  for (let y = 0; y < h && top === h; y++) for (let x = x0; x <= x1; x += 2) if (solidAt(x, y)) { top = y; break; }
  if (top >= Math.min(h, G.waterY)) return;
  const bot = Math.min(h, G.waterY + 40),
    nx = Math.max(2, Math.round((x1 - x0) / 24)),
    ny = Math.max(2, Math.round((bot - top) / 28)),
    V = [];
  for (let j = 0; j <= ny; j++) {
    V.push([]);
    for (let i = 0; i <= nx; i++) {
      const edge = i === 0 || i === nx;
      V[j].push([
        x0 + ((x1 - x0) * i) / nx + (edge ? 0 : rnd(-8, 8)),
        top + ((bot - top) * j) / ny + (j === ny ? 0 : rnd(-9, 9)) - (j === 0 ? 3 : 0),
      ]);
    }
  }
  const shards = [],
    cracks = [],
    mx = (x0 + x1) / 2;
  const has = poly => {
    const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
    const ax = Math.min(...xs), bx = Math.max(...xs), ay = Math.min(...ys), by = Math.max(...ys);
    for (let y = ay; y <= by; y += 4) for (let x = ax; x <= bx; x += 4) if (solidAt(Math.round(x), Math.round(y))) return true;
    return false;
  };
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = V[j][i], b = V[j][i + 1], c = V[j + 1][i + 1], d = V[j + 1][i],
        polys = Math.random() < 0.5 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
      for (const poly of polys) {
        if (!has(poly)) continue;
        const cx = (poly[0][0] + poly[1][0] + poly[2][0]) / 3, cy = (poly[0][1] + poly[1][1] + poly[2][1]) / 3;
        shards.push({ poly: poly.map(p => [p[0] - cx, p[1] - cy]), cx, cy, x: cx, y: cy, rot: 0, vx: 0, vy: 0, vr: 0, wait: 0 });
        for (let k = 0; k < 3; k++) {
          const p = poly[k], q = poly[(k + 1) % 3], ex = (p[0] + q[0]) / 2, ey = (p[1] + q[1]) / 2;
          if (solidAt(Math.round(ex), Math.round(ey))) cracks.push({ p, q, d: Math.hypot(ex - mx, ey - top) });
        }
      }
    }
  const reach = Math.max(1, ...cracks.map(c => c.d));
  FX.slab = { x0, x1, top, bot, t: 0, dur: Math.max(0.2, t), shards, cracks, reach, img: null, fall: false };
}
/** The ground between e.x0..e.x1 is about to be cut away: copies it into the slab's image and lets the shards go. */
function slabRelease(e) {
  let s = FX.slab;
  if (!s || s.fall || Math.abs(s.x0 - e.x0) > 2) {
    slabStart(e.x0, e.x1, 0);
    s = FX.slab;
  }
  if (!s || s.fall) return;
  const iw = Math.ceil(s.x1 - s.x0 + 1), ih = Math.ceil(s.bot - s.top);
  s.img = document.createElement('canvas');
  s.img.width = iw;
  s.img.height = ih;
  s.img.getContext('2d').drawImage(T.cv, s.x0, s.top, iw, ih, 0, 0, iw, ih);
  s.fall = true;
  s.t = 0;
  const mid = (s.x0 + s.x1) / 2, span = Math.max(1, s.x1 - s.x0);
  for (const k of s.shards) {
    k.wait = Math.random() * 0.45 + Math.abs(k.cx - mid) / span * 0.35;
    k.vx = ((k.cx - mid) / span) * 70 + rnd(-18, 18);
    k.vy = rnd(-30, 0);
    k.vr = rnd(-1.4, 1.4);
  }
  for (let i = 0; i < 40; i++)
    addP({
      x: rnd(s.x0, s.x1), y: s.top + rnd(-4, 10), vx: rnd(-40, 40), vy: rnd(-60, -5),
      l: rnd(1, 2), m: 2, c: ['#cfc6b8', '#a89f93', '#8a8178'][i % 3], s: rnd(2, 5), g: -10, k: 's',
    });
}
/** Advances the slab: cracks grow until it breaks, then every shard falls (spinning) into the sea. */
function slabUpdate(dt) {
  const s = FX.slab;
  if (!s) return;
  s.t += dt;
  if (!s.fall) return;
  let alive = 0;
  for (const k of s.shards) {
    if (k.gone) continue;
    alive++;
    if (k.wait > 0) {
      k.wait -= dt;
      continue;
    }
    k.vy += SLAB_GRAV * dt;
    k.x += k.vx * dt;
    k.y += k.vy * dt;
    k.rot += k.vr * dt;
    if (k.y > G.waterY) {
      k.gone = true;
      puff(k.x, G.waterY, 5, 200, ['#cfe9ff', '#8cc4ee', '#fff'], 0.8, 3, 520, 'd');
    }
  }
  if (!alive) FX.slab = null;
}

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
 * Paints a blood stain on the terrain picture (only where there is ground: `source-atop`), for Splatter Mode.
 * Purely visual: the collision mask is untouched, so guests may differ without any consequence.
 */
function bloodStain(x, y, r) {
  if (!T.ctx) return;
  T.ctx.save();
  T.ctx.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 7; i++) {
    T.ctx.fillStyle = ['#7d1020', '#a3122a', '#8a0f22'][i % 3];
    T.ctx.globalAlpha = 0.55;
    T.ctx.beginPath();
    T.ctx.arc(x + (Math.random() - 0.5) * r * 1.6, y + (Math.random() - 0.5) * r * 0.9, r * (0.15 + Math.random() * 0.3), 0, TAU);
    T.ctx.fill();
  }
  T.ctx.restore();
}
/** A shower of blood and gore: `n` droplets thrown up and out under gravity, plus a few heavy chunks. */
function bloodShower(x, y, n, spread = 1) {
  const cols = ['#5e0a16', '#7d1020', '#b5122b', '#d21f3c', '#ff4058'];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6 * spread,
      speed = 90 + Math.random() * 330,
      life = 0.7 + Math.random() * 0.9;
    addP({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      l: life,
      m: life,
      c: cols[(Math.random() * cols.length) | 0],
      s: 1.4 + Math.random() * (i % 6 === 0 ? 5 : 2.6),
      g: 560,
      k: 'c',
    });
  }
}

/**
 * Turns one simulation event into visuals and sound. Runs on the host and on every guest.
 * Event types: x (explosion), dmg (floating damage), msg, log, nuke (background mushroom cloud), splash, snd, shot (tracer),
 * punch, burst (Splatter Mode), tele, plane, quake, tsunami, bolt (lightning), flash, mark (homing target), turn, over, trail (particle trail).
 * Terrain edits (x, cv, gd) are applied separately by applyTerrain().
 */
function applyEvent(e) {
  switch (e.e) {
    case 'blood':
      if (UI.splatterMode) bloodSplat(e.x, e.y);
      break;
    case 'burst':
      // Splatter Mode: the worm hit by the Hokuto Hyakuretsu Ken bursts in a shower of blood
      if (UI.splatterMode) {
        bloodShower(e.x, e.y - 4, 150, 1.2);
        bloodShower(e.x, e.y - 4, 40, 0.5);
        bloodStain(e.x, e.y + 6, 46);
        FX.rings.push({ x: e.x, y: e.y, r: 40, t: 0, big: false });
        UI.shake = Math.min(18, UI.shake + 6);
        SFX.squelch();
      }
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
    case 'stomp':
      FX.rings.push({ x: e.x, y: e.y, r: e.r, t: 0, big: true });
      puff(e.x, e.y, 30, 230, ['#b9a48a', '#8c7a63', '#e0d2b4'], 0.9, 3.5, 200, 'c');
      SFX.stomp();
      break;
    case 'flat':
      // a worm squashed flat: a pancake in its team colour that fades away
      (FX.flats = FX.flats || []).push({ x: e.x, y: e.y, t: 0, team: e.t });
      break;
    case 'slash':
      (FX.slashes = FX.slashes || []).push({ x: e.x, y: e.y, t: 0, f: e.f });
      if (UI.splatterMode) {
        // Splatter Mode: the sliced worm falls apart in two halves and its blood spurts out of the cut
        const ang = e.f > 0 ? 0.9 : Math.PI - 0.9;
        let tw = null,
          best = 16;
        for (const o of G.worms) {
          const d = Math.hypot(o.x - e.x, o.y - 2 - e.y);
          if (!o.dead && d < best) {
            best = d;
            tw = o;
          }
        }
        if (tw) tw._cut = { t0: G.time, ang };
        (FX.spurts = FX.spurts || []).push({ x: e.x, y: e.y, t: 0, ang });
        bloodShower(e.x, e.y, 36, 0.7);
        bloodStain(e.x, e.y + 8, 22);
        SFX.squelch();
      }
      puff(e.x, e.y, 10, 260, ['#fff', '#cfe8ff', '#ff4b4b'], 0.3, 2, 0, 'c');
      SFX.slash();
      break;
    case 'say':
      FX.txt.push({ x: e.x, y: e.y, t: e.t, c: '#ffd23f', l: 2.4 });
      // showMsg(tr(e.t), 1800);
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
    case 'btdefl':
      // a round deflected or passing through the Bullet Time caster: green sparks and a ring
      puff(e.x, e.y, 8, 160, ['#b8ffc8', '#38ff6a', '#fff'], 0.35, 1.6, 0, 'c');
      FX.rings.push({ x: e.x, y: e.y, r: 14, t: 0, big: false });
    case 'rdust':
      // eroded ground turning into fine dust that the wind takes away
      for (let i = 0; i < 6; i++)
        addP({
          x: e.x + rnd(-8, 8), y: e.y + rnd(-8, 8), vx: rnd(-80, 80), vy: rnd(-90, 20),
          l: rnd(0.8, 1.8), m: 1.8, c: ['#cfc6b8', '#a89f93', '#8a7a64', '#6d5a40'][i % 4], s: rnd(0.8, 2.2), g: 0, k: 'w',
        });
      break;
    case 'quake':
      FX.quake = e.t;
      break;
    case 'choke':
      // Force Choke: blood from the squeezed worm (a spray when it crashes into the ground); a smaller one without Splatter Mode
      if (e.hit) {
        bloodSplat(e.x, e.y);
        if (UI.splatterMode) {
          bloodShower(e.x, e.y - 4, 90, 1.4);
          bloodStain(e.x, e.y + 6, 36);
        }
        UI.shake = Math.min(18, UI.shake + 6);
      }
      break;
    case 'avada': {
      // the end of the green beam: a flash of green and a death rattle when it hit, a fizzle when it did not
      const cols = ['#b8ffc4', '#4be86a', '#1fb83e', '#0e7a2a'];
      puff(e.x, e.y, e.hit ? 70 : 24, e.hit ? 260 : 120, cols, e.hit ? 1.0 : 0.6, e.hit ? 3 : 2, e.hit ? -60 : 0);
      FX.rings.push({ x: e.x, y: e.y, r: e.hit ? 46 : 18, t: 0, big: false });
      if (e.hit) UI.shake = Math.min(18, UI.shake + 5);
      if (SFX[e.hit ? 'zap' : 'fizzle']) SFX[e.hit ? 'zap' : 'fizzle']();
      break;
    }
    case 'fr':
      slabStart(e.x0, e.x1, e.t);
      break;
    case 'rc': {
      // the shards fall (slabRelease already cut them from the ground); dust, then a rain of loose rocks
      const mid = (e.x0 + e.x1) / 2,
        cols = [T.theme.top, T.theme.dirt, T.theme.deep, [100, 92, 80]];
      for (let x = e.x0; x < e.x1; x += 24) {
        const first = FX.p.length;
        puff(x, G.waterY, 4, 220, ['#cfe9ff', '#8cc4ee', '#fff'], 0.9, 3, 520, 'd');
        const delay = 0.6 + Math.random() * 0.5;
        for (let i = first; i < FX.p.length; i++) FX.p[i].wait = delay;
      }
      UI.shake = Math.min(18, UI.shake + 10);
      camImpact(mid, G.waterY * 0.5);
      break;
    }

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
      else if (e.k === 'avada')
        addP({
          x: e.x + rnd(-2, 2),
          y: e.y + rnd(-2, 2),
          vx: rnd(-25, 25),
          vy: rnd(-25, 25),
          l: 0.55,
          m: 0.55,
          c: pick(['#b8ffc4', '#4be86a', '#1fb83e']),
          s: rnd(1.4, 2.6),
          g: 0,
          k: 'c',
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
  // Thanos' Gauntlet: a worm turning to dust sheds grains from the crumbling edge; the wind carries them away
  for (const w of G.worms)
    if (w.dustP > 0 && w.dustP < 1 && !w.dead) {
      const dir = G.wind >= 0 ? 1 : -1;
      for (let i = 0; i < 90 * dt * (0.4 + w.dustP) + Math.random(); i++) {
        const fx = w.x + dir * (13 - 26 * w.dustP) + rnd(-3, 3);
        addP({
          x: fx,
          y: w.y + rnd(-14, 8),
          vx: dir * rnd(10, 50),
          vy: rnd(-30, 5),
          l: rnd(1.2, 2.8),
          m: 2.8,
          c: ['#cfc6b8', '#a89f93', '#8a8178', '#e0d8c8'][(Math.random() * 4) | 0],
          s: rnd(0.8, 2.2),
          g: 0,
          k: 'w',
        });
      }
    }
  for (let i = FX.p.length - 1; i >= 0; i--) {
    const p = FX.p[i];
    if (p.wait > 0) {
      p.wait -= dt;
      continue;
    }
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
    if (p.k === 'w') {
      // dust: eases towards the wind speed (never still), rising a little as it thins out
      const sp = (60 + 160 * Math.abs(G.wind)) * (G.wind >= 0 ? 1 : -1);
      p.vx += (sp - p.vx) * 1.4 * dt;
      p.vy += (-18 - p.vy) * dt;
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
  FX.slashes = (FX.slashes || []).filter(s => (s.t += dt) < 0.3);
  // blood pulsing out of a cut (Splatter Mode): a fountain along the cut's normal that weakens over 1 s
  FX.spurts = (FX.spurts || []).filter(s => {
    s.t += dt;
    const k = Math.max(0, 1 - s.t),
      n = Math.round(10 * k * dt * 60 * 0.5);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1,
        sp = 120 + Math.random() * 220 * k,
        a = s.ang + side * (Math.PI / 2) + (Math.random() - 0.5) * 0.5,
        life = 0.45 + Math.random() * 0.5;
      addP({
        x: s.x,
        y: s.y,
        vx: Math.cos(a) * sp * 0.5,
        vy: Math.sin(a) * sp - 120 - Math.random() * 160,
        l: life,
        m: life,
        c: ['#7d1020', '#b5122b', '#d21f3c'][i % 3],
        s: 1.5 + Math.random() * 2.4,
        g: 560,
        k: 'c',
      });
    }
    return s.t < 1;
  });
  FX.flats = (FX.flats || []).filter(f => (f.t += dt) < 2);
  slabUpdate(dt);
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
