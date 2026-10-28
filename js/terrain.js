'use strict';

/**
 * @file terrain.js - Terrain
 *
 * Random level generation (7 styles), terrain painting to an offscreen canvas, and destructive
 * edits (craters, girders). The solidity mask (T.mask) is the single source of truth for
 * collisions.
 *
 * Depends on: util, themes (custommap is used at run time for style "custom")
 * Globals defined: T, SIZES, valueNoise, makeFbm, cleanTerrain, chooseTheme, generateTerrain, paintTerrain, solid, carve,
 *     addGirder
 */

/* ===== Terrain ===== */

/**
 * The current level. Shared (global) because collision, rendering, AI and networking all read it.
 *   w, h        world size in pixels
 *   mask        Uint8Array(w*h), 1 = solid. THE source of truth for collisions.
 *   cv, ctx     offscreen canvas holding the painted terrain (what is drawn on screen)
 *   theme       the active THEMES entry (themeName is its key)
 *   waterBase   y of the water surface at the start of the match
 */
const T = {
  w: 0,
  h: 0,
  mask: null,
  cv: null,
  ctx: null,
  theme: THEMES.grass,
  themeName: 'grass',
  waterBase: 0,
};
/** World sizes [width, height] by the menu's size option. */
const SIZES = { s: [1600, 800], m: [2400, 1000], l: [3200, 1100] };

/**
 * 1D smooth value noise: random values on an integer lattice, smoothly interpolated.
 * @param {() => number} rng seeded generator
 * @param {number} n lattice size (the pattern repeats every n units)
 * @returns {(x: number) => number} noise function returning [0, 1)
 */
function valueNoise(rng, n) {
  const a = [];
  for (let i = 0; i < n; i++) a.push(rng());
  return x => {
    const i = Math.floor(x),
      f = x - i,
      t = f * f * (3 - 2 * f);
    const A = a[((i % n) + n) % n],
      B = a[(((i + 1) % n) + n) % n];
    return A + (B - A) * t;
  };
}
/** Fractal noise: three octaves of valueNoise mixed together (broad hills + medium bumps + fine detail). */
function makeFbm(rng) {
  const n1 = valueNoise(rng, 97),
    n2 = valueNoise(rng, 89),
    n3 = valueNoise(rng, 83);
  return x => n1(x * 0.0035) * 0.62 + n2(x * 0.011) * 0.27 + n3(x * 0.034) * 0.11;
}

/**
 * Tidies a freshly generated mask: removes tiny floating specks of ground and fills tiny sealed air
 * bubbles (flood fill on 4-neighbours). Keeps big caves and every sizeable island.
 * @param {Uint8Array} mask solidity mask (modified)
 * @param {number} w width
 * @param {number} h height
 * @param {number} minSolid ground components smaller than this many pixels are erased
 * @param {number} minAir enclosed air components smaller than this are filled
 */
function cleanTerrain(mask, w, h, minSolid, minAir) {
  const seen = new Uint8Array(w * h),
    stack = new Int32Array(w * h),
    order = new Int32Array(w * h);
  for (const val of [1, 0]) {
    seen.fill(0);
    for (let s = 0; s < w * h; s++) {
      if (seen[s] || mask[s] !== val) continue;
      let sp = 0,
        count = 0,
        edge = false;
      stack[sp++] = s;
      seen[s] = 1;
      while (sp) {
        const i = stack[--sp],
          x = i % w,
          y = (i / w) | 0;
        order[count++] = i;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
        if (x > 0 && !seen[i - 1] && mask[i - 1] === val)
          ((seen[i - 1] = 1), (stack[sp++] = i - 1));
        if (x < w - 1 && !seen[i + 1] && mask[i + 1] === val)
          ((seen[i + 1] = 1), (stack[sp++] = i + 1));
        if (y > 0 && !seen[i - w] && mask[i - w] === val)
          ((seen[i - w] = 1), (stack[sp++] = i - w));
        if (y < h - 1 && !seen[i + w] && mask[i + w] === val)
          ((seen[i + w] = 1), (stack[sp++] = i + w));
      }
      if (val === 1 && count < minSolid) for (let k = 0; k < count; k++) mask[order[k]] = 0;
      else if (val === 0 && !edge && count < minAir)
        for (let k = 0; k < count; k++) mask[order[k]] = 1;
    }
  }
}

/**
 * Resolves the theme ("random" picks one deterministically from the seed stream) into T.theme.
 * @param {object} cfg match options (cfg.theme)
 * @param {function} rng seeded random generator
 */
function chooseTheme(cfg, rng) {
  const names = Object.keys(THEMES).filter(k => !THEMES[k].special); // 'random' keeps to the everyday themes
  T.themeName =
    cfg.theme === 'random'
      ? names[Math.floor(rng() * names.length)]
      : THEMES[cfg.theme]
        ? cfg.theme
        : 'grass';
  T.theme = THEMES[T.themeName];
  T.sky = SKIES.includes(cfg.sky) ? cfg.sky : 'day';
}
/** Scatters the theme's scenery props (theme-fx.js) once the level exists. */
const buildThemeProps = cfg => typeof themeFxBuild === 'function' && themeFxBuild(cfg);

/**
 * Builds a new random level and stores it in T.
 *
 * The result depends only on `cfg` (seed, style, theme, size), so online guests can regenerate
 * the exact same level from the seed the host sends.
 *
 * Styles: 'hills' | 'islands' | 'caves' | 'plateau' | 'canyon'.
 * To add a style, add another `else if (style === '...')` branch below that fills `mask`
 * (and add the option to index.html and STYLES in menu.js).
 *
 * @param {{seed: string, style: string, theme: string, size: 's'|'m'|'l'}} cfg
 */
function generateTerrain(cfg) {
  const rng = mulberry(hashStr(String(cfg.seed)));
  // Imported picture: no generation, the picture is the level.
  if (cfg.style === 'custom' && MAPS.custom) {
    chooseTheme(cfg, rng);
    buildCustomTerrain();
    buildThemeProps(cfg);
    return;
  }
  const [w, h] = SIZES[cfg.size] || SIZES.m;
  T.w = w;
  T.h = h;
  const mask = (T.mask = new Uint8Array(w * h));
  const style = cfg.style;
  const fbm = makeFbm(rng),
    fbm2 = makeFbm(rng);
  const floorY = h - 50;
  // Pushes the land down towards both map edges so the level slopes into the water instead of
  // ending in a cliff at the border.
  const edgeDrop = x => {
    const e = Math.min(x, w - 1 - x) / 200;
    return e < 1 ? Math.pow(1 - e, 2) * h * 0.55 : 0;
  };

  // Fills every column from topFn(x) down to the (slightly ragged) floor of the map.
  const fillCols = topFn => {
    for (let x = 0; x < w; x++) {
      const top = Math.max(0, Math.floor(topFn(x)));
      const bot = Math.min(h, floorY + Math.floor((fbm2(x * 1.3) - 0.5) * 60));
      for (let y = top; y < bot; y++) mask[y * w + x] = 1;
    }
  };
  // Erases a filled circle from the mask (used for tunnels).
  const carveC = (cx, cy, r) => {
    for (let y = Math.max(0, (cy - r) | 0); y < Math.min(h, cy + r); y++) {
      const dx = Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy)));
      for (let x = Math.max(0, (cx - dx) | 0); x < Math.min(w, cx + dx); x++) mask[y * w + x] = 0;
    }
  };
  // Random-walk tunnels: a carving circle wanders through the lower half of the map.
  const tunnels = (n, rmin, rmax) => {
    for (let i = 0; i < n; i++) {
      let x = rng() * w,
        y = h * (0.5 + rng() * 0.3),
        a = rng() * TAU,
        r = rmin + rng() * (rmax - rmin);
      const steps = 40 + rng() * 80;
      for (let s = 0; s < steps; s++) {
        carveC(x, y, r);
        a += (rng() - 0.5) * 0.7;
        x += Math.cos(a) * r * 0.8;
        y += Math.sin(a) * r * 0.5;
        r = clamp(r + (rng() - 0.5) * 3, rmin, rmax);
        if (y < h * 0.4) a = Math.abs(a);
      }
    }
  };

  // Adds a filled, wobbly ellipse to the mask (floating rocks, island lobes).
  const blob = (cx, cy, rx, ry, wobAmt = 0.35) => {
    const ph = rng() * 1000;
    for (let y = Math.max(0, (cy - ry * 1.5) | 0); y < Math.min(h, cy + ry * 1.5); y++)
      for (let x = Math.max(0, (cx - rx * 1.5) | 0); x < Math.min(w, cx + rx * 1.5); x++) {
        const dx = (x - cx) / rx,
          dy = (y - cy) / ry;
        if (dx * dx + dy * dy < 1 + (fbm2(x * 1.3 + y * 1.9 + ph) - 0.5) * wobAmt * 2)
          mask[y * w + x] = 1;
      }
  };
  // Scatters n small floating rocks above the given ground height function.
  const rocks = (n, groundFn) => {
    for (let i = 0; i < n; i++) {
      const x = 120 + rng() * (w - 240),
        g = groundFn(x),
        y = Math.max(h * 0.12, g - 90 - rng() * 220);
      blob(x, y, 28 + rng() * 40, 12 + rng() * 14);
    }
  };
  // Smooth random bumps (positive = down) used to carve valleys or raise mounds into a height line.
  const bumps = (n, wmin, wmax, amin, amax) => {
    const list = [];
    for (let i = 0; i < n; i++)
      list.push([
        rng() * w,
        wmin + rng() * (wmax - wmin),
        (amin + rng() * (amax - amin)) * (rng() < 0.5 ? -1 : 1),
      ]);
    return x => list.reduce((s, [cx, bw, a]) => s + a * Math.exp(-(((x - cx) / bw) ** 2)), 0);
  };

  // ---- style: rolling hills with valleys, rocks and a few tunnels
  if (style === 'hills') {
    const base = h * (0.44 + rng() * 0.12),
      amp = h * (0.2 + rng() * 0.12),
      bump = bumps(2 + Math.round(rng() * 3), 140, 340, 50, 150);
    const top = x =>
      base +
      (fbm(x + (fbm2(x * 0.5) - 0.5) * 260) - 0.5) * 2 * amp +
      bump(x) +
      (fbm2(x * 5) - 0.5) * 12 +
      edgeDrop(x);
    fillCols(top);
    tunnels(Math.round(w / 500), 12, 24);
    if (rng() < 0.7) rocks(1 + Math.round(rng() * 3), top);
    // ---- style: terraces (heights snapped to steps of 80 px)
  } else if (style === 'plateau') {
    const step = 60 + Math.round(rng() * 4) * 12;
    fillCols(x => {
      const t = h * 0.35 + fbm(x) * h * 0.45;
      return Math.round(t / step) * step + edgeDrop(x) + (fbm2(x * 4) - 0.5) * 8;
    });
    tunnels(Math.round(w / 900), 14, 22);
    // ---- style: two high cliffs around a deep valley, joined by a couple of bridges
  } else if (style === 'canyon') {
    const cx = w * (0.38 + rng() * 0.24),
      vw = w * (0.12 + rng() * 0.08);
    fillCols(x => {
      const d = Math.abs(x - cx) / vw;
      const v = d < 1 ? Math.pow(1 - d, 0.6) : 0;
      return h * 0.3 + (fbm(x) - 0.5) * h * 0.25 + v * h * 0.5 + edgeDrop(x);
    });
    // a few bridges across the gap
    for (let b = 0; b < 2; b++) {
      const by = h * (0.42 + b * 0.18) + rng() * 40;
      for (let x = cx - vw * 1.1; x < cx + vw * 1.1; x++)
        for (let t = 0; t < 12; t++) {
          const yy = Math.floor(by + Math.sin(x * 0.02) * 6 + t);
          if (yy >= 0 && yy < h && x >= 0 && x < w) mask[yy * w + (x | 0)] = 1;
        }
    }
    tunnels(Math.round(w / 700), 12, 20);
    // ---- style: floating blobs of land plus a low ground slab
  } else if (style === 'islands') {
    const n = Math.round(w / 330);
    for (let i = 0; i < n; i++) {
      const cx = 160 + rng() * (w - 320),
        cy = h * 0.25 + rng() * h * 0.5;
      const rx = 90 + rng() * 170,
        ry = 30 + rng() * 55,
        ph = rng() * 1000;
      for (let y = Math.max(0, (cy - ry * 3) | 0); y < Math.min(floorY, cy + ry * 3); y++) {
        for (let x = Math.max(0, (cx - rx * 1.4) | 0); x < Math.min(w, cx + rx * 1.4); x++) {
          const dx = (x - cx) / rx;
          let dy = y - cy;
          dy = dy > 0 ? dy / (ry * 2.2) : dy / (ry * 0.55);
          const wob = (fbm(x + y * 1.7 + ph) - 0.5) * 0.7;
          if (dx * dx + dy * dy < 1 + wob) mask[y * w + (x | 0)] = 1;
        }
      }
    }
    // ground slab so a lowest platform always exists
    fillCols(x => h * 0.86 + (fbm(x) - 0.5) * 60 + edgeDrop(x) * 1.5);
    // ---- style: ridged mountain range with deep valleys, overhangs and floating rocks
  } else if (style === 'mountains') {
    // Ridged noise gives sharp crests; averaging a few nearby samples rounds the needle tips so
    // worms can actually stand on the peaks.
    const ridge = x => {
      const r1 = 1 - Math.abs(fbm(x * 1.3) * 2 - 1),
        r2 = 1 - Math.abs(fbm2(x * 2.2 + 700) * 2 - 1);
      return Math.pow(r1, 1.4) * 0.8 + r2 * 0.2;
    };
    const peak = x =>
      (ridge(x - 40) + ridge(x - 20) + ridge(x) + ridge(x + 20) + ridge(x + 40)) / 5;
    const top = x => h * 0.84 - peak(x) * h * 0.66 + edgeDrop(x) * 0.8;
    fillCols(top);
    tunnels(Math.round(w / 600), 14, 22);
    // undercut a few slopes so there are overhangs to hide under
    for (let i = 0; i < Math.round(w / 500); i++) {
      const x = 150 + rng() * (w - 300);
      carveC(x, top(x) + 50 + rng() * 40, 28 + rng() * 22);
    }
    rocks(2 + Math.round(rng() * 3), top);
    // ---- style: a chain of broad flat islands over open sea, with end shores and stepping stones
  } else if (style === 'archipelago') {
    const n = Math.max(3, Math.round(w / 520));
    for (let i = 0; i < n; i++) {
      const cx = ((i + 0.5) / n) * w + (rng() - 0.5) * 120,
        cy = h * (0.5 + (rng() - 0.5) * 0.3),
        rx = 150 + rng() * 140;
      blob(cx, cy, rx, 38 + rng() * 26, 0.5);
      blob(cx + (rng() - 0.5) * rx, cy + 40, rx * 0.7, 55 + rng() * 40, 0.6);
      // a small rock between this island and the next
      blob(cx + rx + 60 + rng() * 60, cy - 60 + rng() * 120, 26 + rng() * 24, 12 + rng() * 10);
    }
    // shores at both ends so worms can never be stranded far from land
    fillCols(x => (x < w * 0.1 || x > w * 0.9 ? h * 0.7 + (fbm(x) - 0.5) * 80 : 1e9));
    // ---- style: cellular-automata caverns (random fill, smoothed with the 4-5 rule)
  } else if (style === 'caves') {
    const gs = 10,
      gw = Math.ceil(w / gs),
      gh = Math.ceil(h / gs);
    let g = new Uint8Array(gw * gh);
    for (let y = 0; y < gh; y++)
      for (let x = 0; x < gw; x++) g[y * gw + x] = y > gh * 0.22 && rng() < 0.47 ? 1 : 0;
    for (let it = 0; it < 5; it++) {
      const n = new Uint8Array(gw * gh);
      for (let y = 0; y < gh; y++)
        for (let x = 0; x < gw; x++) {
          let c = 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const xx = x + dx,
                yy = y + dy;
              c += xx < 0 || xx >= gw || yy >= gh ? 1 : yy < 0 ? 0 : g[yy * gw + xx];
            }
          n[y * gw + x] = c > 4 ? 1 : c < 4 ? 0 : g[y * gw + x];
        }
      g = n;
    }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        mask[y * w + x] =
          y < floorY + (fbm2(x * 1.3) - 0.5) * 60 && g[((y / gs) | 0) * gw + ((x / gs) | 0)]
            ? 1
            : 0;
    // smooth blocky edges
    for (let pass = 0; pass < 2; pass++) {
      const src = mask.slice();
      for (let y = 2; y < h - 2; y++)
        for (let x = 2; x < w - 2; x++) {
          const i = y * w + x;
          let s = 0;
          for (let dy = -2; dy <= 2; dy += 2)
            for (let dx = -2; dx <= 2; dx += 2) s += src[(y + dy) * w + x + dx];
          mask[i] = s >= 5 ? 1 : 0;
        }
    }
    // roof landing: a gentle crust at the top so worms have a surface
    fillCols(x => h * 0.62 + (fbm(x) - 0.5) * 120 + edgeDrop(x));
    carveC(w / 2, h * 0.75, 40);
  }

  cleanTerrain(mask, w, h, 700, style === 'caves' ? 500 : 120);
  chooseTheme(cfg, rng);
  T.waterBase = h - 38;
  paintTerrain();
  buildThemeProps(cfg);
}

/**
 * Paints T.mask onto the offscreen canvas T.cv. Colours come from the theme: a surface layer a
 * few pixels deep, soil that darkens with depth, speckle noise, and a dark rim wherever solid
 * ground borders open air (cave ceilings, overhangs).
 */
function paintTerrain() {
  const { w, h, mask } = T,
    th = T.theme,
    tc = [0, 0, 0];
  const cv = (T.cv = T.cv || document.createElement('canvas'));
  cv.width = w;
  cv.height = h;
  const ctx = (T.ctx = cv.getContext('2d', { willReadFrequently: false }));
  const img = ctx.createImageData(w, h),
    d = img.data;
  for (let x = 0; x < w; x++) {
    let lastAir = -1;
    for (let y = 0; y < h; y++) {
      const i = y * w + x;
      if (!mask[i]) {
        lastAir = y;
        continue;
      }
      const depth = y - lastAir,
        n = hash2(x, y),
        n2 = hash2(x >> 2, y >> 2);
      let r, g, b;
      if (depth <= 5 + n2 * 3) {
        r = th.top[0];
        g = th.top[1];
        b = th.top[2];
        const k = 0.88 + n * 0.2 - depth * 0.012;
        r *= k;
        g *= k;
        b *= k;
      } else {
        const t = clamp((depth - 8) / 260, 0, 1),
          k = 0.88 + n * 0.14 + (n2 - 0.5) * 0.18;
        r = (th.dirt[0] + (th.deep[0] - th.dirt[0]) * t) * k;
        g = (th.dirt[1] + (th.deep[1] - th.dirt[1]) * t) * k;
        b = (th.dirt[2] + (th.deep[2] - th.dirt[2]) * t) * k;
        if (n2 > 0.93) {
          r *= 0.8;
          g *= 0.8;
          b *= 0.8;
        }
      }
      if (y + 3 < h && !mask[i + 3 * w]) {
        r *= 0.62;
        g *= 0.62;
        b *= 0.62;
      }
      if (th.tex) {
        tc[0] = r;
        tc[1] = g;
        tc[2] = b;
        th.tex(x, y, depth, n, n2, tc);
        r = tc[0];
        g = tc[1];
        b = tc[2];
      }
      const p = i * 4;
      d[p] = r;
      d[p + 1] = g;
      d[p + 2] = b;
      d[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** True when the pixel at (x, y) is solid ground. Out-of-bounds is air, so things fall off the map edge. */
const solid = (x, y) => {
  const ix = x | 0,
    iy = y | 0;
  return x >= 0 && ix < T.w && y >= 0 && iy < T.h && T.mask[iy * T.w + ix] === 1;
};

/**
 * Removes a circle of terrain (explosion crater) from both the mask and the canvas.
 * @param {boolean} scorch also draw a dark burn ring on the new crater edge
 */
function carve(x, y, r, scorch = true) {
  const { w, h, mask, ctx } = T;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.restore();
  if (scorch) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.strokeStyle = 'rgba(10,6,4,.45)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, y, r + 2.5, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  const y0 = Math.max(0, Math.floor(y - r)),
    y1 = Math.min(h - 1, Math.ceil(y + r));
  for (let yy = y0; yy <= y1; yy++) {
    const dx = Math.sqrt(Math.max(0, r * r - (yy - y) * (yy - y)));
    const x0 = Math.max(0, Math.floor(x - dx)),
      x1 = Math.min(w - 1, Math.ceil(x + dx));
    for (let xx = x0; xx <= x1; xx++) mask[yy * w + xx] = 0;
  }
}

/**
 * Removes a whole rectangle of terrain (a collapsing section, Gandalf's Staff) from the mask and the canvas.
 * Coordinates are inclusive pixel bounds.
 */
function carveRect(x0, y0, x1, y1) {
  const { w, h, mask, ctx } = T;
  x0 = Math.max(0, Math.floor(x0));
  y0 = Math.max(0, Math.floor(y0));
  x1 = Math.min(w - 1, Math.ceil(x1));
  y1 = Math.min(h - 1, Math.ceil(y1));
  if (x1 < x0 || y1 < y0) return;
  ctx.clearRect(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
  for (let yy = y0; yy <= y1; yy++) mask.fill(0, yy * w + x0, yy * w + x1 + 1);
}

/**
 * Places a steel girder (a rotated rectangle) onto the terrain, but only over open air.
 * @param {number} ang rotation in radians;  @param {number} len length in pixels
 */
function addGirder(cx, cy, ang, len) {
  const { w, h, mask, ctx } = T,
    th = 7,
    c = Math.cos(ang),
    s = Math.sin(ang);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.fillStyle = '#7d8aa0';
  ctx.fillRect(-len / 2, -th / 2, len, th);
  ctx.strokeStyle = '#3a4560';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-len / 2, -th / 2, len, th);
  ctx.beginPath();
  for (let k = -len / 2; k < len / 2; k += 10) {
    ctx.moveTo(k, -th / 2);
    ctx.lineTo(k + 5, th / 2);
    ctx.moveTo(k + 5, -th / 2);
    ctx.lineTo(k, th / 2);
  }
  ctx.stroke();
  ctx.restore();
  const R = len / 2 + th;
  for (let y = Math.max(0, Math.floor(cy - R)); y < Math.min(h, cy + R); y++)
    for (let x = Math.max(0, Math.floor(cx - R)); x < Math.min(w, cx + R); x++) {
      const dx = x - cx,
        dy = y - cy,
        u = dx * c + dy * s,
        v = -dx * s + dy * c;
      if (Math.abs(u) <= len / 2 && Math.abs(v) <= th / 2) mask[y * w + x] = 1;
    }
}
