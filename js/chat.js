'use strict';

/**
 * @file chat.js - Player chat (online games)
 *
 * Text chat between the players of an online room, in the lobby (Host / Join tabs) and during the
 * match (overlay, key T or the Chat button). Offline games have no chat.
 *
 * Protocol (see net.js): everything goes through the host, which stamps the sender.
 *   guest -> host   { t: 'chat', x: text }
 *   host  -> all    { t: 'chat', n: senderName, k: teamIndex | -1, x: text }
 * The host also shows (and broadcasts) its own messages the same way, so every client sees the
 * lines in the same order. Text is cleaned (control characters, length) on both ends, rendered
 * with textContent only (never as HTML) and rate-limited on the host.
 *
 * Depends on: net, fx, i18n, audio
 * Globals defined: CHAT, chatClean, chatMyName, chatReset, chatReceive, chatSend, chatHostMsg,
 *     chatOpen, chatClose, chatSync
 */

/* ===== Chat ===== */
/** Chat state: `log` holds {n, k, x, t} lines (name, team index, text, time; oldest first). */
const CHAT = {
  log: [],
  max: 140, // characters per message
  keep: 80, // lines kept
  show: 7, // lines shown in the in-game overlay
  gap: 350, // ms between two messages of the same guest (host side)
};

/** Removes control characters, collapses spaces and cuts the text to CHAT.max characters. */
const chatClean = s =>
  String(s == null ? '' : s)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CHAT.max);

/** Name shown for my own messages (only used by the host; guests are named by the host). */
function chatMyName() {
  if (G && !G.demo && G.teams[UI.myTeam]) return G.teams[UI.myTeam].name;
  return (($('teamRows').querySelector('input') || {}).value || tr('Host')).slice(0, 14);
}

/** True while there is a room to talk to (hosting, or joined as a guest). */
const chatAvailable = () => NET.role === 'host' || NET.role === 'client';

/** One chat line as a DOM element: coloured name, then the text (no HTML parsing). */
function chatLine(m) {
  const row = document.createElement('div'),
    who = document.createElement('b');
  row.className = 'cl';
  // The overlay fades each line out with a CSS animation; the delay keeps old lines from restarting.
  row.style.animationDelay = -Math.max(0, (Date.now() - (m.t || Date.now())) / 1000) + 's';
  who.textContent = m.n;
  if (m.k >= 0 && TEAM_COLORS[m.k]) who.style.color = TEAM_COLORS[m.k];
  row.append(who, document.createTextNode(' ' + m.x));
  return row;
}

/** Redraws every chat log (lobby tabs show all lines, the in-game overlay the last few). */
function chatSync() {
  for (const el of document.querySelectorAll('[data-chatlog]')) {
    const lines = el.id === 'chatlog' ? CHAT.log.slice(-CHAT.show) : CHAT.log;
    el.replaceChildren(...lines.map(chatLine));
    el.scrollTop = el.scrollHeight;
  }
  const show = chatAvailable();
  for (const id of ['hostChat', 'joinChat']) $(id).hidden = !show;
  $('wchat').hidden = !show || !G || G.demo;
}

/** Forgets the conversation (called when the room is closed). */
function chatReset() {
  CHAT.log.length = 0;
  chatClose();
  chatSync();
}

/** Adds a validated line coming from the host (or produced by the host itself). */
function chatReceive(m) {
  if (!m || typeof m.x !== 'string' || typeof m.n !== 'string') return;
  const x = chatClean(m.x),
    n = chatClean(m.n).slice(0, 14);
  if (!x || !n) return;
  const k = Number.isInteger(m.k) && m.k >= 0 && m.k < MAX_TEAMS ? m.k : -1;
  CHAT.log.push({ n, k, x, t: Date.now() });
  if (CHAT.log.length > CHAT.keep) CHAT.log.shift();
  chatSync();
  if (!(G && !G.demo && k >= 0 && k === UI.myTeam) && !muted && typeof SFX !== 'undefined')
    SFX.beep();
}

/**
 * Sends a message from this player. The host adds and broadcasts it; a guest asks the host to.
 * @returns {boolean} true when something was sent
 */
function chatSend(text) {
  const x = chatClean(text);
  if (!x || !chatAvailable()) return false;
  if (NET.role === 'host') {
    const m = { t: 'chat', n: chatMyName(), k: G && !G.demo ? UI.myTeam : -1, x };
    chatReceive(m);
    NET.bcast(m);
  } else NET.send({ t: 'chat', x });
  return true;
}

/** Host side: a guest's message is re-stamped with the guest's name and team, then broadcast. */
function chatHostMsg(g, m) {
  const now = Date.now();
  if (now - (g.lastChat || 0) < CHAT.gap) return; // flood control
  g.lastChat = now;
  const x = chatClean(m && m.x);
  if (!x) return;
  const out = { t: 'chat', n: g.name, k: g.team, x };
  chatReceive(out);
  NET.bcast(out);
}

/* ---- In-game overlay ---- */
/** Opens the in-game chat input (key T / Chat button). */
function chatOpen() {
  if (!chatAvailable() || !G || G.demo) return;
  $('chat').classList.add('open');
  $('chatform').hidden = false;
  $('chatin').focus();
}
/** Closes the in-game input and gives the keyboard back to the game. */
function chatClose() {
  $('chat').classList.remove('open');
  $('chatform').hidden = true;
  $('chatin').blur();
  $('chatin').value = '';
}

/* ---- Wiring ---- */
$('wchat').addEventListener('click', () =>
  $('chat').classList.contains('open') ? chatClose() : chatOpen()
);
$('chatform').addEventListener('submit', e => {
  e.preventDefault();
  chatSend($('chatin').value);
  chatClose();
});
$('chatin').addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    chatClose();
    e.stopPropagation();
  }
});
// Lobby chat boxes (Host and Join tabs): same input handling, the input keeps focus after sending.
for (const [form, input] of [
  ['hostChatForm', 'hostChatIn'],
  ['joinChatForm', 'joinChatIn'],
])
  $(form).addEventListener('submit', e => {
    e.preventDefault();
    if (chatSend($(input).value)) $(input).value = '';
  });
onLang(chatSync);
chatSync();
