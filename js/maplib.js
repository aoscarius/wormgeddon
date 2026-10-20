'use strict';

/**
 * @file maplib.js - Map library (PNG from the `maps` folder)
 *
 * Every picture in the project's `maps/` folder is offered in the menu's "Maps library"
 * drop-down. Sources, merged in this order (duplicates by file name are skipped):
 *   1. `window.MAPS_BUNDLE`, from the maps folder (names from maps/manifest.json when it exists, 
 *      otherwise from the file names). Because the images are embedded, this works from file://, 
 *      inside the artifact and when hosting online games.
 *   2. `maps/manifest.json` fetched at run time when the page is served over http(s), so a server
 *      admin can add maps without rebuilding. If there is no manifest, the server's directory
 *      index of `maps/` is scanned for image links.
 *
 *   manifest.json:  { "maps": [ { "name": "Island", "file": "island.png" }, "other.png" ] }
 *
 * Choosing an entry imports it like "Load map image" (loadMapImage), so it becomes the custom
 * map; online, the host sends the chosen map to the guests as with any custom map.
 *
 * Depends on: custommap, menu, i18n
 * Globals defined: MAPLIB, MAPS_DIR, parseManifest, setMapLib, renderMapLib, pickLibMap, initMapLib
 */

/** Folder with the maps, relative to the page. */
const MAPS_DIR = 'maps/';
/** The current library: items are {name, file, data?: dataURL, url?: string}. */
const MAPLIB = { items: [] };
const IMG_RE = /\.(png|bmp|gif|webp|jpe?g)$/i;
const baseName = p => String(p).split(/[\\/]/).pop();
/** "rocky-tunnels.png" -> "Rocky tunnels". */
const prettyName = f =>
  baseName(f)
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/^./, c => c.toUpperCase());

/**
 * Normalises manifest JSON into [{name, file}]. Accepts {maps:[...]} (or the older {maps:[...]})
 * or a bare array whose entries are file names or {name, file} objects; non-images are dropped.
 */
function parseManifest(json) {
  const list = Array.isArray(json)
    ? json
    : json && Array.isArray(json.maps)
      ? json.maps
      : json && Array.isArray(json.maps)
        ? json.maps
        : [];
  return list
    .map(e => (typeof e === 'string' ? { file: e } : e))
    .filter(e => e && typeof e.file === 'string' && IMG_RE.test(e.file))
    .map(e => ({ name: e.name || prettyName(e.file), file: e.file }));
}

/** Replaces the library and refreshes the menu. */
function setMapLib(items) {
  MAPLIB.items = items;
  renderMapLib();
}

/** Rebuilds the library drop-down and its note. */
function renderMapLib(errMsg) {
  const sel = $('oLib'),
    note = $('oLibNote'),
    n = MAPLIB.items.length,
    keep = sel.value;
  sel.disabled = !n;
  sel.innerHTML =
    `<option value="">${esc(tr(n ? 'Pick a map…' : 'No maps found'))}</option>` +
    MAPLIB.items.map((m, i) => `<option value="${i}">${esc(m.name)}</option>`).join('');
  if (keep && MAPLIB.items[+keep]) sel.value = keep;
  note.textContent = errMsg || tr(n ? '{0} maps in the maps folder' : LIB_EMPTY, n);
  note.classList.toggle('err', !!errMsg);
}
const LIB_EMPTY = 'Add PNG files to the maps folder (see maps/README.txt).';

/** Imports library entry `i` as the custom map. */
async function pickLibMap(i) {
  const m = MAPLIB.items[i];
  if (!m) return;
  try {
    const r = await fetch(m.data || m.url);
    if (!r.ok) throw new Error(tr('The file is not a readable image.'));
    const blob = await r.blob();
    blob.name = m.file;
    await loadMapImage(blob, m.name);
    showMapState();
  } catch (err) {
    showMapState(err.message);
  }
}
$('oLib').addEventListener('change', e => {
  if (e.target.value !== '') pickLibMap(+e.target.value);
});
onLang(() => renderMapLib());

/** Fetches the run-time list from the server: manifest.json, else the directory index. */
async function fetchServerMaps() {
  const base = new URL(MAPS_DIR, location.href).href;
  let list = [];
  try {
    const r = await fetch(base + 'manifest.json', { cache: 'no-cache' });
    if (r.ok) list = parseManifest(await r.json());
  } catch (err) {
    /* no manifest */
  }
  if (!list.length) {
    try {
      const r = await fetch(base, { cache: 'no-cache' });
      if (r.ok && /html/i.test(r.headers.get('content-type') || ''))
        list = [...(await r.text()).matchAll(/href="([^"?#]+)"/gi)]
          .map(m => decodeURIComponent(m[1]))
          .filter(f => IMG_RE.test(f) && !f.includes('..'))
          .map(f => ({ name: prettyName(f), file: baseName(f) }));
    } catch (err) {
      /* no directory index */
    }
  }
  return list.map(e => ({ name: e.name, file: e.file, url: base + encodeURIComponent(e.file) }));
}

/** Builds the library from the embedded bundle plus whatever the server lists. */
async function initMapLib() {
  const items = (window.MAPS_BUNDLE || []).map(e => ({ name: e.name, file: e.file, data: e.data }));
  setMapLib(items);
  if (!/^https?:$/.test(location.protocol)) return;
  try {
    const extra = (await fetchServerMaps()).filter(e => !items.some(i => i.file === e.file));
    if (extra.length) setMapLib(items.concat(extra));
  } catch (err) {
    /* ignore */
  }
}
initMapLib();
