# Customising Wormgeddon

Part of the [developer guide](DEVELOPING.md). A task-oriented cookbook: "I want to change X, where do I go?". Each recipe
names the files and links to the guide that explains the mechanism. Everything is plain JavaScript loaded by
`<script>` tags in `index.html`; reload the page to see a change (no build step in development).

| Guide | Covers |
| --- | --- |
| [DEVELOPING.md](DEVELOPING.md) | project layout, game loop, levels, menu options, languages, network, tests, conventions |
| [WEAPONS.md](WEAPONS.md) | the weapon record, categories and panel tabs, every weapon, checklist |
| [PROJECTILES.md](PROJECTILES.md) | projectile types, `tick`, drawing and syncing |
| [PHYSICS.md](PHYSICS.md) | constants, worm movement, fall damage, time-based effects |
| [COLLISION.md](COLLISION.md) | terrain mask, `stepBody`, explosions, hit boxes, rays |

---

## 1. Tuning numbers (no new code)

| I want | Where |
| --- | --- |
| gravity, wind strength, fall damage threshold | `GRAV`, `WIND_ACC`, `FALLV` in `core.js` ([PHYSICS.md](PHYSICS.md)) |
| a bigger / smaller worm | `WORM_R` in `core.js` (also changes terrain collision) |
| radiation of the Nuclear Test | `RAD_TIME`, `RAD_DMG`, `RAD_EVERY` in `core.js` |
| how long Thor's Hammer charges | `HAMMER_CHARGE` in `projectiles.js` |
| how long the time car drives | `CAR_MAX_AGE` in `projectiles.js` |
| damage / radius of one weapon | its `explode(...)` / `expl: {r, d, push}` / `melee({...})` / `ray(...)` call |
| starting ammo and unlock round | `ammo` and `delay` in the weapon record |
| which weapons crates drop | `CRATE_WEAP` / `CRATE_UTIL` in `crates.js` |
| walking speed, jump height | `52`, `-285`, `-400` in `controlWorm` (`worms.js`) |
| turn length, retreat time | `turnTime` option (menu) and `G.timer = 3` after firing (`weapons.js`, `doFire`) |
| how fast bots decide / how good they are | `ai.js` |
| camera follow behaviour | `camFocus` in `view.js` (priority: projectile, impact, flying worm, active worm) |
| health bars | `hudTeams` in `hud.js` (sorted by total health, rows slide when teams swap) |

Match rules (health, worms per team, mines, crates, sea rise, sky, ...) are menu options, see section 7 of the
developer guide.

## 2. Adding things

| I want to add | Steps |
| --- | --- |
| **a weapon** | [WEAPONS.md, section 5](WEAPONS.md#5-adding-a-weapon-checklist): record, category, icon, sprite, sounds, Italian, crate, test |
| **a projectile** | [PROJECTILES.md](PROJECTILES.md): `registerProj`, sprite in `spriteProj` |
| **a weapon category / tab** | add to `WEAPON_CATS` and `WEAPON_CAT` (`core.js`), a `<button data-cat>` in `#wtabs` (`index.html`), the label in `lang-it.js` |
| **a level style / theme / sky** | developer guide sections 6.2, 6.3, 6.4 |
| **a PNG level** | drop it in the levels folder (developer guide 6.1) |
| **a menu option** | developer guide section 7 |
| **a language** | developer guide section 8: a `js/lang-xx.js` (`I18N.xx = {...}`), registered in `LANGS` (`i18n.js`) and added to `index.html` |
| **a sound** | `SFX` entry in `audio.js`, or an MP3 in `sounds/` listed in `MP3_FILES` |
| **an icon** | `ICON_DRAW[id]` in `icons.js` (64 x 64 canvas helpers) |
| **a visual effect** | a `case` in `applyEvent` (`fx.js`), then `emit({e: 'name', ...})` from the simulation; draw persistent ones from `FX.*` in `render.js` |
| **a tutorial / tip text** | the weapon hint in `weaponHint` / `activeHint` (`hud.js`), translated |

## 3. Recipes

### A weapon that is a variation of an existing one

Copy the record, change `id`, `name`, `code` and the numbers, add the id to `WEAPON_CAT`, give it an icon and the Italian
name. Example: a stronger bazooka:

```js
registerWeapon({
  id: 'bazooka2', name: 'Big Bazooka', code: 'B2', ammo: 1, delay: 3, charge: true,
  fire: throwP('rocket2', 200, 760),
});
registerProj('rocket2', { r: 4, grav: 0.3, wind: 1, hit: true, spr: 'rocket', trail: 'smoke', expl: { r: 56, d: 80 } });
```

### Make a weapon hurt (or not hurt) its user

`explode(..., {src: w.id})` hurts everyone in reach, the shooter too. `melee`, `ray` and `toolHurt` skip the attacker.
For a custom effect loop over `G.worms` and skip `c.w`.

### Change what a crate can contain

Edit the pools in `crates.js`. Remember that a weapon only works from a crate if its `ammo` is not `-1` (unlimited
weapons would give nothing) and that health crates are separate.

### Make a weapon available from round 1

`delay: 0`. In the Full arsenal every weapon is available from the first turn regardless.

### Make something non-lethal

Use the radiation pattern: apply `w.hp -= Math.min(amount, w.hp - 1)` yourself, or `hurt()` with a clamped amount.
`hurt()` can kill; a worm dies when `hp <= 0` at the next `processDeaths`.

### Show damage immediately instead of at the end of the turn

`hurt()` adds to `w.pend` and the number floats up when the turn settles. For a continuous effect, lower `w.hp`
directly and `emit({e: 'dmg', x, y, v, c})` yourself (what radiation does), so the health bar drops at once.

### Debugging

* `F3` (or backtick) toggles the debug view (collision circles, trajectories, why the turn is not ending).
* `window.__wh` exposes `G`, `newGame`, `stepOnce`, `spawnProj`, `WEAPONS`, `PTYPES`, `tr`, `setLang`, so you can script
  situations from the console: `__wh.newGame(cfg, teams); __wh.stepOnce(1/60)`.
* Tests build exact situations the same way; see [DEVELOPING.md section 12](DEVELOPING.md#12-debugging-and-tests) and
  `tests/README.md`. `ARENA_JS` in `tests/common.py` gives a flat floor to line things up.

### Build and deploy

`node build/build.js` writes a minified, hashed, pre-compressed copy to `dist/`; `--single` writes one self-contained
HTML file with levels and sounds embedded. Adding a script to `index.html` is enough: the build reads the list from there.

## 4. Conventions worth keeping

* Simulation code never draws and never reads the DOM; it `emit`s events. Drawing code never changes `G`.
* Everything random during play is host-only; level generation uses the seeded RNG.
* Every English text shown to the player goes through `tr()` / `wname()` and has an Italian entry (`tests/smoke.py` lists
  the missing ones).
* New behaviour gets a test in `tests/` (they run in Chromium through Playwright, `python3 tests/run_all.py`).
* Keep global names unique: all files share one global scope, and the build concatenates them.
