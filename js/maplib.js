'use strict';

/**
 * @file maplib.js - Map library (PNG levels from a folder)
 *
 * A library is a list of pictures with names. It comes from either
 *   - `maps/manifest.json` next to the page (fetched automatically when served over http/https):
 *       { "maps": [ { "name": "Island", "file": "island.png" }, "other.png" ] }
 *     (file names are relative to the manifest), or
 *   - a folder the player picks with "Load maps folder..." (works from file:// too). A
 *     manifest.json inside the folder is honoured; without one every image is listed.
 * Choosing an entry imports it exactly like "Load map image" (loadMapImage), so it becomes the
 * custom map and is sent to online guests like any other custom map.
 *
 * Depends on: custommap, menu, i18n
 * Globals defined: MAPLIB, parseManifest, setMapLib, renderMapLib, pickLibMap, initMapLib
 */

/** The current library: items are {name, file?: File, url?: string}. */
const MAPLIB = { items: [], source: '' };
const IMG_RE = /\.(png|bmp|gif|webp|jpe?g)$/i;
const baseName = p => String(p).split(/[\\/]/).pop();
/** "rocky-tunnels.png" -> "Rocky tunnels". */
const prettyName = f =>
  baseName(f)
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/^./, c => c.toUpperCase());

/**
 * Normalises manifest JSON into [{name, file}]. Accepts {maps:[...]} or a bare array whose entries
 * are file names or {name, file} objects; entries that are not image files are dropped.
 */
function parseManifest(json) {
  const list = Array.isArray(json) ? json : json && Array.isArray(json.maps) ? json.maps : [];
  return list
    .map(e => (typeof e === 'string' ? { file: e } : e))
    .filter(e => e && typeof e.file === 'string' && IMG_RE.test(e.file))
    .map(e => ({ name: e.name || prettyName(e.file), file: e.file }));
}

/** Replaces the library and refreshes the menu. */
function setMapLib(items, source) {
  MAPLIB.items = items;
  MAPLIB.source = source || '';
  renderMapLib();
}

/** Rebuilds the library drop-down and its note. */
function renderMapLib(errMsg) {
  const sel = $('oLib'),
    note = $('oLibNote'),
    n = MAPLIB.items.length;
  sel.hidden = !n;
  sel.innerHTML =
    `<option value="">${esc(tr('Pick a library map…'))}</option>` +
    MAPLIB.items.map((m, i) => `<option value="${i}">${esc(m.name)}</option>`).join('');
  note.textContent = errMsg || (n ? tr('{0} maps in the library', n) : tr(MAPLIB_NOTE));
  note.classList.toggle('err', !!errMsg);
}
const MAPLIB_NOTE = 'Pick a folder of PNG maps (with an optional manifest.json).';

/** Imports library entry `i` as the custom map. */
async function pickLibMap(i) {
  const m = MAPLIB.items[i];
  if (!m) return;
  try {
    let blob = m.file;
    if (!blob) {
      const r = await fetch(m.url);
      if (!r.ok) throw new Error(tr('The file is not a readable image.'));
      blob = await r.blob();
    }
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

/** Looks for maps/manifest.json next to the page (silently does nothing when it is not reachable). */
async function initMapLib() {
  renderMapLib();
  if (!/^https?:$/.test(location.protocol)) return;
  try {
    const url = new URL('maps/manifest.json', location.href).href,
      r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) return;
    const items = parseManifest(await r.json()).map(e => ({
      name: e.name,
      url: new URL(e.file, url).href,
    }));
    if (items.length && !MAPLIB.items.length) setMapLib(items, 'manifest');
  } catch (err) {
    /* no library on this server */
  }
}
initMapLib();
