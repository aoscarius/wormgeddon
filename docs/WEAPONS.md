# Weapons

Part of the [developer guide](DEVELOPING.md). Sources: `js/core.js` (`registerWeapon`, categories), `js/weapons.js`
(all weapons and the fire state machine), `js/icons.js` (icons), `js/hud.js` + `js/input.js` (weapon panel),
`js/lang-it.js` (names). Projectiles launched by weapons are described in [PROJECTILES.md](PROJECTILES.md).

---

## 1. What a weapon is

A weapon is **one record** passed to `registerWeapon({...})` in `js/weapons.js`. Menu order = registration order.
Nothing else is required for it to work: the arsenal, the weapon panel, crates, bots and the debug view read the
registry (`WEAPONS[id]`, `WLIST`).

| Field | Meaning |
| --- | --- |
| `id`, `name`, `code` | identity; `name` is the English text (translated by `wname`); `code` = 2-letter badge when there is no icon |
| `cat` | category tab (see section 3); default comes from `WEAPON_CAT[id]` in `core.js`, else `special` |
| `ammo` | starting ammo, `-1` = unlimited |
| `delay` | first round in which it is available in the *Standard* arsenal (`R3` badge in the panel) |
| `charge` | hold Space to charge power (1.8 s to full), fires on release |
| `fuse` | honours the 1-5 fuse keys (`G.weapon.fuse`) |
| `click`, `instant` | `click`: needs a map click (`ctx.target = {x, y}`); `instant`: acts at once, no aiming |
| `noEnd`, `anyPhase` | `noEnd`: using it does not end the turn; `anyPhase`: also usable in the 3 s retreat |
| `shots` | presses before the turn ends (shotgun 2) |
| `needTarget` | needs a target marker first (homing missile: click, then fire) |
| `noFire` | listed but cannot be "fired" (select worm, skip, surrender, parachute) |
| `fire(ctx)` | the attack; `ctx = {w, team, power, wdef, target}`. Return `'miss'` to cancel without spending ammo, `'keep'` for tool-like weapons that stay active |
| `onSelect(w, team)` | optional hook when it is picked |

### How a shot flows (`handleFire`, `clickTarget`, `doFire` in `weapons.js`)

1. Input arrives in the team's input record (`fireP` on press, `fire` while held, `clicks[]` for map clicks).
2. **Charging weapons**: press starts a charge (`G.weapon.ch`, `pw` 0..1); release (or full power) calls
   `doFire(w, team, def, power)`. **Plain weapons**: a press calls `doFire` with power 1. **Click weapons**: a click calls
   `clickTarget`, which calls `doFire` with `target`.
3. `doFire` calls your `fire(ctx)`. Unless it returns `'miss'`: ammo is spent, `G.fired` is set (unless `noEnd`), and
   the phase goes `turn -> retreat` (3 s).
4. When the turn settles, damage collected in `w.pend` is announced as floating `-N` numbers (`flushDamage`).

On the rope / jet pack with another weapon selected, **Jump fires** the weapon and **Space lets go** (`holdingOther`).

## 2. Helpers for `fire()`

| Helper | Use |
| --- | --- |
| `muzzle(w)` | `[x, y, dirX, dirY]`: point just in front of the hands along the aim |
| `throwP(type, lo, hi, extra)` | a ready `fire` that launches projectile `type`, speed `lo..hi` by charge, fuse from the keys |
| `spawnProj(type, x, y, vx, vy, owner, extra)` | launch anything yourself |
| `ray(w, ang, len, dmg, push, cr)` | hitscan bullet |
| `melee(w, {reach, dmg, push, fixed, cr, k, self})` | close-range attack |
| `strike(c, n, type, spread, vx, extra)` | air strikes: a plane and `n` projectiles |
| `explode(x, y, r, dmg, push, opts)` | area damage ([COLLISION.md](COLLISION.md)) |
| `sched(seconds, fn)` | do something later (delayed bolts, waves) |
| `surfaceAt(x, from)` | y of the first ground below `from` (sky weapons use it to find the target height) |
| `lightningRay`, `lightningBolt` | bolts that stop at the first obstacle |
| `emit({e: ...})` | visual / audio events ([DEVELOPING.md](DEVELOPING.md) section 2) |

## 3. Categories and the weapon panel tabs

Every weapon belongs to **one** category. The weapon panel has an **All** tab plus one tab per category; the choice is
remembered in `localStorage` (`wormgeddon.wtab`).

| Category (`cat`) | Idea | Weapons |
| --- | --- | --- |
| `body` | direct contact, the worm's own body | Fire Punch, Dragon Ball, Baseball Bat, Kamikaze, Hokuto Hyakuretsu Ken, Oni Giri |
| `short` | close to the shooter: guns, planted and walking things | Shotgun, Handgun, Uzi, Dynamite, Mine, Petrol Bomb, Sheep, Super Sheep |
| `long` | launched or dropped over a distance | Bazooka, Homing Missile, Mortar, Grenade, Cluster Bomb, Banana Bomb, Holy Hand Grenade, Air Strike, Napalm Strike, Mine Strike |
| `destructive` | changes the whole level | Concrete Donkey, Armageddon, Nuclear Test, Earthquake, Tsunami |
| `anime` | fantasy and elemental powers | Dragon Fire, Thunderstorm, Thor's Hammer, Kamehameha, Time Car, Tornado |
| `tools` | movement and digging | Ninja Rope, Jet Pack, Teleport, Girder, Blowtorch, Pneumatic Drill, Parachute |
| `special` | everything else and turn controls | Scales of Justice, Select Worm, Skip Go, Surrender |

**Keyboard only.** While the panel is open (key `W`) the keyboard drives it: arrows move a highlighted cursor (it
starts on the armed weapon; left / right step through the list, up / down jump to the next row), `Home` / `End`
go to the ends, `Tab` / `Shift+Tab` change category, a letter jumps to the next weapon whose name starts with it,
`Enter` or `Space` arm the weapon under the cursor and close the panel (an empty or locked weapon is refused), and
`W` or `Esc` close it. The game keys (arrows to walk, Space to fire, Tab to switch worm) are inactive meanwhile. Code:
`panelKey` / `panelCursor` / `panelMove` / `panelTab` in `input.js`, the `.kb` outline in `style.css`, the cursor
is kept across grid rebuilds by `hudPanel`. `tests/test_weapon_keys.py` covers it.

**Touch.** On phones and tablets swipe left / right over the weapon grid to go to the next / previous category
(it wraps around; the tab strip scrolls so the active tab stays visible). A swipe is mostly horizontal, at least 50 px
(or 18 % of the panel) and under 0.9 s; vertical drags still scroll the grid and the weapon under the finger is not
armed at the end of a swipe. Code: the swipe block above `panelKey` in `input.js`, `touch-action: pan-y` and the slide
animation on `#wgrid` in `style.css`.

Where it lives:

* `WEAPON_CATS` (tab order) and `WEAPON_CAT` (id -> category) are at the top of `core.js`; `registerWeapon` sets
  `d.cat`. A weapon without an entry lands in `special`.
* The tabs are static buttons in `index.html` (`#wtabs [data-cat]`), so they are translated like any other text
  (add the labels to `lang-it.js`). `hudPanel` (`hud.js`) filters the grid by `UI.wcat`; `setWeaponTab` (`input.js`)
  switches tab and rebuilds the grid.
* `tests/test_weapon_tabs.py` fails if a weapon is missing a category, a category is empty, or the tabs and the
  category list differ.

**Adding a new category:** add its id to `WEAPON_CATS`, list weapons for it in `WEAPON_CAT` (or set `cat` on the
weapon), add `<button type="button" role="tab" data-cat="newid">Label</button>` to `#wtabs` in `index.html`, and
translate the label.

## 4. The weapons

Damage numbers are in the code next to each weapon; `ammo` / `delay` are the *Full / Standard* arsenal values
(`-1` = unlimited). The *Special / Anime / Melee / Artillery only* arsenals pick weapons by their category (`cat`) and
ignore `delay`; see "Arsenal modes" in DEVELOPING.md section 7.

| Weapon | id | Ammo | Round | Kind |
| --- | --- | --- | --- | --- |
| Bazooka | `bazooka` | inf | 0 | charge, `rocket` projectile, wind |
| Homing Missile | `homing` | 2 | 1 | click to mark, then fire, `homing` projectile |
| Mortar | `mortar` | 4 | 1 | charge, shell with four bomblets |
| Grenade | `grenade` | inf | 0 | charge, fuse keys |
| Cluster Bomb | `cluster` | 3 | 0 | charge, splits into clusterlets |
| Banana Bomb | `banana` | 2 | 3 | charge, splits into bananalings |
| Holy Hand Grenade | `holy` | 1 | 4 | charge, huge blast, plays the choir with the blast |
| Petrol Bomb | `petrol` | 2 | 1 | charge, sprays flames |
| Dynamite | `dynamite` | 2 | 0 | dropped at the feet, 5 s fuse |
| Mine | `mine` | 3 | 0 | planted, arms after 1.2 s, passive |
| Sheep / Super Sheep | `sheep`, `supersheep` | 2 / 1 | 1 / 3 | walking / steerable projectile |
| Shotgun, Handgun, Uzi | `shotgun`, `handgun`, `uzi` | inf / 4 / 3 | 0 / 0 / 1 | hitscan `ray` |
| Fire Punch, Dragon Ball, Baseball Bat | `firepunch`, `dragonball`, `bat` | inf / 2 / 2 | 0 / 1 / 2 | `melee` |
| Kamikaze | `kamikaze` | 2 | 1 | the worm flies along the aim and explodes |
| Hokuto Hyakuretsu Ken | `hokuto` | 1 | 4 | tool (`w.tool = {k:'hyaku'}`): a barrage of punches on the worm in front, a dash past it, and the victim explodes 3 s later (`hyakuTick`, `doomBlast` in `worms.js`) |
| Oni Giri | `onigiri` | 1 | 4 | tool (`w.tool = {k:'oni'}`): three swords out, a short charge, then a dash that slices every worm it passes (`oniTick` in `worms.js`) |
| Kamehameha | `kamehameha` | 1 | 6 | tool (`w.tool = {k:'kame'}`): 1.3 s charge (aim still adjustable), then a beam across the whole map along the aim that carves a tunnel and wrecks worms, mines, drums and crates (`kameFire`, `kamebeam`) |
| Air Strike, Napalm Strike, Mine Strike | `airstrike`, `napalm`, `minestrike` | 1 | 2 / 3 / 3 | click, `strike` |
| Concrete Donkey | `donkey` | 1 | 5 | click, falls and hops digging a shaft |
| Armageddon | `armageddon` | 1 | 7 | meteor rain for about 11 s |
| Nuclear Test | `nuke` | 1 | 7 | damages every worm, raises the sea, then **radiation** (below) |
| Earthquake | `earthquake` | 1 | 6 | 5 s of shaking: cracks and bounced worms |
| Tsunami | `tsunami` | 1 | 7 | a wave from the left or right wipes out the coast |
| Thunderstorm | `thunder` | 1 | 4 | click, five bolts in and around the target |
| Dragon Fire | `dragonfire` | 1 | 5 | click, a dragon crosses the top and breathes fire |
| Tornado | `tornado` | 1 | 5 | click, a twister walks 8 s, lifts and flings worms, **mines and drums** |
| Thor's Hammer | `hammer` | 1 | 5 | click on a worm: charges in the caster's hand, then lightning to the marked worm |
| Time Car | `timecar` | 1 | 6 | a car arrives from behind and drives in the facing direction, burning what is in front |
| Scales of Justice | `scales` | 1 | 5 | equalises health |
| Ninja Rope, Jet Pack | `rope`, `jetpack` | inf / 2 | 0 / 1 | tools on the worm (`w.rope`, `w.jet`) |
| Teleport, Girder | `teleport`, `girder` | 2 / 3 | 1 / 0 | click |
| Blowtorch, Pneumatic Drill | `blowtorch`, `drill` | 3 / 2 | 1 | tools (`w.tool`), hurt worms they touch |
| Parachute | `parachute` | 3 | 0 | arms a parachute for the next fall |
| Select Worm, Skip Go, Surrender | `select`, `skip`, `surrender` | 1 / inf / inf | 2 / 0 / 0 | turn controls (`noEnd`) |

### Some special mechanics

* **Nuclear Test radiation.** After the blast every worm gets `w.rad = RAD_TIME` and `w.radT`; `stepOnce` takes `RAD_DMG`
  health every `RAD_EVERY` seconds, never lethal. Tune it in `core.js`.
* **Thor's Hammer.** The `mjolnir` projectile follows the caster's hand for `HAMMER_CHARGE` seconds (sparks, clouds
  and sky arcs), then `lightningRay` carries the bolt to the marked worm (it stops at ground or another worm) and
  short branch arcs scatter at the impact.
* **Time Car.** The `timecar` projectile spawns behind the caster, follows the ground (`surfaceAt`), blasts through
  walls, drops flames in front and behind, and hits each worm once.
* **Blowtorch / drill.** `toolHurt` in `worms.js`; the blowtorch always heads straight (the horizontal direction it
  started in) and obeys gravity, so it drops into a hole.
* **Tornado.** One pass over worms, mines (`PTYPES[p.t].mine`) and drums (`G.objs`): pull, lift, fling.

## 5. Adding a weapon: checklist

1. `registerWeapon({...})` in `weapons.js` (+ a projectile type in `projectiles.js` if it launches something).
2. A **category**: add the id to `WEAPON_CAT` in `core.js` (or set `cat`).
3. An **icon**: `ICON_DRAW[id]` in `icons.js` (otherwise a badge with `code` is drawn).
4. A **sprite** for its projectile (`spriteProj`, `sprites.js`) and sounds (`SFX`, `audio.js`) if needed.
5. **Italian**: the weapon name and every banner / log text in `lang-it.js` (`tests/smoke.py` lists the missing ones).
6. **Crates**: add it to `CRATE_WEAP` in `crates.js` if it may drop from the sky; to the **bots** (`ai.js`) if they
   should use it.
7. **Test** it: `tests/test_weapons.py` fires every weapon, `tests/test_special_weapons.py` is the model for the
   special ones, `tests/test_weapon_tabs.py` checks the category.
8. Docs: README weapon count and list, this table.

A worked example (Pumpkin Bomb) is in [DEVELOPING.md](DEVELOPING.md#worked-example-pumpkin-bomb).
