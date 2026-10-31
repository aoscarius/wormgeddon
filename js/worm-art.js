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
 * Globals defined: TEAM_HATS, WORM_INK, WORM_SKIN, HELD_ITEMS, HP_HOLD, shownHp, hexRgb, rgbStr, wormBodyColor,
 *     wCircle, drawHat, drawHeld, drawGrave, drawWorm, drawWormLabel, drawHeldWeaponBox, drawAim
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

/**
 * Health as it is *shown* (label, team bars, paleness). A hit lowers `w.hp` at once in the simulation, but
 * the damage is only announced (floating "-N") when the turn settles; until then, and for HP_HOLD more
 * seconds, the old value stays on screen, and then it counts down to the real one. Heals show at once.
 * `w.pend` (damage not announced yet) is part of the online snapshot, so guests behave the same.
 */
const HP_HOLD = 0.9;
function shownHp(w) {
  const now = performance.now() / 1000,
    real = Math.max(0, w.hp),
    pend = w.pend > 0 ? w.pend : 0;
  if (w.sh === undefined) {
    w.sh = real + pend;
    w.shT = now;
  }
  const dt = Math.min(0.1, now - w.shT);
  w.shT = now;
  if (pend > 0) {
    w.shHold = now + HP_HOLD;
    w.sh = Math.max(w.sh, real);
  } else if (w.sh < real) w.sh = real;
  else if (w.sh > real && now >= (w.shHold || 0)) w.sh = Math.max(real, w.sh - Math.max(30, (w.sh - real) * 1.5) * dt);
  return Math.ceil(w.sh);
}

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

/** Avada Kedavra: the victim hangs in a bubble of electric green (the colour of the bolt), crackling, until the curse takes it. */
function drawZapBubble(w) {
  const g = ctx2,
    R = 21 + Math.sin(G.time * 18) * 1.2,
    cy = w.y - 3;
  g.save();
  g.translate(w.x, cy);
  g.globalCompositeOperation = 'lighter';
  const rg = g.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
  rg.addColorStop(0, 'rgba(60,255,120,0.12)');
  rg.addColorStop(0.75, 'rgba(60,255,120,0.3)');
  rg.addColorStop(1, 'rgba(180,255,200,0.85)');
  g.fillStyle = rg;
  g.beginPath();
  g.arc(0, 0, R, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(210,255,225,0.9)';
  g.lineWidth = 1.4;
  g.stroke();
  // a glint and small discharges running over the surface
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.beginPath();
  g.ellipse(-R * 0.4, -R * 0.45, R * 0.18, R * 0.1, -0.7, 0, TAU);
  g.fill();
  const fl = mulberry(w.id * 131 + Math.floor(G.time * 24));
  g.strokeStyle = '#8dffae';
  g.lineWidth = 1.1;
  g.beginPath();
  for (let k = 0; k < 4; k++) {
    let a = fl() * TAU, x = Math.cos(a) * R, y = Math.sin(a) * R;
    g.moveTo(x, y);
    for (let s = 0; s < 3; s++) {
      a += (fl() - 0.5) * 1.4;
      x += Math.cos(a + Math.PI) * R * 0.28 + (fl() - 0.5) * 3;
      y += Math.sin(a + Math.PI) * R * 0.28 + (fl() - 0.5) * 3;
      g.lineTo(x, y);
    }
  }
  g.stroke();
  g.restore();
}
/**
 * Draws a worm. In Splatter Mode a worm just sliced by the Oni Giri (`w._cut`, set by the 'slash' event) is drawn as two
 * halves along the cut line that slide apart and come back together, while blood spurts from the cut (fx.js).
 */
function drawWorm(w) {
  const cut = UI.splatterMode && !w.dead ? w._cut : null,
    t = cut ? G.time - cut.t0 : 9;
  if (!cut || t > 1.1) {
    if (cut) w._cut = null;
    drawWormBody(w);
    if (w.zap > 0 && !w.dead) drawZapBubble(w);
    return;
  }
  const g = ctx2,
    gap = (t < 0.55 ? Math.min(1, t / 0.12) : Math.max(0, 1 - (t - 0.55) / 0.5)) * 7,
    dx = Math.cos(cut.ang),
    dy = Math.sin(cut.ang),
    nx = -dy,
    ny = dx,
    cx = w.x,
    cy = w.y - 2;
  for (const sg of [1, -1]) {
    g.save();
    g.beginPath();
    g.moveTo(cx - dx * 40, cy - dy * 40);
    g.lineTo(cx + dx * 40, cy + dy * 40);
    g.lineTo(cx + dx * 40 + sg * nx * 40, cy + dy * 40 + sg * ny * 40);
    g.lineTo(cx - dx * 40 + sg * nx * 40, cy - dy * 40 + sg * ny * 40);
    g.closePath();
    g.clip();
    g.translate(sg * nx * gap, sg * ny * gap + (sg > 0 ? -1 : 1) * gap * 0.25);
    drawWormBody(w);
    g.restore();
  }
}
/**
 * Draws one worm (alive or as a grave stone) at its world position.
 * Reads per-frame render memory from the worm (`_px` last x, `_ph` walk phase), which is
 * never sent over the network.
 * @param {object} w worm
 */
function drawWormBody(w) {
  const g = ctx2,
    team = G.teams[w.team];
  g.save();
  g.translate(w.x, w.y);
  if (w.dead) {
    if (!w.sunk && !w.dusted) drawGrave(g, team); // a worm turned to dust leaves nothing behind
    g.restore();
    return;
  }

  // Splatter Mode: a worm marked by the Hokuto Hyakuretsu Ken swells up, after a start time, like blob until it bursts (see 'burst' in fx.js)
  let swell = 0;
  if (w.doom > 0) {
    if (w._doomT === undefined) w._doomT = G.time;
    swell = UI.splatterMode ? Math.min(1, (G.time - w._doomT - HYAKU_SWELL) / HYAKU_FUSE) : 0;
  } else w._doomT = undefined;
  if (swell > 0) {
    const k = swell * swell * (1.3 - 0.3 * swell),
      s = 1 + 1.9 * k + Math.sin(G.time * (10 + 22 * swell)) * 0.07 * swell;
    g.translate(0, 6);
    g.scale(s, s * (1 - 0.06 * Math.sin(G.time * 17) * swell));
    g.translate(0, -6);
  }
  // Force Choke: the held worm trembles in a faint blue grip
  if (w.held) {
    g.translate(Math.sin(G.time * 47) * 1.3, Math.sin(G.time * 31) * 0.8);
    g.globalCompositeOperation = 'lighter';
    const hg = g.createRadialGradient(0, -4, 4, 0, -4, 24);
    hg.addColorStop(0, 'rgba(120,170,255,0)');
    hg.addColorStop(0.7, `rgba(120,170,255,${0.25 + 0.1 * Math.sin(G.time * 20)})`);
    hg.addColorStop(1, 'rgba(120,170,255,0)');
    g.fillStyle = hg;
    g.beginPath();
    g.arc(0, -4, 24, 0, TAU);
    g.fill();
    for (let i = 0; i < 3; i++) {
      const pulse = 0.5 + 0.5 * Math.sin(G.time * 8 + i * TAU / 3),
        rx = 6 + pulse * 8,
        ry = 2.5 + pulse * 3;
      g.strokeStyle = `rgba(130,180,255,${0.3 + pulse * 0.4})`;
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(0, 1, rx, ry, 0, 0, TAU);
      g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
  }
  // Thanos' Gauntlet: the worm crumbles away from the downwind side (the dust itself is spawned in fxUpdate)
  if (w.dustP > 0) {
    const dir = G.wind >= 0 ? 1 : -1;
    g.beginPath();
    if (dir > 0) g.rect(-26, -34, 52 - 52 * w.dustP, 60);
    else g.rect(26 - (52 - 52 * w.dustP), -34, 52 - 52 * w.dustP, 60);
    g.clip();
  }
  // Matrix Bullet Time: the worm bends backwards (pivoting at its feet) while it starts the effect
  if (w.tool && w.tool.k === 'bt') {
    g.translate(0, 6);
    g.rotate(-w.face * Math.sin(clamp(w.tool.p || 0, 0, 1) * Math.PI) * 0.7);
    g.translate(0, -6);
  }
  const f = w.face,
    t = G.time,
    act = w.id === G.active,
    hurt = shownHp(w) < 30,
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
    body = wormBodyColor(team, shownHp(w));
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
  // Matrix Bullet Time: black sunglasses once the worm has put them on, until the effect is over
  if ((G.bt && G.bt.t > 0 && G.bt.id === w.id) || (w.tool && w.tool.k === 'bt' && (w.tool.p || 0) > 0.3)) {
    g.fillStyle = '#0a0a0c';
    g.strokeStyle = '#0a0a0c';
    g.lineWidth = 0.9;
    for (const [ex, ey, er] of eyes) {
      g.beginPath();
      g.ellipse(ex, ey, er + 1.1, er * 0.95 + 0.5, 0, 0, TAU);
      g.fill();
    }
    g.beginPath();
    g.moveTo(eyes[0][0], eyes[0][1] - 0.4);
    g.lineTo(eyes[1][0], eyes[1][1] - 0.4);
    g.moveTo(eyes[0][0] - f * 2.2, eyes[0][1] - 0.4);
    g.lineTo(eyes[0][0] - f * 5, eyes[0][1] + 1);
    g.stroke();
    g.fillStyle = 'rgba(120,255,160,0.55)';
    g.beginPath();
    g.ellipse(eyes[1][0] - f * 0.6, eyes[1][1] - 0.9, 0.8, 0.4, -0.5 * f, 0, TAU);
    g.fill();
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
  if (!themeFxHat(g, team.color, hx, hy, f, t))
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
    } else if (w.tool.k === 'axe') {
      // Gomu Gomu no Gigant Axe: a rubber leg stretches up and the foot grows huge, then it slams straight down.
      const p = w.tool.p || 0,
        ft = axeFoot(w, p),
        fx = ft.x - w.x,
        fy = ft.y - w.y,
        gx = ft.ix - w.x,
        gy = ft.iy - w.y,
        sc = ft.sc,
        W = 2 * AXE_R * sc,
        H = 30 * sc;
      if (p < 2) {
        // telegraph: the zone that is going to be crushed
        g.fillStyle = `rgba(0,0,0,${0.08 + 0.12 * sc})`;
        g.beginPath();
        g.ellipse(gx, gy - 1, AXE_R * sc, 6 * sc + 1, 0, 0, TAU);
        g.fill();
        g.strokeStyle = 'rgba(255,80,60,.6)';
        g.lineWidth = 1.5;
        g.setLineDash([5, 4]);
        g.beginPath();
        g.ellipse(gx, gy - 1, AXE_R, 7, 0, 0, TAU);
        g.stroke();
        g.setLineDash([]);
      }
      g.lineCap = 'round';
      for (const [lw, col] of [
        [8 + 12 * sc, '#0c1524'],
        [5 + 10 * sc, '#f4b9a8'],
      ]) {
        g.strokeStyle = col;
        g.lineWidth = lw;
        g.beginPath();
        g.moveTo(0, -4);
        g.lineTo(fx - f * W * 0.25, fy - H * 0.9);
        g.stroke();
      }
      g.fillStyle = '#f4b9a8';
      g.strokeStyle = '#0c1524';
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(fx, fy - H / 2, W / 2, H / 2, 0, 0, TAU);
      g.fill();
      g.stroke();
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.arc(fx + f * (W / 2 - H * 0.06), fy - H / 2 + (i - 2) * H * 0.2, H * 0.13, 0, TAU);
        g.fill();
        g.stroke();
      }
      g.strokeStyle = '#e5473c';
      g.lineWidth = Math.max(1, 3 * sc);
      g.beginPath();
      g.moveTo(fx - f * W * 0.1, fy - H * 0.92);
      g.lineTo(fx - f * W * 0.1, fy - H * 0.08);
      g.stroke();
      if (p > 1 && p < 2) {
        g.strokeStyle = 'rgba(255,255,255,.7)';
        g.lineWidth = 1.5;
        for (let i = -2; i <= 2; i++) {
          g.beginPath();
          g.moveTo(fx + i * W * 0.2, fy - H - 10);
          g.lineTo(fx + i * W * 0.2, fy - H - 40 - Math.random() * 30);
          g.stroke();
        }
      }
    } else if (w.tool.k === 'oni') {
      // three swords: one in the mouth, one in each hand. Drawn back while charging, thrust forward in the dash,
      // lowered afterwards.
      const ph = w.tool.p || 0,
        base = ph === 0 ? [Math.PI + 0.5, Math.PI, Math.PI - 0.5] : ph === 1 ? [-0.2, 0, 0.2] : [0.9, 1.1, 1.3],
        mount = [
          [6, 0],
          [4, -4],
          [4, 4],
        ];
      g.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const an = base[i] + (ph === 0 ? Math.sin(G.time * 30 + i) * 0.05 : 0),
          sx = f * mount[i][0],
          sy = mount[i][1],
          dx = f * Math.cos(an),
          dy = Math.sin(an),
          ex = sx + dx * 22,
          ey = sy + dy * 22;
        if (ph === 0) {
          g.strokeStyle = `rgba(120,255,160,${0.35 + 0.25 * Math.sin(G.time * 14 + i)})`;
          g.lineWidth = 6;
          g.beginPath();
          g.moveTo(sx, sy);
          g.lineTo(ex, ey);
          g.stroke();
        }
        g.strokeStyle = '#0c1524';
        g.lineWidth = 3.4;
        g.beginPath();
        g.moveTo(sx + dx * 3, sy + dy * 3);
        g.lineTo(ex, ey);
        g.stroke();
        g.strokeStyle = '#e8f0ff';
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(sx + dx * 3, sy + dy * 3);
        g.lineTo(ex, ey);
        g.stroke();
        g.strokeStyle = '#d9a520';
        g.lineWidth = 2.4;
        g.beginPath();
        g.moveTo(sx - dy * 3, sy + dx * 3);
        g.lineTo(sx + dy * 3, sy - dx * 3);
        g.stroke();
      }
      if (ph === 1) {
        g.strokeStyle = 'rgba(255,255,255,.7)';
        g.lineWidth = 1.2;
        for (let i = 0; i < 6; i++) {
          const ly = (i - 2.5) * 4;
          g.beginPath();
          g.moveTo(-f * 8, ly);
          g.lineTo(-f * (24 + Math.random() * 26), ly);
          g.stroke();
        }
      }
    } else if (w.tool.k === 'force') {
      // Force Choke: an arm stretched out towards the victim, fingers curled, with rings of force travelling along it
      const age = (w.tool.p || 0) * (FORCE_CHOKE + FORCE_AFTER),
        on = age < FORCE_CHOKE,
        hx = f * 14,
        hy = -12;
      g.strokeStyle = '#d99a85';
      g.lineWidth = 3;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(f * 3, -3);
      g.lineTo(hx, hy);
      g.stroke();
      g.fillStyle = '#f4b9a8';
      g.beginPath();
      g.arc(hx, hy, 3.2, 0, TAU);
      g.fill();
      for (let i = 0; i < 4; i++) {
        g.strokeStyle = '#d99a85';
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(hx + f * 1.5, hy - 1.5 + i * 1.5);
        g.lineTo(hx + f * 5.5, hy - 3 + i * 2.2);
        g.stroke();
      }
      if (on) {
        g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          const k = ((G.time * 1.6 + i / 3) % 1);
          g.strokeStyle = `rgba(130,180,255,${0.7 * (1 - k)})`;
          g.lineWidth = 1.4;
          g.beginPath();
          g.arc(hx + f * (6 + 26 * k), hy, 3 + 7 * k, 0, TAU);
          g.stroke();
        }
        g.globalCompositeOperation = 'source-over';
      }
    } else if (w.tool.k === 'wand') {
      // Avada Kedavra: the wand is held out towards the target, its tip glowing a sickly green that builds with the incantation
      const age = (w.tool.p || 0) * (WAND_DELAY + WAND_HOLD),
        glow = clamp(age / WAND_DELAY, 0, 1),
        hx = f * 7,
        hy = -1,
        [wdx, wdy] = aimDir(w), // the wand points straight at the target, held low
        tx = hx + wdx * WAND_LEN,
        ty = hy + wdy * WAND_LEN;
      g.strokeStyle = '#2a1a10';
      g.lineWidth = 2.2;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(hx, hy);
      g.lineTo(tx, ty);
      g.stroke();
      g.globalCompositeOperation = 'lighter';
      const rg = g.createRadialGradient(tx, ty, 0, tx, ty, 4 + 9 * glow);
      rg.addColorStop(0, `rgba(210,255,220,${0.5 + 0.5 * glow})`);
      rg.addColorStop(0.5, `rgba(70,240,110,${0.3 + 0.5 * glow})`);
      rg.addColorStop(1, 'rgba(20,160,50,0)');
      g.fillStyle = rg;
      g.beginPath();
      g.arc(tx, ty, 4 + 9 * glow + Math.sin(G.time * 22) * 0.8, 0, TAU);
      g.fill();
      g.globalCompositeOperation = 'source-over';
    } else if (w.tool.k === 'staff') {
      // Raise the staff vertically, then slam it straight down without rotating it.
      const age = (w.tool.p || 0) * (STAFF_DELAY + STAFF_SLAM),
        raise = Math.min(1, age / 1.0),
        slam = clamp((age - STAFF_DELAY) / 0.15, 0, 1),
        handX = f * 5,
        handY = -1 - 13 * raise + 24 * slam,
        topY = handY - 25,
        bottomY = handY + 14,
        glow = clamp(age / STAFF_DELAY, 0, 1);
      // Draw the arm up to the grip.
      g.strokeStyle = '#4a3216';
      g.lineWidth = 4;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(f * 2, -1);
      g.lineTo(handX, handY);
      g.stroke();
      // Keep the staff straight, with a shorter section above the hand.
      g.strokeStyle = '#4a3216';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(handX, topY);
      g.lineTo(handX, bottomY);
      g.stroke();
      g.strokeStyle = '#9a7238';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(handX, topY + 1);
      g.lineTo(handX, bottomY - 1);
      g.stroke();
      // Draw the hand over the staff at the grip point.
      g.fillStyle = rgbStr(WORM_SKIN, 0.92);
      g.strokeStyle = WORM_INK;
      g.lineWidth = 0.9;
      wCircle(g, handX, handY, 2.2);
      g.fill();
      g.stroke();
      // Add the glowing tip above the hand.
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = `rgba(170,210,255,${0.25 + 0.5 * glow})`;
      wCircle(g, handX, topY, 4 + 7 * glow + Math.sin(G.time * 18) * 0.8);
      g.fill();
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#f4faff';
      wCircle(g, handX, topY, 2.6);
      g.fill();
      if (age >= STAFF_DELAY && age < STAFF_DELAY + 0.3) {
        g.strokeStyle = 'rgba(255,255,255,.9)';
        g.lineWidth = 1.6;
        for (let i = 0; i < 7; i++) {
          const a = -0.2 - i * 0.45;
          g.beginPath();
          g.moveTo(handX + Math.cos(a) * 5, bottomY + Math.sin(a) * 5);
          g.lineTo(handX + Math.cos(a) * 14, bottomY + Math.sin(a) * 14);
          g.stroke();
        }
      }
    } else if (w.tool.k === 'snap') {
      // Thanos' Gauntlet: the arm is raised, the golden glove glows with the six stones, then the fingers snap
      const age = (w.tool.p || 0) * SNAP_T,
            snapped = age >= SNAP_AT,
            ax = f * 8,
            ay = -11 - (snapped ? 0 : Math.sin(age * 9) * 0.6);

      g.save();
      g.strokeStyle = '#5a3f08';
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(f * 2, -1);
      g.lineTo(ax, ay + 2);
      g.stroke();
      g.strokeStyle = '#d9a520';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(f * 2, -1);
      g.lineTo(ax, ay + 2);
      g.stroke();
      g.fillStyle = '#dfb130';
      g.strokeStyle = '#5a3f08';
      g.lineWidth = 1.2;
      g.beginPath();
      g.roundRect ? g.roundRect(ax - 4.5 * f, ay - 4, 9 * f, 7, 2) : g.rect(ax - 4.5 * f, ay - 4, 9 * f, 7);
      g.fill();
      g.stroke();
      g.fillStyle = '#b88610';
      for(let i = 0; i < 4; i++) {
        const kx = ax + (i - 1.5) * 2.2 * f;
        const ky = ay - 4.5;
        g.beginPath();
        g.arc(kx, ky, 1.4, 0, TAU);
        g.fill();
        g.stroke();
      }
      const stones = [
        { c: '#e03030', x: -3.3, y: -2.0 }, // Reality (Red)
        { c: '#3090ff', x: -1.1, y: -3.2 }, // Space (Blue)
        { c: '#b040ff', x:  1.1, y: -3.2 }, // Power (Purple)
        { c: '#30c040', x:  3.3, y: -2.0 }, // Time (Green)
        { c: '#ff9020', x:  0.0, y: -4.5 }, // Soul (Orange)
        { c: '#f0e020', x:  0.0, y:  0.2 }  // Mind (Yellow - Center)
      ];
      stones.forEach((s, i) => {
        const sx = ax + s.x * f;
        const sy = ay + s.y;
        const radius = (i === 5) ? 1.6 : 1.0;
        g.fillStyle = s.c;
        g.beginPath();
        g.arc(sx, sy, radius + 0.5, 0, TAU);
        g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.arc(sx, sy, radius * 0.5, 0, TAU);
        g.fill();
      });
      if (!snapped) {
        const k = age / SNAP_AT;
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = `rgba(190, 120, 255, ${0.2 + 0.3 * k})`;
        g.beginPath();
        g.arc(ax, ay, 8 + 7 * k + Math.sin(age * 20) * 1.5, 0, TAU);
        g.fill();
        g.globalCompositeOperation = 'source-over';
      } else if (age < SNAP_AT + 0.3) {
        g.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        g.lineWidth = 1.8;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU;
          g.beginPath();
          g.moveTo(ax + Math.cos(a) * 6, ay + Math.sin(a) * 6);
          g.lineTo(ax + Math.cos(a) * 16, ay + Math.sin(a) * 16);
          g.stroke();
        }
      }
      g.restore();
    } else if (w.tool.k === 'kame') {
      // energy ball between the hands, growing with the charge, with sparks drawn into it
      const k = w.tool.p || 0,
        cx = f * 11,
        cy = -3,
        r = (2 + 11 * k) * (1 + 0.45 * ((w.tool.lv || 1) - 1));
      g.globalCompositeOperation = 'lighter';
      const rg = g.createRadialGradient(cx, cy, 0, cx, cy, r + 4);
      rg.addColorStop(0, 'rgba(255,255,255,1)');
      rg.addColorStop(0.5, 'rgba(130,205,255,.85)');
      rg.addColorStop(1, 'rgba(50,130,255,0)');
      g.fillStyle = rg;
      g.beginPath();
      g.arc(cx, cy, r + 4, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(190,230,255,.8)';
      g.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const an = G.time * 9 + i * 1.05,
          d0 = r + 16 - ((G.time * 40 + i * 7) % 14);
        g.beginPath();
        g.moveTo(cx + Math.cos(an) * d0, cy + Math.sin(an) * d0);
        g.lineTo(cx + Math.cos(an) * (d0 - 5), cy + Math.sin(an) * (d0 - 5));
        g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
    } else if (w.tool.k === 'hyaku') {
      if (!w.tool.p) {
        // gatling of fists: a blur of fists flickering in front of the worm, with impact stars
        for (let i = 0; i < 7; i++) {
          const fx = f * (9 + Math.random() * 14),
            fy = -2 + (Math.random() - 0.5) * 16;
          g.fillStyle = 'rgba(255,230,160,.35)';
          g.beginPath();
          g.arc(fx - f * 5, fy, 3.4, 0, TAU);
          g.fill();
          g.fillStyle = '#f4b9a8';
          g.strokeStyle = '#0c1524';
          g.lineWidth = 0.8;
          g.beginPath();
          g.arc(fx, fy, 2.7, 0, TAU);
          g.fill();
          g.stroke();
        }
      } else if (w.tool.p === 1) {
        // dash: speed lines streaming behind the worm
        g.strokeStyle = 'rgba(255,255,255,.7)';
        g.lineWidth = 1.2;
        for (let i = 0; i < 6; i++) {
          const ly = (i - 2.5) * 4;
          g.beginPath();
          g.moveTo(-f * 8, ly);
          g.lineTo(-f * (22 + Math.random() * 22), ly);
          g.stroke();
        }
      }
    }
  }
  // shooter of a Proton Stream: a proton pack on the back and a rifle aimed at the locked target
  const rig = protonRig(w);
  if (rig) {
    const tg = wById(rig.net[0]),
      an = tg ? Math.atan2(tg.y - (w.y - 3), tg.x - w.x) : 0,
      dx = Math.cos(an),
      dy = Math.sin(an),
      bf = w.face || 1;
    g.fillStyle = '#586377';
    g.strokeStyle = '#0c1524';
    g.lineWidth = 1;
    g.fillRect(-bf * 8 - 3, -7, 6, 10);
    g.strokeRect(-bf * 8 - 3, -7, 6, 10);
    g.fillStyle = `rgba(255,140,30,${0.6 + 0.4 * Math.sin(G.time * 16)})`;
    g.fillRect(-bf * 8 - 1.5, -5, 3, 3);
    g.lineCap = 'round';
    for (const [lw, col] of [
      [4.2, '#0c1524'],
      [2.6, '#a9b4c2'],
    ]) {
      g.strokeStyle = col;
      g.lineWidth = lw;
      g.beginPath();
      g.moveTo(dx * 3, -3 + dy * 3);
      g.lineTo(dx * 15, -3 + dy * 15);
      g.stroke();
    }
    g.strokeStyle = '#ff8a1f';
    g.lineWidth = 2.6;
    g.beginPath();
    g.moveTo(dx * 15, -3 + dy * 15);
    g.lineTo(dx * 19, -3 + dy * 19);
    g.stroke();
  }
  if (swell > 0) {
    // the blob: reddening skin with pulsing veins
    g.fillStyle = `rgba(190,15,40,${0.12 + 0.4 * swell})`;
    g.beginPath();
    g.arc(0, 0, 9 + 2 * swell, 0, TAU);
    g.fill();
    g.strokeStyle = `rgba(110,0,20,${0.4 + 0.5 * swell})`;
    g.lineWidth = 0.8;
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26 + 0.4,
        p = 0.5 + 0.5 * Math.sin(G.time * 12 + i);
      g.beginPath();
      g.moveTo(Math.cos(a) * 3, Math.sin(a) * 3);
      g.lineTo(Math.cos(a + 0.3 * p) * (7 + 2 * swell), Math.sin(a + 0.3 * p) * (7 + 2 * swell));
      g.stroke();
    }
  }
  // marked by the Hokuto Hyakuretsu Ken: a pulsing red aura until the blast
  if (w.doom > 0) {
    const pu = Math.sin(G.time * 14);
    g.strokeStyle = `rgba(255,50,40,${0.55 + 0.35 * pu})`;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 0, 12 + pu * 1.5, 0, TAU);
    g.stroke();
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
  const hp = String(shownHp(w)),
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

/** Weapon icons as Image objects for canvas drawing (the PNG data URLs come from weaponIconURL). */
const ICON_IMGS = {};
/**
 * While the worm hangs on the rope / flies with the jet pack and another weapon is selected, a small
 * box next to it shows that weapon's icon: Jump fires it, Space lets go.
 */
function drawHeldWeaponBox(w) {
  if (w.dead || !(G.phase === 'turn' || G.phase === 'retreat') || !holdingOther(w)) return;
  const id = G.weapon.id,
    s = 1 / CAM.s,
    sz = 26 * s;
  let im = ICON_IMGS[id];
  if (!im) {
    im = ICON_IMGS[id] = new Image();
    im.src = weaponIconURL(id);
  }
  const t = G.teams[w.team],
    x = w.x + 14 * s,
    y = w.y - 14 * s - sz / 2;
  ctx2.save();
  ctx2.fillStyle = 'rgba(8,16,30,.78)';
  ctx2.strokeStyle = t.color;
  ctx2.lineWidth = 1.5 * s;
  ctx2.beginPath();
  ctx2.roundRect(x, y, sz, sz, 5 * s);
  ctx2.fill();
  ctx2.stroke();
  if (im.complete && im.naturalWidth) ctx2.drawImage(im, x + 2 * s, y + 2 * s, sz - 4 * s, sz - 4 * s);
  ctx2.restore();
}

/**
 * Draws the aim reticle and the charge dots for the active worm. Nothing is drawn for weapons
 * that are not aimed (click-targeted, instant or tool weapons).
 */
function drawAim(w) {
  const W = G.weapon,
    d = WEAPONS[W.id];
  if (!d || G.phase !== 'turn' || w.tool || ((w.jet || w.rope) && !holdingOther(w)) || w.dead) return;
  if ((d.click && ! d.id === 'homing') || d.instant || d.id === 'jetpack' || d.id === 'blowtorch' || d.id === 'drill')
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
