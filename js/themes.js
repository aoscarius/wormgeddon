'use strict';

/**
 * @file themes.js - Themes
 *
 * Colour palettes for the sky, terrain surface, soil and water. Add a theme by adding an entry
 * here and an <option> in index.html.
 *
 * Depends on: none
 * Globals defined: THEMES
 */

/* ===== Themes ===== */
/**
 * Visual themes. Per theme:
 *   sky    [top, bottom] CSS colours of the sky gradient
 *   top    [r,g,b] colour of the terrain surface layer (grass, sand, snow ...)
 *   dirt   [r,g,b] soil colour just below the surface
 *   deep   [r,g,b] soil colour far below the surface (the soil fades towards this)
 *   water  [surface, deep] CSS colours of the water gradient
 *   sun    CSS colour of the sun disc;  cloud  CSS colour of the clouds
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
};
