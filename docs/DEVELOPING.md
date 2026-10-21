# Wormgeddon developer guide

How the game is put together and how to customise or extend it: weapons, projectiles, levels,
level styles, themes, languages, crates, menu options and the network protocol.

Everything is plain JavaScript loaded with ordinary `<script>` tags (no bundler, no modules), so
every top-level `function` / `const` is a global and you can try things in the browser console
(`window.__wh` also exposes `newGame`, `stepOnce`, `G`, ...).

- [Wormgeddon developer guide](#wormgeddon-developer-guide)
  - [1. Project layout and workflow](#1-project-layout-and-workflow)
  - [2. How the game runs](#2-how-the-game-runs)
  - [3. Adding a weapon](#3-adding-a-weapon)
    - [Worked example: Pumpkin Bomb](#worked-example-pumpkin-bomb)
  - [4. Adding a projectile type](#4-adding-a-projectile-type)
  - [5. Tool-like weapons](#5-tool-like-weapons)
  - [6. Levels](#6-levels)
    - [6.1 Levels folder (PNG levels)](#61-levels-folder-png-levels)
    - [6.2 Generated level styles](#62-generated-level-styles)
    - [6.3 Themes](#63-themes)
  - [7. Menu options and match settings](#7-menu-options-and-match-settings)
  - [8. Languages](#8-languages)
  - [9. Crates, sounds, icons, sprites, worm art](#9-crates-sounds-icons-sprites-worm-art)
  - [10. Bots](#10-bots)
  - [11. Online play and the network protocol](#11-online-play-and-the-network-protocol)
  - [12. Debugging and tests](#12-debugging-and-tests)
  - [13. Conventions and gotchas](#13-conventions-and-gotchas)

---

## 1. Project layout and workflow

```
index.html        development entry point (menu markup, HUD, <script> list = load order)
css/style.css     all styles (HUD, menu, touch gamepad, weapon drawer)
js/*.js           game modules, see below
maps/             PNG levels + optional manifest.json (see section 6)
build/            build.js (minify + compress for deployment), package.json, README.md
tests/            Playwright browser tests, README.md, requirements.txt
dist/             build output (git-ignored): the deployable folder (index.html, assets/, maps/, sounds/)
```

| Module | What lives there |
| --- | --- |
| `util.js` | `$`, `clamp`, `rnd`, `rndi`, `pick`, seeded RNG (`mulberry`, `hashStr`) |
| `i18n.js`, `lang-it.js` | `tr()`, `wname()`, dictionaries |
| `audio.js` | WebAudio helpers (`tone`, `noiseBurst`, `mp3Sfx`) and the `SFX` table |
| `themes.js` | colour palettes (`THEMES`) |
| `terrain.js` | terrain mask + canvas, level generation (`generateTerrain`), carving, girders |
| `custommap.js`, `maplib.js` | importing PNG levels, the level library |
| `collision.js` | `solid`, `hitC`, `normalAt`, `findFree`, `groundBelow`, `stepBody` |
| `core.js` | constants, **`registerWeapon` / `registerProj`**, global state `G`, helpers |
| `match.js` | `newGame`, turn flow (`startTurn`, `toSettle`, `quiet`), deaths, end of game |
| `combat.js` | `hurt`, `explode` |
| `projectiles.js` | projectile types (`registerProj` records) and their update loop |
| `worms.js` | worm physics, walking, jumping, rope, jet pack, tools |
| `crates.js` | crates and oil drums |
| `weapons.js` | **the weapon catalogue**, fire helpers, weapon selection, fire/charge state machine |
| `step.js` | one simulation tick (`step`) |
| `view.js`, `fx.js` | camera, UI state, effects/particles, event playback |
| `sprites.js`, `worm-art.js`, `icons.js`, `render.js` | all drawing |
| `hud.js`, `input.js`, `menu.js` | HUD, keyboard/mouse/touch input, menu |
| `ai.js` | bot |
| `net.js` | PeerJS host/guest |
| `main.js` | main loop (`stepOnce`, `frame`) and `window.__wh` |

Workflow:

```bash
# edit files, then open index.html directly (works from file://) or serve the folder:
python3 -m http.server 8000
(cd build && npm install)        # once: esbuild + html-minifier-terser, build-time only
node build/build.js              # -> dist/: minified html/css/js (hashed), maps/, sounds/, .gz/.br
pip install -r tests/requirements.txt && playwright install chromium   # once
python3 tests/run_all.py         # every test; or one: python3 tests/smoke.py (see tests/README.md)
```

New `.js` files must be added to the `<script>` list in `index.html` (order = load order; the
`Depends on:` line in each file header documents what a module needs). `build/build.js` picks the
scripts up from that list automatically.

---

## 2. How the game runs

* **Fixed step.** `main.js` runs `stepOnce(1/60)` up to 6 times per frame; it builds the input record
  for every team and calls `step(dt, inputs)` (`step.js`).
* **State.** The whole match is the global `G`: `teams[]`, `worms[]`, `projs[]`, `fires[]`,
  `objs[]` (drums, crates), `phase`, `active` (worm id), `timer`, `wind`, `waterY`, `weapon`
  (the current selection), `ev[]` (events of this tick), `sched[]` (delayed actions).
* **Phases.** `turn` (player controls) -> `retreat` (3 s after firing) -> `settle` (the timer shows
  `--`; waits until `quiet()` is true, hard cap 10 s) -> next turn. `quietBlocker()` in `match.js`
  returns *why* the match is not quiet; the debug view prints it.
* **Input.** Each team has an input record (`makeInp()`): held keys `l r u d fire`, one-shot edges
  `fireP jump back tab`, and a queue of map `clicks`. Humans share `LOCAL`; bots fill `t.aiInp`;
  online guests fill `t.remoteInp`.
* **Events.** Simulation code never draws. It calls `emit({e: 'x', ...})` and `drainEvents()`
  (`net.js`) plays them on the host and sends them to guests; `fx.js` implements each type
  (`x` explosion, `snd` sound, `msg` banner, `log`, `splash`, `shot`, `tele`, `trail`, ...). Terrain
  changes (`x`, `cv`, `gd`) go through `applyTerrain` on both sides so everybody carves the same
  ground.
* **Localisation.** Event texts are English *keys* plus `a` arguments (`emit({e:'msg', t:'{0} died', a:[name]})`);
  each client translates with `tr()` when it plays the event.

---

## 3. Adding a weapon

A weapon is one `registerWeapon({...})` record in `js/weapons.js` (anywhere before the end of the
file; menu order = registration order). Fields:

| Field | Meaning |
| --- | --- |
| `id`, `name`, `code` | identity; `code` = two-letter badge used when there is no icon |
| `ammo` | starting ammo, `-1` = unlimited |
| `delay` | first round it is available in the *Standard* arsenal |
| `charge` | `true`: hold Space to charge, fires on release |
| `fuse` | `true`: honours the 1-5 fuse keys (`G.weapon.fuse`) |
| `click`, `instant` | `click`: needs a map click (`ctx.target`); `instant`: acts immediately |
| `noEnd`, `anyPhase` | `noEnd`: using it does not end the turn; `anyPhase`: also usable while retreating |
| `shots` | number of presses before the turn ends (shotgun: 2) |
| `needTarget` | needs a target marker first (homing missile) |
| `noFire` | listed in the menu but cannot be "fired" (select worm, skip, surrender, parachute) |
| `fire(ctx)` | does the attack. `ctx = {w, team, power, wdef, target}`. Return `'miss'` to cancel without spending ammo, `'keep'` for tool-like weapons |
| `onSelect(w, team)` | optional hook when picked |

Helper functions in `weapons.js`: `muzzle(w)` (point in front of the hands + aim vector),
`throwP(type, lo, hi, extra)` (a `fire()` that launches a projectile, speed `lo..hi` by charge),
`ray(...)` (hitscan), `melee(...)`, `strike(...)` (air strikes), `aimDir(w)`.

### Sky and world weapons (examples in the code)

Five weapons show the patterns that need more than a thrown projectile (all in `weapons.js` /
`projectiles.js`, helpers `surfaceAt(x, from)` = first solid pixel going down, `sched(t, fn)`):

| Weapon | How it works |
| --- | --- |
| **Thunderstorm** (`thunder`) | click weapon; `sched()` calls `lightningBolt(x)` five times. Each bolt emits a `bolt` event (jagged flash drawn from `FX.bolts`, `render.js`) and a small `explode()`. |
| **Dragon Fire** (`dragonfire`) | click weapon; spawns the `dragon` projectile whose `tick()` flies it across the top of the level (just above the highest ground near the target), slows down near `tx` and drops flames with `spawnFire()`. `p.walk` is 1 while breathing so guests draw the flame. |
| **Tornado** (`tornado`) | click weapon; the `tornado` projectile's `tick()` walks along the ground for 8 s and applies forces to worms in range (pull, lift, fling, 1 HP/0.5 s). |
| **Tsunami** (`tsunami`) | instant weapon; sets `G.tsu = {dir, D, H0, t, hit}` with a random side. `tsunamiTick()` (called from `step.js`) moves the front inland at 360 px/s and, once per object, destroys worms, crates, drums, projectiles and flames lying below the wave height at their distance from the shore (`H0` at the shore, 0 at `D` px inland). Clients animate the wave from the `tsunami` event alone (`FX.waves`, `render.js`). |
| **Earthquake** (`earthquake`) | instant weapon; sets `G.quake = 5`. `step.js` calls `quakeTick()` every 0.14 s: `cv` events carve small cracks, grounded worms are bounced. The `quake` event shakes every client's screen (`FX.quake`). `quietBlocker()` waits for `G.quake`. |

Rules they follow: the host does the physics; guests only get positions (projectiles), terrain events
(`cv`) and visual events (`bolt`, `quake`). Anything that hurts uses `hurt(w, n, {noEnd: true})`
so damage in the middle of an action does not end the active worm's turn twice.

### Worked example: Pumpkin Bomb

A bouncing, fused bomb that sets the ground on fire. Paste into the console to try it, or add the
code to the end of `projectiles.js` (the projectile) and `weapons.js` (the weapon):

```js
// 1) the projectile: gr() gives the usual grenade physics (bounce 0.5, fuse 3 s, beep)
registerProj('pumpkin', gr({
  fuse: 4, bounce: 0.6, spr: 'grenade',
  expl: { r: 38, d: 45, push: 260, fire: 6 },   // crater radius, damage, knockback, flames
}));

// 2) the weapon
registerWeapon({
  id: 'pumpkin', name: 'Pumpkin Bomb', code: 'PK',
  ammo: 2, delay: 2,                 // 2 per team, from round 2 (Standard arsenal)
  charge: true, fuse: true,          // hold Space, keys 1-5 set the fuse
  fire: throwP('pumpkin', 60, 640),  // throw speed 60..640 px/s by charge
});

// 3) optional polish
I18N.it['Pumpkin Bomb'] = 'Bomba zucca';   // js/lang-it.js (key = English name)
HELD_ITEMS.pumpkin = '#ff8a1f';            // worm-art.js: what the worm holds
CRATE_WEAP.push('pumpkin');                // crates.js: can drop in weapon crates
// icons.js: ICON_DRAW.pumpkin = g => { ... }   (optional, otherwise a "PK" badge is shown)
```

Checklist for a *permanent* weapon:

1. `registerProj` (if it flies) in `projectiles.js`; sprite in `sprites.js` (`spr` name) or reuse one.
2. `registerWeapon` in `weapons.js`.
3. Icon in `icons.js` -> `ICON_DRAW[id]` (64x64 canvas drawing; helpers `icCircle`, `icPoly` ...).
4. Held item in `worm-art.js` -> `HELD_ITEMS` (string = colour of a held ball, or `tube`, `gun`,
   `pistol`, `stick`).
5. Translation in `lang-it.js` (the weapon name; the smoke test fails on untranslated menu text).
6. `CRATE_WEAP` / `CRATE_UTIL` in `crates.js` if crates may contain it.
7. Bots only use what `AI_SHOTS` / `aiPlan` in `ai.js` know about; add an entry to teach them.
8. Add the id to `tests/smoke.py` if you track the weapon count (currently 41).

Online play needs nothing extra for ordinary weapons: the host simulates, guests only receive
projectile positions (`id`, type, `x`, `y`, angle, fuse, ...). If a projectile needs more visible
state on guests, add it to `snapshot()` / `applySnapshot()` in `net.js` (see section 11).

---

## 4. Adding a projectile type

`registerProj(id, d)` (`core.js` documents the fields, `projectiles.js` has ~20 examples):

| Field | Meaning |
| --- | --- |
| `r` | collision radius |
| `grav`, `wind` | gravity / wind factors (1 = normal, 0 = none) |
| `bounce`, `fric` | restitution and tangential damping on contact |
| `fuse`, `beep` | seconds until `detonate`, beep every second |
| `hit` | explode on first terrain contact (rockets) |
| `expl` | `{r, d, push, k, fire}`: explosion radius, damage, knockback, effect style, flame count |
| `boom(p)` | custom explosion code instead of `expl` (cluster bombs spawn children here) |
| `tick(p, dt)` | custom per-tick logic; return `false` to skip default physics (sheep, donkey, homing) |
| `spr`, `trail` | sprite name for `sprites.js`, particle trail type |
| `passive`, `mine`, `ctl` | `passive`: does not delay the turn change; `mine`: arms/triggers; `ctl`: steerable by the owner |
| `fixedAngle` | do not rotate the sprite to the velocity |

Rules of thumb: move bodies with `stepBody(p, dt)` (sub-stepped circle collision, bounces,
slides, never tunnels), explode with `detonate(p)` / `explode(x, y, r, dmg, push, opts)`, spawn
with `spawnProj(type, x, y, vx, vy, ownerWorm, extra)`. Anything random on the host is fine
(guests never simulate).

Example of a `tick` projectile: a seeker that falls straight then rolls towards the nearest foe:

```js
registerProj('roller', {
  r: 4, spr: 'grenade', bounce: 0, fric: 0.9, fuse: 8,
  expl: { r: 34, d: 40, push: 220 },
  tick(p, dt) {
    if (p.grounded) {
      const foe = G.worms.filter(w => !w.dead && w.team !== p.team)
        .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
      if (foe) p.vx = Math.sign(foe.x - p.x) * 60;
    }
    return true;               // true/undefined = continue with gravity and collision
  },
});
```

---

## 5. Tool-like weapons

Rope, jet pack, blowtorch, drill, kamikaze and the parachute do not spawn a projectile: they
put state on the worm and `controlWorm()` / `physWorm()` in `worms.js` act on it.

* `w.rope = {ax, ay, len}` (pendulum, `ropePhys`), `w.jet = {fuel, on}`, `w.tool = {k, t}`
  (`k`: `torch`, `drill`, `kami`), `w.chute`.
* Their weapons return `'keep'` from `fire()` and set `noEnd: true` (and `anyPhase: true` for rope /
  jet pack, which may also be used while retreating).
* **Letting go.** Fire again (or pick the same weapon in the menu again) detaches the rope and
  switches the jet pack off (`handleFire`, `selectWeapon` in `weapons.js`); Enter / Backspace
  (Jump / Back on touch) also release the rope. Aiming and weapon changes work again afterwards.
  `toSettle()` always drops rope, jet pack and tool at the end of the turn.
* **Firing another weapon while attached.** With the rope or jet pack active and a different weapon
  selected (`holdingOther(w)`), Jump fires that weapon (charging weapons at 65 % power, since the
  charge cannot be held), Space lets go of the rope / jet pack, and a small icon box is drawn next to
  the worm (`drawHeldWeaponBox`, `worm-art.js`). A shot that ends the turn also drops rope and jet pack.
* **Falling out of the world.** `sinkWorm()` (`worms.js`) handles both the water and the map's left/right
  edges: splash, log line, "died" banner, and the turn ends.
* When you add a new held state, add it to: `toSettle` (drop it), `processDeaths` and
  `explode` (knock it off), the snapshot in `net.js`, and `drawAim` / `drawWorm` if it changes how the
  worm looks.

---

## 6. Levels

### 6.1 Levels folder (PNG levels)

Put pictures in **`levels/`** (PNG with transparent sky, or a Worms Armageddon style PNG/BMP map
whose first palette colour is the sky; GIF/WebP/JPEG also work). Optionally describe them in
`levels/manifest.json`:

```json
{ "levels": [ { "name": "Floating isles", "file": "floating-isles.png" }, "other.png" ] }
```

* `node build/build.js` copies the folder (manifest order, then remaining files alphabetically) into
  `dist/maps/` and writes a complete `manifest.json` there (`--single` embeds the pictures instead).
* When the page is served over http(s), `levels/manifest.json` (or the server's directory index) is
  read at start-up as well, so you can add levels to a running server without rebuilding.
* The menu's **Level library** drop-down lists them; picking one imports it like "Load map
  image" (`loadMapImage`, `custommap.js`): binary alpha, sensible size (800..3600 px wide),
  water strip added below. The **host** sends the chosen level to guests inside the game config
  (`cfg.mapData`), so guests need no files at all.
* Rules for good levels: at least ~200 solid pixels, not completely solid, sky transparent. Worms
  are placed on the surface *and* inside caves/overhangs of the picture.
* Native Worms Armageddon `.img` files are not supported; convert to PNG first.

### 6.2 Generated level styles

`terrain.js` -> `generateTerrain(cfg)`; styles are `else if (style === '...')` branches that fill
`mask` (1 = ground) using the seeded `fbm`, `fillCols(topFn)`, `carveC` and `tunnels` helpers. The
result must depend only on `cfg` (seed, style, theme, size) so guests regenerate the identical
level. To add a style: add the branch, add the id to `STYLES` in `menu.js`, add an `<option>` to
`#oStyle` in `index.html`, translate its label in `lang-it.js`, and add it to the style list in
`tests/smoke.py`. `cleanTerrain` removes slivers and unreachable crumbs afterwards.

### 6.3 Themes

`themes.js` -> `THEMES[name] = {sky:[top,bottom], top:[r,g,b], dirt, deep, water:[surface,deep], sun, cloud}`.
Add an `<option>` to `#oTheme` in `index.html` and a translation. PNG levels keep their own
colours; the theme still colours sky, sun, clouds and water.

---

## 7. Menu options and match settings

Match settings live in `cfg`, built by `readCfg()` in `menu.js`, consumed by `newGame(cfg, teams)`
and sent verbatim to online guests. To add one (say `oFoo`):

1. Add the control to `index.html` (mark dynamic text `data-nt`; static text gets translated by the DOM
   walker, so add a dictionary entry).
2. Read it in `readCfg()` (`foo: +$('oFoo').value`).
3. Use `G.cfg.foo` in the simulation (`match.js`, `step.js`, ...).
4. Translate the label in `lang-it.js`.

Per-player (client-side) options that are *not* match rules, like **Auto-centre the camera**, are
kept in `UI` and `localStorage` (`wormgeddon.autocenter`); see the end of `menu.js`.

Other tunables: physics constants (`GRAV`, `WIND_ACC`, `FALLV`, `WORM_R`) in `core.js`;
explosion data in `projectiles.js` / `weapons.js`; camera behaviour in `view.js` (`camFocus`);
turn timing in `match.js` / `step.js`; sea level rise and sudden death in `match.js`.

---

## 8. Languages

Gettext style: the English text *is* the key. `tr('{0} died', name)` returns the translation or the
English text. `wname(id)` translates weapon names.

1. Create `js/lang-xx.js` with `I18N.xx = { 'English text': 'translation', ... }` (copy `lang-it.js`).
2. Register it in `LANGS` (`i18n.js`): `{ en: 'English', it: 'Italiano', xx: 'Name' }`.
3. Add the script after `i18n.js` in `index.html`.

Static HTML text is translated by `translateDom()`; text built by code must go through `tr()`;
elements whose content is generated and already translated get `data-nt`. the smoke test fails
if a page text has no Italian translation, so keep dictionaries complete when you add text.
Online players each use their own language because events carry keys, not sentences.

---

## 9. Crates, sounds, icons, sprites, worm art

* **Crates** (`crates.js`): `CRATE_UTIL` (utilities) and `CRATE_WEAP` (weapons) are the pools a crate
  picks from; health crates are separate. `spawnCrate`, `updateObjs`, `collectCrate` hold the logic
  (progress watchdog, parachute handling).
* **Sounds** (`audio.js`): add an entry to `SFX` (`name: r => tone(...)` or `noiseBurst(...)` or `mp3Sfx(...)`), then
  `emit({e: 'snd', s: 'name', r: radius})` from the simulation.
* **Icons** (`icons.js`): `ICON_DRAW[weaponId] = g => {...}` on a 64x64 canvas with helpers
  (`icRect`, `icCircle`, `icEllipse`, `icPoly`, `icLine`, `icFlame`, `icGrenade`, `icWormHead`, palette `IC`).
  Missing icons fall back to a badge with the weapon `code`.
* **Projectile sprites** (`sprites.js`): `spriteProj(p)` switches on the type's `spr` name; draw in world
  coordinates with `ctx2` (already translated to the projectile).
* **Worm art** (`worm-art.js`): `HELD_ITEMS`, hats per team (`TEAM_HATS`), `drawWorm`, `drawAim`.
* **Effects** (`fx.js`): `puff(...)` particles, floating text, rings; add a case for a new event type and
  `emit` it from the simulation.

---

## 10. Bots

`ai.js`: `aiPlan` picks target and weapon (punch, shotgun, air strike, then brute-force
`simShot` over angle/power for the weapons listed in `AI_SHOTS`), `aiTick` presses keys through a normal
input record. Add an entry to `AI_SHOTS` with the same physics numbers as the projectile
(`type`, `lo`, `hi`, gravity factor `g`, `wind`, optional `fuse`) to make a new thrown weapon
usable by bots.

---

## 11. Online play and the network protocol

Host-authoritative over PeerJS (peer ids `wormgeddon-XXXXX`). The host simulates everything;
guests send inputs and render what they receive.

| Direction | Type | Content |
| --- | --- | --- |
| host -> guest | `start` | game config (`cfg`, incl. `mapData` for custom levels), team list |
| host -> guest | `s` | snapshot (~30/s): phase, timer, wind, water, worms, projectiles, fires, objects, weapon |
| host -> guest | `v` | batch of events (explosions, sounds, messages) |
| host -> guest | `full` | the room is full / already started |
| guest -> host | `hello` | join request |
| guest -> host | `k` | held keys |
| guest -> host | `e` | key edge (`fireP`, `jump`, `back`, `tab`) |
| guest -> host | `c` | map click |
| guest -> host | `w` / `f` | weapon choice / fuse change |
| guest -> host | `chat` | `{x}`: chat text (the host cleans it, stamps name and team, rate-limits it) |
| host -> all | `chat` | `{n, k, x}`: sender name, team index (-1 in the lobby), text |

Adding **visible per-worm or per-projectile state**: add it to the arrays in `snapshot()` and read it
back in `applySnapshot()` (`net.js`). Anything guests only need for drawing belongs there;
simulation-only fields never need to be sent. Guests regenerate generated terrain from the seed
and receive crater/carve/girder events, so terrain stays identical. Levels from the levels folder
are sent as `cfg.mapData` by the host: put your PNG in `levels/` *before* hosting.

**Chat** (`chat.js`): lobby boxes in the Host/Join tabs and an in-game overlay (`T` or the Chat
button; Esc closes). Only online games have it. Guests never choose their own name or team: the host
re-stamps every line, cleans it (control characters, 140 chars) and rebroadcasts it, so all clients
show the same order. Text is rendered with `textContent` only. `NET.close()` calls `chatReset()`.

Online play needs a normal web page (WebRTC through PeerJS' cloud broker); it does not work inside
sandboxed iframes such as the artifact preview.

---

## 12. Debugging and tests

* **Debug view:** `F3` or `` ` `` toggles it: collision circles, probe points, bounding boxes, velocity
  vectors, ground contact, the terrain mask around the active worm (zoom in), the world border and
  water line, plus a text panel with phase, timers and *what is blocking the turn change*.
* **Trajectories:** with the debug view on, `F4` toggles full trajectories: the real path of every
  projectile and of the active worm (kept 8 s after they vanish) and a yellow dashed *prediction*
  of the selected weapon at the current aim/charge, ending in a red circle at the blast radius.
  Weapons built with `throwP()` are predicted automatically (`fire.launch`); for others set
  `fn.launch = {type, lo, hi}` on the `fire` function.
* **Console:** `window.__wh` gives `newGame(cfg, teams)`, `G`, `stepOnce(dt)`; handy for scripted
  scenarios (see `tests/`).
* **Tests** (`tests/`, setup and the list of tests in `tests/README.md`): `smoke.py` generates every
  level style, plays full bot matches, checks translations and counts weapons; `test_weapons.py`
  fires every weapon; `test_bots.py` checks bots never idle; `test_movement.py` covers map-edge
  death and rope/jet pack; `test_chat.py` covers the chat. Run `python3 tests/run_all.py` after every
  change and add a test for new features.
* **Stress ideas:** run many seeds with 8 bot teams and assert that `G.settleT` never exceeds a few
  seconds and that no worm/crate stays un-grounded (`quietBlocker()` tells you why a settle drags on).

---

## 13. Conventions and gotchas

* `'use strict'` classic scripts; add a header comment (`@file`, `Depends on`, `Globals defined`) to new
  files and keep it up to date.
* Keep the simulation deterministic *per host*: only the host calls `Math.random()` for gameplay.
* Never draw from simulation code; `emit()` an event and handle it in `fx.js`.
* Use `stepBody` for anything that moves through terrain, `findFree` to place things, and
  `groundBelow` / `supported(w)` to ask whether something stands.
* Translate every user-visible string (`tr`, dictionary entries, `data-nt` for generated nodes).
* After changing code run `node build/build.js`; the artifact / standalone file is only updated by the build.
