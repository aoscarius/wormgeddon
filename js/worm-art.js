'use strict';

/**
 * @file worm-art.js - Worm art
 *
 * Stylised worm drawing. A worm is a three-segment "caterpillar" (tail, belly, head) with a soft
 * gradient, expressive eyes that follow the aim, a mouth that reacts to what is happening and a
 * team accessory (each of the 8 teams has its own hat). Also draws grave stones, the name/health
 * label above each worm and the aim reticle.
 *
 * Coordinates are in a worm-local space: origin at the worm's centre, +y down, ground contact at
 * about y = +7.5, and `f` (= worm.face, +1 or -1) mirrors everything horizontally.
 *
 * Depends on: view (ctx2, CAM), core (G, aimDir, WEAPONS)
 * Globals defined: TEAM_HATS, WORM_INK, WORM_SKIN, HELD_ITEMS, hexRgb, rgbStr, wormBodyColor,
 *     wCircle, drawHat, drawHeld, drawGrave, drawWorm, drawWormLabel, drawAim
 */

/** Accessory per team index (matches TEAM_COLORS order). */
const TEAM_HATS = ['headband', 'cap', 'helmet', 'tophat', 'mohawk', 'viking', 'antenna', 'crown'];

/** Outline colour used for hats and facial features. */
const WORM_INK = 'rgba(30,14,36,0.9)';
/** Base skin colour; each team tints it a little so teams are recognisable at a glance. */
const WORM_SKIN = [247, 201, 184];

/** What a worm holds in its hands for each weapon id (anything not listed holds nothing). */
const HELD_ITEMS = {
  bazooka: 'tube',
  homing: 'tube',
  mortar: 'tube',
  shotgun: 'gun',
  handgun: 'pistol',
  uzi: 'pistol',
  grenade: '#4f8f3a',
  cluster: '#6a8a2a',
  banana: '#ffd92e',
  holy: '#ffe27a',
  petrol: '#d6561c',
  mine: '#3e4048',
  dynamite: 'stick',
};

/** Parses '#rrggbb' into [r, g, b]. */
function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** CSS colour string from an [r, g, b] array, optionally scaled by `k` (<1 darker, >1 lighter). */
function rgbStr(c, k = 1) {
  return `rgb(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0})`;
}
/** Body colour of a team's worms: skin tinted by the team colour, paler when badly hurt. */
function wormBodyColor(team, hp) {
  const tc = hexRgb(team.color);
  const tint = 0.28;
  let c = WORM_SKIN.map((v, i) => v * (1 - tint) + tc[i] * tint);
  if (hp < 30) c = c.map(v => v * 0.8 + 255 * 0.2 * 0.8); // sickly pale
  return c;
}

/** Draws a circle path helper. */
function wCircle(g, x, y, r) {
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
}

/**
 * Draws the team accessory on top of the head.
 * @param {CanvasRenderingContext2D} g
 * @param {string} kind one of TEAM_HATS
 * @param {string} col team colour
 * @param {number} hx head centre x
 * @param {number} hy head centre y
 * @param {number} f facing (+1/-1)
 * @param {number} t time in seconds (for fluttering parts)
 */
function drawHat(g, kind, col, hx, hy, f, t) {
  g.save();
  g.strokeStyle = WORM_INK;
  g.lineWidth = 0.9;
  g.lineJoin = 'round';
  g.fillStyle = col;
  switch (kind) {
    case 'headband': {
      // Band around the forehead plus two fluttering knot tails behind the head.
      g.lineWidth = 2.6;
      g.strokeStyle = col;
      g.beginPath();
      g.arc(hx, hy, 4.9, Math.PI * 1.08, Math.PI * 1.98);
      g.stroke();
      g.lineWidth = 1.5;
      for (const k of [-1, 1]) {
        g.beginPath();
        g.moveTo(hx - f * 4.6, hy - 2.6);
        g.quadraticCurveTo(
          hx - f * 8,
          hy - 3 + k * 1.2,
          hx - f * 10.5,
          hy - 3 + k * 2.4 + Math.sin(t * 9 + k) * 1.4
        );
        g.stroke();
      }
      break;
    }
    case 'cap': {
      g.beginPath();
      g.arc(hx, hy - 0.6, 5.5, Math.PI, 0);
      g.closePath();
      g.fill();
      g.stroke();
      g.beginPath();
      g.ellipse(hx + f * 5, hy - 1.2, 3.8, 1.2, 0, 0, TAU);
      g.fill();
      g.stroke();
      wCircle(g, hx, hy - 6.1, 0.9);
      g.fillStyle = '#fff';
      g.fill();
      break;
    }
    case 'helmet': {
      g.beginPath();
      g.arc(hx, hy - 0.4, 6.1, Math.PI, 0);
      g.lineTo(hx + 6.4, hy + 0.6);
      g.lineTo(hx - 6.4, hy + 0.6);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = 'rgba(0,0,0,.22)';
      wCircle(g, hx - f * 1.8, hy - 3.4, 1.4);
      g.fill();
      wCircle(g, hx + f * 2.4, hy - 2.2, 1.1);
      g.fill();
      break;
    }
    case 'tophat': {
      g.fillStyle = '#26232e';
      g.beginPath();
      g.ellipse(hx, hy - 3.8, 6.6, 1.5, 0, 0, TAU);
      g.fill();
      g.stroke();
      g.beginPath();
      g.roundRect(hx - 3.7, hy - 11.4, 7.4, 8, 1);
      g.fill();
      g.stroke();
      g.fillStyle = col;
      g.fillRect(hx - 3.7, hy - 6.2, 7.4, 2);
      break;
    }
    case 'mohawk': {
      for (let i = 0; i < 5; i++) {
        const x = hx - f * 3.6 + f * i * 1.9,
          h = 6.2 - Math.abs(i - 2) * 0.8 + Math.sin(t * 6 + i) * 0.3;
        g.beginPath();
        g.moveTo(x - 1.5, hy - 4 - Math.abs(i - 2) * 0.3);
        g.lineTo(x, hy - 4 - h);
        g.lineTo(x + 1.5, hy - 4 - Math.abs(i - 2) * 0.3);
        g.closePath();
        g.fill();
        g.stroke();
      }
      break;
    }
    case 'viking': {
      g.fillStyle = '#8d96a6';
      g.beginPath();
      g.arc(hx, hy - 0.4, 5.8, Math.PI, 0);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = col;
      g.fillRect(hx - 5.8, hy - 2.2, 11.6, 1.8);
      g.fillStyle = '#f4efe2';
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(hx + s * 5.4, hy - 2);
        g.quadraticCurveTo(hx + s * 10, hy - 3, hx + s * 8.6, hy - 8.5);
        g.quadraticCurveTo(hx + s * 7.6, hy - 4.5, hx + s * 4.6, hy - 3.6);
        g.closePath();
        g.fill();
        g.stroke();
      }
      break;
    }
    case 'antenna': {
      g.lineWidth = 1;
      for (const s of [-1, 1]) {
        const sway = Math.sin(t * 4 + s) * 1.2;
        g.beginPath();
        g.moveTo(hx + s * 1.8, hy - 4.6);
        g.quadraticCurveTo(hx + s * 3 + sway, hy - 8, hx + s * 4 + sway * 1.5, hy - 10.5);
        g.stroke();
        wCircle(g, hx + s * 4 + sway * 1.5, hy - 11, 1.8);
        g.fill();
        g.stroke();
      }
      break;
    }
    case 'crown': {
      g.fillStyle = '#ffd23f';
      g.beginPath();
      g.moveTo(hx - 4.6, hy - 3.4);
      g.lineTo(hx - 5, hy - 8.4);
      g.lineTo(hx - 2.4, hy - 5.8);
      g.lineTo(hx, hy - 9.4);
      g.lineTo(hx + 2.4, hy - 5.8);
      g.lineTo(hx + 5, hy - 8.4);
      g.lineTo(hx + 4.6, hy - 3.4);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = col;
      wCircle(g, hx, hy - 5.2, 1.1);
      g.fill();
      break;
    }
  }
  g.restore();
}

/**
 * Draws the object the worm holds for the selected weapon (only for the active worm while it
 * is aiming). `ang` is the world aim angle; the sprite is mirrored vertically when facing left.
 */
function drawHeld(g, w, ax, ay) {
  const kind = HELD_ITEMS[G.weapon.id];
  if (!kind) return;
  g.save();
  g.translate(ax * 3, ay * 3 - 1.2);
  g.rotate(Math.atan2(ay, ax));
  if (w.face < 0) g.scale(1, -1);
  g.strokeStyle = WORM_INK;
  g.lineWidth = 0.9;
  if (kind === 'tube') {
    g.fillStyle = '#3d6a3a';
    g.fillRect(-2, -2.3, 16, 4.6);
    g.strokeRect(-2, -2.3, 16, 4.6);
    g.fillStyle = '#26402a';
    g.fillRect(12, -2.9, 3, 5.8);
    g.fillStyle = '#c63a30';
    g.fillRect(-3.4, -1.4, 1.6, 2.8);
  } else if (kind === 'gun' || kind === 'pistol') {
    const len = kind === 'gun' ? 16 : 9;
    g.fillStyle = '#4b5565';
    g.fillRect(0, -1.5, len, 2.6);
    g.strokeRect(0, -1.5, len, 2.6);
    g.fillStyle = '#8a5a2b';
    g.fillRect(-2, 0.2, 5, 3.4);
  } else if (kind === 'stick') {
    g.fillStyle = '#c8322a';
    g.fillRect(5, -2, 3.4, 8);
  } else {
    g.fillStyle = kind;
    wCircle(g, 8, 0, 3.4);
    g.fill();
    g.stroke();
  }
  // Hand
  g.fillStyle = rgbStr(WORM_SKIN, 0.92);
  wCircle(g, kind === 'tube' ? 6 : kind === 'gun' || kind === 'pistol' ? 2.5 : 5.4, 0.5, 1.8);
  g.fill();
  g.stroke();
  g.restore();
}

/** Draws a worm's grave stone, with a cross in the team colour. */
function drawGrave(g, team) {
  g.fillStyle = '#c8ccd2';
  g.strokeStyle = '#4a4f58';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(-5, 7.5);
  g.lineTo(-5, -3);
  g.arc(0, -3, 5, Math.PI, 0);
  g.lineTo(5, 7.5);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = team.color;
  g.fillRect(-3, -3.2, 6, 1.7);
  g.fillRect(-0.85, -6.4, 1.7, 7.4);
  g.fillStyle = 'rgba(0,0,0,.18)';
  g.fillRect(-6.5, 7, 13, 1.8);
}

/**
 * Draws one worm (alive or as a grave stone) at its world position.
 * Reads per-frame render memory from the worm (`_px` last x, `_ph` walk phase), which is
 * never sent over the network.
 * @param {object} w worm
 */
function drawWorm(w) {
  const g = ctx2,
    team = G.teams[w.team];
  g.save();
  g.translate(w.x, w.y);
  if (w.dead) {
    if (!w.sunk) drawGrave(g, team);
    g.restore();
    return;
  }

  const f = w.face,
    t = G.time,
    act = w.id === G.active,
    hurt = w.hp < 30,
    aiming = act && G.phase === 'turn' && !w.tool && !w.jet && !w.rope;
  // Walk cycle phase advances with horizontal travel.
  const moved = Math.abs(w.x - (w._px === undefined ? w.x : w._px));
  w._px = w.x;
  w._ph = (w._ph || 0) + moved * 0.9;
  const walking = moved > 0.05 && w.grounded;
  const [ax, ay] = aimDir(w);

  // --- gadgets behind the body: parachute, jet pack
  if (w.chute && !w.grounded) {
    g.fillStyle = team.color;
    g.strokeStyle = '#fff';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(0, -26, 17, Math.PI, 0);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(-17, -26);
    g.lineTo(-2, -5);
    g.moveTo(17, -26);
    g.lineTo(2, -5);
    g.stroke();
  }
  if (w.jet) {
    g.fillStyle = '#6a7080';
    g.strokeStyle = WORM_INK;
    g.lineWidth = 0.8;
    g.fillRect(-f * 8 - 3, -5, 6, 11);
    g.strokeRect(-f * 8 - 3, -5, 6, 11);
    if (w.jet.on) {
      g.fillStyle = '#ffb02e';
      g.beginPath();
      g.moveTo(-f * 8 - 2, 6);
      g.lineTo(-f * 8, 14 + Math.random() * 5);
      g.lineTo(-f * 8 + 2, 6);
      g.fill();
    }
  }

  // --- squash & stretch while airborne
  const air = !w.grounded && !w.rope ? Math.min(1, Math.abs(w.vy || 0) / 420) : 0;
  g.scale(1 - air * 0.1, 1 + air * 0.16); // facing is applied per feature via `f`

  // --- body: tail, belly, head
  const sway = walking ? Math.sin(w._ph) * 1.6 : Math.sin(t * 2 + w.id) * 0.45;
  const bob = walking ? Math.abs(Math.sin(w._ph)) * -0.9 : Math.sin(t * 2.4 + w.id) * 0.25;
  const segs = [
    { x: -f * 1.1 - f * sway * 0.5, y: 4.7, r: 3.3 }, // tail
    { x: -f * 0.2, y: 1.4 + bob * 0.5, r: 4.7 }, // belly
    { x: f * 0.8, y: -2.2 + bob, r: 5.3 }, // head
  ];
  const head = segs[2],
    body = wormBodyColor(team, w.hp);
  // Outline pass first so the three circles merge into a single silhouette.
  g.fillStyle = 'rgba(70,24,50,0.95)';
  for (const s of segs) {
    wCircle(g, s.x, s.y, s.r + 1.15);
    g.fill();
  }
  // Fill pass with a soft radial highlight on each segment.
  for (const s of segs) {
    const gr = g.createRadialGradient(
      s.x - s.r * 0.35,
      s.y - s.r * 0.45,
      s.r * 0.15,
      s.x,
      s.y,
      s.r
    );
    gr.addColorStop(0, rgbStr(body, 1.12));
    gr.addColorStop(1, rgbStr(body, 0.86));
    g.fillStyle = gr;
    wCircle(g, s.x, s.y, s.r);
    g.fill();
  }
  // Ring lines between segments and a glossy highlight on the head.
  g.strokeStyle = 'rgba(90,30,60,.28)';
  g.lineWidth = 0.8;
  for (const y of [3.6, 0.2]) {
    g.beginPath();
    g.arc(0, y - 3.4, 4.6, 0.25, Math.PI - 0.25);
    g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,.32)';
  g.beginPath();
  g.ellipse(head.x - f * 1.8, head.y - 3, 2, 1.1, -0.5 * f, 0, TAU);
  g.fill();

  // --- face
  const hx = head.x,
    hy = head.y;
  const blink = (t * 1 + w.id * 1.7) % 3.6 < 0.12;
  const lid = blink ? 1 : hurt ? 0.38 : 0;
  const eyes = [
    [hx + f * 1.1, hy - 0.5, 2.2],
    [hx + f * 3.9, hy - 0.4, 1.95],
  ];
  const lookX = clamp(ax * 0.9, -0.9, 0.9),
    lookY = clamp(ay * 0.9, -0.9, 0.9);
  for (const [ex, ey, er] of eyes) {
    g.fillStyle = '#fff';
    g.strokeStyle = WORM_INK;
    g.lineWidth = 0.7;
    g.beginPath();
    g.ellipse(ex, ey, er, er * 1.12, 0, 0, TAU);
    g.fill();
    g.stroke();
    g.fillStyle = '#16121c';
    wCircle(g, ex + lookX * (act ? 1 : 0.4), ey + lookY * (act ? 1 : 0.4), er * 0.5);
    g.fill();
    g.fillStyle = '#fff';
    wCircle(g, ex + lookX * 0.4 - 0.25, ey + lookY * 0.4 - 0.35, er * 0.16);
    g.fill();
    if (lid > 0) {
      g.fillStyle = rgbStr(body, 1);
      g.beginPath();
      g.ellipse(ex, ey - er * 1.12 * (1 - lid), er + 0.3, er * 1.12 * lid + 0.2, 0, Math.PI, TAU);
      g.fill();
      g.strokeStyle = WORM_INK;
      g.beginPath();
      g.moveTo(ex - er, ey - er * 1.12 * (1 - lid));
      g.lineTo(ex + er, ey - er * 1.12 * (1 - lid));
      g.stroke();
    }
  }
  // Brows: determined while charging, worried when hurt.
  const charging = act && G.weapon.ch;
  if (charging || hurt) {
    g.strokeStyle = WORM_INK;
    g.lineWidth = 1;
    const slant = charging ? 1 : -1;
    for (const [ex, ey, er] of eyes) {
      g.beginPath();
      g.moveTo(ex - f * er, ey - er * 1.4 - slant * 0.9);
      g.lineTo(ex + f * er, ey - er * 1.4 + slant * 0.9);
      g.stroke();
    }
  }
  // Mouth reacts: "o" in the air, flat when charging, wobbly frown when hurt, smile otherwise.
  const mx = hx + f * 3.1,
    my = hy + 3;
  g.strokeStyle = WORM_INK;
  g.lineWidth = 0.9;
  if (!w.grounded && !w.rope) {
    g.fillStyle = '#5a1e3a';
    g.beginPath();
    g.ellipse(mx, my, 1.1, 1.5, 0, 0, TAU);
    g.fill();
  } else if (charging) {
    g.beginPath();
    g.moveTo(mx - 1.6, my);
    g.lineTo(mx + 1.6, my);
    g.stroke();
  } else if (hurt) {
    g.beginPath();
    g.arc(mx, my + 1.4, 1.7, Math.PI * 1.1, Math.PI * 1.9);
    g.stroke();
    g.fillStyle = '#7ec8ff';
    g.beginPath();
    g.ellipse(hx - f * 4.8, hy - 3 + ((t * 8) % 3) * 0.4, 0.9, 1.4, 0, 0, TAU);
    g.fill();
  } else {
    g.beginPath();
    g.arc(mx, my - 0.6, 1.9, 0.2, Math.PI - 0.2);
    g.stroke();
  }

  // --- accessory
  drawHat(g, TEAM_HATS[w.team % TEAM_HATS.length], team.color, hx, hy, f, t);

  // --- held weapon (and its hand), drawn in front of the body
  if (aiming) {
    // The held-weapon transform is drawn without the squash so it stays crisp.
    drawHeld(g, w, ax, ay);
  }

  // --- tool visuals (blowtorch flame, drill bit)
  if (w.tool) {
    const [dx, dy] = aimDir(w);
    if (w.tool.k === 'torch') {
      g.fillStyle = '#6ec6ff';
      g.beginPath();
      g.arc(dx * 12, dy * 12, 4 + Math.random() * 2, 0, TAU);
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(dx * 11, dy * 11, 2, 0, TAU);
      g.fill();
    } else if (w.tool.k === 'drill') {
      g.strokeStyle = '#999';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, 6);
      g.lineTo(Math.sin(G.time * 60) * 2, 14);
      g.stroke();
    }
  }
  g.restore();
}

/**
 * Draws the worm's name and health pill above it (counter-scaled so text stays readable at any
 * zoom), and a bobbing arrow above the active worm.
 */
function drawWormLabel(w) {
  if (w.dead) return;
  const t = G.teams[w.team],
    s = 1 / CAM.s,
    act = w.id === G.active;
  ctx2.save();
  ctx2.translate(w.x, w.y - 18 - (act ? Math.sin(G.time * 5) * 2 : 0));
  ctx2.font = `700 ${12 * s}px 'Barlow Condensed',sans-serif`;
  ctx2.textAlign = 'center';
  ctx2.lineWidth = 3 * s;
  ctx2.strokeStyle = 'rgba(0,0,0,.65)';
  ctx2.fillStyle = t.color;
  ctx2.strokeText(w.name, 0, -14 * s);
  ctx2.fillText(w.name, 0, -14 * s);
  const hp = String(Math.max(0, Math.ceil(w.hp))),
    tw = ctx2.measureText(hp).width + 8 * s;
  ctx2.fillStyle = t.color;
  ctx2.globalAlpha = 0.95;
  ctx2.beginPath();
  ctx2.roundRect(-tw / 2, -12 * s, tw, 13 * s, 5 * s);
  ctx2.fill();
  ctx2.globalAlpha = 1;
  ctx2.fillStyle = '#0d1a2b';
  ctx2.fillText(hp, 0, -2 * s);
  if (act && G.phase === 'turn') {
    ctx2.fillStyle = '#fff';
    ctx2.beginPath();
    ctx2.moveTo(0, 4 * s);
    ctx2.lineTo(-5 * s, -2 * s);
    ctx2.lineTo(5 * s, -2 * s);
    ctx2.fill();
  }
  ctx2.restore();
}

/**
 * Draws the aim reticle and the charge dots for the active worm. Nothing is drawn for weapons
 * that are not aimed (click-targeted, instant or tool weapons).
 */
function drawAim(w) {
  const W = G.weapon,
    d = WEAPONS[W.id];
  if (!d || G.phase !== 'turn' || w.tool || w.jet || w.dead) return;
  if (d.click || d.instant || d.id === 'jetpack' || d.id === 'blowtorch' || d.id === 'drill')
    return;
  if (w.rope && d.id === 'rope') return;
  const [ax, ay] = aimDir(w),
    s = 1 / CAM.s,
    dist = 56,
    cx = w.x + ax * dist,
    cy = w.y - 2 + ay * dist;
  // Charge dots grow and shift from green to red along the aim line.
  if (W.pw > 0)
    for (let i = 0; i < 14; i++) {
      const f = i / 13;
      if (f > W.pw) break;
      ctx2.fillStyle = `hsl(${120 - 120 * f},90%,55%)`;
      ctx2.beginPath();
      ctx2.arc(w.x + ax * (14 + f * 36), w.y - 2 + ay * (14 + f * 36), 1.8 + f * 2.2, 0, TAU);
      ctx2.fill();
    }
  ctx2.strokeStyle = '#fff';
  ctx2.lineWidth = 1.6 * s;
  ctx2.beginPath();
  ctx2.arc(cx, cy, 5, 0, TAU);
  ctx2.moveTo(cx - 9, cy);
  ctx2.lineTo(cx - 3, cy);
  ctx2.moveTo(cx + 3, cy);
  ctx2.lineTo(cx + 9, cy);
  ctx2.moveTo(cx, cy - 9);
  ctx2.lineTo(cx, cy - 3);
  ctx2.moveTo(cx, cy + 3);
  ctx2.lineTo(cx, cy + 9);
  ctx2.stroke();
}
