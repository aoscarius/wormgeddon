'use strict';

/**
 * @file render.js - Renderer
 *
 * Per-frame drawing: parallax sky, water, terrain, entities, effects and targeting previews.
 *
 * Depends on: sprites, worm-art, fx, terrain
 * Globals defined: SKY_CLOUDS, drawSky, drawNuke, drawWater, render
 */

/* ---- Rendering ---- */
/** Fixed cloud layout for the parallax sky. */
const SKY_CLOUDS = Array.from({ length: 9 }, (_, i) => ({
  x: i * 330 + ((i * 97) % 200),
  y: 40 + ((i * 61) % 160),
  s: 0.7 + (i % 4) * 0.25,
}));
/** Screen-space background: gradient, sun, drifting clouds (move with the wind) and two parallax mountain layers. */
function drawSky() {
  const th = T.theme,
    g = ctx2.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, th.sky[0]);
  g.addColorStop(1, th.sky[1]);
  ctx2.fillStyle = g;
  ctx2.fillRect(0, 0, VW, VH);
  const px = CAM.x * 0.04,
    py = CAM.y * 0.04;
  ctx2.fillStyle = th.sun;
  ctx2.globalAlpha = 0.9;
  ctx2.beginPath();
  ctx2.arc(VW * 0.8 - px, VH * 0.2 - py, 46, 0, TAU);
  ctx2.fill();
  ctx2.globalAlpha = 1;
  const t = G ? G.time : 0,
    wind = G ? G.wind : 0;
  ctx2.fillStyle = th.cloud;
  ctx2.globalAlpha = 0.55;
  for (const c of SKY_CLOUDS) {
    const x =
        ((((c.x + t * (8 + wind * 14) - CAM.x * 0.12) % (VW + 500)) + VW + 500) % (VW + 500)) - 250,
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
    ctx2.fillStyle = L ? 'rgba(10,20,40,.22)' : 'rgba(10,20,40,.13)';
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
  for (const p of FX.p) {
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
  const aw = activeWorm();
  if (aw) {
    drawAim(aw);
  }
  for (const w of G.worms) drawWormLabel(w);
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
  if (UI.flashA > 0) {
    ctx2.setTransform(1, 0, 0, 1, 0, 0);
    ctx2.globalAlpha = UI.flashA * 0.8;
    ctx2.fillStyle = UI.flash;
    ctx2.fillRect(0, 0, cvs.width, cvs.height);
    ctx2.globalAlpha = 1;
  }
}
