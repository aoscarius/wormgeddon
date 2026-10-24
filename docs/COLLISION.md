# Collision system and hit detection

Part of the [developer guide](DEVELOPING.md). Everything described here runs on the host (or in a local
game); guests never simulate, they only draw what the host sends. Sources: `js/terrain.js`, `js/collision.js`,
`js/combat.js`, `js/weapons.js`, `js/projectiles.js`, `js/worms.js`, `js/crates.js`, `js/core.js`.

There are **two different families** of detection:

1. **Body against terrain**: circles (worms, projectiles, crates, drums, fire) tested against the pixel mask.
2. **Body against body**: simple distance tests, each weapon kind with its own rule (explosions, rays, melee,
   projectile paths, tools).

---

## 1. The terrain mask

The level is a bitmap `T.mask` (a `Uint8Array`, `T.w * T.h`, 1 = ground, 0 = air) next to a drawing canvas.
Collision only ever reads the mask.

```js
solid(x, y)   // true when the pixel is ground. Outside the map it is AIR, so things fall off the edges.
```

The mask changes in three ways, all through `applyTerrain` (events `x`, `cv`, `gd`), so host and guests carve
identical ground:

| Event | Effect |
| --- | --- |
| `x` | explosion crater of radius `r` (`c: 0` = no carving) |
| `cv` | plain crater / tunnel (blowtorch, drill, bullets) |
| `gd` | girder (adds ground, `{x, y, a, l}`) |

Because the mask is just an array you can edit it directly in a test (`T.mask.fill(1, y * T.w + x0, y * T.w + x1)`),
see `ARENA_JS` in `tests/common.py`.

---

## 2. Circle against terrain (`collision.js`)

| Function | What it does |
| --- | --- |
| `hitC(x, y, r)` | true if a circle touches ground: the centre plus **8 samples on the perimeter** (`RING`). Thin spikes narrower than the sample spacing can slip between samples; that is deliberate and cheap. |
| `normalAt(x, y)` | surface normal from a 7x7 window: sums the directions away from solid pixels. Unit vector out of the ground, `[0, -1]` if nothing solid is near. |
| `findFree(x, y, r, maxR)` | spirals outwards (2 px rings, 16 directions) to the nearest spot where the circle fits; `null` if none within `maxR`. |
| `groundBelow(x, y, r)` | ground just under the feet: three samples (`x-3`, `x`, `x+3`) at `y + r + 1.5`. Used for "standing". |
| `supported(w)` (`worms.js`) | `groundBelow` **or** `hitC(x, y + 1, r)`. The second test catches spikes and diagonal edges the three foot samples miss. |
| `stepBody(b, dt)` | the integrator behind almost everything (below). |

### `stepBody(b, dt)`

Moves `b = {x, y, vx, vy, r, bounce?, fric?}` for `dt` seconds:

1. **Unstick.** If the body starts inside ground it is moved with `findFree(..., 40)`. If it is buried deeper it
   moves freely so it can dig itself out (a crater edge, new terrain on top of it).
2. **Sub-steps** of at most **2 px** (`n = ceil(speed * dt / 2)`), so even a 600 px/s body cannot tunnel through
   thin ground.
3. **On contact**: take the normal `N`; if the body moves into the surface (`v . N < 0`) reflect the velocity
   with restitution `1 + bounce`, damp the tangential part by `fric` (default 0.85), remember the contact
   `{n: N, speed}` and continue the remaining sub-steps with the new velocity. A second contact in the same tick
   stops the loop.
4. **Corner graze**: if blocked without moving into the surface, try each axis alone (slides along walls).

It returns `null` when the body moved freely, otherwise `{n, speed}` of the **first** contact. Callers use it:

* projectiles with `hit: true` explode when `c` is truthy;
* worms read `c.n[1] < -0.4` (a floor) and `c.speed` for **fall damage** (see [PHYSICS.md](PHYSICS.md));
* a body with `bounce: 0` simply stops against the surface.

Rule of thumb: **never move a body by hand through terrain**; write `vx`/`vy` and let `stepBody` move it. The only
code that moves things directly is deliberately special (blowtorch walking through its own tunnel, donkey moving on
the vertical axis only, tornado lifting, time car following the ground).

---

## 3. Body against body

### 3.1 Explosions (`explode` in `combat.js`)

```js
explode(x, y, r, dmg, push, { k, fire, noCarve, noEnd, src })
```

* Emits the `x` event (crater + effects) first.
* **Reach is `r + 14` px** from the centre. For every living worm, distance `d = hypot(w.x - x, w.y - y - 2)`;
  if `d < reach`, factor `f = 1 - d / reach` (**linear falloff**).
  Damage `round(dmg * f)` via `hurt()`, knockback `push * f` along the centre-to-worm direction (plus a small lift),
  and the worm leaves `grounded`, drops the rope and, above 120 px/s of push, loses tool / jet pack.
* Loose projectiles in reach are pushed (`70%` of the push) unless `passive` / `ctl`; **mines** in reach start
  their fuse (0.15-0.65 s); **oil drums** are lit; **crates** (not health crates) within `0.7 r` are destroyed.
* `fire: n` sprays `n` flame particles.

So the *effective* radius of a blast is bigger than its crater: tune `r` for the crater, `dmg` and `push` for
the effect.

### 3.2 Projectiles against worms (`projectileWormHit` in `collision.js`)

Only **impact-detonating** projectiles (type flag `hit: true`) and the homing missile test worms. After the move
`updateProj` asks `projectileWormHit(p, oldX, oldY, newX, newY)`:

* the movement **segment** `old -> new` is tested, not just the end point, so fast projectiles cannot skip
  over a worm;
* a worm is hit when its centre is within `p.r + w.r` of the closest point of the segment (projectile radius plus
  worm radius, `WORM_R` = 6 by default);
* the **first** worm along the segment wins; the projectile is moved to the contact point and detonated.

**Making worms easier to hit:** the hit box is purely the two radii, so either give the projectile type a bigger
`r` (it also changes its terrain collision), raise `WORM_R` in `core.js` (it changes the worm's terrain collision
too, so check that worms still fit into tunnels), or add a padding term in `projectileWormHit`
(`const radius = (p.r || 0) + (w.r || 0) + PAD;`), which affects only worm hits.
**Harder to hit:** the opposite.

Grenades, mines, dynamite etc. (no `hit`) ignore worms and only bounce on terrain; they hurt through their
explosion.

The **homing missile** (`tick` returns `false`, so `updateProj` does not run) calls `projectileWormHit` itself,
detonates on terrain contact, and also has a **proximity fuse**: after 0.3 s of flight it explodes within 20 px of the
marked point (it also slows down and turns tighter near it), so it cannot orbit a point in empty sky.

### 3.3 Hitscan (`ray` in `weapons.js`; shotgun, handgun, uzi)

Walks along the aim direction in **3 px steps** up to `len`; stops at the first worm (box test
`|dx| < 6 && |dy| < 8`) or ground (`solid`), carves a tiny crater, emits a tracer (`shot` event) and applies
damage plus knockback to the worm.

### 3.4 Melee (`melee` in `weapons.js`; Fire Punch, Dragon Ball, Baseball Bat)

Every worm within `o.reach` of the attacker **and in front of him** (`rx * face > -4`) is hurt and launched.
It is a distance test, not a swept test: reach is the only "hit box".

### 3.5 Lightning (`lightningRay`, `lightningBolt` in `weapons.js`)

`lightningRay(x1, y1, x2, y2, skip)` walks a segment in 3 px steps and returns the first ground pixel or the first
living worm (box `|dx| < 9 && |dy| < 8`, the caster is skipped). Thunderstorm bolts and Thor's Hammer both use
it, so **a bolt is stopped by the first obstacle** (terrain, a girder, another worm) and does not reach a worm
standing behind it.

### 3.6 Tools and moving weapons

| Weapon | Rule |
| --- | --- |
| Blowtorch / drill | `toolHurt`: every 0.25 s other worms within 14 px of the tool head take damage and are shoved. The user is never hurt. |
| Time car | worm within 20 px in x and 38 px in y of the car, once per worm (`p.hits`), the caster is immune. |
| Tornado | worms, mines and drums within 95 px (x) and between -30 and 190 px (height above the funnel foot) are caught. |
| Kamikaze | the worm itself is the projectile (`stepBody`), explodes on contact or timeout. |

### 3.7 Mines, drums, crates, fire

* **Mine** (projectile with `mine: true`): arms after 1.2 s; a worm within **26 px** sets a 0.9 s fuse.
* **Oil drum** (`G.objs`, `k: 'drum'`, radius 7): lit by explosions or by a flame particle within 9 x 10 px;
  explodes when the `lit` timer ends. It only moves when it has no ground below or is lifted (`air`).
* **Crate**: collected by the **active** worm touching it during turn / retreat (`updateObjs`).
* **Fire particles** (`G.fires`): a worm within 8 x 9 px of a flame burns 1 hp every 0.3 s.

### 3.8 Water

`G.waterY` is the sea level (it can rise in sudden death). A worm below it is sunk (`sinkWorm`), projectiles and
flames die there with a splash.

---

## 4. Adding a new detection

Pick the closest existing rule instead of inventing one:

| You want | Start from |
| --- | --- |
| a bullet | `ray(...)` |
| a short-range attack | `melee(...)` |
| a rocket-like projectile | `registerProj` with `hit: true` (the worm hit box is `p.r + w.r`) |
| a bolt from the sky | `lightningRay` |
| something that drives or walks | a `tick` that sets `vx`/`vy` and calls `stepBody`, or follows `surfaceAt(x, from)` like the time car |
| an area effect | `explode(...)` with the right `r` / `dmg` / `push` |

Always test it: `tests/test_hammer_collision.py` shows how to build a flat arena with `ARENA_JS`, put worms and walls in
a line and assert who gets hit.
