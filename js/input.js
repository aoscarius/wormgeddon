'use strict';

/**
 * @file input.js - Input
 *
 * Keyboard, mouse/touch and on-screen touch controls. Translates them into the LOCAL input
 * record (and network messages for clients).
 *
 * Depends on: view, hud, net
 * Globals defined: uiSelect, KEYMAP, setKey, edge, ZOOM_MIN, ZOOM_MAX, zoomAt, drag, pinch, buildTouch
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
// Keyboard: arrows, Space, Enter, Backspace, Tab, W (panel), 1-5 (fuse), R (girder), C, M, Esc.
addEventListener('keydown', e => {
  if (!G || $('menu').style.display !== 'none' || e.target.tagName === 'INPUT') return;
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
  } else if (e.key === 'w' || e.key === 'W') $('wpanel').classList.toggle('on');
  else if (e.key >= '1' && e.key <= '5') {
    const d = WEAPONS[G.weapon.id];
    if (d && d.fuse) {
      if (NET.role === 'client') NET.send({ t: 'f', v: +e.key });
      else if (isMyTurn()) G.weapon.fuse = +e.key;
    }
  } else if (e.key === 'r' || e.key === 'R') UI.ang = (UI.ang + 1) % 8;
  else if (e.key === 'c' || e.key === 'C') {
    UI.panT = -9;
  } else if (e.key === 'm' || e.key === 'M') {
    muted = !muted;
    showMsg(tr(muted ? 'Sound off' : 'Sound on'), 900);
  } else if (e.key === 'Escape') togglePause();
});
addEventListener('keyup', e => {
  const k = KEYMAP[e.key];
  if (k) setKey(k, 0);
  else if (e.key === ' ') setKey('fire', 0);
});
addEventListener('blur', () => {
  ['l', 'r', 'u', 'd', 'fire'].forEach(k => setKey(k, 0));
});

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
    } else if (drag.b === 2 && isMyTurn()) $('wpanel').classList.toggle('on');
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
  const b = e.target.closest('.wb');
  if (!b || b.classList.contains('off')) return;
  uiSelect(b.dataset.w);
  if (innerWidth < 800) $('wpanel').classList.remove('on');
});
$('wtoggle').addEventListener('click', () => $('wpanel').classList.toggle('on'));

/* Touch controls */
/** Creates the on-screen touch buttons (shown on devices with a coarse pointer). */
function buildTouch() {
  const box = $('touch');
  box.style.display = 'block';
  const defs = [
    ['◀', 'l', 'left:12px;bottom:84px'],
    ['▶', 'r', 'left:82px;bottom:84px'],
    ['▲', 'u', 'left:47px;bottom:146px'],
    ['▼', 'd', 'left:47px;bottom:22px'],
    ['⤒', 'jump', 'right:84px;bottom:100px'],
    ['●', 'fire', 'right:14px;bottom:84px'],
  ];
  for (const [txt, k, pos] of defs) {
    const b = document.createElement('div');
    b.className = 'tc';
    b.textContent = txt;
    b.style.cssText = pos;
    const down = ev => {
      ev.preventDefault();
      ac();
      if (k === 'jump') {
        edge('jump');
      } else if (k === 'fire') {
        setKey('fire', 1);
        edge('fireP');
      } else setKey(k, 1);
    };
    const up = ev => {
      ev.preventDefault();
      if (k === 'fire') setKey('fire', 0);
      else if (k !== 'jump') setKey(k, 0);
    };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('pointerleave', up);
    box.appendChild(b);
  }
}
if (matchMedia('(pointer:coarse)').matches) buildTouch();
