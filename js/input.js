'use strict';

/**
 * @file input.js - Input
 *
 * Keyboard, mouse/touch and on-screen touch controls. Translates them into the LOCAL input
 * record (and network messages for clients).
 *
 * Depends on: view, hud, net
 * Globals defined: setWeaponTab, uiSelect, togglePanel, PAD_ARROW, TOUCH_ICONS, touchFx, KEYMAP, setKey, edge, ZOOM_MIN, ZOOM_MAX, zoomAt, drag, pinch, buildTouch
 */

/* ---- Input ---- */
/** Selects a weapon: guests ask the host, host/local call selectWeapon() directly. */
function uiSelect(id, fuse) {
  if (NET.role === 'client') {
    NET.send({ t: 'w', id, f: fuse });
    return;
  }
  if (G.ti >= 0) selectWeapon(G.ti, id, fuse);
}
/** Held keys that map to input flags. */
const KEYMAP = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd' };
/** Sets a held key state and, for guests, tells the host. */
function setKey(k, v) {
  if (LOCAL[k] === v) return;
  LOCAL[k] = v;
  NET.sendKeys();
}
/** Registers a one-shot key press (jump, back-flip, fire pressed, tab). Guests send it to the host instead. */
function edge(k) {
  LOCAL[k] = (LOCAL[k] || 0) + 1;
  if (NET.role === 'client') {
    NET.send({ t: 'e', k });
    LOCAL[k] = 0;
  }
}
// Keyboard: arrows, Space, Enter, Backspace, Tab, W (panel), 1-5 (fuse), R (girder), C, M, Esc,
// F3 or ` (debug view).
addEventListener('keydown', e => {
  if (!G || $('menu').style.display !== 'none' || e.target.tagName === 'INPUT') return;
  if (panelKey(e)) return;
  const k = KEYMAP[e.key];
  if (k) {
    if (!e.repeat) setKey(k, 1);
    e.preventDefault();
    return;
  }
  if (e.key === ' ') {
    if (!e.repeat) {
      setKey('fire', 1);
      edge('fireP');
    }
    e.preventDefault();
    return;
  }
  if (e.repeat) {
    if (e.key === 'Tab' || e.key === 'Backspace') e.preventDefault();
    return;
  }
  if (e.key === 'Enter') {
    edge('jump');
    e.preventDefault();
  } else if (e.key === 'Backspace') {
    edge('back');
    e.preventDefault();
  } else if (e.key === 'Tab') {
    edge('tab');
    e.preventDefault();
  } else if (e.key === 'w' || e.key === 'W') togglePanel();
  else if (e.key >= '1' && e.key <= '5') {
    const d = WEAPONS[G.weapon.id];
    if (d && d.fuse) {
      if (NET.role === 'client') NET.send({ t: 'f', v: +e.key });
      else if (isMyTurn()) G.weapon.fuse = +e.key;
    }
  } else if (e.key === 'F3' || e.key === '`') {
    // Debug view: collision circles, probe points, bounding boxes, states and the settle blocker.
    UI.debug = !UI.debug;
    $('dbg').hidden = !UI.debug;
    e.preventDefault();
  } else if (e.key === 'F4') {
    // In debug view: full trajectories (recorded flight paths and the predicted shot).
    if (UI.debug) UI.traj = !UI.traj;
    e.preventDefault();
  } else if (e.key === 'r' || e.key === 'R') UI.ang = (UI.ang + 1) % 8;
  else if (e.key === 'c' || e.key === 'C') {
    UI.panT = -9;
  } else if (e.key === 't' || e.key === 'T') {
    // Chat (online games only): the key is swallowed so it is not typed into the input.
    if (chatAvailable()) {
      e.preventDefault();
      chatOpen();
    }
  } else if (e.key === 'm' || e.key === 'M') {
    muted = !muted;
    if (muted) mp3Stop();
    showMsg(tr(muted ? 'Sound off' : 'Sound on'), 900);
  } else if (e.key === 'f' || e.key === 'F') {
    toggleFullscreen();
  } else if (e.key === 'Escape') {
    if ($('wpanel').classList.contains('on')) togglePanel(false);
    else togglePause();
  }
});
addEventListener('keyup', e => {
  const k = KEYMAP[e.key];
  if (k) setKey(k, 0);
  else if (e.key === ' ') setKey('fire', 0);
});
addEventListener('blur', () => {
  ['l', 'r', 'u', 'd', 'fire'].forEach(k => setKey(k, 0));
});

/**
 * Opens or closes the weapon drawer (slides in from the right). Pass true/false to force a state.
 * @param {boolean} [open] desired state, toggles when omitted
 */
function togglePanel(open) {
  const p = $('wpanel'),
    on = open === undefined ? !p.classList.contains('on') : !!open;
  if (on && !p.classList.contains('on')) UI.wcur = G && G.weapon ? G.weapon.id : null; // keyboard cursor starts on the armed weapon
  p.classList.toggle('on', on);
  p.setAttribute('aria-hidden', on ? 'false' : 'true');
  $('wback').classList.toggle('on', on);
  if (on) panelCursor(UI.wcur);
}

/* ---- Weapon panel: keyboard navigation ---- */
/** Weapon buttons currently in the panel grid. */
const panelButtons = () => [...$('wgrid').querySelectorAll('.wb')];
/**
 * Puts the keyboard cursor on weapon `id` (the armed weapon, else the first one shown) and scrolls it into view.
 * Called after every grid rebuild too, so the cursor survives ammo changes.
 */
function panelCursor(id) {
  const bs = panelButtons();
  if (!bs.length) return;
  const b = bs.find(x => x.dataset.w === id) || bs.find(x => x.dataset.w === (G && G.weapon && G.weapon.id)) || bs[0];
  UI.wcur = b.dataset.w;
  for (const x of bs) x.classList.toggle('kb', x === b);
  if (b.scrollIntoView) b.scrollIntoView({ block: 'nearest' });
}
/** Moves the cursor: left / right step through the list, up / down jump to the nearest button in the next row. */
function panelMove(dx, dy) {
  const bs = panelButtons();
  if (!bs.length) return;
  let i = bs.findIndex(b => b.dataset.w === UI.wcur);
  if (i < 0) i = 0;
  if (dx) return panelCursor(bs[(i + dx + bs.length) % bs.length].dataset.w);
  const c = bs[i],
    cx = c.offsetLeft + c.offsetWidth / 2,
    rows = [...new Set(bs.map(b => b.offsetTop))].sort((a, b) => a - b),
    r = rows.indexOf(c.offsetTop) + dy;
  if (r < 0 || r >= rows.length) return;
  const row = bs.filter(b => b.offsetTop === rows[r]);
  row.sort((a, b) => Math.abs(a.offsetLeft + a.offsetWidth / 2 - cx) - Math.abs(b.offsetLeft + b.offsetWidth / 2 - cx));
  panelCursor(row[0].dataset.w);
}
/** Tab / Shift+Tab: next / previous visible category tab. */
function panelTab(dir) {
  const tabs = [...document.querySelectorAll('#wtabs [data-cat]')].filter(b => !b.hidden),
    i = tabs.findIndex(b => b.dataset.cat === UI.wcat);
  if (!tabs.length) return;
  UI.wcur = null;
  setWeaponTab(tabs[(i + dir + tabs.length) % tabs.length].dataset.cat);
  hud(); // rebuild the grid now so the cursor lands on the first weapon of the category
  const bs = panelButtons();
  if (bs.length) panelCursor(bs[0].dataset.w);
}
/**
 * Touch: swipe left / right over the weapon grid to move to the next / previous category tab (the tab strip
 * itself also scrolls sideways with a finger). A swipe is mostly horizontal, at least 50 px (or 18 % of the
 * panel) long and fast enough to be deliberate; vertical drags keep scrolling the grid.
 */
(function () {
  const grid = $('wgrid');
  let s = null;
  grid.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    s = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
  });
  const end = e => {
    if (!s || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x,
      dy = e.clientY - s.y,
      dt = performance.now() - s.t;
    s = null;
    if (e.type === 'pointercancel') return;
    const min = Math.max(50, $('wpanel').offsetWidth * 0.18);
    if (Math.abs(dx) >= min && Math.abs(dx) > Math.abs(dy) * 1.6 && dt < 900) {
      UI.swipedAt = performance.now();
      panelTab(dx < 0 ? 1 : -1);
      grid.classList.remove('swl', 'swr');
      void grid.offsetWidth; // restart the slide-in animation
      grid.classList.add(dx < 0 ? 'swl' : 'swr');
    }
  };
  grid.addEventListener('pointerup', end);
  grid.addEventListener('pointercancel', end);
})();
/**
 * Keyboard control of the open weapon panel (for players without a mouse): arrows move the cursor,
 * Enter / Space arm the weapon under it and close the panel, Tab / Shift+Tab change category, Home / End
 * jump to the ends, a letter jumps to the next weapon whose name starts with it. W and Esc close it (handled
 * by the normal key handler). Returns true when the key was consumed.
 */
function panelKey(e) {
  if (!$('wpanel').classList.contains('on') || e.ctrlKey || e.metaKey || e.altKey) return false;
  const k = e.key;
  if (k === 'w' || k === 'W' || k === 'Escape') return false;
  let used = true;
  if (k === 'ArrowLeft') panelMove(-1, 0);
  else if (k === 'ArrowRight') panelMove(1, 0);
  else if (k === 'ArrowUp') panelMove(0, -1);
  else if (k === 'ArrowDown') panelMove(0, 1);
  else if (k === 'Home' || k === 'End') {
    const bs = panelButtons();
    if (bs.length) panelCursor(bs[k === 'Home' ? 0 : bs.length - 1].dataset.w);
  } else if (k === 'Tab') panelTab(e.shiftKey ? -1 : 1);
  else if (k === 'Enter' || k === ' ') {
    if (!e.repeat) {
      const b = panelButtons().find(x => x.dataset.w === UI.wcur);
      if (b && !b.classList.contains('off')) {
        uiSelect(UI.wcur);
        togglePanel(false);
      }
    }
  } else if (k.length === 1 && /[a-z]/i.test(k)) {
    const bs = panelButtons(),
      n = bs.length,
      i = bs.findIndex(b => b.dataset.w === UI.wcur);
    for (let j = 1; j <= n; j++) {
      const b = bs[(i + j + n) % n];
      if (b.querySelector('b').textContent.trim().toLowerCase().startsWith(k.toLowerCase())) {
        panelCursor(b.dataset.w);
        break;
      }
    }
  } else used = false;
  if (used) e.preventDefault();
  return used;
}
/** Toggles browser full screen (Fullscreen API; the iOS iPhone Safari has none, so nothing happens there). */
function toggleFullscreen() {
  const d = document, el = d.documentElement;
  try {
    if (d.fullscreenElement || d.webkitFullscreenElement)
      (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
  } catch (e) {}
}
$('wfull').addEventListener('click', toggleFullscreen);
if (!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen))
  $('wfull').hidden = true;

/** Zoom limits for the battlefield camera. */
const ZOOM_MIN = 0.4,
  ZOOM_MAX = 2.6;
/**
 * Zooms the camera by `factor` while keeping the world point under screen position (sx, sy)
 * fixed, so the view zooms towards the cursor / pinch centre. Counts as a manual camera move.
 */
function zoomAt(sx, sy, factor) {
  if (!G) return;
  const [wx, wy] = toWorld(sx, sy);
  CAM.z = clamp(CAM.z * factor, ZOOM_MIN, ZOOM_MAX);
  CAM.s = CAM.z * clamp(VW / 1000, 0.7, 1.5);
  CAM.x = wx - (sx - VW / 2) / CAM.s;
  CAM.y = wy - (sy - VH / 2) / CAM.s;
  UI.panT = Math.max(G.time, 0.001);
}

// Pointer handling.
//  - Left button / one finger: a short press is a map click (targeting); dragging pans the camera.
//  - Right button: a short click toggles the weapon menu; dragging pans the camera.
//  - Two fingers: pinch to zoom (anchored at the midpoint) and drag to pan.
let drag = null,
  pinch = null;
const ptrs = new Map();
/** Distance and midpoint of the two active touches. */
const pinchGeom = () => {
  const [a, b] = [...ptrs.values()];
  return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
};
// No browser context menu anywhere over the game (HUD overlays included); the right button is the
// weapon menu. The menu screen keeps the normal behaviour for text fields.
addEventListener('contextmenu', e => {
  if ($('menu').style.display === 'none') e.preventDefault();
});
cvs.addEventListener('contextmenu', e => e.preventDefault());
cvs.addEventListener('pointerdown', e => {
  ac();
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  cvs.setPointerCapture(e.pointerId);
  if (ptrs.size === 2) {
    // second finger: switch from click/pan to pinch
    const g = pinchGeom();
    pinch = { d: g.d, z: CAM.z, mx: g.mx, my: g.my };
    if (drag) drag.moved = true;
    return;
  }
  if (ptrs.size > 2) return;
  drag = {
    x: e.clientX,
    y: e.clientY,
    cx: CAM.x,
    cy: CAM.y,
    moved: false,
    b: e.button,
    id: e.pointerId,
  };
});
cvs.addEventListener('pointermove', e => {
  if (G) {
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    UI.mx = wx;
    UI.my = wy;
  }
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && ptrs.size >= 2 && G) {
    const g = pinchGeom();
    // pan by the midpoint movement, then zoom around the new midpoint
    CAM.x -= (g.mx - pinch.mx) / CAM.s;
    CAM.y -= (g.my - pinch.my) / CAM.s;
    pinch.mx = g.mx;
    pinch.my = g.my;
    zoomAt(g.mx, g.my, (pinch.z * g.d) / pinch.d / CAM.z);
    return;
  }
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x,
    dy = e.clientY - drag.y;
  if (Math.hypot(dx, dy) > 6) drag.moved = true;
  if (drag.moved && G) {
    CAM.x = drag.cx - dx / CAM.s;
    CAM.y = drag.cy - dy / CAM.s;
    UI.panT = Math.max(G.time, 0.001);
  }
});
/** Ends a pointer; a short left click targets, a short right click toggles the weapon menu. */
const pointerEnd = e => {
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinch = null;
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.moved && e.type === 'pointerup' && G) {
    if (drag.b === 0 && isMyTurn()) {
      const [wx, wy] = toWorld(e.clientX, e.clientY);
      if (NET.role === 'client') NET.send({ t: 'c', x: wx, y: wy, a: UI.ang });
      else {
        G.weapon.ang = UI.ang;
        LOCAL.clicks.push({ x: wx, y: wy });
      }
    } else if (drag.b === 2 && isMyTurn()) togglePanel();
  }
  drag = null;
};
cvs.addEventListener('pointerup', pointerEnd);
cvs.addEventListener('pointercancel', pointerEnd);
// Mouse wheel: zooms towards the cursor. With the girder selected the wheel rotates it instead
// (hold Ctrl to zoom anyway; trackpad pinch gestures arrive as Ctrl+wheel).
cvs.addEventListener(
  'wheel',
  e => {
    e.preventDefault();
    if (!G) return;
    if (WEAPONS[G.weapon.id].id === 'girder' && isMyTurn() && !e.ctrlKey)
      UI.ang = (UI.ang + (e.deltaY > 0 ? 1 : 7)) % 8;
    else zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
  },
  { passive: false }
);
$('wgrid').addEventListener('click', e => {
  if (performance.now() - (UI.swipedAt || -1e9) < 350) return; // the end of a swipe is not a tap
  const b = e.target.closest('.wb');
  if (!b || b.classList.contains('off')) return;
  uiSelect(b.dataset.w);
  if (innerWidth < 800 || matchMedia('(pointer:coarse)').matches) togglePanel(false);
});
/** Weapon panel tabs: show one category or all weapons. */
function setWeaponTab(cat) {
  UI.wcat = cat;
  for (const b of document.querySelectorAll('#wtabs [data-cat]')) {
    b.classList.toggle('on', b.dataset.cat === cat);
    b.setAttribute('aria-selected', b.dataset.cat === cat ? 'true' : 'false');
  }
  UI.sig = null; // rebuild the grid
  const on = document.querySelector(`#wtabs [data-cat="${cat}"]`);
  if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' }); // keep the tab visible in the strip
  try {
    localStorage.setItem('wormgeddon.wtab', cat);
  } catch (e) {}
  $('wgrid').scrollTop = 0;
}
$('wtabs').addEventListener('click', e => {
  const b = e.target.closest('[data-cat]');
  if (b) setWeaponTab(b.dataset.cat);
});
try {
  const saved = localStorage.getItem('wormgeddon.wtab');
  if (saved && (saved === 'all' || WEAPON_CATS.includes(saved))) setWeaponTab(saved);
} catch (e) {}
$('wtoggle').addEventListener('click', () => togglePanel());
$('wclose').addEventListener('click', () => togglePanel(false));
$('wback').addEventListener('mousedown', () => togglePanel(false));
// The current-weapon box doubles as the menu button (handy on phones).
$('cur').addEventListener('click', () => isMyTurn() && togglePanel());
$('cur').addEventListener('keydown', e => (e.key === 'Enter' ? togglePanel() : 0));

/* Touch controls */
/** Inline SVG arrow used by the d-pad (points up; CSS rotates it). */
const PAD_ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l8 11H4z"/></svg>';
/** Icons of the action buttons: jump (chevrons up), back-flip (curved arrow), fire (burst). */
const TOUCH_ICONS = {
  jump: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 14l7-7 7 7M5 20l7-7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18a7 7 0 1 1 10 0M7 18l-1-5M7 18l5-1" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  fire: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.8 2.8M16.2 16.2L19 19M19 5l-2.8 2.8M7.8 16.2L5 19" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
};
/** Icon of the fire button while it means "let go" (rope / jet pack with another weapon selected): a broken link. */
const TOUCH_RELEASE =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14l-2 2a3.5 3.5 0 0 1-5-5l2-2M14 10l2-2a3.5 3.5 0 0 1 5 5l-2 2M9 5V3M5 7L3.5 5.5M15 21v-2M19 17l1.5 1.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
/**
 * Creates the on-screen gamepad (shown on devices with a coarse pointer): a slide-able d-pad on
 * the left (walk and aim, diagonals allowed) and, on the right, a big fire button with a power
 * ring plus jump and back-flip buttons. Every control uses pointer capture so several fingers
 * work at once and a finger may slide off a button without leaving it stuck.
 */
function buildTouch() {
  const box = $('touch');
  box.style.display = 'block';
  box.innerHTML = '';
  // --- d-pad: one touch surface, the finger position decides the directions
  const pad = document.createElement('div');
  pad.className = 'dpad';
  pad.innerHTML =
    ['u', 'r', 'd', 'l'].map(k => `<i class="arm ${k}">${PAD_ARROW}</i>`).join('') +
    '<b class="hub"></b>';
  const dirs = { l: 0, r: 0, u: 0, d: 0 };
  const setDirs = e => {
    const r = pad.getBoundingClientRect(),
      dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2),
      dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2),
      dead = Math.hypot(dx, dy) < 0.18,
      next = {
        l: !dead && dx < -0.32,
        r: !dead && dx > 0.32,
        u: !dead && dy < -0.32,
        d: !dead && dy > 0.32,
      };
    for (const k in dirs)
      if (!!dirs[k] !== next[k]) {
        dirs[k] = next[k] ? 1 : 0;
        setKey(k, dirs[k]);
        pad.querySelector('.arm.' + k).classList.toggle('on', next[k]);
      }
  };
  // Lifting the finger clears every direction.
  const release = () => {
    for (const k in dirs)
      if (dirs[k]) {
        dirs[k] = 0;
        setKey(k, 0);
        pad.querySelector('.arm.' + k).classList.remove('on');
      }
  };
  pad.addEventListener('pointerdown', e => {
    e.preventDefault();
    ac();
    pad.setPointerCapture(e.pointerId);
    setDirs(e);
  });
  pad.addEventListener('pointermove', e => pad.hasPointerCapture(e.pointerId) && setDirs(e));
  pad.addEventListener('pointerup', release);
  pad.addEventListener('pointercancel', release);
  box.appendChild(pad);
  // --- action cluster
  const act = document.createElement('div');
  act.className = 'tact';
  const mk = (cls, key, label) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tbtn ' + cls;
    b.id = 't' + cls;
    b.setAttribute('aria-label', tr(label));
    b.innerHTML = TOUCH_ICONS[cls];
    const down = ev => {
      ev.preventDefault();
      ac();
      b.setPointerCapture(ev.pointerId);
      b.classList.add('down');
      if (key === 'fire') {
        setKey('fire', 1);
        edge('fireP');
      } else edge(key);
    };
    const up = ev => {
      ev.preventDefault();
      b.classList.remove('down');
      if (key === 'fire') setKey('fire', 0);
    };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('contextmenu', e => e.preventDefault());
    act.appendChild(b);
  };
  mk('fire', 'fire', 'Fire');
  mk('jump', 'jump', 'Jump');
  mk('back', 'back', 'Back-flip');
  // Aux button: cycles the grenade fuse (1-5 s) or rotates the girder; only shown when relevant.
  const aux = document.createElement('button');
  aux.type = 'button';
  aux.id = 'taux';
  aux.className = 'tbtn aux';
  aux.hidden = true;
  aux.addEventListener('pointerdown', ev => {
    ev.preventDefault();
    ac();
    const d = WEAPONS[G.weapon.id];
    if (d && d.id === 'girder') UI.ang = (UI.ang + 1) % 8;
    else if (d && d.fuse) {
      const v = (G.weapon.fuse % 5) + 1;
      if (NET.role === 'client') NET.send({ t: 'f', v });
      else if (isMyTurn()) G.weapon.fuse = v;
    }
  });
  act.appendChild(aux);
  box.appendChild(act);
}
/** Keeps the fire button's power ring in step with the charge of the current shot. */
function touchFx() {
  const f = document.getElementById('tfire'),
    aux = document.getElementById('taux');
  if (!f || !G || !G.weapon) return;
  // Controls stay at the bottom corners; they are lifted above the weapon box only when the
  // d-pad or the action cluster would horizontally overlap it (narrow / portrait screens).
  const cur = document.getElementById('cur'),
    pad = document.querySelector('#touch .dpad'),
    act = document.querySelector('#touch .tact'),
    box = document.getElementById('touch');
  if (cur && pad && act && cur.offsetWidth) {
    const c = cur.getBoundingClientRect(),
      p = pad.getBoundingClientRect(),
      a = act.getBoundingClientRect(),
      lift = p.right + 6 > c.left || a.left - 6 < c.right;
    if (box.classList.contains('lift') !== lift) box.classList.toggle('lift', lift);
    box.style.setProperty('--curh', c.height.toFixed(0) + 'px');
  }
  f.style.setProperty('--pw', G.weapon.pw > 0 ? (G.weapon.pw * 100).toFixed(0) : 0);
  // On the rope / jet pack with another weapon selected the buttons change meaning: Jump becomes a
  // glowing "fire the selected weapon" button showing that weapon's icon, and Fire becomes "let go".
  const aw = activeWorm(),
    alt = !!(aw && isMyTurn() && holdingOther(aw)),
    j = document.getElementById('tjump'),
    mode = alt ? G.weapon.id : '';
  if (j && j.dataset.mode !== mode) {
    j.dataset.mode = mode;
    j.classList.toggle('shoot', alt);
    j.innerHTML = alt
      ? `<img src="${weaponIconURL(G.weapon.id)}" alt="" /><span class="tag" data-nt>${tr('FIRE')}</span>`
      : TOUCH_ICONS.jump;
    j.setAttribute('aria-label', tr(alt ? 'Fire selected weapon' : 'Jump'));
    f.classList.toggle('release', alt);
    f.innerHTML = alt ? TOUCH_RELEASE : TOUCH_ICONS.fire;
    f.setAttribute('aria-label', tr(alt ? 'Let go' : 'Fire'));
  }
  const d = WEAPONS[G.weapon.id],
    label = d && d.id === 'girder' ? '\u27F3' : d && d.fuse ? G.weapon.fuse + 's' : '';
  aux.hidden = !label;
  if (aux.textContent !== label) aux.textContent = label;
}
if (matchMedia('(pointer:coarse)').matches) buildTouch();
