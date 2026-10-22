'use strict';

/**
 * @file icons.js - Weapon icons
 *
 * Every weapon gets a small hand-drawn vector icon. Icons are drawn once on a 64x64 canvas and
 * cached as data URLs, so the HUD can use them as ordinary <img> sources (no image assets).
 *
 * To give a new weapon an icon, add an entry to ICON_DRAW keyed by the weapon id. Weapons
 * without an entry get a generic badge showing their two-letter `code`.
 *
 * Depends on: core (WEAPONS)
 * Globals defined: ICON_SIZE, IC, icPaint, icRect, icCircle, icEllipse, icPoly, icLine, icFlame,
 *     icGrenade, icWormHead, ICON_DRAW, ICON_URLS, weaponIconURL
 */

/** Icon canvas size in pixels (drawing coordinates are 0..64). */
const ICON_SIZE = 64;

/** Icon palette. INK is the outline colour shared by every shape. */
const IC = {
  ink: '#0c1524',
  steel: '#a9b4c2',
  dsteel: '#586377',
  red: '#e5473c',
  green: '#5a9a3e',
  dgreen: '#35662a',
  yellow: '#ffd23f',
  orange: '#ff8a1f',
  brown: '#9a6a35',
  white: '#f4f6fa',
  blue: '#4aa3e8',
  skin: '#f4b9a8',
  gold: '#ffd86a',
};

/* ---- Drawing primitives. Each fills (when `fill` is given) and then outlines the shape. ---- */

/** Fills and outlines the current path. */
function icPaint(g, fill) {
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  g.stroke();
}
/** Rounded rectangle. */
function icRect(g, x, y, w, h, fill, r = 3) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  icPaint(g, fill);
}
/** Circle. */
function icCircle(g, x, y, r, fill) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  icPaint(g, fill);
}
/** Ellipse. */
function icEllipse(g, x, y, rx, ry, fill, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  icPaint(g, fill);
}
/** Closed polygon from a flat [x0, y0, x1, y1, ...] list. */
function icPoly(g, pts, fill) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  icPaint(g, fill);
}
/** Thick line with an outline (drawn as a wide ink line under a narrower coloured one). */
function icLine(g, x1, y1, x2, y2, w, col) {
  g.save();
  for (const [lw, c] of [
    [w + 3, IC.ink],
    [w, col],
  ]) {
    g.lineWidth = lw;
    g.strokeStyle = c;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
  }
  g.restore();
}
/** Teardrop flame centred on (x, y) with size s. */
function icFlame(g, x, y, s) {
  const drop = k => {
    g.beginPath();
    g.moveTo(x, y - s * k);
    g.bezierCurveTo(
      x + s * 0.9 * k,
      y - s * 0.2 * k,
      x + s * 0.6 * k,
      y + s * 0.7 * k,
      x,
      y + s * 0.7 * k
    );
    g.bezierCurveTo(
      x - s * 0.6 * k,
      y + s * 0.7 * k,
      x - s * 0.9 * k,
      y - s * 0.2 * k,
      x,
      y - s * k
    );
  };
  drop(1);
  icPaint(g, IC.orange);
  drop(0.55);
  g.fillStyle = IC.yellow;
  g.fill();
}
/** Grenade body shared by several icons: a ridged oval with a lever. */
function icGrenade(g, cx, cy, r, col) {
  icRect(g, cx - r * 0.25, cy - r * 1.35, r * 0.5, r * 0.5, IC.dsteel, 2);
  icCircle(g, cx, cy, r, col);
  g.save();
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(cx - r * 0.85, cy - r * 0.25);
  g.lineTo(cx + r * 0.85, cy - r * 0.25);
  g.moveTo(cx - r * 0.85, cy + r * 0.3);
  g.lineTo(cx + r * 0.85, cy + r * 0.3);
  g.stroke();
  g.restore();
}
/** Small stylised worm head used by a few icons. */
function icWormHead(g, x, y, r, band) {
  icCircle(g, x, y, r, IC.skin);
  icRect(g, x - r, y - r * 0.55, r * 2, r * 0.45, band, 2);
  icCircle(g, x + r * 0.35, y + r * 0.1, r * 0.3, IC.white);
}

/**
 * Icon painters keyed by weapon id. Each receives a 2D context that is already set up with
 * the outline style (round joins, 3px ink stroke).
 */
const ICON_DRAW = {
  bazooka(g) {
    icRect(g, 6, 24, 38, 14, IC.dgreen);
    icRect(g, 40, 21, 9, 20, IC.dsteel);
    icPoly(g, [49, 26, 61, 31, 49, 36], IC.red);
    icRect(g, 17, 38, 8, 12, IC.dsteel);
  },
  homing(g) {
    icPoly(g, [8, 26, 1, 19, 16, 26], IC.red);
    icPoly(g, [8, 38, 1, 45, 16, 38], IC.red);
    icRect(g, 8, 26, 30, 12, IC.steel);
    icPoly(g, [38, 26, 52, 32, 38, 38], IC.red);
    g.strokeStyle = IC.red;
    icCircle(g, 47, 14, 8);
    g.beginPath();
    g.moveTo(47, 4);
    g.lineTo(47, 24);
    g.moveTo(37, 14);
    g.lineTo(57, 14);
    g.stroke();
  },
  mortar(g) {
    icRect(g, 12, 52, 40, 7, IC.dsteel);
    g.save();
    g.translate(32, 38);
    g.rotate(-0.55);
    icRect(g, -7, -30, 14, 42, IC.dgreen);
    icRect(g, -10, -33, 20, 7, IC.dsteel);
    g.restore();
    icCircle(g, 46, 8, 4.5, IC.yellow);
  },
  grenade(g) {
    icPoly(g, [34, 16, 52, 20, 52, 26, 34, 24], IC.steel);
    icGrenade(g, 31, 40, 17, IC.green);
    icCircle(g, 18, 15, 6);
  },
  cluster(g) {
    icGrenade(g, 24, 38, 14, IC.green);
    for (const [x, y] of [
      [46, 16],
      [53, 34],
      [43, 50],
    ])
      icCircle(g, x, y, 6.5, IC.orange);
  },
  banana(g) {
    g.save();
    g.lineCap = 'round';
    g.beginPath();
    g.arc(32, 22, 22, 0.35, 2.8);
    g.lineWidth = 15;
    g.strokeStyle = IC.ink;
    g.stroke();
    g.lineWidth = 9;
    g.strokeStyle = IC.yellow;
    g.stroke();
    g.restore();
    icCircle(g, 52, 33, 3, IC.brown);
    icCircle(g, 12, 33, 3, IC.brown);
  },
  holy(g) {
    g.save();
    g.strokeStyle = IC.yellow;
    g.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.beginPath();
      g.moveTo(32 + Math.cos(a) * 25, 40 + Math.sin(a) * 25);
      g.lineTo(32 + Math.cos(a) * 30, 40 + Math.sin(a) * 30);
      g.stroke();
    }
    g.restore();
    icCircle(g, 32, 42, 15, IC.gold);
    icRect(g, 29, 6, 6, 20, IC.gold, 2);
    icRect(g, 23, 11, 18, 6, IC.gold, 2);
  },
  petrol(g) {
    icRect(g, 26, 14, 12, 14, IC.orange, 3);
    icRect(g, 17, 26, 30, 30, IC.orange, 7);
    icRect(g, 22, 36, 20, 10, IC.white, 2);
    icFlame(g, 32, 8, 8);
  },
  dynamite(g) {
    icRect(g, 12, 26, 13, 32, IC.red, 3);
    icRect(g, 25, 22, 13, 36, IC.red, 3);
    icRect(g, 38, 26, 13, 32, IC.red, 3);
    icRect(g, 10, 38, 44, 7, '#7a1710', 2);
    g.beginPath();
    g.moveTo(32, 22);
    g.quadraticCurveTo(36, 12, 46, 10);
    g.stroke();
    icFlame(g, 48, 8, 7);
  },
  mine(g) {
    icRect(g, 8, 42, 48, 9, '#2a2f38', 3);
    g.beginPath();
    g.arc(32, 42, 21, Math.PI, 0);
    g.closePath();
    icPaint(g, IC.dsteel);
    for (const x of [14, 26, 38, 50])
      icRect(g, x - 2, 14 + Math.abs(x - 32) * 0.35, 4, 7, IC.steel, 1);
    icCircle(g, 32, 28, 5, IC.red);
  },
  sheep(g) {
    icRect(g, 20, 44, 5, 12, IC.ink, 1);
    icRect(g, 40, 44, 5, 12, IC.ink, 1);
    for (const [x, y, r] of [
      [22, 34, 11],
      [34, 28, 12],
      [44, 36, 10],
      [32, 40, 11],
    ])
      icCircle(g, x, y, r, IC.white);
    icEllipse(g, 52, 32, 7, 8, '#2a2f38');
    icCircle(g, 54, 29, 1.6, IC.white);
  },
  supersheep(g) {
    icPoly(g, [20, 26, 2, 14, 6, 38], IC.red);
    for (const [x, y, r] of [
      [26, 34, 10],
      [36, 29, 11],
      [44, 36, 9],
      [33, 40, 10],
    ])
      icCircle(g, x, y, r, IC.white);
    icEllipse(g, 53, 32, 7, 8, '#2a2f38');
    icCircle(g, 55, 29, 1.6, IC.white);
    icLine(g, 6, 50, 22, 50, 3, IC.yellow);
    icLine(g, 10, 56, 26, 56, 3, IC.yellow);
  },
  shotgun(g) {
    icPoly(g, [42, 26, 60, 32, 60, 46, 44, 40], IC.brown);
    icRect(g, 4, 24, 42, 7, IC.dsteel, 2);
    icRect(g, 12, 32, 20, 6, IC.brown, 2);
    g.beginPath();
    g.arc(40, 40, 5, 0, Math.PI);
    g.stroke();
  },
  handgun(g) {
    icRect(g, 6, 20, 40, 11, IC.dsteel, 3);
    icPoly(g, [34, 31, 46, 31, 42, 54, 31, 54], IC.brown);
    icRect(g, 2, 22, 6, 7, IC.steel, 1);
    g.beginPath();
    g.arc(30, 36, 5, 0, Math.PI);
    g.stroke();
  },
  uzi(g) {
    icRect(g, 3, 28, 12, 5, IC.steel, 1);
    icRect(g, 12, 22, 36, 15, IC.dsteel, 3);
    icRect(g, 46, 25, 14, 5, IC.steel, 1);
    icRect(g, 22, 36, 9, 20, IC.steel, 2);
    icRect(g, 38, 36, 8, 14, IC.dsteel, 2);
  },
  firepunch(g) {
    icFlame(g, 14, 36, 14);
    icRect(g, 40, 28, 18, 16, IC.red, 3);
    icRect(g, 20, 22, 26, 26, IC.skin, 8);
    g.beginPath();
    for (const y of [29, 35, 41]) {
      g.moveTo(20, y);
      g.lineTo(32, y);
    }
    g.stroke();
  },
  dragonball(g) {
    icCircle(g, 32, 32, 24, IC.orange);
    g.fillStyle = 'rgba(255,255,255,.45)';
    g.beginPath();
    g.ellipse(24, 22, 7, 4, -0.7, 0, Math.PI * 2);
    g.fill();
    for (const [x, y] of [
      [28, 30],
      [38, 28],
      [34, 40],
      [26, 41],
    ])
      icCircle(g, x, y, 3.2, IC.red);
  },
  bat(g) {
    g.save();
    g.translate(32, 32);
    g.rotate(-0.8);
    icPoly(g, [-3, 28, 3, 28, 8, -22, 4, -28, -4, -28, -8, -22], IC.brown);
    icRect(g, -4, 24, 8, 6, '#2a2f38', 2);
    g.restore();
  },
  kamikaze(g) {
    icFlame(g, 8, 34, 11);
    icWormHead(g, 36, 32, 17, IC.red);
    icPoly(g, [22, 22, 12, 12, 16, 26], IC.red);
  },
  airstrike(g) {
    icPoly(g, [4, 16, 40, 14, 58, 22, 40, 28, 28, 40, 22, 28, 4, 26], IC.steel);
    icPoly(g, [4, 16, 2, 8, 12, 15], IC.dsteel);
    icEllipse(g, 42, 52, 6, 9, IC.dsteel, 0.5);
    icEllipse(g, 24, 54, 5, 8, IC.dsteel, -0.4);
  },
  napalm(g) {
    icFlame(g, 32, 48, 17);
    icEllipse(g, 32, 24, 19, 10, IC.orange);
    icPoly(g, [14, 24, 6, 14, 18, 18], IC.dsteel);
  },
  minestrike(g) {
    icPoly(g, [6, 8, 36, 6, 54, 12, 36, 18, 26, 26, 22, 18, 6, 16], IC.steel);
    g.beginPath();
    g.arc(32, 56, 14, Math.PI, 0);
    g.closePath();
    icPaint(g, IC.dsteel);
    icCircle(g, 32, 48, 3, IC.red);
    icLine(g, 14, 30, 14, 38, 2.5, IC.steel);
    icLine(g, 50, 28, 50, 36, 2.5, IC.steel);
  },
  tsunami(g) {
    g.beginPath();
    g.moveTo(4, 58);
    g.lineTo(4, 40);
    g.quadraticCurveTo(14, 36, 22, 24);
    g.quadraticCurveTo(32, 4, 52, 8);
    g.quadraticCurveTo(44, 12, 46, 20);
    g.quadraticCurveTo(56, 26, 60, 40);
    g.lineTo(60, 58);
    g.closePath();
    icPaint(g, IC.blue);
    icCircle(g, 50, 11, 4, IC.white);
    icCircle(g, 44, 18, 3, IC.white);
    icCircle(g, 36, 12, 3.2, IC.white);
    icLine(g, 8, 50, 20, 46, 2.5, IC.white);
    icLine(g, 28, 54, 44, 48, 2.5, IC.white);
  },
  earthquake(g) {
    icRect(g, 6, 34, 52, 24, IC.brown, 3);
    icLine(g, 32, 34, 26, 44, 3, IC.ink);
    icLine(g, 26, 44, 36, 50, 3, IC.ink);
    icLine(g, 36, 50, 30, 58, 3, IC.ink);
    icLine(g, 10, 24, 14, 16, 3, IC.orange);
    icLine(g, 24, 22, 28, 10, 3, IC.orange);
    icLine(g, 40, 22, 36, 10, 3, IC.orange);
    icLine(g, 54, 24, 50, 16, 3, IC.orange);
  },
  dragonfire(g) {
    icFlame(g, 50, 36, 15);
    icPoly(g, [8, 20, 14, 8, 20, 18], IC.red);
    icPoly(g, [6, 26, 30, 14, 44, 26, 44, 40, 20, 46, 8, 38], IC.green);
    icPoly(g, [20, 14, 26, 4, 32, 14], IC.dgreen);
    icCircle(g, 28, 24, 3, IC.yellow);
    icPoly(g, [36, 34, 46, 36, 36, 40], IC.white);
  },
  thunder(g) {
    icCircle(g, 20, 20, 12, IC.steel);
    icCircle(g, 34, 14, 13, IC.steel);
    icCircle(g, 46, 22, 10, IC.steel);
    icRect(g, 12, 20, 42, 12, IC.steel, 5);
    icPoly(g, [34, 28, 22, 46, 31, 46, 26, 62, 46, 38, 36, 38, 42, 28], IC.yellow);
  },
  hammer(g) {
    icLine(g, 22, 58, 40, 24, 5, IC.brown);
    icPoly(g, [26, 10, 56, 6, 60, 22, 30, 26], IC.steel);
    icPoly(g, [26, 10, 56, 6, 57, 11, 27, 15], IC.white);
    icPoly(g, [50, 28, 42, 40, 47, 40, 41, 54, 56, 36, 49, 36, 54, 28], IC.yellow);
  },
  timecar(g) {
    icFlame(g, 8, 38, 12);
    icPoly(g, [14, 44, 14, 34, 26, 32, 32, 20, 46, 20, 52, 32, 60, 36, 60, 44], IC.steel);
    icPoly(g, [32, 32, 35, 24, 44, 24, 48, 32], IC.blue);
    icCircle(g, 24, 46, 6, IC.ink);
    icCircle(g, 24, 46, 3, IC.orange);
    icCircle(g, 50, 46, 6, IC.ink);
    icCircle(g, 50, 46, 3, IC.orange);
  },
  tornado(g) {
    icEllipse(g, 32, 12, 26, 7, IC.steel, 0);
    icEllipse(g, 32, 24, 20, 6, IC.steel, 0);
    icEllipse(g, 33, 35, 14, 5, IC.dsteel, 0);
    icEllipse(g, 32, 45, 9, 4, IC.steel, 0);
    icEllipse(g, 31, 55, 4, 3, IC.dsteel, 0);
  },
  donkey(g) {
    icRect(g, 12, 44, 7, 14, '#6e7480', 2);
    icRect(g, 36, 44, 7, 14, '#6e7480', 2);
    icRect(g, 8, 22, 38, 24, '#9aa0aa', 6);
    icRect(g, 40, 12, 16, 17, '#9aa0aa', 5);
    icRect(g, 42, 3, 4, 11, '#9aa0aa', 1);
    icRect(g, 50, 3, 4, 11, '#9aa0aa', 1);
    icLine(g, 8, 28, 2, 40, 3, '#6e7480');
    icCircle(g, 51, 19, 2, IC.ink);
  },
  armageddon(g) {
    icPoly(g, [38, 38, 4, 6, 20, 8, 44, 30], IC.orange);
    icCircle(g, 42, 40, 14, '#7a3b1a');
    icCircle(g, 38, 36, 4, '#a85a2a');
    icPoly(g, [56, 30, 38, 6, 48, 6, 60, 22], IC.red);
    icCircle(g, 54, 20, 5, IC.orange);
  },
  nuke(g) {
    icPoly(g, [22, 54, 28, 28, 38, 28, 44, 54], IC.orange);
    icEllipse(g, 32, 52, 22, 6, '#aa5a1a');
    icEllipse(g, 32, 22, 22, 14, IC.red);
    icEllipse(g, 32, 24, 14, 8, IC.yellow);
  },
  scales(g) {
    icRect(g, 17, 52, 30, 6, IC.dsteel, 2);
    icRect(g, 30, 14, 5, 40, IC.steel, 1);
    icRect(g, 8, 11, 48, 5, IC.gold, 2);
    for (const x of [11, 53]) {
      icLine(g, x, 16, x - 7, 34, 2, IC.steel);
      icLine(g, x, 16, x + 7, 34, 2, IC.steel);
      g.beginPath();
      g.arc(x, 34, 8, 0, Math.PI);
      g.closePath();
      icPaint(g, IC.gold);
    }
  },
  rope(g) {
    g.save();
    g.lineWidth = 9;
    g.strokeStyle = IC.ink;
    g.beginPath();
    g.arc(30, 40, 15, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 5;
    g.strokeStyle = '#d9c28a';
    g.stroke();
    g.restore();
    icCircle(g, 30, 40, 5, '#d9c28a');
    g.beginPath();
    g.arc(48, 14, 8, Math.PI * 0.6, Math.PI * 2.1);
    g.lineWidth = 4;
    g.strokeStyle = IC.steel;
    g.stroke();
    icLine(g, 42, 20, 36, 28, 3, '#d9c28a');
  },
  jetpack(g) {
    icFlame(g, 22, 54, 10);
    icFlame(g, 42, 54, 10);
    icRect(g, 12, 10, 16, 36, IC.dsteel, 7);
    icRect(g, 36, 10, 16, 36, IC.dsteel, 7);
    icRect(g, 10, 22, 44, 7, IC.red, 2);
    icRect(g, 14, 12, 12, 5, IC.steel, 2);
    icRect(g, 38, 12, 12, 5, IC.steel, 2);
  },
  teleport(g) {
    icEllipse(g, 32, 32, 24, 28, IC.blue);
    icEllipse(g, 32, 32, 16, 20, '#9fd8ff');
    icEllipse(g, 32, 32, 8, 11, IC.white);
    icLine(g, 6, 8, 12, 14, 2, IC.white);
    icLine(g, 58, 52, 52, 46, 2, IC.white);
  },
  girder(g) {
    icRect(g, 4, 20, 56, 24, '#7d8aa0', 2);
    g.beginPath();
    for (let x = 4; x < 52; x += 16) {
      g.moveTo(x, 20);
      g.lineTo(x + 16, 44);
      g.moveTo(x + 16, 20);
      g.lineTo(x, 44);
    }
    g.stroke();
    for (const [x, y] of [
      [9, 25],
      [9, 39],
      [55, 25],
      [55, 39],
    ])
      icCircle(g, x, y, 2, IC.steel);
  },
  blowtorch(g) {
    icRect(g, 12, 38, 14, 18, IC.red, 4);
    icRect(g, 6, 26, 32, 13, IC.dsteel, 4);
    icRect(g, 36, 29, 10, 7, IC.steel, 2);
    icPoly(g, [46, 28, 62, 32.5, 46, 37, 50, 32.5], IC.blue);
  },
  drill(g) {
    icRect(g, 2, 20, 12, 24, IC.red, 4);
    icPoly(g, [14, 24, 14, 40, 58, 32], IC.steel);
    icLine(g, 24, 38, 30, 26, 2.5, IC.dsteel);
    icLine(g, 36, 36, 41, 28, 2.5, IC.dsteel);
    icLine(g, 46, 34, 49, 30, 2, IC.dsteel);
  },
  parachute(g) {
    g.beginPath();
    g.arc(32, 26, 26, Math.PI, 0);
    g.closePath();
    icPaint(g, IC.red);
    g.save();
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(32, 0);
    g.quadraticCurveTo(14, 10, 12, 26);
    g.moveTo(32, 0);
    g.quadraticCurveTo(50, 10, 52, 26);
    g.moveTo(32, 0);
    g.lineTo(32, 26);
    g.stroke();
    g.restore();
    icLine(g, 8, 27, 28, 48, 1.6, IC.white);
    icLine(g, 56, 27, 36, 48, 1.6, IC.white);
    icWormHead(g, 32, 53, 6, IC.red);
  },
  select(g) {
    icWormHead(g, 20, 42, 12, IC.blue);
    icWormHead(g, 42, 36, 12, IC.red);
    icPoly(g, [44, 4, 44, 24, 50, 18, 55, 28, 59, 26, 54, 16, 62, 16], IC.white);
  },
  skip(g) {
    icPoly(g, [6, 14, 28, 32, 6, 50], IC.blue);
    icPoly(g, [28, 14, 50, 32, 28, 50], IC.blue);
    icRect(g, 52, 14, 6, 36, IC.blue, 2);
  },
  surrender(g) {
    icRect(g, 12, 6, 5, 54, IC.brown, 2);
    g.beginPath();
    g.moveTo(17, 10);
    g.bezierCurveTo(30, 4, 40, 18, 56, 12);
    g.lineTo(56, 34);
    g.bezierCurveTo(40, 40, 30, 26, 17, 32);
    g.closePath();
    icPaint(g, IC.white);
  },
};

/** Cache of generated data URLs, keyed by weapon id. */
const ICON_URLS = {};

/**
 * Returns a PNG data URL for the weapon's icon (generated on first use, then cached).
 * @param {string} id weapon id
 * @returns {string} data URL usable as an <img> src
 */
function weaponIconURL(id) {
  if (ICON_URLS[id]) return ICON_URLS[id];
  const cv = document.createElement('canvas');
  cv.width = cv.height = ICON_SIZE;
  const g = cv.getContext('2d');
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = IC.ink;
  g.lineWidth = 3;
  const paint = ICON_DRAW[id];
  if (paint) paint(g);
  else {
    // Generic fallback badge with the weapon's code.
    icCircle(g, 32, 32, 24, IC.dsteel);
    g.fillStyle = IC.white;
    g.font = 'bold 22px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText((WEAPONS[id] && WEAPONS[id].code) || '?', 32, 33);
  }
  ICON_URLS[id] = cv.toDataURL();
  return ICON_URLS[id];
}
