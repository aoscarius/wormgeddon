'use strict';

/**
 * @file render.js - Renderer
 *
 * Per-frame drawing: parallax sky, water, terrain, entities, effects and targeting previews.
 *
 * Depends on: sprites, worm-art, fx, terrain
 * Globals defined: SKY_CLOUDS, SKY_CLOUDS2, SKY_STARS, SKY_RAIN, mixHex, drawSky, drawSkyOverlay, drawNuke, drawDebug, drawTrajectories, DBG_PATHS, debugText, drawWater, drawSlab, drawBulletTime, render
 */

/* ---- Rendering ---- */
/** Fixed cloud layout for the parallax sky. */
const SKY_CLOUDS = Array.from({ length: 9 }, (_, i) => ({
  x: i * 330 + ((i * 97) % 200),
  y: 40 + ((i * 61) % 160),
  s: 0.7 + (i % 4) * 0.25,
}));
/** Extra clouds for the overcast skies, stars for the night and raindrops (positions as fractions of the screen). */
const SKY_CLOUDS2 = Array.from({ length: 9 }, (_, i) => ({
  x: i * 330 + 170 + ((i * 53) % 160),
  y: 20 + ((i * 43) % 120),
  s: 1.1 + (i % 3) * 0.3,
}));
const SKY_STARS = Array.from({ length: 120 }, (_, i) => ({
  x: ((i * 0.618034) % 1),
  y: ((i * 0.381966 * 7.13) % 1) * 0.75,
  s: 0.6 + (i % 4) * 0.5,
  p: i * 1.7,
}));
const SKY_RAIN = Array.from({ length: 170 }, (_, i) => ({
  x: (i * 0.754877) % 1,
  y: (i * 0.569840) % 1,
  l: 12 + (i % 7) * 3,
  v: 900 + (i % 5) * 170,
}));
/** Mixes two '#rrggbb' colours: k = 0 gives a, 1 gives b. Returns a CSS rgb() string. */
function mixHex(a, b, k) {
  const x = hexRgb(a),
    y = hexRgb(b);
  return rgbStr(x.map((v, i) => v + (y[i] - v) * k));
}
/**
 * Screen-space background for the chosen sky (T.sky: day, night, cloudy, rainy): gradient, sun / moon /
 * stars, drifting clouds (move with the wind) and two parallax mountain layers.
 */
function drawSky() {
  const th = T.theme,
    sky = T.sky || 'day',
    g = ctx2.createLinearGradient(0, 0, 0, VH);
  let c0 = th.sky[0],
    c1 = th.sky[1];
  if (sky === 'night') {
    c0 = mixHex(c0, '#04081c', 0.92);
    c1 = mixHex(c1, '#1c2c5c', 0.8);
  } else if (sky === 'cloudy') {
    c0 = mixHex(c0, '#7d8794', 0.6);
    c1 = mixHex(c1, '#c5ccd4', 0.6);
  } else if (sky === 'rainy') {
    c0 = mixHex(c0, '#262d39', 0.8);
    c1 = mixHex(c1, '#667080', 0.7);
  }
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  ctx2.fillStyle = g;
  ctx2.fillRect(0, 0, VW, VH);
  const px = CAM.x * 0.04,
    py = CAM.y * 0.04,
    t = G ? G.time : 0,
    wind = G ? G.wind : 0;
  if (sky === 'night') {
    ctx2.fillStyle = '#ffffff';
    for (const s of SKY_STARS) {
      ctx2.globalAlpha = 0.45 + 0.45 * Math.sin(t * 1.7 + s.p);
      const x = (((s.x * VW - px * 0.3) % VW) + VW) % VW;
      ctx2.fillRect(x, s.y * VH - py * 0.3, s.s, s.s);
    }
    // moon with a few craters
    const mx = VW * 0.8 - px,
      my = VH * 0.2 - py;
    ctx2.globalAlpha = 0.95;
    ctx2.fillStyle = '#eef2ff';
    ctx2.beginPath();
    ctx2.arc(mx, my, 38, 0, TAU);
    ctx2.fill();
    ctx2.fillStyle = 'rgba(150,160,190,.5)';
    for (const [dx, dy, r] of [[-12, -8, 8], [10, 6, 11], [-4, 16, 5], [16, -14, 4]]) {
      ctx2.beginPath();
      ctx2.arc(mx + dx, my + dy, r, 0, TAU);
      ctx2.fill();
    }
    ctx2.globalAlpha = 1;
  } else if (sky !== 'rainy') {
    ctx2.fillStyle = th.sun;
    ctx2.globalAlpha = sky === 'cloudy' ? 0.35 : 0.9;
    ctx2.beginPath();
    ctx2.arc(VW * 0.8 - px, VH * 0.2 - py, 46, 0, TAU);
    ctx2.fill();
    ctx2.globalAlpha = 1;
  }
  const over = sky === 'cloudy' || sky === 'rainy';
  ctx2.fillStyle = sky === 'night' ? '#2b3a66' : sky === 'cloudy' ? '#e6eaee' : sky === 'rainy' ? '#586170' : th.cloud;
  ctx2.globalAlpha = sky === 'night' ? 0.7 : over ? 0.85 : 0.55;
  for (const c of over ? SKY_CLOUDS.concat(SKY_CLOUDS2) : SKY_CLOUDS) {
    const x =
        ((((c.x + t * (8 + wind * 114) - CAM.x * 0.12) % (VW + 500)) + VW + 500) % (VW + 500)) - 250,
      y = c.y * 1.3 - CAM.y * 0.06;
    ctx2.beginPath();
    ctx2.ellipse(x, y, 70 * c.s, 20 * c.s, 0, 0, TAU);
    ctx2.ellipse(x + 40 * c.s, y - 12 * c.s, 40 * c.s, 20 * c.s, 0, 0, TAU);
    ctx2.ellipse(x - 38 * c.s, y - 6 * c.s, 34 * c.s, 16 * c.s, 0, 0, TAU);
    ctx2.fill();
  }
  ctx2.globalAlpha = 1;
  for (let L = 0; L < 2; L++) {
    const par = 0.1 + L * 0.12,
      base = VH * (0.72 + L * 0.08) - CAM.y * par * 0.4;
    ctx2.fillStyle = sky === 'night' ? (L ? 'rgba(2,6,24,.5)' : 'rgba(2,6,24,.35)') : L ? 'rgba(10,20,40,.22)' : 'rgba(10,20,40,.13)';
    ctx2.beginPath();
    ctx2.moveTo(0, VH);
    for (let x = 0; x <= VW; x += 24) {
      const wx = x + CAM.x * par;
      ctx2.lineTo(
        x,
        base - (Math.sin(wx * 0.004 + L * 2) * 50 + Math.sin(wx * 0.011 + L) * 22 + 60)
      );
    }
    ctx2.lineTo(VW, VH);
    ctx2.fill();
  }
}
/**
 * Screen-space weather drawn over the finished world (device pixels): a colour tint for night / overcast
 * skies and, when rainy, slanted raindrops (they lean with the wind) and now and then a distant flash.
 */
function drawSkyOverlay() {
  const sky = T.sky || 'day';
  if (sky === 'day') return;
  const w = cvs.width,
    h = cvs.height;
  ctx2.save();
  ctx2.setTransform(1, 0, 0, 1, 0, 0);
  ctx2.fillStyle = sky === 'night' ? 'rgba(6,12,44,.30)' : sky === 'cloudy' ? 'rgba(110,120,135,.12)' : 'rgba(30,45,70,.22)';
  ctx2.fillRect(0, 0, w, h);
  if (sky === 'rainy') {
    const t = G ? G.time : 0,
      lean = 0.2 + (G ? G.wind : 0) * 0.35,
      d = typeof DPR === 'number' ? DPR : 1;
    ctx2.strokeStyle = 'rgba(200,220,245,.5)';
    ctx2.lineWidth = Math.max(1, 1.2 * d);
    ctx2.beginPath();
    for (const r of SKY_RAIN) {
      const y = (((r.y * h + t * r.v * d) % (h + 40 * d)) + h + 40 * d) % (h + 40 * d) - 20 * d,
        x = (((r.x * w + y * lean * 0.6) % w) + w) % w;
      ctx2.moveTo(x, y);
      ctx2.lineTo(x - r.l * lean * d, y + r.l * d);
    }
    ctx2.stroke();
    if (G && !G.demo && Math.random() < 0.0007) {
      UI.flash = '#cfd8ff';
      UI.flashA = 0.35;
    }
  }
  ctx2.restore();
}
/** Animated water body. Drawn twice: behind the terrain and, semi-transparent, in front of it. */
function drawWater(front) {
  const th = T.theme,
    y0 = G.waterY,
    t = G.time,
    x0 = CAM.x - VW / CAM.s / 2 - 20,
    x1 = CAM.x + VW / CAM.s / 2 + 20,
    yb = CAM.y + VH / CAM.s / 2 + 40;
  const g = ctx2.createLinearGradient(0, y0, 0, y0 + 160);
  g.addColorStop(0, th.water[0]);
  g.addColorStop(1, th.water[1]);
  ctx2.fillStyle = g;
  ctx2.globalAlpha = front ? 0.82 : 1;
  ctx2.beginPath();
  ctx2.moveTo(x0, yb);
  const off = front ? 6 : 0,
    ph = front ? 1.7 : 0;
  for (let x = x0; x <= x1; x += 12)
    ctx2.lineTo(
      x,
      y0 + off + Math.sin(x * 0.03 + t * 1.8 + ph) * 3 + Math.sin(x * 0.011 + t * 1.1) * 2
    );
  ctx2.lineTo(x1, yb);
  ctx2.fill();
  ctx2.globalAlpha = 1;
}
/**
 * Stylised mushroom cloud of the Nuclear Test, drawn behind the terrain (screen space, with a
 * little parallax). Timeline over NUKE_TIME seconds: flash and shock ring on the horizon, a stem
 * rising, a lobed fiery cap blooming, then everything fades into dark smoke.
 */
function drawNuke() {
  const n = FX.nuke;
  if (!n) return;
  const k = n.t / NUKE_TIME,
    grow = 1 - Math.pow(1 - Math.min(1, n.t / 3.2), 3), // fast start, slow finish
    fade = k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1,
    cool = clamp((n.t - 1) / 5, 0, 1), // fire -> smoke colour mix
    bx = VW * 0.5 - CAM.x * 0.05,
    by = VH * 0.82 - CAM.y * 0.1,
    H = VH * 0.48 * grow, // stem height
    sw = VH * 0.07 * (0.6 + 0.4 * grow), // stem half-width at the base
    capR = VH * 0.16 * (0.35 + 0.65 * grow),
    cy = by - H - capR * 0.15;
  const mix = (a, b) => Math.round(a + (b - a) * cool),
    fire = (l, al) => `rgba(${mix(255, 90)},${mix(l, 50)},${mix(40 + l * 0.2, 55)},${al})`;
  ctx2.save();
  ctx2.globalAlpha = fade;
  // Sky glow
  const glow = ctx2.createRadialGradient(bx, cy, 0, bx, cy, VH * 0.9);
  glow.addColorStop(0, `rgba(255,200,120,${0.55 * (1 - cool * 0.7)})`);
  glow.addColorStop(1, 'rgba(255,120,40,0)');
  ctx2.fillStyle = glow;
  ctx2.fillRect(0, 0, VW, VH);
  // Shock ring racing along the horizon
  const ring = clamp(n.t / 2.6, 0, 1);
  if (ring < 1) {
    ctx2.strokeStyle = `rgba(255,246,208,${0.8 * (1 - ring)})`;
    ctx2.lineWidth = 3 + 9 * (1 - ring);
    ctx2.beginPath();
    ctx2.ellipse(bx, by, VW * 0.75 * ring, VH * 0.05 * ring, 0, 0, TAU);
    ctx2.stroke();
  }
  // Stem: tapered column with bulging puffs
  ctx2.fillStyle = fire(120, 0.95);
  ctx2.strokeStyle = 'rgba(40,16,10,.55)';
  ctx2.lineWidth = 3;
  ctx2.beginPath();
  ctx2.moveTo(bx - sw * 1.6, by);
  ctx2.bezierCurveTo(
    bx - sw * 0.5,
    by - H * 0.2,
    bx - sw * 0.45,
    by - H * 0.6,
    bx - sw * 0.7,
    cy + capR * 0.3
  );
  ctx2.lineTo(bx + sw * 0.7, cy + capR * 0.3);
  ctx2.bezierCurveTo(bx + sw * 0.45, by - H * 0.6, bx + sw * 0.5, by - H * 0.2, bx + sw * 1.6, by);
  ctx2.closePath();
  ctx2.fill();
  ctx2.stroke();
  for (let i = 0; i < 5; i++) {
    const f = (i + 0.5) / 5,
      wob = Math.sin(n.t * 2 + i * 1.7) * sw * 0.15;
    ctx2.fillStyle = fire(150 - i * 14, 0.8);
    ctx2.beginPath();
    ctx2.ellipse(bx + wob, by - H * f * 0.9, sw * (1.2 - f * 0.5), sw * 0.55, 0, 0, TAU);
    ctx2.fill();
  }
  // Ground fireball at the base
  ctx2.fillStyle = fire(170, 0.9);
  ctx2.beginPath();
  ctx2.ellipse(bx, by, sw * 3.2 * (0.5 + 0.5 * grow), sw * 0.9, 0, Math.PI, TAU);
  ctx2.fill();
  // Cap: overlapping lobes (dark underskirt first, bright core last)
  ctx2.fillStyle = fire(80, 0.95);
  ctx2.beginPath();
  ctx2.ellipse(bx, cy + capR * 0.35, capR * 1.15, capR * 0.32, 0, 0, TAU);
  ctx2.fill();
  const lobes = 7;
  for (let i = 0; i < lobes; i++) {
    const a = Math.PI + (i / (lobes - 1)) * Math.PI,
      pulse = 1 + Math.sin(n.t * 2.4 + i * 1.3) * 0.05,
      lx = bx + Math.cos(a) * capR * 0.82,
      ly = cy + Math.sin(a) * capR * 0.55 + capR * 0.1,
      lr = capR * (0.42 + 0.1 * Math.sin(i * 2.1)) * pulse;
    ctx2.fillStyle = fire(110 + (i % 3) * 25, 0.97);
    ctx2.strokeStyle = 'rgba(40,16,10,.5)';
    ctx2.lineWidth = 3;
    ctx2.beginPath();
    ctx2.arc(lx, ly, lr, 0, TAU);
    ctx2.fill();
    ctx2.stroke();
  }
  const core = ctx2.createRadialGradient(bx, cy - capR * 0.1, 0, bx, cy - capR * 0.1, capR * 0.95);
  core.addColorStop(0, `rgba(255,250,200,${1 - cool * 0.6})`);
  core.addColorStop(0.5, fire(190, 0.9));
  core.addColorStop(1, fire(110, 0));
  ctx2.fillStyle = core;
  ctx2.beginPath();
  ctx2.arc(bx, cy - capR * 0.05, capR * 0.95, 0, TAU);
  ctx2.fill();
  ctx2.restore();
}
/**
 * Debug view (toggle with F3 or `): draws what the physics really sees. Every body gets its
 * collision circle, the 8 probe points used by hitC (red = touching ground, green = free), its
 * bounding box and a velocity vector; worms show grounded/airborne, crates show landed/falling,
 * and a terrain pixel grid is outlined around the active worm.
 */
function drawDebug() {
  const S = CAM.s,
    lw = 1.2 / S;
  const body = (b, col, label) => {
    ctx2.lineWidth = lw;
    // bounding box (axis aligned square around the circle)
    ctx2.strokeStyle = 'rgba(255,255,0,.8)';
    ctx2.strokeRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    // collision circle
    ctx2.strokeStyle = col;
    ctx2.beginPath();
    ctx2.arc(b.x, b.y, b.r, 0, TAU);
    ctx2.stroke();
    // probe points: centre + ring
    const pts = [[0, 0]].concat(RING.map(([cx, cy]) => [cx * b.r, cy * b.r]));
    for (const [dx, dy] of pts) {
      ctx2.fillStyle = solid(b.x + dx, b.y + dy) ? '#ff3030' : '#30ff60';
      ctx2.fillRect(b.x + dx - 1.2 / S, b.y + dy - 1.2 / S, 2.4 / S, 2.4 / S);
    }
    // velocity (0.25 s ahead)
    if (b.vx || b.vy) {
      ctx2.strokeStyle = '#00d0ff';
      ctx2.beginPath();
      ctx2.moveTo(b.x, b.y);
      ctx2.lineTo(b.x + b.vx * 0.25, b.y + b.vy * 0.25);
      ctx2.stroke();
    }
    // ground-contact sample points used by groundBelow
    ctx2.fillStyle = groundBelow(b.x, b.y, b.r) ? '#30ff60' : '#ff3030';
    for (const ox of [-3, 0, 3])
      ctx2.fillRect(b.x + ox - 1 / S, b.y + b.r + 1.5 - 1 / S, 2 / S, 2 / S);
    if (label) {
      ctx2.fillStyle = '#fff';
      ctx2.font = `${10 / S}px monospace`;
      ctx2.fillText(label, b.x + b.r + 3 / S, b.y - b.r);
    }
  };
  for (const w of G.worms)
    if (!w.dead) body(w, w.grounded ? '#30ff60' : '#ff9a30', (w.grounded ? 'G ' : 'A ') + w.hp);
  for (const p of G.projs) body(p, '#ff5ad0', p.t);
  for (const o of G.objs)
    body(
      o,
      o.landed || o.k === 'drum' ? '#30ff60' : '#ff9a30',
      o.k === 'crate' ? (o.landed ? 'landed' : 'falling') : o.k
    );
  ctx2.fillStyle = '#ffa030';
  for (const f of G.fires) ctx2.fillRect(f.x - 1, f.y - 1, 2, 2);
  // terrain mask around the active worm, one square per solid pixel (zoom in to read it)
  const aw = activeWorm();
  if (aw && S > 1.4) {
    ctx2.fillStyle = 'rgba(255,60,60,.35)';
    for (let y = Math.floor(aw.y) - 20; y < aw.y + 20; y++)
      for (let x = Math.floor(aw.x) - 20; x < aw.x + 20; x++)
        if (solid(x, y)) ctx2.fillRect(x, y, 1, 1);
  }
  // world border
  ctx2.strokeStyle = 'rgba(255,255,255,.4)';
  ctx2.strokeRect(0, 0, T.w, T.h);
  ctx2.setLineDash([6 / S, 6 / S]);
  ctx2.strokeStyle = 'rgba(80,160,255,.8)';
  ctx2.beginPath();
  ctx2.moveTo(0, G.waterY);
  ctx2.lineTo(T.w, G.waterY);
  ctx2.stroke();
  ctx2.setLineDash([]);
}
/**
 * F4 debug: impact line of a straight-line weapon at the current aim / cursor, or null when the selected weapon is not one.
 * Uses the very same geometry as the weapons: ray() for the hitscan guns, kameGeom() for the Kamehameha, lightningRay()
 * for Thor's Hammer, streamRay() for the Proton Stream. `end` is where it stops; `hit` what it stops on; `w` the half
 * width of the line (the Kamehameha tunnel).
 */
const LINEAR_RANGE = { shotgun: 330, handgun: 300, uzi: 280 };
const LINEAR_MELEE = { firepunch: 24, dragonball: 34, bat: 22 };
/** Walks from (x, y) along (dx, dy) in 3 px steps up to `len`; stops at the first solid pixel (or worm when `worms`). */
function dbgWalk(x, y, dx, dy, len, skip, worms) {
  let d = 0;
  for (; d < len; d += 3) {
    const px = x + dx * (d + 3), py = y + dy * (d + 3);
    if (worms && G.worms.some(o => !o.dead && o !== skip && Math.abs(o.x - px) < 6 && Math.abs(o.y - py) < 8)) return { x: px, y: py, hit: 'worm' };
    if (solid(px, py)) return { x: px, y: py, hit: 'ground' };
  }
  return { x: x + dx * len, y: y + dy * len, hit: null };
}
function linearShot(aw, id) {
  const [dx, dy] = aimDir(aw), f = aw.face || 1;
  const line = (x1, y1, e, extra) => Object.assign({ x1, y1, x2: e.x, y2: e.y, hit: e.hit, w: 0 }, extra);
  if (LINEAR_RANGE[id]) return line(aw.x + dx * 8, aw.y - 2 + dy * 8, dbgWalk(aw.x + dx * 8, aw.y - 2 + dy * 8, dx, dy, LINEAR_RANGE[id], aw, true));
  if (LINEAR_MELEE[id]) {
    const bat = id === 'bat', ux = bat ? dx : f, uy = bat ? dy : 0, L = LINEAR_MELEE[id];
    return line(aw.x, aw.y - 2, { x: aw.x + ux * L, y: aw.y - 2 + uy * L, hit: null }, { r: L });
  }
  if (id === 'kamehameha') {
    const g = kameGeom(aw), ex = Math.cos(g.a), ey = Math.sin(g.a);
    // the beam is longer than the level: draw it up to the map border
    let bd = g.L;
    if (ex > 1e-6) bd = Math.min(bd, (T.w - g.ox) / ex); else if (ex < -1e-6) bd = Math.min(bd, -g.ox / ex);
    if (ey > 1e-6) bd = Math.min(bd, (T.h - g.oy) / ey); else if (ey < -1e-6) bd = Math.min(bd, -g.oy / ey);
    bd = Math.max(0, bd);
    let d = KAME_START, hit = null;
    // the beam carves through terrain, so only worms are marked on the way; the first ground it meets starts the tunnel
    for (; d < bd; d += 3)
      if (G.worms.some(o => !o.dead && o !== aw && segDist(o.x, o.y, g.ox, g.oy, g.ox + ex * d, g.oy + ey * d) < KAME_R * g.lv + (o.r || 6) && Math.hypot(o.x - g.ox, o.y - g.oy) <= d + KAME_R * g.lv)) { hit = 'worm'; break; }
    d = Math.min(d, bd);
    const gr = dbgWalk(g.ox, g.oy, ex, ey, bd, aw, false);
    return { x1: g.ox, y1: g.oy, x2: g.ox + ex * bd, y2: g.oy + ey * bd, mx: g.ox + ex * d, my: g.oy + ey * d, gx: gr.hit ? gr.x : undefined, gy: gr.y, hit, w: KAME_R * g.lv };
  }
  if (id === 'hammer') {
    let tw = null, best = 70;
    for (const o of G.worms) {
      if (o.dead || o === aw) continue;
      const d = Math.hypot(o.x - UI.mx, o.y - UI.my);
      if (d < best) { best = d; tw = o; }
    }
    const x = clamp(tw ? tw.x : UI.mx, 8, T.w - 8);
    let y = tw ? tw.y : surfaceAt(x);
    if (y == null) y = G.waterY - 4;
    const x1 = aw.x + f * 7, y1 = aw.y - 38 - 8;
    return line(x1, y1, lightningRay(x1, y1, x, y, aw.id), { r: 20 });
  }
  if (id === 'proton') {
    let tw = null, best = 70;
    for (const o of G.worms) {
      if (o.dead || o.team === aw.team) continue;
      const d = Math.hypot(o.x - UI.mx, o.y - UI.my);
      if (d < best) { best = d; tw = o; }
    }
    if (!tw) return null;
    const sf = tw.x >= aw.x ? 1 : -1, mx = aw.x + sf * 9, my = aw.y - 4, d = Math.hypot(tw.x - mx, tw.y - my),
      k = d > PROTON_RANGE ? PROTON_RANGE / d : 1;
    return line(mx, my, streamRay(mx, my, mx + (tw.x - mx) * k, my + (tw.y - my) * k, [aw.id]));
  }
  if (id === 'rope') return line(aw.x, aw.y - 4, dbgWalk(aw.x, aw.y - 4, dx, dy, 290, aw, false));
  if (id === 'supersheep') return line(aw.x + dx * 10, aw.y - 6 + dy * 10, dbgWalk(aw.x + dx * 10, aw.y - 6 + dy * 10, dx, dy, 900, aw, false));
  if (id === 'kamikaze') return line(aw.x, aw.y, dbgWalk(aw.x, aw.y, dx, dy, 320 * 1.3, aw, false), { r: 42 });
  if (id === 'blowtorch') return line(aw.x + f * 11, aw.y, { x: aw.x + f * (11 + 38 * 5), y: aw.y, hit: null }, { w: 10 });
  if (id === 'drill') return line(aw.x, aw.y + 9, { x: aw.x, y: aw.y + 9 + 70 * 5, hit: null }, { w: 10 });
  if (id === 'onigiri') return line(aw.x, aw.y, { x: aw.x + f * (ONI_REACH + ONI_SAFE), y: aw.y, hit: null }, { w: 16 });
  if (id === 'hokuto') return line(aw.x, aw.y, { x: aw.x + f * HYAKU_REACH, y: aw.y, hit: null }, { w: 18 });
  if (id === 'gigantaxe') {
    const sp = axeSpot(aw);
    return line(sp.x, sp.y - AXE_H, { x: sp.x, y: sp.y, hit: 'ground' }, { w: AXE_R });
  }
  return null;
}
/** Recorded flight paths for the debug view: projectile id -> {pts, col, gone}. */
const DBG_PATHS = new Map();
/**
 * Debug trajectories (F4 while the debug view is on). Three things are drawn:
 *  - the real path of every projectile and of the active worm, recorded frame by frame and kept
 *    for 8 s after the projectile is gone;
 *  - the impact line of straight-line weapons (linearShot);
 *  - a prediction of the selected weapon's shot at the current aim (and at the current charge, or
 *    full power when not charging), simulated with the same physics and terrain collision.
 * Weapons opt in to the prediction through `fire.launch = {type, lo, hi}` (set by throwP()).
 */
function drawTrajectories() {
  const S = CAM.s,
    now = G.time;
  const rec = (key, x, y, col) => {
    let r = DBG_PATHS.get(key);
    if (!r) DBG_PATHS.set(key, (r = { pts: [], col, gone: 0 }));
    r.gone = 0;
    const l = r.pts[r.pts.length - 1];
    if (!l || Math.hypot(l[0] - x, l[1] - y) > 2) {
      r.pts.push([x, y]);
      if (r.pts.length > 900) r.pts.shift();
    }
  };
  for (const p of G.projs) rec('p' + p.id, p.x, p.y, '#ff5ad0');
  const aw = activeWorm();
  if (aw && !aw.dead && (G.phase === 'turn' || G.phase === 'retreat'))
    rec('w' + aw.id + ':' + G.round, aw.x, aw.y - 2, '#30ff60');
  ctx2.lineWidth = 1.4 / S;
  for (const [k, r] of DBG_PATHS) {
    if (k[0] === 'p' && !G.projs.some(p => 'p' + p.id === k)) r.gone = (r.gone || 0) + 1 / 60;
    if (k[0] === 'w' && !k.endsWith(':' + G.round)) r.gone = (r.gone || 0) + 1 / 30;
    if (r.gone > 8) {
      DBG_PATHS.delete(k);
      continue;
    }
    ctx2.globalAlpha = Math.max(0.15, 1 - r.gone / 8);
    ctx2.strokeStyle = r.col;
    ctx2.beginPath();
    r.pts.forEach(([x, y], i) => (i ? ctx2.lineTo(x, y) : ctx2.moveTo(x, y)));
    ctx2.stroke();
  }
  ctx2.globalAlpha = 1;
  // impact line of the straight-line weapons (hitscan guns, Kamehameha, Thor's Hammer, Proton Stream)
  const lin = aw && !aw.dead && G.weapon && (G.phase === 'turn' || (G.phase === 'retreat' && aw.tool)) && linearShot(aw, aw.tool && aw.tool.k === 'kame' ? 'kamehameha' : G.weapon.id);
  if (lin) {
    const a = Math.atan2(lin.y2 - lin.y1, lin.x2 - lin.x1), nx = -Math.sin(a) * lin.w, ny = Math.cos(a) * lin.w,
      ix = lin.mx === undefined ? lin.x2 : lin.mx, iy = lin.my === undefined ? lin.y2 : lin.my;
    // the visible part of a very long line stops at the map border
    let ex = lin.x2, ey = lin.y2;
    const path = () => {
      ctx2.beginPath();
      ctx2.moveTo(lin.x1, lin.y1);
      ctx2.lineTo(ex, ey);
      if (lin.w) {
        ctx2.moveTo(lin.x1 + nx, lin.y1 + ny); ctx2.lineTo(ex + nx, ey + ny);
        ctx2.moveTo(lin.x1 - nx, lin.y1 - ny); ctx2.lineTo(ex - nx, ey - ny);
      }
    };
    ctx2.lineCap = 'round';
    ctx2.setLineDash([]);
    ctx2.strokeStyle = '#4ad8ff';
    ctx2.lineWidth = 2.2 / S;
    ctx2.setLineDash([8 / S, 5 / S]);
    path();
    ctx2.stroke();
    ctx2.setLineDash([]);
    // markers: where it first meets ground (orange, Kamehameha) and where it ends / hits (red), with a label
    const mark = (x, y, col, r) => {
      ctx2.strokeStyle = col; ctx2.lineWidth = 2.2 / S;
      ctx2.beginPath(); ctx2.arc(x, y, r, 0, TAU); ctx2.moveTo(x - r - 4, y); ctx2.lineTo(x + r + 4, y); ctx2.moveTo(x, y - r - 4); ctx2.lineTo(x, y + r + 4); ctx2.stroke();
    };
    if (lin.gx !== undefined) mark(lin.gx, lin.gy, '#ffa020', 7);
    mark(ix, iy, '#ff3030', Math.min(lin.r || 8, 60));
  }
  // prediction of the selected weapon
  const d = G.weapon && WEAPONS[G.weapon.id];
  if (!aw || aw.dead || !d || !d.fire.launch || G.phase !== 'turn') return;
  const { type, lo, hi } = d.fire.launch,
    pt = PTYPES[type],
    power = G.weapon.pw > 0 ? G.weapon.pw : 1,
    sp = lo + (hi - lo) * power,
    [mx, my, dx, dy] = muzzle(aw),
    ly = d.fire.launch.lift || 0,
    g = { x: mx, y: my - ly, vx: dx * sp, vy: dy * sp, r: pt.r || 3, bounce: pt.bounce || 0, fric: pt.fric == null ? 0.85 : pt.fric };
  let fuse = pt.fuse != null ? (d.fuse ? G.weapon.fuse : pt.fuse) : null,
    t = 0;
  ctx2.strokeStyle = '#ffe04a';
  ctx2.setLineDash([5 / S, 4 / S]);
  ctx2.beginPath();
  ctx2.moveTo(g.x, g.y);
  let end = null;
  for (let i = 0; i < 60 * 8; i++) {
    const dt = 1 / 60;
    g.vy += GRAV * (pt.grav == null ? 1 : pt.grav) * dt;
    if (pt.wind) g.vx += G.wind * WIND_ACC * pt.wind * dt;
    const c = stepBody(g, dt);
    ctx2.lineTo(g.x, g.y);
    t += dt;
    if ((c && pt.hit) || g.y > G.waterY || g.x < -200 || g.x > T.w + 200) {
      end = [g.x, g.y];
      break;
    }
    if (fuse != null && t >= fuse) {
      end = [g.x, g.y];
      break;
    }
  }
  ctx2.stroke();
  ctx2.setLineDash([]);
  if (end) {
    ctx2.strokeStyle = '#ff4040';
    ctx2.beginPath();
    ctx2.arc(end[0], end[1], (pt.expl ? pt.expl.r : pt.mark || 10), 0, TAU);
    ctx2.stroke();
  }
}
/** Text block of the debug view: phase, timers and, while settling, what is blocking the turn change. */
function debugText() {
  const aw = activeWorm();
  const lines = [
    `phase ${G.phase}  round ${G.round + 1}  timer ${G.timer.toFixed(1)}`,
    `worms ${G.worms.filter(w => !w.dead).length}  projs ${G.projs.length}  objs ${G.objs.length}  fires ${G.fires.length}`,
    `water ${G.waterY.toFixed(0)} -> ${G.waterTarget.toFixed(0)}`,
    `trajectories (F4): ${UI.traj ? 'on' : 'off'}`,
  ];
  if (G.phase === 'settle')
    lines.push(`settle ${G.settleT.toFixed(1)} s  blocked by: ${quietBlocker() || 'nothing'}`);
  if (aw)
    lines.push(
      `active ${aw.name}  ${aw.x.toFixed(1)},${aw.y.toFixed(1)}  v ${aw.vx.toFixed(0)},${aw.vy.toFixed(0)}  ${aw.grounded ? 'grounded' : 'airborne'}`
    );
  return lines.join('\n');
}
/**
 * Draws one complete frame: sky, world (water, terrain, objects, projectiles, worms, fire, effects,
 * labels, targeting previews) in world space with camera and screen shake, then the flash overlay.
 */
function render() {
  if (!G) {
    ctx2.setTransform(1, 0, 0, 1, 0, 0);
    ctx2.fillStyle = '#0d1a2b';
    ctx2.fillRect(0, 0, cvs.width, cvs.height);
    return;
  }
  ctx2.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawSky();
  themeFxSky();
  drawNuke();
  const sh = UI.shake,
    ox = (Math.random() - 0.5) * sh,
    oy = (Math.random() - 0.5) * sh,
    S = CAM.s;
  ctx2.setTransform(
    DPR * S,
    0,
    0,
    DPR * S,
    DPR * (VW / 2 - CAM.x * S + ox),
    DPR * (VH / 2 - CAM.y * S + oy)
  );
  drawWater(false);
  ctx2.drawImage(T.cv, 0, 0);
  themeFxWorld();
  for (const o of G.objs) drawObj(o);
  for (const p of G.projs) spriteProj(p);
  for (const w of G.worms) drawWorm(w);
  // ropes
  for (const w of G.worms)
    if (w.rope && !w.dead) {
      ctx2.strokeStyle = '#d9c28a';
      ctx2.lineWidth = 1.4;
      ctx2.beginPath();
      ctx2.moveTo(w.x, w.y - 3);
      ctx2.lineTo(w.rope.ax, w.rope.ay);
      ctx2.stroke();
      ctx2.fillStyle = '#888';
      ctx2.beginPath();
      ctx2.arc(w.rope.ax, w.rope.ay, 2.2, 0, TAU);
      ctx2.fill();
    }
  for (const f of G.fires) {
    const fl = 0.6 + Math.random() * 0.6;
    ctx2.fillStyle = Math.random() < 0.5 ? '#ffb02e' : '#ff5a1f';
    ctx2.beginPath();
    ctx2.arc(f.x, f.y - 1, 2.2 * fl, 0, TAU);
    ctx2.fill();
  }
  for (const t of FX.tracers) {
    ctx2.strokeStyle = '#fff6c0';
    ctx2.lineWidth = 1.4;
    ctx2.globalAlpha = t.l / 0.12;
    ctx2.beginPath();
    ctx2.moveTo(t.x1, t.y1);
    ctx2.lineTo(t.x2, t.y2);
    ctx2.stroke();
    ctx2.globalAlpha = 1;
  }
  for (const r of FX.rings) {
    const k = r.t / 0.45;
    ctx2.strokeStyle = r.big ? '#fff' : '#ffe9a0';
    ctx2.globalAlpha = 1 - k;
    ctx2.lineWidth = 4 * (1 - k) + 1;
    ctx2.beginPath();
    ctx2.arc(r.x, r.y, r.r * (0.4 + k * 1.1), 0, TAU);
    ctx2.stroke();
    ctx2.globalAlpha = 1;
  }
  drawSlab();
  for (const p of FX.p) {
    if (p.wait > 0) continue;
    const a = clamp(p.l / p.m, 0, 1);
    ctx2.globalAlpha = p.k === 's' ? a * 0.45 : a;
    ctx2.fillStyle = p.c;
    if (p.k === 'd') ctx2.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    else {
      ctx2.beginPath();
      ctx2.arc(p.x, p.y, p.s, 0, TAU);
      ctx2.fill();
    }
  }
  ctx2.globalAlpha = 1;
  for (const wv of FX.waves) {
    // Giant wave: a wall of water whose height at the front shrinks the further inland it gets.
    const front = TSU_START + TSU_SPEED * wv.t,
      h0 = wv.H0 * Math.max(0, 1 - front / wv.D);
    if (h0 < 4) continue;
    const X = d => (wv.dir > 0 ? d : T.w - d),
      base = G.waterY + 40,
      L = 460,
      N = 28;
    const top = k => G.waterY - h0 * (0.22 + 0.78 * Math.pow(k, 1.8)) + Math.sin(k * 14 + wv.t * 9) * 5;
    ctx2.save();
    const gr = ctx2.createLinearGradient(0, G.waterY - h0, 0, base);
    gr.addColorStop(0, 'rgba(150,215,255,.92)');
    gr.addColorStop(0.35, 'rgba(40,130,200,.9)');
    gr.addColorStop(1, 'rgba(10,60,120,.95)');
    ctx2.fillStyle = gr;
    ctx2.beginPath();
    ctx2.moveTo(X(front - L), base);
    for (let i = 0; i <= N; i++) {
      const k = i / N;
      ctx2.lineTo(X(front - L * (1 - k)), top(k));
    }
    ctx2.lineTo(X(front + 12), base);
    ctx2.closePath();
    ctx2.fill();
    // foam along the crest and bubbles at the front
    ctx2.strokeStyle = 'rgba(255,255,255,.95)';
    ctx2.lineWidth = 6;
    ctx2.lineJoin = 'round';
    ctx2.beginPath();
    for (let i = 0; i <= N; i++) {
      const k = i / N,
        x = X(front - L * (1 - k));
      i ? ctx2.lineTo(x, top(k)) : ctx2.moveTo(x, top(k));
    }
    ctx2.stroke();
    ctx2.fillStyle = 'rgba(255,255,255,.9)';
    for (let i = 0; i < 14; i++) {
      const k = 0.55 + 0.45 * ((i * 0.37 + wv.t * 1.3) % 1),
        x = X(front - L * (1 - k)) + Math.sin(i * 5 + wv.t * 8) * 8;
      ctx2.beginPath();
      ctx2.arc(x, top(k) - 4 - (i % 3) * 6, 5 + (i % 4) * 2, 0, TAU);
      ctx2.fill();
    }
    ctx2.restore();
  }
  for (const s of FX.storms) {
    // a dark cloud gathers above the target and flickers before the strike
    const k = Math.min(1, s.t / 0.6) * Math.min(1, (s.l - s.t) / 0.3 + 0.2);
    ctx2.save();
    ctx2.globalAlpha = 0.85 * k;
    for (let i = 0; i < 7; i++) {
      const gx = s.x + (i - 3) * 30 + Math.sin(s.t * 2 + i) * 6;
      ctx2.fillStyle = i % 2 ? '#3b4352' : '#2a303c';
      ctx2.beginPath();
      ctx2.arc(gx, -34 + Math.abs(i - 3) * 4, 26 - Math.abs(i - 3) * 2, 0, TAU);
      ctx2.fill();
    }
    if (Math.sin(s.t * 23) > 0.7) {
      ctx2.fillStyle = 'rgba(200,225,255,.35)';
      ctx2.fillRect(s.x - 110, -62, 220, 50)
    }
    ctx2.restore();
  }
  for (const b of FX.bolts) {
    ctx2.save();
    ctx2.globalAlpha = Math.max(0, 1 - b.t / 0.35);
    ctx2.lineJoin = 'round';
    ctx2.shadowColor = '#7fc4ff';
    ctx2.shadowBlur = 14;
    for (const [col, lw] of [
      ['#9fd2ff', 6],
      ['#ffffff', 2.2],
    ]) {
      ctx2.strokeStyle = col;
      ctx2.lineWidth = lw;
      ctx2.beginPath();
      b.pts.forEach(([x, y], i) => (i ? ctx2.lineTo(x, y) : ctx2.moveTo(x, y)));
      ctx2.stroke();
    }
    ctx2.restore();
  }
  for (const f of FX.flats || []) {
    const tm = G.teams[f.team];
    ctx2.save();
    ctx2.globalAlpha = Math.min(1, (2 - f.t) / 0.6);
    ctx2.fillStyle = (tm && tm.color) || '#f4a6b8';
    ctx2.strokeStyle = '#0c1524';
    ctx2.lineWidth = 1.2;
    ctx2.beginPath();
    ctx2.ellipse(f.x, f.y + 4, 15, 2.6, 0, 0, TAU);
    ctx2.fill();
    ctx2.stroke();
    ctx2.restore();
  }
  for (const s of FX.slashes || []) {
    // three parallel cuts that flash across the sliced worm and fade
    const k = s.t / 0.3,
      len = 34 * Math.min(1, k * 4),
      ang = s.f > 0 ? 0.9 : Math.PI - 0.9;
    ctx2.save();
    ctx2.globalAlpha = Math.max(0, 1 - k);
    ctx2.lineCap = 'round';
    ctx2.shadowColor = '#fff';
    ctx2.shadowBlur = 10;
    ctx2.strokeStyle = '#fff';
    ctx2.lineWidth = 2;
    for (const off of [-7, 0, 7]) {
      const cx = s.x - Math.sin(ang) * off,
        cy = s.y + Math.cos(ang) * off;
      ctx2.beginPath();
      ctx2.moveTo(cx - Math.cos(ang) * len, cy - Math.sin(ang) * len);
      ctx2.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
      ctx2.stroke();
    }
    ctx2.restore();
  }
  for (const p of FX.planes) {
    ctx2.save();
    ctx2.translate(p.x, -110);
    ctx2.scale(p.dir, 1);
    ctx2.fillStyle = '#4a5260';
    ctx2.beginPath();
    ctx2.ellipse(0, 0, 30, 7, 0, 0, TAU);
    ctx2.fill();
    ctx2.fillRect(-6, -2, 14, 3);
    ctx2.beginPath();
    ctx2.moveTo(-3, 0);
    ctx2.lineTo(-14, 16);
    ctx2.lineTo(2, 0);
    ctx2.fill();
    ctx2.fillRect(-30, -12, 8, 12);
    ctx2.fillStyle = '#9fd0ff';
    ctx2.beginPath();
    ctx2.ellipse(14, -3, 8, 4, 0, 0, TAU);
    ctx2.fill();
    ctx2.restore();
  }
  drawWater(true);
  if (UI.debug) {
    drawDebug();
    if (UI.traj) drawTrajectories();
  }
  const aw = activeWorm();
  if (aw) {
    drawAim(aw);
  }
  for (const w of G.worms) drawWormLabel(w);
  if (aw) drawHeldWeaponBox(aw);
  // targeting previews
  const myTurn = isMyTurn();
  if (myTurn && aw && G.phase === 'turn') {
    const d = WEAPONS[G.weapon.id];
    if (d && d.id === 'girder') {
      ctx2.save();
      ctx2.translate(UI.mx, UI.my);
      ctx2.rotate((UI.ang * Math.PI) / 8);
      ctx2.fillStyle = 'rgba(160,180,210,.6)';
      ctx2.strokeStyle = '#fff';
      ctx2.lineWidth = 1;
      ctx2.fillRect(-32, -3.5, 64, 7);
      ctx2.strokeRect(-32, -3.5, 64, 7);
      ctx2.restore();
    } else if (d && d.click) {
      ctx2.strokeStyle = '#ff6a6a';
      ctx2.lineWidth = 2 / S;
      ctx2.beginPath();
      ctx2.arc(UI.mx, UI.my, 9, 0, TAU);
      ctx2.moveTo(UI.mx - 14, UI.my);
      ctx2.lineTo(UI.mx + 14, UI.my);
      ctx2.moveTo(UI.mx, UI.my - 14);
      ctx2.lineTo(UI.mx, UI.my + 14);
      ctx2.stroke();
    }
  }
  if (G.weapon.tx != null) {
    ctx2.strokeStyle = '#ff4a3a';
    ctx2.lineWidth = 2 / S;
    const k = 1 + Math.sin(G.time * 8) * 0.15;
    ctx2.beginPath();
    ctx2.arc(G.weapon.tx, G.weapon.ty, 10 * k, 0, TAU);
    ctx2.moveTo(G.weapon.tx - 14, G.weapon.ty);
    ctx2.lineTo(G.weapon.tx + 14, G.weapon.ty);
    ctx2.moveTo(G.weapon.tx, G.weapon.ty - 14);
    ctx2.lineTo(G.weapon.tx, G.weapon.ty + 14);
    ctx2.stroke();
  }
  for (const t of FX.txt) {
    ctx2.globalAlpha = clamp(t.l, 0, 1);
    ctx2.font = `700 ${16 / S}px 'Barlow Condensed',sans-serif`;
    ctx2.textAlign = 'center';
    ctx2.lineWidth = 3 / S;
    ctx2.strokeStyle = '#000';
    ctx2.strokeText(t.t, t.x, t.y);
    ctx2.fillStyle = t.c;
    ctx2.fillText(t.t, t.x, t.y);
    ctx2.globalAlpha = 1;
  }
  drawSkyOverlay();
  themeFxScreen();
  drawBulletTime();
  if (UI.flashA > 0) {
    ctx2.setTransform(1, 0, 0, 1, 0, 0);
    ctx2.globalAlpha = UI.flashA * 0.8;
    ctx2.fillStyle = UI.flash;
    ctx2.fillRect(0, 0, cvs.width, cvs.height);
    ctx2.globalAlpha = 1;
  }
}

/** Gandalf's slab: jagged cracks growing out of the impact point along the real ground, then the shards of ground falling. */
function drawSlab() {
  const s = FX.slab;
  if (!s) return;
  ctx2.save();
  if (!s.fall) {
    const k = clamp(s.t / (s.dur * 0.7), 0, 1);
    ctx2.lineCap = 'round';
    for (const pass of [0, 1]) {
      ctx2.strokeStyle = pass ? 'rgba(255,230,170,0.5)' : '#0b0703';
      ctx2.lineWidth = pass ? 1.0 : 1.0;
      ctx2.beginPath();
      for (const c of s.cracks)
        if (c.d <= k * s.reach) {
          ctx2.moveTo(c.p[0], c.p[1]);
          ctx2.lineTo(c.q[0], c.q[1]);
        }
      ctx2.stroke();
    }
  } else {
    for (const k of s.shards) {
      if (k.gone) continue;
      ctx2.save();
      ctx2.translate(k.x, k.y);
      ctx2.rotate(k.rot);
      ctx2.beginPath();
      k.poly.forEach((p, i) => (i ? ctx2.lineTo(p[0], p[1]) : ctx2.moveTo(p[0], p[1])));
      ctx2.closePath();
      ctx2.save();
      ctx2.clip();
      ctx2.drawImage(s.img, s.x0 - k.cx, s.top - k.cy);
      ctx2.restore();
      ctx2.restore();
    }
  }
  ctx2.restore();
}

/** Bullet Time: a green cast over the screen and columns of falling digital rain, fading in and out with the effect. */
function drawBulletTime() {
  if (!G.bt || !(G.bt.t > 0)) return;
  const k = Math.min(1, (BT_TIME - G.bt.t) / 0.35, G.bt.t / 0.5),
    W = cvs.width,
    H = cvs.height,
    g = ctx2;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 0.16 * Math.max(0, k);
  g.fillStyle = '#00ff55';
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.5 * Math.max(0, k);
  g.font = `${Math.round(14 * DPR)}px monospace`;
  const col = Math.round(18 * DPR);
  for (let x = 0, i = 0; x < W; x += col, i++) {
    const sp = 60 + ((i * 37) % 90),
      y0 = ((G.time * sp * DPR + i * 197) % (H + 200 * DPR)) - 100 * DPR;
    for (let j = 0; j < 8; j++) {
      g.fillStyle = j === 0 ? '#d8ffe0' : '#27ff63';
      g.globalAlpha = 0.5 * Math.max(0, k) * (1 - j / 8);
      g.fillText(String.fromCharCode(0x30a0 + ((i * 7 + j * 13 + Math.floor(G.time * 6 + j)) % 60)), x, y0 - j * 16 * DPR);
    }
  }
  g.restore();
}
