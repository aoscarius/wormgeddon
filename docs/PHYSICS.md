# Physics

Part of the [developer guide](DEVELOPING.md). Sources: `js/core.js` (constants), `js/step.js`, `js/worms.js`,
`js/projectiles.js`, `js/collision.js`, `js/combat.js`, `js/crates.js`. How bodies are *detected* against terrain and
each other is in [COLLISION.md](COLLISION.md).

All units are **pixels** and **seconds**. The y axis points **down** (gravity is positive, jumping is negative `vy`).

---

## 1. The simulation loop

* The simulation advances in **fixed ticks of 1/60 s** (`stepOnce(1/60)` in `main.js`, up to 6 ticks per rendered
  frame, so physics is independent of the frame rate).
* Only the host (or a local game) simulates. The host sends a snapshot every second frame (full every 10th), guests
  interpolate (`clientSmooth`) and play the same events.
* Order inside one tick (`step.js`): scheduled actions (`sched`) -> earthquake / tsunami / Armageddon -> active worm
  control -> physics of the other worms -> projectiles -> fire particles -> crates and drums -> radiation -> water
  level -> phase logic.
* All randomness during play (`rnd`, `Math.random`) happens on the host only. Only level generation and spawn
  placement are seeded (`mulberry(hashStr(seed + ...))`) so a seed always gives the same level.

## 2. Constants (`core.js`)

| Constant | Value | Meaning |
| --- | --- | --- |
| `GRAV` | 600 | gravity (px/s^2); projectiles scale it with their `grav` factor |
| `WIND_ACC` | 90 | acceleration at full wind (px/s^2) times the projectile's `wind` factor |
| `FALLV` | 460 | impact speed above which a worm is hurt by landing |
| `WORM_R` | 6 | worm collision radius |
| `RAD_TIME`, `RAD_DMG`, `RAD_EVERY` | 60, 1, 5 | Nuclear Test radiation: duration, damage per tick, seconds between ticks |

The wind `G.wind` is in `-1..1` and is re-rolled every turn (`startTurn`); the HUD shows it top right.

## 3. Bodies

Everything that moves is a circle `{x, y, vx, vy, r, bounce?, fric?}` moved by `stepBody(b, dt)`
(see [COLLISION.md](COLLISION.md)). The usual pattern per tick is:

```js
b.vy += GRAV * dt;            // gravity
b.vx += G.wind * WIND_ACC * k * dt;   // optional wind
const c = stepBody(b, dt);    // move + collide; c = null or {n, speed}
```

`bounce` is the restitution (0 = no bounce, 0.5 = loses half), `fric` the share of the **tangential** speed that
survives a contact (0.85 default, 0.5 = very sticky, so mines and drums stop quickly).

## 4. Worms (`physWorm`, `controlWorm` in `worms.js`)

| State | Behaviour |
| --- | --- |
| **grounded** | walks with `walkStep` (52 px/s, climbs gentle slopes), slides after knockback (`vx *= 0.9` per tick while above 4 px/s), loses `grounded` as soon as `supported(w)` is false |
| **airborne** | gravity + `stepBody`; on landing `vx *= 0.4`, `vy = 0`, grounded again |
| **jump** | `vy = -285`, `vx = face * 92` (peak about 68 px); **back-flip** `vy = -400`, `vx = -face * 36` (peak about 133 px) |
| **rope** | `ropePhys`: a pendulum around the anchor; Left/Right swing, Up/Down shorten / lengthen |
| **jet pack** | `vy -= 1000 dt` (Up) and `vx += 650 dt` (sideways) while `fuel > 0`; no fall damage while flying |
| **parachute** | `w.chute`: fall speed capped at 70 px/s, no fall damage, used up on landing |
| **tools** | blowtorch / drill / kamikaze (see [WEAPONS.md](WEAPONS.md)) |

### Fall damage

On a floor contact (`c.n[1] < -0.4`) with `c.speed > FALLV` and no parachute / jet pack:

```
damage = min(60, round((speed - FALLV) / 7))
```

* A normal jump lands at about 300 px/s and a back-flip at about 400 px/s: **both stay under `FALLV`** and never hurt.
* Free fall reaches `FALLV` after `460^2 / (2 * 600)` = **about 176 px**; every further 7 px/s adds 1 hp.
* Hitting a wall or ceiling hurts only above `FALLV * 1.3` (598 px/s): `round((speed - FALLV*1.3) / 10)`.
* **To make jumps and falls more or less dangerous change `FALLV`** (`core.js`). The `/ 7` divisor and the cap of 60
  are in `worms.js` (`physWorm`).

### Knockback

Explosions, melee and bullets add to the victim's `vx` / `vy` and clear `grounded`, `rope` and (for strong pushes)
`tool` / `jet`. There is no separate "stun": the worm is simply airborne until it lands, and landing hard hurts.

### Settling and the watchdog

At the end of a turn the match waits in the `settle` phase until nothing moves (`quiet()`; hard cap 10 s). To keep
worms from hanging in the air, a worm that is not grounded but barely moves with ground under it is grounded again, and
one that has made **no progress for 1.2 s** (wedged in a crevice) is freed with `findFree` and grounded.

### Leaving the map and drowning

A worm leaving the map sideways dies; a worm below `G.waterY` is sunk (`sinkWorm`). The sea can rise (sudden death,
`G.waterTarget`), flames and projectiles die in it with a splash.

## 5. Projectiles (`updateProj`)

Per tick: `age += dt` -> `tick(p, dt)` hook (return `false` to skip the rest) -> gravity (`grav` factor) -> wind
(`wind` factor) -> `stepBody` -> worm hit test (`hit` types) -> on terrain contact either `detonate` (`hit`) or bounce
(and rest when slower than 14 px/s) -> fuse countdown (`fuse` seconds, beeping each second if `beep`) -> trail
particles. Details and every field are in [PROJECTILES.md](PROJECTILES.md).

Flight tuning in one table (see `projectiles.js` for all):

| Type | `grav` | `wind` | Notes |
| --- | --- | --- | --- |
| rocket | 0.3 | 1 | explodes on contact |
| homing | 0.3 | 1 | flies like a rocket up to its apex, then homes in: turn rate 8-12 rad/s, speed `min(launch speed, max(45, distance * 4.5))` |
| mortar | 0.55 | 1 | four bomblets |
| grenade family | 1 | 0 | `bounce 0.5`, `fuse 3` |
| bomb (air strike) | 0.8 | 0 | explodes on contact |

## 6. Fire, crates, drums, water

* **Fire particles** (`G.fires`, cap 260): fall with `0.7 * GRAV`, come to rest when slow, burn worms (1 hp every
  0.3 s), light drums, die after `life` seconds or in the water.
* **Crates** fall with a parachute (slowly) and land; **drums** are static unless they have no ground below, are lit,
  or are lifted by a tornado (`air`), and a hard landing (over 280 px/s) sets them off.
* **Water** (`G.waterY`) drops back towards `G.waterTarget` at 14 px/s after a rise.

## 7. Time-based effects

Anything that lasts uses `dt`, never real time: `G.sched` (delayed actions: `sched(seconds, fn)`), `p.age`, fuses,
`G.quake` (earthquake, ticks every 0.14 s), the tsunami front, **radiation** (`w.rad` seconds left, `w.radT` seconds to
the next tick: `RAD_DMG` hp every `RAD_EVERY` s for `RAD_TIME` s, never lethal). Because the clock is the simulation's own
tick, pausing the game and running tests with `stepOnce` behave exactly like real play.

## 8. Tuning recipes

| I want | Change |
| --- | --- |
| a floatier game | `GRAV` down (everything falls slower, jumps get higher) |
| more dangerous falls | `FALLV` down |
| stronger wind | `WIND_ACC` up, or the `wind` factor of the projectile type |
| bouncier grenades | `bounce` in `gr({...})` or the type |
| easier to hit worms | the projectile's `r`, or a padding term in `projectileWormHit` ([COLLISION.md](COLLISION.md)) |
| a longer / harsher radiation | `RAD_TIME`, `RAD_DMG`, `RAD_EVERY` |
| faster / slower walking | the `52` in `controlWorm` (`walkStep(w, 52 * dt)`) |
