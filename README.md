# Wormgeddon

A turn-based artillery game for the browser, in the spirit of Worms Armageddon. Plain HTML5 canvas,
no framework, no assets: levels, sound, icons and worms are all generated or drawn in code.
Online multiplayer uses [PeerJS](https://peerjs.com) (WebRTC).

## Features

- **2-8 teams**, each human or bot, up to 40 worms in total. Humans share the keyboard in turns.
- **Random level generator** with 7 styles (rolling hills, floating islands, caverns, terraces, mountains, archipelago,
  canyon), 5 themes (meadow, desert, arctic, inferno, neon), 3 sizes and a text seed (same seed =
  same level, also online).
- **Custom maps**: load your own picture as the battlefield (menu, Battlefield, "Load map
  image", or drop a file on the window). PNG with an alpha channel (transparent = sky) or an
  opaque Worms Armageddon style indexed PNG/BMP (first palette colour = sky; any other opaque
  image uses its top-left colour as sky). The picture keeps its own colours and is fully
  destructible. In online games the host sends the map to the guests.
- **Destructible terrain**, wind, fall damage, drowning, rising water (sudden death), mines, oil
  drums and supply crates.
- **36 weapons and tools**, each with a hand-drawn icon: Bazooka, Homing Missile, Mortar, Grenade,
  Cluster Bomb, Banana Bomb, Holy Hand Grenade, Petrol Bomb, Dynamite, Mine, Sheep, Super Sheep,
  Shotgun, Handgun, Uzi, Fire Punch, Dragon Ball, Baseball Bat, Kamikaze, Air Strike, Napalm
  Strike, Mine Strike, Concrete Donkey, Armageddon, Nuclear Test, Scales of Justice, Ninja Rope,
  Jet Pack, Teleport, Girder, Blowtorch, Pneumatic Drill, Parachute, Select Worm, Skip Go,
  Surrender.
- **Stylised worms**: segmented bodies, eyes that follow the aim, expressive faces and one
  accessory per team (headband, cap, helmet, top hat, mohawk, viking helmet, antennae, crown).
- **English and Italian**: the language follows the browser by default and can be changed in the
  menu (top right). Team names, weapon names, HUD, messages and help are all translated.
- **Bots** that simulate shots to pick weapon, angle and power.
- **Online play**: the host runs the game, friends join with a short room code.
- Touch controls for phones and tablets.

## Quick start

Open `dist/wormgeddon.html` in a browser. That single file contains everything.

To work on the source, open `index.html` instead (it loads `css/style.css` and `js/*.js`
directly, no build step needed), then run `node build.js` to regenerate the single-file builds.

Online play needs the page to be opened from a normal web address or file (not inside an
embedded viewer that blocks WebRTC). The PeerJS library and fonts load from a CDN; the game also
runs offline without them (only online play and the display font are lost).

## Controls

| Input                  | Action                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| Left / Right           | walk, swing the rope, steer a super sheep                                                        |
| Up / Down              | aim (rope: reel in / out; jet pack: thrust)                                                      |
| Enter / Backspace      | jump / back-flip (Enter also lets go of the rope)                                                |
| Space                  | hold to charge, release to fire; fires instant weapons; detonates sheep                          |
| W                      | weapon panel (click a weapon to arm it)                                                          |
| 1-5                    | grenade fuse in seconds                                                                          |
| Mouse click / tap      | target for strikes, teleport, girder, homing missile                                             |
| Mouse wheel / pinch    | zoom towards the cursor / fingers (wheel rotates the girder when it is armed; hold Ctrl to zoom) |
| R                      | rotate the girder                                                                                |
| Right-click            | open or close the weapon menu                                                                    |
| Drag / two-finger drag | pan the camera (C re-centres)                                                                    |
| Tab                    | switch worm (Select Worm)                                                                        |
| Esc / M                | pause (offline) / mute                                                                           |

## Rules in short

- A turn lasts 20-90 s. Firing starts a 3 s retreat during which you can still move.
- Taking damage in your own turn ends it. Deaths and damage numbers are resolved when the
  battlefield has come to rest.
- Standard arsenal: strong weapons unlock in later rounds; crates unlock them early.
- Sea level rise (optional): the water climbs a little every 1, 2, 3 or 5 rounds.
- Sudden death: every worm drops to 1 HP and the water rises each round.
- Last team standing wins.

## Project layout

```
index.html          page markup + <script> tags in dependency order (development entry point)
css/style.css       all styles
js/*.js             one file per module, classic scripts sharing the global scope
build.js            bundles everything into dist/ (node build.js)
dist/               generated single-file builds (standalone page + fragment)
tests/smoke.py      headless-browser smoke test (Playwright)
```

| Module           | Responsibility                                                       |
| ---------------- | -------------------------------------------------------------------- |
| `util.js`        | helpers, seeded PRNG, hashes                                         |
| `i18n.js`        | localisation engine: `tr()`, `wname()`, `setLang()`, DOM translation |
| `lang-it.js`     | Italian dictionary                                                   |
| `audio.js`       | Web-Audio synthesised sound effects                                  |
| `themes.js`      | colour themes                                                        |
| `terrain.js`     | level generation, painting, craters, girders                         |
| `collision.js`   | circle/terrain collision, surface normals, body integrator           |
| `core.js`        | constants, weapon/projectile registries, match state `G`, event bus  |
| `match.js`       | match creation, ammo, turn state machine                             |
| `combat.js`      | damage and explosions                                                |
| `projectiles.js` | projectile engine and all projectile types                           |
| `worms.js`       | worm walking/jumping/falling, rope, jet pack, tools                  |
| `crates.js`      | supply crates and oil drums                                          |
| `weapons.js`     | weapon catalogue, selection and firing state machine                 |
| `step.js`        | one simulation tick                                                  |
| `view.js`        | canvas, camera, UI state, input record                               |
| `fx.js`          | particles and event-to-visual/sound handling                         |
| `sprites.js`     | projectile and object drawings                                       |
| `worm-art.js`    | worm, grave, label and aim reticle drawings                          |
| `render.js`      | per-frame renderer (sky, water, world)                               |
| `custommap.js`   | imports a picture (PNG/BMP/GIF/WebP/JPEG) as a level                 |
| `icons.js`       | weapon icons                                                         |
| `hud.js`         | DOM HUD and weapon panel                                             |
| `input.js`       | keyboard, pointer and touch input                                    |
| `ai.js`          | bot                                                                  |
| `net.js`         | PeerJS host/guest networking                                         |
| `menu.js`        | setup form, demo backdrop, pause                                     |
| `main.js`        | fixed-timestep loop and boot                                         |

Every file starts with a header listing its purpose, dependencies and the globals it defines.
Because all modules are plain scripts, **load order matters**: a file may only use, at load
time, what earlier files defined. Functions can call forward at run time.

## How it works

**Simulation.** The authority (offline game or online host) runs a fixed 1/60 s tick
(`step.js`). State lives in one object `G`: teams, worms, projectiles, fires, objects, phase,
timer, wind, water level. Turn phases: `turn` (aim and shoot) -> `retreat` (3 s to flee) ->
`settle` (wait until everything is calm, then show damage, resolve deaths) -> next turn, or
`over`.

**Terrain.** `T.mask` is a byte per pixel (1 = solid) and is the only thing physics asks. The
visible terrain is a canvas painted from the mask; craters are carved from both at once.

**Events.** The simulation reports what happened through `emit({e: ...})`. Terrain edits apply
immediately. Everything else (particles, sounds, messages) is handled by `applyEvent()` in
`fx.js`, on the host and on guests alike. Events flagged `q: 1` are cosmetic and stay local.

**Input.** Each team has an input record (`makeInp()`): held flags (`l r u d fire`), one-shot
edges (`fireP jump back tab`) and a queue of map clicks. Keyboard, touch, bots and network guests
all produce the same record, so the simulation does not care who is playing.

## Online protocol

Transport: PeerJS data connections with JSON messages. Room ids look like `wormgeddon-ABCDE`; the
visible code is the last five characters.

| Dir           | `t`     | Content                                                                                                                                    |
| ------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| guest -> host | `hello` | `name`                                                                                                                                     |
| host -> guest | `start` | `cfg` (includes the seed, and `mapData`, a PNG data URL, for custom maps), `teams`, `worms`, `my` (your team index)                        |
| host -> guest | `s`     | snapshot at about 30 Hz: phase, active worm, timer, wind, water, worms, projectiles, fires, objects, weapon state; ammo every 5th snapshot |
| host -> guest | `v`     | list of simulation events (explosions, damage numbers, messages ...)                                                                       |
| host -> guest | `full`  | room full or already started                                                                                                               |
| guest -> host | `k`     | held keys `l r u d f`                                                                                                                      |
| guest -> host | `e`     | one-shot key `k` (`fireP`, `jump`, `back`, `tab`)                                                                                          |
| guest -> host | `c`     | map click `x y` plus girder angle `a`                                                                                                      |
| guest -> host | `w`     | weapon choice `id`, optional fuse `f`                                                                                                      |
| guest -> host | `f`     | fuse `v` (1-5)                                                                                                                             |

The host validates everything: guest input only counts for the guest's own team during its own
turn. Guests never simulate; they regenerate the terrain from the seed, apply terrain events and
interpolate snapshots. If a guest disconnects, a bot takes over their team.

## Extending the game

**Add a weapon.** In `js/weapons.js`, call `registerWeapon({...})` (fields are documented in
`core.js`). Projectile weapons usually reuse `throwP('type', minSpeed, maxSpeed)`. Add a drawing
to `ICON_DRAW` in `js/icons.js` and, if it needs a new projectile, a `registerProj()` record in
`js/projectiles.js`. Menu order = registration order.

**Add a projectile type.** `registerProj('name', {...})` in `js/projectiles.js`: physics factors,
`fuse`, `hit` (explode on contact), `expl: {r, d}` or a custom `boom(p)`, and an optional
`tick(p, dt)` for special behaviour (the Concrete Donkey is a good example). Give it a sprite in
`spriteProj()` (`js/sprites.js`).

**Add a theme.** Add an entry to `THEMES` in `js/themes.js` and an `<option>` to `#oTheme` in
`index.html`.

**Add a level style.** Add a branch to `generateTerrain()` in `js/terrain.js` that fills
`mask` (helpers: `fillCols`, `carveC`, `tunnels`, `blob`, `rocks`, `bumps`; a clean-up pass removes specks and tiny bubbles afterwards), then add the option to `#oStyle` and the name to `STYLES` in `js/menu.js`.

**Add a team accessory.** Add a case to `drawHat()` in `js/worm-art.js` and its name to
`TEAM_HATS` (and a colour to `TEAM_COLORS` / `MAX_TEAMS` in `core.js` to go beyond 8 teams).

## Translating

Text keys are the English sentences themselves. In code write `tr('Waiting for {0}', name)`; static
text in `index.html` needs no markup, the page is translated by walking its text nodes. To add a
language: copy `js/lang-it.js` to `js/lang-xx.js` and translate the values, add the code to `LANGS`
in `js/i18n.js`, and add the script tag after `lang-it.js` in `index.html`. Anything missing falls
back to English, and `tests/smoke.py` fails if a static page text has no Italian entry. Strings
sent over the network are English keys plus arguments, so every player sees their own language.

## Build and test

```
node build.js            # writes dist/wormgeddon.html and dist/wormgeddon.fragment.html
npx prettier --write .   # formatting (config in .prettierrc)
python3 tests/smoke.py   # needs Python Playwright and a Chromium
```

`tests/smoke.py` plays bot-only matches with 2 and 8 teams for five simulated minutes, checks that
all 36 weapons are registered and that the Concrete Donkey keeps hopping and exploding, and fails
on any page error.

## Custom map notes

- Native Worms Armageddon `.img` files are not supported (proprietary compressed format); convert
  them to PNG first. Monochrome `.bit`/`.lev` maps are not supported either.
- The "first palette colour = sky" rule for indexed PNG/BMP files is an assumption based on how
  those maps are normally drawn; if a map comes out inverted, make the sky transparent instead.
- Pictures narrower than 800 px are enlarged (2-4x, crisp), pictures larger than 3600 x 1600 px
  are reduced. A strip of open space is added below the picture for the water.

## Known limitations

- Online play is host-authoritative with no lag compensation, no reconnection and no spectators.
- Weapon balance and bot skill are first-pass and meant to be tuned in the data records.
- Floating-point results are only ever computed on the host, so there is no desync, but a slow
  host slows everyone down.
