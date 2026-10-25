'use strict';

/**
 * @file theme-fx.js - Seasonal and special theme overlays
 *
 * A theme (themes.js) is a colour palette; a theme *effect* adds assets on top of it: sky decorations,
 * scenery props standing on the terrain, a screen overlay, a worm hat. A theme opts in with
 * `fx: 'name'`; the effect is registered here with registerThemeFx(). Everything is drawn with canvas
 * calls (no image files) and depends only on the seed and the game clock, so online guests see exactly
 * what the host sees without any network traffic.
 *
 * Hooks of an effect definition (all optional):
 *   props: ['kind', ...]        scenery kinds scattered over the terrain at match start (seeded)
 *   prop(g, p, t)               draw one prop; g is translated to its base (p.x, p.y), p.s = scale, p.f = facing, p.ph = phase
 *   sky(g, t)                   screen-space decoration right after the sky gradient (moon, bats, ...)
 *   screen(g, t)                screen-space overlay on top of the finished frame (snow, speed lines, ...)
 *   hat(g, col, hx, hy, f, t)   replaces the team hat on every worm; return true when it drew something
 *
 * Add a theme: THEMES entry with `fx`, registerThemeFx() below, <option> in index.html, translations
 * in lang-it.js. See docs/DEVELOPING.md ("Themes and seasonal effects").
 *
 * Depends on: util, themes, terrain, view (CAM, VW, VH), render (ctx2)
 * Globals defined: THEME_FX, registerThemeFx, themeFxBuild, themeFxSky, themeFxWorld, themeFxScreen, themeFxHat
 */

/** Registered effects by name. */
const THEME_FX = {};
/** Registers (or replaces) a theme effect; see the hooks above. */
function registerThemeFx(name, def) {
  THEME_FX[name] = def;
}
const themeFxCur = () => (T.theme && T.theme.fx ? THEME_FX[T.theme.fx] : null);

/**
 * Scatters the props of the active theme over the terrain. Called by generateTerrain() when the level
 * is ready; uses its own generator seeded from cfg.seed, so every client builds the same scenery.
 * Props sit on gentle ground above the water and disappear once their ground is blown away.
 */
function themeFxBuild(cfg) {
  T.props = [];
  const fx = themeFxCur();
  if (!fx || !fx.props || !fx.props.length) return;
  const rng = mulberry(hashStr(String(cfg.seed)) ^ 0x5eed1e55),
    top = x => {
      for (let y = 0; y < T.h; y++) if (T.mask[y * T.w + x]) return y;
      return -1;
    },
    n = Math.round(T.w / 85);
  for (let i = 0; i < n * 3 && T.props.length < n; i++) {
    const x = 30 + Math.floor(rng() * (T.w - 60)),
      y = top(x);
    const kind = fx.props[Math.floor(rng() * fx.props.length)],
      s = 0.85 + rng() * 0.4,
      f = rng() < 0.5 ? -1 : 1,
      ph = rng() * TAU;
    if (y < 0 || y > T.waterBase - 14) continue;
    if (Math.abs(top(x - 7) - y) > 5 || Math.abs(top(x + 7) - y) > 5) continue; // too steep
    if (T.props.some(p => Math.abs(p.x - x) < 46)) continue; // keep them apart
    T.props.push({ x, y: y + 1, kind, s, f, ph, gone: false });
  }
}

/** Sky decoration (screen space), after the gradient and before the world. */
function themeFxSky() {
  const fx = themeFxCur();
  if (!fx || !fx.sky) return;
  ctx2.save();
  fx.sky(ctx2, G ? G.time : 0);
  ctx2.restore();
}

/** Draws the props in world space (call between the terrain and the worms). */
function themeFxWorld() {
  const fx = themeFxCur();
  if (!fx || !fx.prop || !T.props) return;
  const g = ctx2,
    t = G.time,
    hw = VW / CAM.s / 2 + 40,
    hh = VH / CAM.s / 2 + 60;
  for (const p of T.props) {
    if (p.gone) continue;
    if (!solid(p.x, p.y + 2)) {
      p.gone = true; // the ground under it was destroyed
      continue;
    }
    if (Math.abs(p.x - CAM.x) > hw || Math.abs(p.y - CAM.y) > hh || p.y > G.waterY) continue;
    g.save();
    g.translate(p.x, p.y);
    fx.prop(g, p, t);
    g.restore();
  }
}

/** Screen-space overlay on the finished frame. */
function themeFxScreen() {
  const fx = themeFxCur();
  if (!fx || !fx.screen) return;
  ctx2.save();
  ctx2.setTransform(DPR, 0, 0, DPR, 0, 0);
  fx.screen(ctx2, G ? G.time : 0);
  ctx2.restore();
}

/** Theme hat for a worm (replaces the team accessory). Returns true when it drew one. */
function themeFxHat(g, col, hx, hy, f, t) {
  const fx = themeFxCur();
  if (!fx || !fx.hat) return false;
  g.save();
  g.strokeStyle = WORM_INK;
  g.lineWidth = 0.9;
  g.lineJoin = 'round';
  const done = fx.hat(g, col, hx, hy, f, t);
  g.restore();
  return !!done;
}

/** Deterministic pseudo-random in [0,1) from an integer (for particles that need no state). */
const fxr = i => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Falling snow in screen space: `n` flakes per layer, drifting with the wind. */
function fxSnow(g, t, n, size, speed, alpha) {
  const w = VW,
    h = VH,
    wind = G ? G.wind || 0 : 0;
  g.fillStyle = '#fff';
  g.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    const sp = speed * (0.7 + fxr(i + 3) * 0.6),
      x = (((fxr(i) * w + Math.sin(t * 0.8 + i) * 16 + wind * t * 6) % w) + w) % w,
      y = (fxr(i + 99) * h + t * sp) % h;
    g.beginPath();
    g.arc(x, y, size * (0.6 + fxr(i + 7) * 0.8), 0, TAU);
    g.fill();
  }
  g.globalAlpha = 1;
}

/* ===== Halloween ===== */
registerThemeFx('halloween', {
  props: ['tombstone', 'pumpkin', 'deadtree', 'ghost', 'pumpkin', 'tombstone'],
  sky(g, t) {
    // big orange moon with craters and a soft halo
    const mx = VW * 0.78,
      my = VH * 0.2,
      r = Math.min(VW, VH) * 0.11,
      halo = g.createRadialGradient(mx, my, r * 0.8, mx, my, r * 2.6);
    halo.addColorStop(0, 'rgba(255,150,40,.35)');
    halo.addColorStop(1, 'rgba(255,150,40,0)');
    g.fillStyle = halo;
    g.fillRect(mx - r * 3, my - r * 3, r * 6, r * 6);
    g.fillStyle = '#ffa31f';
    g.beginPath();
    g.arc(mx, my, r, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(160,70,0,.28)';
    for (const [dx, dy, k] of [[-0.35, -0.2, 0.22], [0.25, 0.1, 0.3], [-0.1, 0.45, 0.16], [0.4, -0.4, 0.12]]) {
      g.beginPath();
      g.arc(mx + dx * r, my + dy * r, k * r, 0, TAU);
      g.fill();
    }
    // bats crossing the sky
    g.fillStyle = '#0b0710';
    for (let i = 0; i < 7; i++) {
      const sp = 38 + fxr(i) * 40,
        x = ((t * sp + fxr(i + 5) * (VW + 300)) % (VW + 300)) - 150,
        y = VH * (0.1 + fxr(i + 11) * 0.35) + Math.sin(t * 2 + i * 2) * 14,
        s = 0.8 + fxr(i + 20) * 0.7,
        flap = Math.sin(t * 14 + i * 3);
      g.save();
      g.translate(x, y);
      g.scale(s, s);
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(-8, -6 - flap * 6, -17, -1 - flap * 4);
      g.quadraticCurveTo(-11, 1, -8, 3);
      g.quadraticCurveTo(-4, 1, 0, 5);
      g.quadraticCurveTo(4, 1, 8, 3);
      g.quadraticCurveTo(11, 1, 17, -1 - flap * 4);
      g.quadraticCurveTo(8, -6 - flap * 6, 0, 0);
      g.fill();
      g.beginPath();
      g.arc(0, 0, 2.6, 0, TAU);
      g.fill();
      g.restore();
    }
  },
  screen(g, t) {
    // purple vignette
    const v = g.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.35, VW / 2, VH / 2, Math.max(VW, VH) * 0.75);
    v.addColorStop(0, 'rgba(40,0,60,0)');
    v.addColorStop(1, 'rgba(40,0,60,.45)');
    g.fillStyle = v;
    g.fillRect(0, 0, VW, VH);
  },
  prop(g, p, t) {
    g.scale(p.s * p.f, p.s);
    if (p.kind === 'tombstone') {
      g.fillStyle = '#8f8a9c';
      g.strokeStyle = '#2a2433';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(-8, 0);
      g.lineTo(-8, -17);
      g.arc(0, -17, 8, Math.PI, 0);
      g.lineTo(8, 0);
      g.closePath();
      g.fill();
      g.stroke();
      g.strokeStyle = '#4a4458';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(0, -20);
      g.lineTo(0, -10);
      g.moveTo(-3.5, -16.5);
      g.lineTo(3.5, -16.5);
      g.stroke();
    } else if (p.kind === 'pumpkin') {
      g.fillStyle = '#f07a12';
      g.strokeStyle = '#6a2f05';
      g.lineWidth = 1.2;
      for (const dx of [-6, 6, 0]) {
        g.beginPath();
        g.ellipse(dx, -8, dx ? 6 : 7.5, 8, 0, 0, TAU);
        g.fill();
        g.stroke();
      }
      g.fillStyle = '#3d7a1c';
      g.fillRect(-1.4, -18, 2.8, 4);
      const glow = 0.75 + Math.sin(t * 9 + p.ph) * 0.15 + Math.sin(t * 23 + p.ph) * 0.1;
      g.fillStyle = `rgba(255,222,70,${glow})`;
      g.beginPath();
      g.moveTo(-5, -11);
      g.lineTo(-2, -11);
      g.lineTo(-3.5, -14);
      g.closePath();
      g.moveTo(5, -11);
      g.lineTo(2, -11);
      g.lineTo(3.5, -14);
      g.closePath();
      g.moveTo(-5, -6);
      g.lineTo(5, -6);
      g.lineTo(3, -3.5);
      g.lineTo(1.5, -5);
      g.lineTo(0, -3.5);
      g.lineTo(-1.5, -5);
      g.lineTo(-3, -3.5);
      g.closePath();
      g.fill();
    } else if (p.kind === 'deadtree') {
      g.strokeStyle = '#1d1424';
      g.lineCap = 'round';
      const br = (x, y, a, len, w, d) => {
        g.lineWidth = w;
        const x2 = x + Math.cos(a) * len,
          y2 = y + Math.sin(a) * len;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x2, y2);
        g.stroke();
        if (d > 0) {
          br(x2, y2, a - 0.55, len * 0.7, w * 0.7, d - 1);
          br(x2, y2, a + 0.5, len * 0.68, w * 0.7, d - 1);
        }
      };
      br(0, 2, -Math.PI / 2 + 0.05, 18, 4, 3);
    } else if (p.kind === 'ghost') {
      const bob = Math.sin(t * 2 + p.ph) * 4;
      g.translate(0, -26 + bob);
      g.fillStyle = 'rgba(240,240,255,.78)';
      g.beginPath();
      g.arc(0, 0, 8, Math.PI, 0);
      g.lineTo(8, 10);
      for (let i = 0; i < 4; i++) g.quadraticCurveTo(8 - i * 4 - 2, 5 + (i % 2 ? 0 : 4) + 6, 8 - (i + 1) * 4, 10);
      g.closePath();
      g.fill();
      g.fillStyle = '#1b1226';
      g.beginPath();
      g.ellipse(-3, -1, 1.6, 2.4, 0, 0, TAU);
      g.ellipse(3, -1, 1.6, 2.4, 0, 0, TAU);
      g.fill();
      g.beginPath();
      g.ellipse(0, 4, 1.8, 2.2, 0, 0, TAU);
      g.fill();
    }
  },
  hat(g, col, hx, hy, f, t) {
    // witch hat
    g.fillStyle = '#231a33';
    g.beginPath();
    g.ellipse(hx, hy - 4, 8, 1.8, 0, 0, TAU);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(hx - 4.6, hy - 4.3);
    g.quadraticCurveTo(hx - 2, hy - 10, hx + f * 2, hy - 15);
    g.quadraticCurveTo(hx + f * 5.5, hy - 14.5 - Math.sin(t * 4) * 0.5, hx + f * 6, hy - 12.5);
    g.quadraticCurveTo(hx + f * 2.4, hy - 11.5, hx + 4.6, hy - 4.3);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = col;
    g.fillRect(hx - 4.2, hy - 7.2, 8.4, 2.1);
    g.fillStyle = '#f2c230';
    g.fillRect(hx - 1.4, hy - 7.4, 2.8, 2.5);
    return true;
  },
});

/* ===== Christmas ===== */
registerThemeFx('christmas', {
  props: ['tree', 'gift', 'snowman', 'tree', 'candy'],
  sky(g, t) {
    // twinkling stars in the upper sky
    for (let i = 0; i < 70; i++) {
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (0.8 + fxr(i + 40)) + i));
      g.fillStyle = `rgba(255,250,220,${tw * 0.85})`;
      g.fillRect(fxr(i) * VW, fxr(i + 60) * VH * 0.55, 1.6, 1.6);
    }
    fxSnow(g, t, 55, 1.6, 24, 0.7); // far flakes
  },
  screen(g, t) {
    fxSnow(g, t, 45, 2.8, 52, 0.9); // near flakes
    const v = g.createLinearGradient(0, 0, 0, VH);
    v.addColorStop(0, 'rgba(255,255,255,.08)');
    v.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = v;
    g.fillRect(0, 0, VW, VH);
  },
  prop(g, p, t) {
    g.scale(p.s * p.f, p.s);
    if (p.kind === 'tree') {
      g.fillStyle = '#5a3a1e';
      g.fillRect(-2.5, -6, 5, 7);
      g.strokeStyle = '#0d3a1a';
      g.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const y = -5 - i * 9,
          w = 15 - i * 3.5;
        g.fillStyle = i % 2 ? '#1d7a36' : '#238a3e';
        g.beginPath();
        g.moveTo(-w, y);
        g.lineTo(0, y - 15);
        g.lineTo(w, y);
        g.closePath();
        g.fill();
        g.stroke();
        g.fillStyle = '#fff';
        g.beginPath();
        g.moveTo(-w * 0.5, y - 7.5);
        g.lineTo(0, y - 15);
        g.lineTo(w * 0.5, y - 7.5);
        g.quadraticCurveTo(w * 0.2, y - 9, 0, y - 7);
        g.quadraticCurveTo(-w * 0.2, y - 9, -w * 0.5, y - 7.5);
        g.fill();
      }
      g.fillStyle = '#ffd34a';
      g.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = (k * Math.PI) / 5 - Math.PI / 2,
          r = k % 2 ? 2.2 : 5;
        g.lineTo(Math.cos(a) * r, -34 + Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
      const cols = ['#ff3b3b', '#ffd34a', '#4aa8ff', '#ff7ad9'];
      for (let k = 0; k < 7; k++) {
        const on = Math.sin(t * 3 + k * 1.7 + p.ph) > -0.3;
        g.fillStyle = on ? cols[k % 4] : '#444';
        g.beginPath();
        g.arc(-8 + ((k * 37) % 17) + (k % 2) * 0, -9 - k * 3.4 + (k % 2) * 2, 1.5, 0, TAU);
        g.fill();
      }
    } else if (p.kind === 'gift') {
      const c = ['#d62b2b', '#2b7bd6', '#1f9a4a'][Math.floor(p.ph) % 3];
      g.fillStyle = c;
      g.strokeStyle = '#222';
      g.lineWidth = 1;
      g.fillRect(-8, -12, 16, 12);
      g.strokeRect(-8, -12, 16, 12);
      g.fillStyle = '#ffd34a';
      g.fillRect(-1.6, -12, 3.2, 12);
      g.fillRect(-8, -7, 16, 3);
      g.beginPath();
      g.ellipse(-3.2, -14, 3.4, 2.2, -0.5, 0, TAU);
      g.ellipse(3.2, -14, 3.4, 2.2, 0.5, 0, TAU);
      g.fill();
    } else if (p.kind === 'snowman') {
      g.fillStyle = '#fff';
      g.strokeStyle = '#6a7a96';
      g.lineWidth = 1;
      for (const [y, r] of [[-7, 8], [-19, 6], [-28, 4.6]]) {
        g.beginPath();
        g.arc(0, y, r, 0, TAU);
        g.fill();
        g.stroke();
      }
      g.fillStyle = '#111';
      g.fillRect(-4, -36, 8, 4);
      g.fillRect(-6, -32.4, 12, 1.4);
      g.beginPath();
      g.arc(-1.7, -29, 0.7, 0, TAU);
      g.arc(1.7, -29, 0.7, 0, TAU);
      g.fill();
      g.fillStyle = '#ff7a1a';
      g.beginPath();
      g.moveTo(0, -28);
      g.lineTo(6.5, -27);
      g.lineTo(0, -26.2);
      g.fill();
      g.fillStyle = '#d62b2b';
      g.fillRect(-5, -24.2, 10, 2);
    } else if (p.kind === 'candy') {
      g.lineWidth = 3.4;
      g.lineCap = 'round';
      for (const [c, w] of [['#fff', 3.4], ['#d62b2b', 1.6]]) {
        g.strokeStyle = c;
        g.lineWidth = w;
        g.setLineDash(c === '#fff' ? [] : [3, 3.5]);
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(0, -17);
        g.arc(4, -17, 4, Math.PI, 0);
        g.stroke();
      }
      g.setLineDash([]);
    }
  },
  hat(g, col, hx, hy, f, t) {
    // Santa hat with a swinging pompom
    g.fillStyle = '#d62b2b';
    g.beginPath();
    g.moveTo(hx - 5.4, hy - 4);
    g.quadraticCurveTo(hx - 4, hy - 12, hx - f * 1, hy - 12.5);
    g.quadraticCurveTo(hx - f * 5 - Math.sin(t * 3) * 0.8, hy - 12, hx - f * 7, hy - 7.5);
    g.quadraticCurveTo(hx + f * 3, hy - 9, hx + 5.4, hy - 4);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#fff';
    g.beginPath();
    g.roundRect(hx - 6, hy - 5.6, 12, 3.2, 1.6);
    g.fill();
    g.stroke();
    g.beginPath();
    g.arc(hx - f * 7, hy - 7.3 + Math.sin(t * 3) * 0.5, 2, 0, TAU);
    g.fill();
    g.stroke();
    return true;
  },
});

/* ===== Manga ===== */
let mangaTone = null;
/** Halftone dot gradient (dense at the top), cached per screen size. */
function mangaHalftone() {
  if (mangaTone && mangaTone.w === VW && mangaTone.h === VH) return mangaTone.cv;
  const cv = document.createElement('canvas');
  cv.width = VW;
  cv.height = VH;
  const g = cv.getContext('2d'),
    step = 9;
  g.fillStyle = '#111';
  for (let y = 0, row = 0; y < VH * 0.6; y += step * 0.866, row++) {
    const r = 3.2 * (1 - y / (VH * 0.6));
    if (r < 0.35) continue;
    for (let x = (row % 2) * step * 0.5; x < VW; x += step) {
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }
  }
  mangaTone = { w: VW, h: VH, cv };
  return cv;
}
registerThemeFx('manga', {
  props: ['bush', 'rock', 'sakura', 'bush', 'rock'],
  sky(g, t) {
    g.globalAlpha = 0.38;
    g.drawImage(mangaHalftone(), 0, 0);
    g.globalAlpha = 1;
    // a few speed streaks drifting behind the scenery
    g.strokeStyle = 'rgba(0,0,0,.35)';
    g.lineWidth = 1.2;
    for (let i = 0; i < 16; i++) {
      const y = fxr(i + 8) * VH * 0.7,
        len = 60 + fxr(i + 30) * 140,
        x = ((t * (90 + fxr(i) * 90) + fxr(i + 50) * (VW + 300)) % (VW + 300)) - 150;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + len, y);
      g.stroke();
    }
  },
  screen(g, t) {
    // black-and-white look: wash most colour out (the team colours stay readable)
    g.globalCompositeOperation = 'saturation';
    g.globalAlpha = 0.62;
    g.fillStyle = '#808080';
    g.fillRect(0, 0, VW, VH);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    // impact lines while the screen shakes (explosions)
    const k = clamp((UI.shake || 0) / 12, 0, 1);
    if (k > 0.05) {
      g.fillStyle = `rgba(0,0,0,${0.55 * k})`;
      const cx = VW / 2,
        cy = VH / 2,
        R = Math.hypot(VW, VH) / 2 + 20,
        n = 46;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + fxr(i) * 0.1,
          w = 0.012 + fxr(i + 9) * 0.03,
          r0 = R * (0.55 + fxr(i + 21) * 0.2);
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        g.lineTo(cx + Math.cos(a - w) * R, cy + Math.sin(a - w) * R);
        g.lineTo(cx + Math.cos(a + w) * R, cy + Math.sin(a + w) * R);
        g.fill();
      }
    }
    // ink frame
    g.strokeStyle = '#111';
    g.lineWidth = 6;
    g.strokeRect(3, 3, VW - 6, VH - 6);
  },
  prop(g, p, t) {
    g.scale(p.s * p.f, p.s);
    g.strokeStyle = '#111';
    g.lineWidth = 1.4;
    if (p.kind === 'bush') {
      g.fillStyle = '#fff';
      for (const [x, y, r] of [[-7, -5, 6], [0, -9, 7.5], [7, -5, 6]]) {
        g.beginPath();
        g.arc(x, y, r, Math.PI * 0.9, Math.PI * 2.1);
        g.fill();
        g.stroke();
      }
      g.beginPath();
      g.moveTo(-13, 0);
      g.lineTo(13, 0);
      g.stroke();
      g.beginPath();
      g.moveTo(-3, -4);
      g.lineTo(-1, -9);
      g.moveTo(4, -3);
      g.lineTo(5, -7);
      g.stroke();
    } else if (p.kind === 'rock') {
      g.fillStyle = '#bbb';
      g.beginPath();
      g.moveTo(-9, 0);
      g.lineTo(-6, -9);
      g.lineTo(0, -12);
      g.lineTo(7, -8);
      g.lineTo(10, 0);
      g.closePath();
      g.fill();
      g.stroke();
      g.beginPath();
      for (let i = 0; i < 4; i++) {
        g.moveTo(-4 + i * 3, -3 - i);
        g.lineTo(-1 + i * 3, -6 - i);
      }
      g.stroke();
    } else if (p.kind === 'sakura') {
      g.strokeStyle = '#111';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, 1);
      g.quadraticCurveTo(-3, -14, 2, -26);
      g.stroke();
      g.lineWidth = 1.4;
      g.fillStyle = '#fff';
      for (const [x, y, r] of [[-6, -26, 7], [6, -30, 7.5], [0, -36, 6.5], [10, -22, 5.5]]) {
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
        g.stroke();
      }
      // petals falling and swirling
      g.fillStyle = '#111';
      for (let i = 0; i < 4; i++) {
        const k = (t * 0.35 + i / 4 + p.ph) % 1;
        g.beginPath();
        g.ellipse(Math.sin(k * 7 + i) * 9, -30 + k * 34, 1.6, 0.9, k * 6, 0, TAU);
        g.fill();
      }
    }
  },
  hat(g, col, hx, hy, f, t) {
    // hachimaki headband with a rising-sun disc and fluttering tails
    g.fillStyle = '#fff';
    g.beginPath();
    g.roundRect(hx - 5.6, hy - 4.2, 11.2, 3.2, 1.2);
    g.fill();
    g.stroke();
    g.fillStyle = '#e60012';
    g.beginPath();
    g.arc(hx + f * 1, hy - 2.6, 1.15, 0, TAU);
    g.fill();
    g.fillStyle = '#fff';
    for (const k of [0, 1]) {
      const w = Math.sin(t * 9 + k * 1.3) * 1.6;
      g.beginPath();
      g.moveTo(hx - f * 5, hy - 3.2);
      g.quadraticCurveTo(hx - f * (9 + k * 2), hy - 3 + w, hx - f * (13 + k * 2.5), hy - 0.5 + k * 2.4 + w);
      g.lineTo(hx - f * (11 + k * 2.5), hy + 0.2 + k * 2.4 + w);
      g.quadraticCurveTo(hx - f * 8, hy - 1.5, hx - f * 5, hy - 1.6);
      g.closePath();
      g.fill();
      g.stroke();
    }
    return true;
  },
});
