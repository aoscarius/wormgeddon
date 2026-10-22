'use strict';

/**
 * @file invite.js - Invite links
 *
 * One-click room sharing. The host gets a link (`<this page>?join=ABCDE`) to copy or, on phones, to
 * pass to the system share sheet; opening that link joins the room straight away and lands the guest
 * on the Join tab (the lobby: connection status and chat).
 *
 * Depends on: net, menu, i18n
 * Globals defined: inviteCode, inviteURL, inviteSync, inviteAction, inviteBoot
 */

/** Room code from a `?join=` value or a pasted code / link; '' when it does not look like one. */
function inviteCode(v) {
  const m = String(v || '')
    .toUpperCase()
    .match(/(?:JOIN=|WORMGEDDON-)?([A-Z0-9]{3,12})\s*$/);
  return m ? m[1] : '';
}
/** The invite link of the open room (this page's address without query or hash). */
const inviteURL = code => location.href.split(/[?#]/)[0] + '?join=' + code;
/** True when the browser has a share sheet. */
const inviteCanShare = () => typeof navigator.share === 'function';

/** Updates the link field and the button (label: Share on phones, Copy otherwise; off until a room is open). */
function inviteSync() {
  const code = NET.role === 'host' ? NET.code : '', b = $('bLink');
  b.disabled = !code;
}
/** Copies text; falls back to selecting the field where the clipboard API is missing (plain http). */
function inviteCopy(text) {
  try {
    if (navigator.clipboard && window.isSecureContext)
      return navigator.clipboard.writeText(text).then(() => true, () => false);
  } catch (e) {}
  const f = $('hostLink');
  f.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (e) {}
  return Promise.resolve(ok);
}
/** The button: share sheet on phones, otherwise (or if sharing fails) copy the link. */
async function inviteAction() {
  if (!NET.code) return;
  const url = inviteURL(NET.code);
  if (inviteCanShare()) 
  {
    try {
      await navigator.share({ title: 'Wormgeddon', text: tr('Join my Wormgeddon game!'), url: url });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return; // the player closed the sheet
    }
  }
  showMsg(tr((await inviteCopy(url)) ? 'Link copied' : 'Select the link and copy it'), 1400);
}
/** At start-up: `?join=CODE` opens the Join tab and joins that room at once. */
function inviteBoot() {
  let code = '';
  try {
    code = inviteCode(new URLSearchParams(location.search).get('join'));
  } catch (e) {}
  if (!code) return;
  document.querySelector('.tabs button[data-tab="join"]').click();
  $('jCode').value = code;
  try {
    let n = localStorage.getItem('wormgeddon.name');
    if (!n) localStorage.setItem('wormgeddon.name', (n = tr('Player') + Math.floor(10 + Math.random() * 90)));
    $('jName').value = n;
  } catch (e) {}
  try {
    history.replaceState(null, '', location.href.split(/[?#]/)[0]); // a reload must not re-join an old room
  } catch (e) {}
  $('joinNote').textContent = tr('Joining room {0}...', code);
  joinRoom();
}
$('bLink').addEventListener('click', inviteAction);
$('jName').addEventListener('change', () => {
  try {
    localStorage.setItem('wormgeddon.name', $('jName').value.trim());
  } catch (e) {}
});
// A pasted invite link in the code box works too.
$('jCode').addEventListener('input', () => {
  const v = $('jCode').value;
  if (/[?\/]/.test(v)) $('jCode').value = inviteCode(v);
});
onLang(inviteSync);
inviteSync();
