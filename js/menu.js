'use strict';

/**
 * @file menu.js - Menu & setup
 *
 * Setup form, lobby buttons, demo background scene, pause/quit handling.
 *
 * Depends on: net, hud, custommap, i18n
 * Globals defined: STYLES, isDefaultTeamName, retranslateTeamNames, MAP_MODE_TEXT, showMapState, importMapFile, buildTeamRows, readTeamRows, readCfg, enterGame, backToMenu,
 *     showDemo, paused, togglePause
 */

/* ===== Menu & setup ===== */
/** Level styles that 'Surprise me' picks from. */
const STYLES = ['hills', 'islands', 'caves', 'plateau', 'canyon', 'mountains', 'archipelago'];
/** (Re)builds the team name / controller rows, keeping what the player already typed. */
function buildTeamRows() {
  const n = +$('oTeams').value;
  // Team 1 defaults to a human, every other team to a bot.
  const defaults = TEAM_NAMES.map((name, i) => [tr(name), i === 0 ? 'local' : 'ai']);
  const old = [...$('teamRows').querySelectorAll('.teamrow')].map(r => [
    r.querySelector('input').value,
    r.querySelector('select').value,
  ]);
  let h = '';
  for (let i = 0; i < n; i++) {
    const o = old[i] || defaults[i];
    h += `<div class="teamrow"><i style="background:${TEAM_COLORS[i]}"></i><input type="text" id="tn${i}" value="${esc(o[0])}" maxlength="14" aria-label="${esc(tr('Team {0} name', i + 1))}"><select id="tc${i}" aria-label="${esc(tr('Team {0} controller', i + 1))}"><option value="local"${o[1] === 'local' ? ' selected' : ''}>${tr('Human')}</option><option value="ai"${o[1] === 'ai' ? ' selected' : ''}>${tr('Bot')}</option></select></div>`;
  }
  $('teamRows').innerHTML = h;
}
/** Reads the team rows into [{name, ctrl}]. */
function readTeamRows() {
  return [...$('teamRows').querySelectorAll('.teamrow')].map(r => ({
    name: r.querySelector('input').value.trim() || tr('Team'),
    ctrl: r.querySelector('select').value,
  }));
}
/** Collects the match options from the form (a random seed is generated when the field is empty). */
function readCfg() {
  let style = $('oStyle').value;
  if (style === 'random') style = pick(STYLES);
  if (style === 'custom' && !MAPS.custom) style = 'hills';
  const seed = $('oSeed').value.trim() || Math.random().toString(36).slice(2, 8);
  return {
    seed,
    style,
    theme: $('oTheme').value,
    size: $('oSize').value,
    hp: +$('oHp').value,
    turnTime: +$('oTime').value,
    arsenal: $('oArs').value,
    mines: +$('oMines').value,
    drums: +$('oDrums').value,
    crates: +$('oCrates').value,
    sd: +$('oSD').value,
    rise: +$('oRise').value,
    worms: +$('oWorms').value,
  };
}
/** Hides the menu, shows the HUD and resets camera, effects and input for a new match. */
function enterGame() {
  $('menu').style.display = 'none';
  $('hud').hidden = false;
  $('over').classList.remove('on');
  UI.over = false;
  UI.sig = '';
  FX.p.length = 0;
  FX.nuke = null;
  FX.txt.length = 0;
  FX.logs.length = 0;
  CAM.z = 1;
  CAM.fx = null;
  UI.panT = -9;
  const w = G.worms[0];
  if (w) {
    CAM.x = w.x;
    CAM.y = w.y;
  }
  Object.assign(LOCAL, makeInp());
  ac();
}
/** Leaves the match: closes the network, clears the state and shows the menu over a fresh demo level. */
function backToMenu() {
  NET.close();
  G = null;
  $('hud').hidden = true;
  $('over').classList.remove('on');
  $('pause').classList.remove('on');
  paused = false;
  $('menu').style.display = '';
  showDemo();
  lobby.guests = [];
  $('hostCode').textContent = '----';
  renderLobby();
}
/** Generates a random level as a slowly panning backdrop for the menu. */
function showDemo() {
  generateTerrain({
    seed: Math.random().toString(36).slice(2, 8),
    style: pick(STYLES),
    theme: pick(['grass', 'desert', 'snow', 'hell', 'neon']),
    size: 'm',
  });
  G = {
    demo: true,
    time: 0,
    wind: 0.4,
    waterY: T.waterBase,
    worms: [],
    projs: [],
    fires: [],
    objs: [],
    teams: [],
    weapon: { id: 'bazooka' },
    phase: 'menu',
    active: -1,
    cfg: {},
  };
  CAM.x = T.w / 2;
  CAM.y = T.h / 2;
  CAM.z = 1;
}
/* ===== Custom map import ===== */
/** Human-readable description of how the imported picture was interpreted. */
const MAP_MODE_TEXT = {
  alpha: 'transparent pixels = sky',
  palette: 'first palette colour = sky',
  corner: 'top-left colour = sky',
};
/** Text of the note below the map button when no error is showing (translated on every call). */
const MAP_NOTE_DEFAULT =
  'PNG with transparency, or a Worms Armageddon style PNG/BMP map. You can also drop the file onto this window.';
/** Updates the "Level style" option and the note below the file button for the current import. */
function showMapState(errMsg) {
  const opt = $('oStyle').querySelector('option[value="custom"]'),
    m = MAPS.custom;
  opt.disabled = !m;
  opt.textContent = m ? tr('Custom: {0}', m.name) : tr('Custom image');
  if (m) $('oStyle').value = 'custom';
  else if ($('oStyle').value === 'custom') $('oStyle').value = 'hills';
  $('oMapClear').hidden = !m;
  $('oMapNote').textContent = errMsg
    ? errMsg
    : m
      ? tr('{0} \u00d7 {1} px, {2}.', m.w, m.h, tr(MAP_MODE_TEXT[m.mode]))
      : tr(MAP_NOTE_DEFAULT);
  $('oMapNote').classList.toggle('err', !!errMsg);
}
/** Imports a picture file chosen or dropped by the player. */
async function importMapFile(file) {
  if (!file) return;
  try {
    await loadMapImage(file);
    showMapState();
  } catch (err) {
    showMapState(err.message);
  }
}
$('oMap').addEventListener('change', e => {
  importMapFile(e.target.files[0]);
  e.target.value = '';
});
$('oMapClear').addEventListener('click', () => {
  MAPS.custom = null;
  showMapState();
});
// Drag and drop anywhere on the window while the menu is open.
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => {
  e.preventDefault();
  if ($('menu').style.display !== 'none' && e.dataTransfer.files.length)
    importMapFile(e.dataTransfer.files[0]);
});
/* ===== Language ===== */
/** True when `v` is any language's default name of team `k` (so switching language may replace it). */
const isDefaultTeamName = (v, k) =>
  v === TEAM_NAMES[k] || Object.values(I18N).some(d => d[TEAM_NAMES[k]] === v);
/** After a language change: untouched default team names follow the new language. */
function retranslateTeamNames() {
  $('teamRows')
    .querySelectorAll('.teamrow input')
    .forEach(inp => {
      const k = TEAM_NAMES.findIndex((n, i) => isDefaultTeamName(inp.value, i));
      if (k >= 0) inp.value = tr(TEAM_NAMES[k]);
    });
}
$('oLang').innerHTML = Object.entries(LANGS)
  .map(([k, v]) => `<option value="${k}">${v}</option>`)
  .join('');
$('oLang').addEventListener('change', e => setLang(e.target.value));
// Text generated by the game is rebuilt in the new language (static text is handled by translateDom).
onLang(() => {
  retranslateTeamNames();
  buildTeamRows();
  showMapState();
  renderLobby();
  UI.sig = '';
});
/** Pause is only available in offline games. */
let paused = false;
function togglePause() {
  if (!G || G.demo || NET.role !== 'local' || G.over) return;
  paused = !paused;
  $('pause').classList.toggle('on', paused);
}
// Menu wiring
document.querySelectorAll('.tabs button').forEach(b =>
  b.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
    for (const s of ['local', 'host', 'join', 'help']) $('tab-' + s).hidden = s !== b.dataset.tab;
    if (b.dataset.tab === 'host') renderLobby();
  })
);
$('oTeams').addEventListener('change', buildTeamRows);
$('bStart').addEventListener('click', () => {
  const rows = readTeamRows();
  NET.role = 'local';
  newGame(readCfg(), rows);
  enterGame();
});
$('bHost').addEventListener('click', hostCreate);
$('bHostStart').addEventListener('click', hostStart);
$('bJoin').addEventListener('click', joinRoom);
$('bCopy').addEventListener('click', () => {
  const c = NET.code;
  if (!c) return;
  try {
    navigator.clipboard.writeText(c).catch(() => {});
  } catch (e) {}
  showMsg(tr('Code copied: {0}', c), 1200);
});
$('bResume').addEventListener('click', togglePause);
$('bQuit').addEventListener('click', backToMenu);
$('bAgain').addEventListener('click', backToMenu);
buildTeamRows();
