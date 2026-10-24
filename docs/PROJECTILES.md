# Projectiles

Part of the [developer guide](DEVELOPING.md). Sources: `js/core.js` (`registerProj`, `PTYPES`), `js/projectiles.js`
(all types, `spawnProj`, `updateProj`, `detonate`), `js/sprites.js` (drawing), `js/net.js` (snapshots),
`js/match.js` (`quietBlocker`). Weapons that launch them are in [WEAPONS.md](WEAPONS.md); movement and contact rules
are in [PHYSICS.md](PHYSICS.md) and [COLLISION.md](COLLISION.md).

A **projectile** is anything that flies, falls, walks or drives on its own after a weapon was used: rockets, grenades,
mines, sheep, the dragon, the tornado, Thor's hammer, the time car, meteors. Each lives in `G.projs[]` as a plain
object created by `spawnProj` and described by a **type** registered with `registerProj(id, definition)`.

---

## 1. The projectile object

`spawnProj(type, x, y, vx, vy, ownerWorm, extra)` returns:

| Field | Meaning |
| --- | --- |
| `id`, `t` | unique id, type name |
| `x`, `y`, `vx`, `vy`, `r` | position, velocity, collision radius (from the type) |
| `a` | angle of travel (rotates the sprite unless the type has `fixedAngle`) |
| `age` | seconds since it was spawned |
| `fuse` | seconds to `detonate`, `null` = no fuse |
| `team`, `ow` | owner's team and worm id (`-1` for world-spawned ones such as meteors) |
| `bounce`, `fric`, `grounded` | physics state ([PHYSICS.md](PHYSICS.md)) |
| `face` | -1 / 1, direction the owner faced |
| `dead` | set to remove it at the end of the tick |

`extra` overrides or adds fields: `{fuse, ow, tx, ty, face, ...}`. Anything you add (`p.sung`, `p.hits`, `p.phase`) lives
on the object, is free to use inside `tick`, and is **not** sent to guests unless it is one of the snapshot fields below.

## 2. Registering a type

```js
registerProj('roller', {
  r: 4,              // collision radius
  grav: 1, wind: 0,  // factors of GRAV and WIND_ACC (default grav 1, wind 0)
  bounce: 0, fric: 0.9,
  fuse: 8, beep: true,
  expl: { r: 34, d: 40, push: 220 },   // or boom(p) { ... }
  spr: 'grenade',    // sprite name, see section 5
  trail: 'smoke',    // optional particle trail ('smoke', 'fire')
  tick(p, dt) { /* optional per-tick logic */ },
});
```

| Field | Meaning |
| --- | --- |
| `r` | collision radius (default 3). **Also the worm hit box**: a `hit` projectile hits a worm within `p.r + worm.r` |
| `grav`, `wind` | multipliers of `GRAV` / `WIND_ACC`; `grav: 0` flies straight |
| `bounce`, `fric` | restitution and tangential damping on terrain contact; `fric` default 0.85 |
| `fuse`, `beep` | seconds to `detonate`; `beep` makes it beep each second |
| `hit` | explode on the first terrain contact **or worm contact** (rockets, bombs) |
| `expl` | `{r, d, push, k, fire}`: crater radius, damage, knockback (default `d*3.2 + r*3`), effect style (`k: 1` = big flash), number of flames |
| `boom(p)` | custom explosion instead of `expl` (cluster bombs spawn children here) |
| `tick(p, dt)` | custom per-tick logic, see below |
| `spr` | sprite name for `sprites.js` |
| `trail` | particle trail type emitted while flying |
| `fixedAngle` | do not rotate the sprite to the velocity |
| `passive` | does not delay the end of the turn while it has no fuse (mines) |
| `mine`, `ctl` | `mine`: armed by worms nearby, set off by explosions; `ctl`: steerable by its owner (super sheep) |

`gr({...})` is the base record for grenade-like throwables (`r 3, bounce 0.5, fric 0.82, fuse 3, beep, wind 0`).

### The `tick(p, dt)` hook

Called first on every tick (`updateProj`). What it returns decides the rest:

| Return | Effect |
| --- | --- |
| `true` / `undefined` | continue with the **default physics**: gravity, wind, `stepBody`, hit tests, bounce, fuse, trail |
| `false` | **you** moved the projectile. Default physics and hit tests are skipped; only the fuse still counts down |

So a type that returns `false` must do its own movement, collisions and `detonate(p)`. Examples in the code:

* *donkey*: moves on the vertical axis only, hops after every landing.
* *dragon*, *tornado*, *mjolnir*, *timecar*: move kinematically, ignore terrain collision, set `p.dead = true` when done.
* *homing*: rises like a rocket, then steers; calls `stepBody` and `projectileWormHit` itself.
* *mine*: `return true` (default physics) and watches for worms in range.

### Ending a projectile

* `detonate(p)`: marks it dead and runs `boom(p)` or `explode(...)` from `expl`. Call it, don't set `dead` by hand,
  when you want an explosion.
* `p.dead = true`: silent removal (leaving the map, finishing an effect).
* Falling into the sea (`y > waterY`) and leaving the map (`x < -400`, `x > width + 400`, `y > height + 200`) kill a
  projectile automatically (`step.js`).

## 3. One tick, in order (`updateProj`)

1. `age += dt`; run `tick`; if it returned `false`, count the fuse and stop here.
2. `vy += GRAV * grav * dt`; `vx += wind * WIND_ACC * wind-factor * dt`.
3. `stepBody` (sub-stepped terrain collision, bounce).
4. If `hit`: `projectileWormHit` along the path; a worm hit detonates at the contact point.
5. Unless `fixedAngle`: `a = atan2(vy, vx)`.
6. On terrain contact: `hit` types detonate; others beep when fast and come to rest below 14 px/s.
7. Fuse countdown, `trail`.

## 4. Turn flow and projectiles

The match only moves on from the `settle` phase when `quietBlocker()` finds nothing active. Every projectile **blocks**
it (`'projectile <type>'` in the debug view) unless the type is `passive` and has no fuse. That is why a time car or a
tornado keeps the turn open until it dies, and why a lingering mine does not. Use `sched(seconds, fn)` for delayed
effects: scheduled actions block too.

## 5. Drawing and syncing

* **Sprites:** `spriteProj(p)` in `sprites.js` switches on the type's `spr` and draws in world units with the canvas
  already translated to the projectile (`ctx2`). Use `p.face`, `p.a`, `p.walk`, `G.time` (not `Date.now()`, so paused
  and replayed frames look the same).
* **Guests** never run `tick`. The host sends, per projectile, `[id, type, x, y, angle, fuse, face, walk, old]`
  (`snapshot()` in `net.js`); guests interpolate the position. Consequences:
  * anything the sprite needs must be derivable from those fields. `p.walk` (0..1, one decimal) is the free
    "animation state" channel: the dragon uses it for "breathing", Thor's hammer for the charge level, the time car
    for "driving";
  * **targets and counters (`tx`, `tw`, `hits`) stay on the host.** Effects that need to be visible to guests go through
    events: `emit({e: 'arc', ...})`, `emit({e: 'storm', ...})`, `emit({e: 'snd', s: 'roar'})`.
* **Events:** `emit` from `tick` works exactly like from weapons; add a `case` in `applyEvent` (`fx.js`) for a new one.

## 6. Existing types (`projectiles.js`)

| Group | Types |
| --- | --- |
| rockets and bombs | `rocket`, `homing`, `mortar`, `bomblet`, `bomb`, `napbomb`, `dot` |
| grenade family | `grenade`, `cluster`, `clusterlet`, `banana`, `bananaling`, `holy`, `petrol`, `dynamite` |
| planted / walking | `mine`, `sheep`, `supersheep` |
| world / sky | `donkey`, `meteor`, `dragon`, `tornado`, `mjolnir`, `timecar` |

## 7. Recipes

**A projectile that follows the ground** (time car): in `tick`, move `x`, read `surfaceAt(x, p.y - 26)`, then
`p.y += clamp(groundY - 8 - p.y, -300 * dt, 1800 * dt)` so it climbs slowly but drops fast; return `false`.

**A timed area effect**: `spawnProj('myzone', x, y, 0, 0, w, {ow: w.id})` and in `tick` loop `G.worms` with a
distance test; set `p.dead = true` at `p.age > N`.

**Hitting each worm once**: keep `p.hits = {}` in `extra` and test `p.hits[worm.id]` before applying damage.

**Choosing the owner**: always pass the worm as `ownerWorm` (or `ow` in `extra`) so `explode(..., {src: p.ow})`
attributes the kill and friendly checks work; world-spawned things pass `null` and `{ow: -1}`.

**Testing:** spawn it from a test with `window.__wh.spawnProj(type, x, y, vx, vy, worm, extra)`, step with `stepOnce(1/60)`
and assert on `G.projs`, worm health and the events (`tests/test_special_weapons.py`, `tests/test_homing.py`).
