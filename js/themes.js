'use strict';

/**
 * @file themes.js - Themes
 *
 * Colour palettes for the sky, terrain surface, soil and water. Add a theme by adding an entry
 * here and an <option> in index.html.
 *
 * Depends on: none
 * Globals defined: THEMES, SKIES, seasonalTheme
 */

/* ===== Themes ===== */
/** Sky conditions (the "Sky" menu option; cfg.sky). 'random' is resolved by the host before the match starts. */
const SKIES = ['day', 'night', 'cloudy', 'rainy'];
/**
 * Visual themes. Per theme:
 *   sky    [top, bottom] CSS colours of the sky gradient
 *   top    [r,g,b] colour of the terrain surface layer (grass, sand, snow ...)
 *   dirt   [r,g,b] soil colour just below the surface
 *   deep   [r,g,b] soil colour far below the surface (the soil fades towards this)
 *   water  [surface, deep] CSS colours of the water gradient
 *   sun    CSS colour of the sun disc;  cloud  CSS colour of the clouds
 * Optional, for special / seasonal themes:
 *   special true: left out of the "Random" theme choice
 *   fx      name of a registered effect in theme-fx.js (props, sky decoration, overlay, worm hat)
 *   tex     tex(x, y, depth, n, n2, c) recolours one terrain pixel: c = [r,g,b] is changed in place;
 *           depth = pixels below the surface, n / n2 = fine / coarse noise in [0,1)
 */
const THEMES = {
  grass: {
    sky: ['#4aa8ec', '#cdeeff'],
    top: [92, 176, 52],
    dirt: [128, 88, 54],
    deep: [70, 46, 34],
    water: ['#2f86c4', '#18457a'],
    sun: '#fff3b0',
    cloud: '#ffffff',
  },
  desert: {
    sky: ['#f2a65a', '#fde7b0'],
    top: [226, 184, 96],
    dirt: [196, 140, 76],
    deep: [128, 84, 52],
    water: ['#3aa6a0', '#1d5e6a'],
    sun: '#fff8d8',
    cloud: '#ffe9c4',
  },
  snow: {
    sky: ['#6a8fc4', '#e6f1ff'],
    top: [244, 249, 255],
    dirt: [150, 176, 206],
    deep: [78, 98, 136],
    water: ['#3f78b4', '#17325e'],
    sun: '#ffffff',
    cloud: '#f2f8ff',
  },
  hell: {
    sky: ['#2a0707', '#a8330f'],
    top: [210, 70, 24],
    dirt: [92, 44, 36],
    deep: [40, 18, 20],
    water: ['#e0561a', '#7a1606'],
    sun: '#ffb070',
    cloud: '#5a1a12',
  },
  neon: {
    sky: ['#0b0a2a', '#4a1c78'],
    top: [0, 240, 200],
    dirt: [44, 38, 110],
    deep: [18, 14, 52],
    water: ['#a020d0', '#3a0a6a'],
    sun: '#ff5fd0',
    cloud: '#6a3aa8',
  },
  halloween: {
    special: true,
    fx: 'halloween',
    sky: ['#1a0a2e', '#8a3a12'],
    top: [88, 52, 128],
    dirt: [62, 42, 52],
    deep: [24, 16, 30],
    water: ['#4a7a3a', '#1c2a1c'],
    sun: '#ffa31f',
    cloud: '#4a2a5a',
    tex(x, y, depth, n, n2, c) {
      // purple moss on top, orange pumpkin-flesh specks and pale bone flecks in the soil
      if (depth > 9 && n2 > 0.94) {
        c[0] = 230;
        c[1] = 120;
        c[2] = 20;
      } else if (depth > 14 && n > 0.985) {
        c[0] = 225;
        c[1] = 220;
        c[2] = 200;
      }
    },
  },
  christmas: {
    special: true,
    fx: 'christmas',
    sky: ['#0c1c46', '#5a7ab8'],
    top: [250, 252, 255],
    dirt: [126, 78, 50],
    deep: [66, 36, 28],
    water: ['#2f6aa8', '#12305a'],
    sun: '#fffbe0',
    cloud: '#dfe9ff',
    tex(x, y, depth, n, n2, c) {
      // gingerbread soil with white icing dots and the odd red / green sweet
      if (depth > 9) {
        if (n2 > 0.95) {
          c[0] = c[1] = c[2] = 250;
        } else if (n > 0.992) {
          c[0] = 214;
          c[1] = 43;
          c[2] = 43;
        } else if (n > 0.984) {
          c[0] = 31;
          c[1] = 154;
          c[2] = 74;
        }
      }
    },
  },
  manga: {
    special: true,
    fx: 'manga',
    sky: ['#fafafa', '#cfcfcf'],
    top: [16, 16, 16],
    dirt: [236, 236, 236],
    deep: [120, 120, 120],
    water: ['#8a8a8a', '#2a2a2a'],
    sun: '#e60012',
    cloud: '#ffffff',
    tex(x, y, depth, n, n2, c) {
      // ink on the surface, screentone dots below (they grow with depth), hatching in the deep
      if (depth <= 8) {
        c[0] = c[1] = c[2] = n > 0.93 ? 235 : 18;
        return;
      }
      const gx = (x + (((y >> 2) & 1) * 2)) & 3,
        gy = y & 3,
        r = Math.min(1.9, 0.35 + depth / 150),
        d = Math.hypot(gx - 1.5, gy - 1.5);
      let v = d <= r ? 38 : 238;
      if (depth > 200 && ((x + y) & 7) === 0) v = 30;
      c[0] = c[1] = c[2] = v;
    },
  },
};

const SEASON_THEMES = [
  // [theme, first month/day, last month/day] (inclusive; ranges may wrap over the new year)
  ['halloween', [10, 15], [11, 2]],
  ['christmas', [12, 1], [1, 6]],
];
/**
 * The theme of the current season ("Seasonal" menu choice): Halloween from 15 Oct to 2 Nov, Christmas
 * from 1 Dec to 6 Jan, otherwise one of the normal themes at random.
 * @param {Date} [date]
 * @param {function} [rng] random source for the out-of-season pick
 */
function seasonalTheme(date = new Date(), rng = Math.random) {
  const v = (date.getMonth() + 1) * 100 + date.getDate();
  for (const [name, a, b] of SEASON_THEMES) {
    const x = a[0] * 100 + a[1],
      y = b[0] * 100 + b[1];
    if (x <= y ? v >= x && v <= y : v >= x || v <= y) return name;
  }
  const normal = Object.keys(THEMES).filter(k => !THEMES[k].special);
  return normal[Math.floor(rng() * normal.length)];
}
