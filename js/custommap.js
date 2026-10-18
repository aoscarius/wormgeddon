'use strict';

/**
 * @file custommap.js - Custom maps
 *
 * Turns a user-supplied picture into a level. Supported inputs are anything the browser can
 * decode (PNG, BMP, GIF, WebP, JPEG):
 *
 *   1. Images with an alpha channel: transparent pixels are empty air, everything else is
 *      solid ground drawn with the picture's own colours.
 *   2. Opaque images, e.g. the 8-bit indexed PNG/BMP maps used by Worms Armageddon: pixels
 *      matching the "empty" colour are air. That colour is the first palette entry of an indexed
 *      PNG/BMP (the Worms Armageddon convention for the background) or, for any other opaque
 *      image, the colour of the top-left pixel.
 *
 * The image is normalised once into `MAPS.custom` (binary alpha, sensible size). The host sends
 * that normalised PNG to guests, which decode it with the very same code, so both sides get an
 * identical collision mask.
 *
 * Native Worms Armageddon `.img` files are NOT supported (proprietary compressed format); convert
 * them to PNG first.
 *
 * Depends on: util, terrain
 * Globals defined: MAPS, MAP_LIMITS, loadMapImage, buildCustomTerrain
 */

/* ===== Custom maps ===== */

/**
 * Size limits applied while importing. Pictures narrower than `minW` are enlarged with
 * nearest-neighbour scaling (keeps pixel art crisp), pictures above `maxW` x `maxH` are reduced.
 */
const MAP_LIMITS = { minW: 800, targetW: 1200, maxW: 3600, maxH: 1600, pad: 80 };
/**
 * Imported maps. `custom` is null or {w, h, canvas, dataURL, mode, key, name}:
 *   canvas   RGBA canvas, alpha is exactly 0 (air) or 255 (ground)
 *   dataURL  PNG of that canvas, sent to online guests
 *   mode     'alpha' | 'palette' | 'corner' (how air was detected)
 */
const MAPS = { custom: null };

/** Decodes an <img> from a URL and resolves with it once loaded. */
function decodeImage(url) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(tr('The file is not a readable image.')));
    im.src = url;
  });
}

/**
 * Looks at the raw bytes of a PNG or BMP and returns the colour [r, g, b] of palette entry 0, or
 * null when the file is not an indexed image.
 * @param {Uint8Array} u8
 */
function paletteZero(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  // PNG: signature, then chunks (length, type, data, crc). IHDR colour type 3 = indexed.
  if (u8.length > 33 && u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47) {
    if (u8[25] !== 3) return null;
    let p = 8;
    while (p + 12 <= u8.length) {
      const len = dv.getUint32(p),
        type = String.fromCharCode(u8[p + 4], u8[p + 5], u8[p + 6], u8[p + 7]);
      if (type === 'PLTE' && len >= 3) return [u8[p + 8], u8[p + 9], u8[p + 10]];
      if (type === 'IDAT') return null;
      p += 12 + len;
    }
    return null;
  }
  // BMP: 'BM', DIB header size at 14, bits per pixel at 28, palette (B, G, R, 0) after the header.
  if (u8.length > 54 && u8[0] === 0x42 && u8[1] === 0x4d) {
    const hdr = dv.getUint32(14, true),
      bpp = dv.getUint16(28, true);
    if (bpp > 8 || bpp === 0) return null;
    const o = 14 + hdr;
    if (o + 4 > u8.length) return null;
    return [u8[o + 2], u8[o + 1], u8[o]];
  }
  return null;
}

/** True when the bytes start with the native Worms Armageddon image signature "IMG\x1a". */
const isNativeImg = u8 =>
  u8.length > 4 && u8[0] === 0x49 && u8[1] === 0x4d && u8[2] === 0x47 && u8[3] === 0x1a;

/**
 * Loads a picture and turns it into the custom map.
 * @param {File|Blob|string} src an uploaded file, or a data/blob URL (used for guests)
 * @param {string} [name] display name
 * @returns {Promise<object>} the MAPS.custom record (also stored in MAPS.custom)
 * @throws {Error} with a human-readable message when the file cannot be used
 */
async function loadMapImage(src, name) {
  let url = src,
    bytes = null,
    lossy = false;
  if (typeof src !== 'string') {
    bytes = new Uint8Array(await src.arrayBuffer());
    if (isNativeImg(bytes))
      throw new Error(tr('Native .img files are not supported. Please convert the map to PNG.'));
    lossy = /jpe?g|webp/i.test(src.type || '');
    url = URL.createObjectURL(src);
    name = name || src.name;
  }
  let im;
  try {
    im = await decodeImage(url);
  } finally {
    if (typeof src !== 'string') URL.revokeObjectURL(url);
  }
  if (!im.naturalWidth || !im.naturalHeight) throw new Error(tr('The image is empty.'));

  // Read the pixels, shrinking absurdly large pictures first to protect memory.
  const pre = Math.min(1, 8000 / im.naturalWidth, 4000 / im.naturalHeight);
  let w = Math.max(1, Math.round(im.naturalWidth * pre)),
    h = Math.max(1, Math.round(im.naturalHeight * pre));
  let cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  let cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(im, 0, 0, w, h);
  let img = cx.getImageData(0, 0, w, h),
    d = img.data;

  // Decide how "air" is detected.
  let hasAlpha = false;
  for (let i = 3; i < d.length; i += 4)
    if (d[i] < 250) {
      hasAlpha = true;
      break;
    }
  let mode = 'alpha',
    key = null;
  if (!hasAlpha) {
    const pal = bytes && paletteZero(bytes);
    key = pal || [d[0], d[1], d[2]];
    mode = pal ? 'palette' : 'corner';
    const tol2 = (lossy ? 40 : 8) ** 2;
    for (let i = 0; i < d.length; i += 4) {
      const dr = d[i] - key[0],
        dg = d[i + 1] - key[1],
        db = d[i + 2] - key[2];
      if (dr * dr + dg * dg + db * db <= tol2) d[i + 3] = 0;
    }
    cx.putImageData(img, 0, 0);
  }

  // Scale into the playable size range (smooth when shrinking, crisp when enlarging).
  let s = 1;
  if (w < MAP_LIMITS.minW) s = Math.min(4, Math.max(2, Math.round(MAP_LIMITS.targetW / w)));
  else if (w > MAP_LIMITS.maxW || h > MAP_LIMITS.maxH)
    s = Math.min(MAP_LIMITS.maxW / w, MAP_LIMITS.maxH / h);
  if (s !== 1) {
    const nw = Math.max(1, Math.round(w * s)),
      nh = Math.max(1, Math.round(h * s)),
      c2 = document.createElement('canvas');
    c2.width = nw;
    c2.height = nh;
    const x2 = c2.getContext('2d', { willReadFrequently: true });
    x2.imageSmoothingEnabled = s < 1;
    x2.drawImage(cv, 0, 0, nw, nh);
    cv = c2;
    cx = x2;
    w = nw;
    h = nh;
    img = cx.getImageData(0, 0, w, h);
    d = img.data;
  }
  // Binarise alpha: ground is fully opaque, air fully transparent.
  let solidN = 0;
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] >= 128) {
      d[i] = 255;
      solidN++;
    } else d[i] = 0;
  }
  cx.putImageData(img, 0, 0);
  if (solidN < 200) throw new Error(tr('No solid ground found in this image.'));
  if (solidN > w * h * 0.995)
    throw new Error(
      tr('The whole image is solid. Use transparency (or a plain background colour) for the sky.')
    );

  MAPS.custom = {
    w,
    h,
    canvas: cv,
    dataURL: cv.toDataURL('image/png'),
    mode,
    key,
    name: name || 'custom map',
  };
  return MAPS.custom;
}

/**
 * Builds the level from MAPS.custom (called by generateTerrain for style "custom"). The picture is
 * placed at the top of the world with a strip of open space below it so the water has room.
 */
function buildCustomTerrain() {
  const m = MAPS.custom,
    pad = MAP_LIMITS.pad;
  if (!m) throw new Error(tr('No custom map loaded'));
  const w = m.w,
    h = m.h + pad;
  T.w = w;
  T.h = h;
  const mask = (T.mask = new Uint8Array(w * h));
  const cv = (T.cv = T.cv || document.createElement('canvas'));
  cv.width = w;
  cv.height = h;
  const ctx = (T.ctx = cv.getContext('2d', { willReadFrequently: false }));
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(m.canvas, 0, 0);
  const d = m.canvas
    .getContext('2d', { willReadFrequently: true })
    .getImageData(0, 0, m.w, m.h).data;
  for (let i = 0; i < m.w * m.h; i++) mask[i] = d[i * 4 + 3] ? 1 : 0;
  T.waterBase = h - 38;
}
