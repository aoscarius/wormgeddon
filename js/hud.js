'use strict';

/**
 * @file hud.js - HUD
 *
 * DOM heads-up display: turn timer, active team/worm, wind meter, team health bars, the current
 * weapon box, the weapon panel (with icons) and the game-over overlay.
 *
 * The HUD only reads the match state G, so it works identically for local hosts and online
 * clients. It is refreshed about 12 times per second from the main loop (see main.js).
 *
 * Depends on: view, core, icons, match (avail)
 * Globals defined: esc, isMyTurn, setHTML, hudTurnInfo, hudWind, hudTeams, weaponHint, activeHint,
 *     hudWeapon, hudPanel, hud, showOver
 */

/** Escapes text for safe insertion into innerHTML. */
const esc = s =>
  String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * Whether the local player controls the worm that is currently active.
 * Clients control their own team; hosts/local games control every team with ctrl === 'local'.
 * @returns {boolean}
 */
function isMyTurn() {
  if (!G) return false;
  const w = activeWorm();
  if (!w) return false;
  if (NET.role === 'client') return w.team === UI.myTeam;
  return G.teams[w.team].ctrl === 'local';
}

/** Writes `html` into element `id` only when it changed (avoids needless DOM churn). */
function setHTML(id, html) {
  const el = $(id);
  if (el.dataset.h !== html) {
    el.innerHTML = html;
    el.dataset.h = html;
  }
}

/** Timer circle plus the "team / worm / round" banner. */
function hudTurnInfo(w, t) {
  $('timer').textContent =
    G.phase === 'settle' || G.phase === 'over' ? '--' : Math.max(0, Math.ceil(G.timer));
  $('timer').classList.toggle('low', G.phase === 'turn' && G.timer <= 5);
  if (!t) return;
  $('who').style.borderLeftColor = t.color;
  $('whoTeam').textContent = t.name;
  $('whoWorm').textContent =
    (t.ctrl === 'ai' ? tr('{0} (bot)', w.name) : w.name) + ' · ' + tr('Round {0}', G.round + 1);
}

/** Wind meter: the bar grows left or right from the centre mark. */
function hudWind() {
  const fill = $('windfill'),
    v = G.wind * 50;
  fill.style.left = (v >= 0 ? 50 : 50 + v) + '%';
  fill.style.width = Math.abs(v) + '%';
}

/** One health bar per team (sum of its worms' health relative to the starting total). */
function hudTeams(t) {
  const maxTotal = G.cfg.hp * G.cfg.worms;
  let html = '';
  for (const tm of G.teams) {
    const hp = tm.worms.reduce((sum, id) => sum + shownHp(wById(id)), 0);
    const pct = clamp((hp / maxTotal) * 100, 0, 100);
    html +=
      `<div class="tb${t && tm.id === t.id ? ' act' : ''}">` +
      `<span class="n" style="color:${tm.color}">${esc(tm.name)}</span>` +
      `<span class="bar"><i style="width:${pct}%;background:${tm.color}"></i></span></div>`;
  }
  setHTML('teamsbar', html);
}

/** Usage hint shown under the weapon name. */
function weaponHint(d) {
  const touch = matchMedia('(pointer:coarse)').matches;
  if (d.id === 'girder')
    return touch
      ? tr('Tap to place · \u27F3 to rotate')
      : tr('Click to place · R / wheel to rotate');
  if (d.id === 'homing' && G.weapon.tx == null) return tr('Click the map to set a target first');
  let hint = d.charge
    ? tr(touch ? 'Hold FIRE to charge, release to shoot' : 'Hold Space to charge, release to fire')
    : d.click
      ? tr('Click the map to target')
      : d.noFire
        ? tr('Active')
        : tr(touch ? 'Press FIRE' : 'Press Space');
  if (d.fuse)
    hint +=
      ' \u00b7 ' + tr(touch ? 'fuse {0}s (tap the timer)' : 'fuse {0}s (keys 1-5)', G.weapon.fuse);
  return hint;
}

/** Hint for a weapon that is currently in use (rope, jet pack, digging tool), or '' if none. */
function activeHint(w) {
  const touch = matchMedia('(pointer:coarse)').matches;
  if (!w) return '';
  // Another weapon selected while hanging / flying: Jump fires it, Space / FIRE lets go.
  if ((w.rope || w.jet) && holdingOther(w))
    return tr(touch ? 'JUMP fires the selected weapon \u00b7 FIRE lets go' : 'Enter fires the selected weapon \u00b7 Space lets go');
  if (w.rope)
    return tr(
      touch
        ? 'Left/Right swing \u00b7 Up/Down reel \u00b7 JUMP, BACK or FIRE lets go'
        : 'Left/Right swing \u00b7 Up/Down reel \u00b7 Enter, Backspace or Space lets go'
    );
  if (w.jet) return tr(touch ? 'Up/Left/Right thrust \u00b7 FIRE switches off' : 'Up/Left/Right thrust \u00b7 Space switches off');
  if (w.tool && w.tool.k !== 'kami') return tr(touch ? 'FIRE stops digging' : 'Space stops digging');
  return '';
}

/** The box at the bottom centre: icon, name, ammo and a hint (or who we are waiting for). */
function hudWeapon(t, mine) {
  const d = WEAPONS[G.weapon.id];
  const ammo = t ? t.ammo[d.id] : 0;
  const icon = weaponIconURL(d.id);
  if ($('curIcon').dataset.id !== d.id) {
    $('curIcon').src = icon;
    $('curIcon').dataset.id = d.id;
  }
  $('curName').textContent = wname(d.id) + (ammo >= 0 ? ' ×' + ammo : '  ∞');
  $('curHint').textContent = mine
    ? activeHint(activeWorm()) || weaponHint(d)
    : t && t.ctrl === 'ai'
      ? tr('Bot is thinking')
      : tr('Waiting for {0}', t ? t.name : '');
}

/** Rebuilds the weapon grid when ammo, round or selection changes. */
function hudPanel(t, mine) {
  const signature = mine
    ? [
        LANG,
        t.id,
        G.round,
        G.weapon.id,
        WLIST.map(x => t.ammo[x.id] + '' + (avail(t, x.id) ? 1 : 0)).join(''),
      ].join('|')
    : 'x';
  if (signature !== UI.sig) {
    UI.sig = signature;
    let html = '';
    if (mine) {
      for (const x of WLIST) {
        const ok = avail(t, x.id),
          ammo = t.ammo[x.id];
        // Badge: remaining ammo, infinity, or the round the weapon unlocks in.
        const badge = ok
          ? ammo < 0
            ? '∞'
            : ammo
          : G.cfg.arsenal === 'std' && x.delay > G.round
            ? 'R' + x.delay
            : '';
        html +=
          `<button type="button" class="wb${G.weapon.id === x.id ? ' sel' : ''}${ok ? '' : ' off'}" ` +
          `data-w="${x.id}" title="${esc(wname(x.id))}" ${ok ? '' : 'aria-disabled="true"'}>` +
          `<img src="${weaponIconURL(x.id)}" alt="" width="40" height="40">` +
          `<b>${esc(wname(x.id))}</b><em>${badge}</em></button>`;
      }
    }
    $('wgrid').innerHTML = html;
  }
  $('wtoggle').style.display = mine ? '' : 'none';
  $('touch').classList.toggle('off', !mine);
  if (!mine) togglePanel(false);
}

/** Refreshes the whole HUD from the current match state. */
function hud() {
  if (!G) return;
  const w = activeWorm(),
    t = w ? G.teams[w.team] : null,
    mine = !!(isMyTurn() && t);
  hudTurnInfo(w, t);
  hudWind();
  hudTeams(t);
  hudWeapon(t, mine);
  setHTML('log', FX.logs.map(l => `<span style="color:${l.c}">${esc(l.t)}</span>`).join(''));
  hudPanel(t, mine);
  if (UI.debug) $('dbg').textContent = debugText();
}

/**
 * Shows the end-of-match overlay (after a short delay so the last explosion can play out).
 * @param {number} winner winning team index, or -1 for a draw
 */
function showOver(winner) {
  UI.over = true;
  const t = winner >= 0 ? G.teams[winner] : null;
  $('overT').textContent = t ? tr('{0} wins!', t.name) : tr('Draw!');
  $('overT').style.color = t ? t.color : '';
  $('overS').textContent = tr('Rounds played: {0}', G.round + 1);
  setTimeout(() => $('over').classList.add('on'), 1400);
}
