'use strict';

/**
 * @file projectiles.js - Projectiles
 *
 * Projectile spawning/updating and the data-driven projectile types (rocket, grenade, sheep,
 * donkey ...). Each type is a registerProj() record: physics flags, optional tick() hook and
 * boom()/expl explosion data.
 *
 * Depends on: core, combat, collision
 * Globals defined: KAME_*, PROTON_*, streamRay, protonGeom, protonRig, segDist, kameFire, spawnProj, spawnFire, detonate, updateProj, fuseTick, gr, DONKEY_MAX_HOPS, HAMMER_CHARGE, CAR_MAX_AGE
 */

/* ===== Projectiles ===== */
/**
 * Creates a projectile of a registered type and adds it to the match.
 * @param {string} type key in PTYPES
 * @param {object|null} w shooter worm (sets team, owner and facing), or null for world-spawned ones
 * @param {object} [extra] fields that override the defaults (fuse, tx/ty target, ow ...)
 * @returns {object} the projectile
 */
function spawnProj(type, x, y, vx, vy, w, extra) {
  const d = PTYPES[type];
  const p = Object.assign(
    {
      id: G.nid++,
      t: type,
      x,
      y,
      vx,
      vy,
      r: d.r || 3,
      a: Math.atan2(vy, vx),
      age: 0,
      fuse: d.fuse != null ? d.fuse : null,
      team: w ? w.team : -1,
      ow: w ? w.id : -1,
      bounce: d.bounce || 0,
      fric: d.fric == null ? 0.85 : d.fric,
      face: w ? w.face : 1,
      grounded: false,
    },
    extra || {}
  );
  G.projs.push(p);
  return p;
}
/** Spawns one flame particle that falls, burns worms it touches and dies after `life` seconds (capped at 260). */
function spawnFire(x, y, vx, vy, life) {
  if (G.fires.length > 260) G.fires.shift();
  G.fires.push({ x, y, vx, vy, life, r: 1.5, bounce: 0.1, fric: 0.5, rest: false });
}
/** Destroys a projectile and triggers its explosion: custom boom(p), else the type's `expl` data. */
function detonate(p) {
  if (p.dead) return;
  p.dead = true;
  const d = PTYPES[p.t];
  if (d.boom) d.boom(p);
  else if (d.expl)
    explode(
      p.x,
      p.y,
      d.expl.r,
      d.expl.d,
      d.expl.push != null ? d.expl.push : d.expl.d * 3.2 + d.expl.r * 3,
      { k: d.expl.k, fire: d.expl.fire, src: p.ow, noEnd: false }
    );
}
/**
 * One tick of projectile logic: the type's tick() hook, gravity, wind, movement and terrain
 * contact (explode / bounce / come to rest), fuse countdown and an optional particle trail.
 */
function updateProj(p, dt) {
  const d = PTYPES[p.t];
  p.age += dt;
  if (d.tick && d.tick(p, dt) === false) {
    if (p.fuse != null) fuseTick(p, dt, d);
    return;
  }
  p.vy += GRAV * (d.grav == null ? 1 : d.grav) * dt;
  if (d.wind) p.vx += G.wind * WIND_ACC * d.wind * dt;
  const oldX = p.x, oldY = p.y;
  const c = stepBody(p, dt);
  // Only impact-detonating projectiles (for example, rockets) stop on worm contact.
  if (d.hit) {
    const hit = projectileWormHit(p, oldX, oldY, p.x, p.y);
    if (hit) {
      p.x = hit.x;
      p.y = hit.y;
      detonate(p);
      return;
    }
  }
  if (!d.fixedAngle) p.a = Math.atan2(p.vy, p.vx);
  if (c) {
    if (d.hit) {
      detonate(p);
      return;
    }
    if (d.impactSpeed != null && c.speed >= d.impactSpeed) {
      if (d.impactFuse != null) {
        if (p.fuse == null) {
          p.fuse = d.impactFuse;
          p.trig = true;
          if (d.beep) emit({ e: 'snd', s: 'beep' });
        }
      } else {
        detonate(p);
        return;
      }
    }
    if (c.speed > 140) emit({ e: 'snd', s: 'beep', q: 1 });
    if (Math.hypot(p.vx, p.vy) < 14) {
      p.vx = p.vy = 0;
      p.grounded = true;
    }
  }
  if (p.fuse != null) fuseTick(p, dt, d);
  if (d.trail && Math.random() < 0.8) emit({ e: 'trail', x: p.x, y: p.y, k: d.trail, q: 1 });
}
/** Counts a fuse down (beeping each second for types with `beep`) and detonates at zero. */
function fuseTick(p, dt, d) {
  const before = Math.ceil(p.fuse);
  p.fuse -= dt;
  if (d.beep && Math.ceil(p.fuse) < before) emit({ e: 'snd', s: 'beep', q: 1 });
  if (p.fuse <= 0) detonate(p);
}

/* Grenade-like throw presets */
/** Base record shared by all fused, bouncing grenade-style projectiles. */
const gr = o =>
  Object.assign({ r: 3, bounce: 0.5, fric: 0.82, spr: 'grenade', fuse: 3, beep: true, wind: 0 }, o);
// Bazooka rocket: slight gravity, strongly affected by wind, explodes on contact.
registerProj('rocket', {
  r: 3,
  grav: 0.3,
  wind: 1,
  hit: true,
  spr: 'rocket',
  trail: 'smoke',
  expl: { r: 30, d: 50 },
});
// Homing missile: steers towards the marked target at a limited turn rate, accelerating up to 340 px/s.
registerProj('homing', {
  r: 3,
  grav: 0.3,
  wind: 1,
  hit: true,
  spr: 'rocket',
  trail: 'smoke',
  fuse: 9,
    tick(p, dt) {
    // Use normal rocket physics (including gravity and wind) until the missile reaches its apex.
    if (p.phase !== 'return') {
      if (p.vy < 0) {
        p.rising = true;
        return true;
      }
      // If it never rose, treat its launch point as its apex.
      if (!p.rising || p.vy >= 0) p.phase = 'return';
    }

    const tx = p.tx,
      ty = p.ty;
    if (tx != null && ty != null) {
      const dx = tx - p.x,
        dy = ty - p.y,
        distance = Math.hypot(dx, dy);

      if (distance < 20 && p.age > 0.3) {
        detonate(p);
        return false;
      }

      const want = Math.atan2(dy, dx);
      let df = want - p.a;
      while (df > Math.PI) df -= TAU;
      while (df < -Math.PI) df += TAU;

      // Tighten the turn near the target and reduce speed to avoid orbiting it.
      const near = clamp((140 - distance) / 140, 0, 1);
      const turnRate = 8 + 4 * near;
      p.a += clamp(df, -turnRate * dt, turnRate * dt);

      const launchSpeed = p.spd || Math.max(120, Math.hypot(p.vx, p.vy));
      const speed = Math.min(launchSpeed, Math.max(45, distance * 4.5));
      p.vx = Math.cos(p.a) * speed;
      p.vy = Math.sin(p.a) * speed;
    }

    const ox = p.x,
      oy = p.y,
      c = stepBody(p, dt),
      hit = projectileWormHit(p, ox, oy, p.x, p.y);

    if (hit) {
      p.x = hit.x;
      p.y = hit.y;
    }
    if (c || hit) detonate(p);
    if (Math.random() < 0.8) emit({ e: 'trail', x: p.x, y: p.y, k: 'smoke', q: 1 });
    return false;
  },
  expl: { r: 32, d: 45 },
});
// Mortar shell: heavy arc, bursts into four small bomblets on impact.
registerProj('mortar', {
  r: 3,
  grav: 0.55,
  wind: 1,
  hit: true,
  spr: 'shell',
  trail: 'smoke',
  boom(p) {
    explode(p.x, p.y, 22, 25, 120, { src: p.ow });
    for (let i = 0; i < 4; i++)
      spawnProj('bomblet', p.x, p.y - 4, rnd(-170, 170), -rnd(120, 300), null, { ow: p.ow });
  },
});
// Small bomblet released by the mortar.
registerProj('bomblet', { r: 2, hit: true, spr: 'dot', col: '#ffd23f', expl: { r: 14, d: 14 } });
// Grenade: 3 s fuse (adjustable), bounces, ignores wind.
registerProj('grenade', gr({ expl: { r: 34, d: 50 } }));
// Cluster bomb: on detonation scatters five cluster-lets.
registerProj(
  'cluster',
  gr({
    spr: 'cluster',
    boom(p) {
      explode(p.x, p.y, 22, 25, 130, { src: p.ow });
      for (let i = 0; i < 5; i++)
        spawnProj('clusterlet', p.x, p.y - 4, rnd(-220, 220), -rnd(150, 360), null, { ow: p.ow });
    },
  })
);
// Fragment of a cluster bomb (explodes on contact).
registerProj('clusterlet', {
  r: 2,
  hit: true,
  bounce: 0.2,
  spr: 'dot',
  col: '#e0e8f0',
  expl: { r: 20, d: 24 },
});
// Banana bomb: very bouncy, splits into five fused banana-lings.
registerProj(
  'banana',
  gr({
    bounce: 0.8,
    spr: 'banana',
    boom(p) {
      explode(p.x, p.y, 40, 75, 260, { src: p.ow });
      for (let i = 0; i < 5; i++)
        spawnProj('bananaling', p.x, p.y - 6, rnd(-240, 240), -rnd(180, 380), null, {
          ow: p.ow,
          fuse: rnd(1.3, 3),
        });
    },
  })
);
// Fragment of a banana bomb.
registerProj('bananaling', gr({ bounce: 0.8, spr: 'banana', expl: { r: 34, d: 60 } }));
/** Length in seconds of the audible part of sounds/hallelujah.mp3 (2.53 s file, silence after 2.0 s). */
const HOLY_SONG = 2.0;
// Holy Hand Grenade: biggest grenade explosion, with a flash; the choir sings during the last seconds of the fuse.
registerProj(
  'holy',
  gr({
    bounce: 0.35,
    spr: 'holy',
    r: 4,
    tick(p) {},
    boom(p) {
      if (!p.sung && p.fuse != null && p.fuse <= HOLY_SONG) {
        p.sung = true;
        emit({ e: 'snd', s: 'holy' });
      }
      emit({ e: 'flash', c: '#fff6c0' });
      explode(p.x, p.y, 72, 100, 420, { k: 1, src: p.ow });
    },
  })
);
// Dynamite: dropped at the worm's feet, 5 s fuse, no wind.
registerProj('dynamite', {
  r: 4,
  bounce: 0.1,
  fric: 0.4,
  spr: 'dynamite',
  fuse: 5,
  beep: true,
  wind: 0,
  expl: { r: 56, d: 100, k: 1 },
});
// Petrol bomb: small blast that sprays burning fuel.
registerProj('petrol', {
  r: 3,
  wind: 0,
  hit: true,
  spr: 'petrol',
  boom(p) {
    explode(p.x, p.y, 14, 8, 60, { fire: 26, src: p.ow });
  },
});
// Mine: passive (does not delay the turn change); arms after 1.2 s, then a worm within 26 px sets a 0.9 s fuse.
registerProj('mine', {
  r: 4,
  bounce: 0.2,
  fric: 0.5,
  spr: 'mine',
  passive: true,
  mine: true,
  beep: true,
  expl: { r: 34, d: 50 },
  impactSpeed: 260,
  impactFuse: 0.9,
  tick(p, dt) {
    if (p.fuse == null && p.age > 1.2)
      for (const w of G.worms)
        if (!w.dead && Math.hypot(w.x - p.x, w.y - p.y) < 26) {
          p.fuse = 0.9;
          p.trig = true;
          emit({ e: 'snd', s: 'beep' });
          break;
        }
    return true;
  },
});
// Air-strike bomb.
registerProj('bomb', { r: 3, grav: 0.8, hit: true, spr: 'bomb', expl: { r: 26, d: 35 } });
// Napalm bomb: small blast plus 16 flames.
registerProj('napbomb', {
  r: 3,
  grav: 0.8,
  hit: true,
  spr: 'bomb',
  col: '#ff8a1f',
  boom(p) {
    explode(p.x, p.y, 14, 8, 60, { fire: 16, src: p.ow });
  },
});
/**
 * Concrete Donkey: falls from the sky, explodes where it lands, then keeps hopping in the
 * thrower's facing direction and explodes again on every landing. It only stops when it
 * drops into the water or leaves the map (the "end of the floor"), or after MAX_HOPS.
 */
const DONKEY_MAX_HOPS = 40;
registerProj('donkey', {
  r: 9,
  grav: 0.8,
  spr: 'donkey',
  fixedAngle: true,
  // The donkey moves on the vertical axis only: it drops straight down at the targeted x, and every
  // landing blows a crater, hops up and falls again, digging a shaft until it leaves the map.
  tick(p, dt) {
    p.hops = p.hops || 0;
    p.cool = Math.max(0, (p.cool || 0) - dt);
    p.vx = 0;
    p.vy += GRAV * 0.8 * dt;
    // Move in small vertical steps so it cannot tunnel through thin ground.
    const dy = p.vy * dt,
      n = Math.max(1, Math.ceil(Math.abs(dy) / 3));
    let landed = false;
    for (let i = 0; i < n; i++) {
      const ny = p.y + dy / n;
      if (hitC(p.x, ny, p.r)) {
        landed = p.vy > 0; // hitting a ceiling just stops the climb
        p.vy = 0;
        break;
      }
      p.y = ny;
    }
    // Landing: blow up, then hop straight up and fall again.
    if (landed && p.cool <= 0) {
      const first = p.hops === 0;
      explode(p.x, p.y, first ? 64 : 52, first ? 100 : 75, 400, { k: 1, src: p.ow });
      p.hops++;
      if (p.hops > DONKEY_MAX_HOPS) {
        p.dead = true;
        return false;
      }
      p.vy = -300;
      p.cool = 0.3;
    }
    return false; // we integrated the motion ourselves
  },
});
/**
 * Dragon (Dragon Fire weapon): flies straight across the top of the level, slows down near the target
 * x (`tx`, within `span` px) and breathes flames downwards there. It never collides with anything.
 * `walk` is 1 while breathing so guests can draw the flame at its mouth.
 */
registerProj('dragon', {
  r: 12,
  spr: 'dragon',
  fixedAngle: true,
  tick(p, dt) {
    const near = Math.abs(p.x - p.tx) < p.span;
    p.x += p.face * (near ? 150 : 460) * dt;
    p.y = p.y0 + Math.sin(p.age * 3) * 6;
    p.walk = near ? 1 : 0;
    if (near) {
      p.acc = (p.acc || 0) + dt * 46;
      for (; p.acc >= 1; p.acc--)
        spawnFire(p.x + p.face * 34, p.y + 8, p.face * rnd(50, 150) + rnd(-50, 50), rnd(40, 220), rnd(3, 6));
      p.snd = (p.snd || 0) - dt;
      if (p.snd <= 0) {
        p.snd = 0.25;
        emit({ e: 'snd', s: 'launch' });
      }
    }
    if ((p.face > 0 && p.x > T.w + 140) || (p.face < 0 && p.x < -140)) p.dead = true;
    return false;
  },
});
/**
 * Tornado: wanders along the ground for 8 s. Worms near it are pulled in, lifted and flung out again;
 * the ones in the funnel take a little damage.
 */
registerProj('tornado', {
  r: 10,
  spr: 'tornado',
  fixedAngle: true,
  tick(p, dt) {
    if (p.age > 8) {
      p.dead = true;
      return false;
    }
    if (Math.random() < dt * 0.5) p.face = -p.face;
    p.x += p.face * 38 * dt;
    if (p.x < 20 || p.x > T.w - 20) p.face = -p.face;
    p.x = clamp(p.x, 20, T.w - 20);
    const gy = surfaceAt(p.x, p.y - 70);
    if (gy != null) p.y += clamp(gy - p.y, -80 * dt, 80 * dt);
    // Worms, mines and oil drums all get caught: pulled in, lifted, then flung out from the top.
    const things = [...G.worms.filter(o => !o.dead), ...G.projs.filter(q => PTYPES[q.t].mine), ...G.objs.filter(o => o.k === 'drum')];
    for (const w of things) {
      const dx = p.x - w.x,
        h = p.y - w.y; // height above the funnel's foot
      if (Math.abs(dx) > 95 || h < -30 || h > 190) continue;
      const isW = w.hp != null;
      w.grounded = false;
      w.rope = null;
      if (w.k === 'drum') w.air = 0.5;
      w.tw = (w.tw || 0) - dt;
      // inward pull plus a lift that fades out near the top, and a sideways swirl
      w.vx += clamp(dx, -60, 60) * 5 * dt + Math.sin(p.age * 5 + (w.id || 0)) * 160 * dt;
      if (h < 150 && w.vy > -190) w.vy -= 1500 * dt;
      if (h >= 150 && w.tw <= 0) {
        // thrown out from the top
        w.tw = 1.2;
        w.vx = (dx > 0 ? -1 : 1) * rnd(160, 300);
        w.vy = -rnd(60, 160);
        if (isW) hurt(w, rndi(8, 14), { noEnd: true, src: p.ow });
      }
      if (isW && Math.abs(dx) < 40) {
        // being spun in the funnel really hurts
        w.twd = (w.twd || 0) - dt;
        if (w.twd <= 0) {
          w.twd = 0.3;
          hurt(w, rndi(3, 5), { noEnd: true });
        }
      }
    }
    return false;
  },
});
/** Seconds Thor's Hammer charges before the strike. */
const HAMMER_CHARGE = 1.8;
/**
 * Thor's Hammer: held up in the caster's hand while it charges (`walk` goes 0..1, guests draw the sparks
 * from it; bolts from the sky keep hitting it). Then the charge leaps from the hammer to the marked worm
 * (followed until the last moment); nothing else follows. The bolt ends at the first ground or worm on the
 * way (lightningRay), so a hill or another worm between hammer and target takes the hit instead.
 */
registerProj('mjolnir', {
  r: 8,
  spr: 'mjolnir',
  fixedAngle: true,
  tick(p, dt) {
    const o = wById(p.ow);
    if (o && !o.dead) {
      p.x = o.x + (o.face || 1) * 7;
      p.y = o.y - 30 - Math.sin(p.age * 4) * 1.5;
    }
    p.walk = Math.min(1, p.age / HAMMER_CHARGE);
    if (!p.struck) {
      p.zap = (p.zap || 0) - dt;
      if (p.zap <= 0 && p.age < HAMMER_CHARGE) {
        p.zap = 0.45 - 0.25 * p.walk; // faster and faster
        emit({ e: 'arc', x1: p.x + rnd(-40, 40), y1: -10, x2: p.x, y2: p.y - 8, soft: 1 });
      }
    }
    if (!p.struck && p.age >= HAMMER_CHARGE) {
      p.struck = true;
      const t = p.tw >= 0 ? wById(p.tw) : null;
      if (t && !t.dead) p.tx = t.x;
      const x = clamp(p.tx, 8, T.w - 8);
      let y = surfaceAt(x);
      if (t && !t.dead) y = t.y;
      if (y == null) y = G.waterY - 4;
      // The bolt stops at the first thing in its way (ground, or another worm), like the Thunderstorm's bolts do.
      const end = lightningRay(p.x, p.y - 8, x, y, p.ow);
      emit({ e: 'arc', x1: p.x, y1: p.y - 8, x2: end.x, y2: end.y });
      // Impact scatters short lightning strikes in random directions.
      const branches = 7, originY = end.y - 8;
      for (let i = 0; i < branches; i++) {
        const angle = Math.random() * TAU,
          range = rnd(24, 58),
          tx = clamp(end.x + Math.cos(angle) * range, 4, T.w - 4),
          ty = clamp(originY + Math.sin(angle) * range, 4, G.waterY - 4),
          branch = lightningRay(end.x, originY, tx, ty, p.ow);
        emit({ e: 'arc', x1: end.x, y1: originY, x2: branch.x, y2: branch.y });
        explode(branch.x, branch.y, 9, 8, 55, { src: p.ow });
      }
      explode(end.x, end.y, 20, 32, 200, { src: p.ow, fire: 3 });
    }
    if (p.age >= HAMMER_CHARGE + 0.2) p.dead = true;
    return false;
  },
});
/** Time Car: drives forward along the ground, burning and knocking away every worm it meets. */
const CAR_MAX_AGE = 3.6;
registerProj('timecar', {
  r: 10,
  spr: 'timecar',
  fixedAngle: true,
  tick(p, dt) {
    const speed = 120 + Math.min(p.age, 0.9) * 480,
      nx = p.x + p.face * speed * dt,
      gy = surfaceAt(clamp(nx, 0, T.w - 1), p.y - 26);
    if (nx < -30 || nx > T.w + 30 || gy == null || gy > G.waterY - 6 || p.age > CAR_MAX_AGE) {
      if (p.age > 0.3) {
        p.dead = true;
        return false;
      }
    }
    if (gy != null) {
      p.wall = (p.wall || 0) - dt;
      if (gy < p.y - 18 && p.wall <= 0) {
        p.wall = 0.3; // a wall: blast through
        explode(p.x + p.face * 14, p.y - 4, 26, 18, 160, { src: p.ow, fire: 3 });
      }
      p.y += clamp(gy - 8 - p.y, -300 * dt, 1800 * dt);
    }
    p.x = nx;
    p.walk = 1;
    // flames: a fiery trail behind and a burning jet in front
    p.acc = (p.acc || 0) + dt * 40;
    for (; p.acc >= 1; p.acc--) {
      spawnFire(p.x - p.face * 14, p.y + 4, -p.face * rnd(10, 60), -rnd(10, 60), rnd(1.5, 3));
      spawnFire(p.x + p.face * 16, p.y - 2, p.face * rnd(80, 200), -rnd(10, 90), rnd(1, 2.5));
    }
    p.snd = (p.snd || 0) - dt;
    if (p.snd <= 0) {
      p.snd = 0.3;
      emit({ e: 'snd', s: 'launch' });
    }
    for (const w of G.worms) {
      if (w.dead || w.id === p.ow || p.hits[w.id]) continue;
      if (Math.abs(w.x - p.x) < 20 && Math.abs(w.y - p.y) < 38) {
        p.hits[w.id] = 1;
        explode(p.x + p.face * 10, p.y + 4, 16, 28, 420, { src: p.ow, fire: 6 });
        w.grounded = false;
        w.vx = p.face * 320;
        w.vy = Math.min(w.vy, -240);
      }
    }
    return false;
  },
});
// Armageddon meteor: fast, fiery, small blast plus a few flames.
registerProj('meteor', {
  r: 3,
  grav: 0.2,
  hit: true,
  spr: 'meteor',
  trail: 'fire',
  boom(p) {
    explode(p.x, p.y, 24, 25, 150, { fire: 4, src: p.ow });
  },
});
// Sheep: walks forward over the terrain (hopping obstacles) until detonated with Space or its 7 s fuse runs out.
registerProj('sheep', {
  r: 5,
  spr: 'sheep',
  ctl: true,
  fuse: 7,
  fixedAngle: true,
  expl: { r: 44, d: 75, k: 1 },
  tick(p, dt) {
    p.walk = (p.walk || 0) + dt * 8;
    if (p.grounded) {
      p.vy = 0;
      if (p.age % 0.6 < dt) emit({ e: 'snd', s: 'sheep', q: 1 });
      if (!walkStep(p, p.face * 62 * dt)) {
        if (p.age - (p.lastJ || -9) > 0.8) {
          p.grounded = false;
          p.vy = -230;
          p.vx = p.face * 60;
          p.lastJ = p.age;
        } else p.face *= -1;
      } else if (Math.random() < 0.004) {
        p.grounded = false;
        p.vy = -220;
        p.vx = p.face * 60;
      }
    } else {
      physBody(p, dt);
    }
    return false;
  },
});
// Super sheep: flies, steered with Left/Right, detonates on contact or with Space.
registerProj('supersheep', {
  r: 5,
  spr: 'ssheep',
  ctl: true,
  fuse: 9,
  fixedAngle: true,
  expl: { r: 50, d: 80, k: 1 },
  // Steering: the arrow keys name a heading (Right = 0, Down = 90 deg, Left = 180, Up = 270, and
  // the diagonals for two keys); the sheep turns towards it by the shortest way. With no key held
  // it keeps its course. Up/Down therefore work just like Left/Right.
  tick(p, dt) {
    const inp = curInp && p.ow === G.active ? curInp : null;
    if (inp && (inp.l || inp.r || inp.u || inp.d)) {
      const want = Math.atan2((inp.d ? 1 : 0) - (inp.u ? 1 : 0), (inp.r ? 1 : 0) - (inp.l ? 1 : 0));
      let diff = want - p.a;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest signed angle
      const turn = 4.2 * dt;
      p.a += Math.abs(diff) <= turn ? diff : Math.sign(diff) * turn;
    }
    p.vx = Math.cos(p.a) * 230;
    p.vy = Math.sin(p.a) * 230;
    const c = stepBody(p, dt);
    if (c) detonate(p);
    if (Math.random() < 0.9) emit({ e: 'trail', x: p.x, y: p.y, k: 'star', q: 1 });
    return false;
  },
});

/**
 * Kamehameha: charge time (s), beam head speed (px/s), tunnel radius (px), damage to a worm in the beam, how long the
 * full-length beam stays and how long its tail takes to sweep out (s), and how far from the muzzle the carving starts
 * (so the shooter keeps the ground under its feet).
 */
const KAME_CHARGE = 1.3,
  KAME_SPEED = 2000,
  KAME_R = 20,
  KAME_DMG = 75,
  KAME_HOLD = 0.7,
  KAME_FADE = 0.5,
  KAME_START = 26;
/** Distance from point (px, py) to the segment (x1, y1)-(x2, y2). */
function segDist(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1,
    vy = y2 - y1,
    l2 = vx * vx + vy * vy,
    t = l2 ? clamp(((px - x1) * vx + (py - y1) * vy) / l2, 0, 1) : 0;
  return Math.hypot(px - (x1 + vx * t), py - (y1 + vy * t));
}
/**
 * Releases the Kamehameha beam from worm `w` along its aim. The beam is a projectile that stays at the muzzle; its
 * geometry lives in p.net = [originX, originY, angle, headDistance, tailDistance, fullLength] (sent to guests as is).
 * The full length is the distance to the edge of the map (and a bit beyond), so it always crosses the whole level.
 */
function kameFire(w) {
  const [dx, dy] = aimDir(w),
    ox = w.x + dx * 10,
    oy = w.y - 2 + dy * 10,
    a = Math.atan2(dy, dx);
  let L = Infinity;
  if (dx > 1e-6) L = Math.min(L, (T.w + 60 - ox) / dx);
  else if (dx < -1e-6) L = Math.min(L, (-60 - ox) / dx);
  if (dy > 1e-6) L = Math.min(L, (T.h + 60 - oy) / dy);
  else if (dy < -1e-6) L = Math.min(L, (-420 - oy) / dy);
  spawnProj('kamebeam', ox, oy, 0, 0, w, { a, net: [ox, oy, a, 0, 0, L], hits: new Set(), cd: KAME_START });
  emit({ e: 'snd', s: 'kame' });
  emit({ e: 'flash', c: '#bfe6ff' });
  emit({ e: 'quake', t: 2 });
}
// Kamehameha beam: its head sweeps outwards, carving a tunnel (KAME_R) and wrecking whatever it meets once: worms
// (damage + shove along the beam), mines (detonate), oil drums (blow up) and crates (destroyed). After the head
// reached the map edge the beam holds for a moment, then its tail sweeps out after it.
registerProj('kamebeam', {
  r: 1,
  grav: 0,
  spr: 'kamebeam',
  fixedAngle: true,
  tick(p, dt) {
    const n = p.net,
      dx = Math.cos(n[2]),
      dy = Math.sin(n[2]);
    n[3] = Math.min(n[5], n[3] + KAME_SPEED * dt);
    while (p.cd <= n[3]) {
      const x = n[0] + dx * p.cd,
        y = n[1] + dy * p.cd;
      if (x > -KAME_R && x < T.w + KAME_R && y > -KAME_R && y < T.h + KAME_R) emit({ e: 'cv', x, y, r: KAME_R, s: 1 });
      p.cd += KAME_R / 2;
    }
    const x1 = n[0] + dx * n[4],
      y1 = n[1] + dy * n[4],
      x2 = n[0] + dx * n[3],
      y2 = n[1] + dy * n[3],
      once = (key, x, y, r) => {
        if (p.hits.has(key) || segDist(x, y, x1, y1, x2, y2) >= KAME_R + r) return false;
        p.hits.add(key);
        return true;
      };
    for (const o of G.worms)
      if (!o.dead && o.id !== p.ow && once('w' + o.id, o.x, o.y, o.r)) {
        hurt(o, KAME_DMG, { src: p.ow, noEnd: true });
        o.vx += dx * 520;
        o.vy += dy * 520 - 140;
        o.grounded = false;
        o.rope = null;
      }
    for (const q of [...G.projs]) if (q.t === 'mine' && !q.dead && once('p' + q.id, q.x, q.y, q.r)) detonate(q);
    for (const o of G.objs) {
      if (o.kill || !once('o' + o.id, o.x, o.y, o.r || 7)) continue;
      if (o.k === 'drum') o.lit = o.lit > 0 ? Math.min(o.lit, 0.05) : 0.05;
      else o.kill = true;
    }
    if (n[3] >= n[5]) {
      p.hold = (p.hold || 0) + dt;
      if (p.hold > KAME_HOLD) {
        n[4] = Math.min(n[5], n[4] + (n[5] / KAME_FADE) * dt);
        if (n[4] >= n[5]) p.dead = true;
      }
    }
    return false;
  },
});

/**
 * Proton Stream: seconds the rifles are raised before firing, how long the streams burn, how long they take to die
 * down, the time between damage ticks, the farthest a stream reaches (px), the damage per tick by number of streams
 * that reach the target (0, 1, 2 = crossed, 3 = crossed by all three), and the shooters (the caster + the nearest
 * teammates) allowed in one Stream.
 */
const PROTON_EQUIP = 0.7,
  PROTON_FIRE = 2.4,
  PROTON_FADE = 0.3,
  PROTON_TICK = 0.3,
  PROTON_RANGE = 450,
  PROTON_DMG = [0, 2, 6, 10],
  PROTON_SHOOTERS = 3;
/**
 * Walks a stream from (x1, y1) towards (x2, y2) in 3 px steps and returns where it ends: the first solid pixel or the
 * first living worm other than the shooters (`skip` = their ids) on the way, else the aimed point.
 * @returns {{x: number, y: number, hit: 'ground'|'worm'|null, worm?: object}}
 */
function streamRay(x1, y1, x2, y2, skip) {
  const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 3));
  for (let i = 0; i <= n; i++) {
    const x = x1 + ((x2 - x1) * i) / n,
      y = y1 + ((y2 - y1) * i) / n;
    if (solid(x, y)) return { x, y, hit: 'ground' };
    const o = G.worms.find(q => !q.dead && !skip.includes(q.id) && Math.abs(q.x - x) < 9 && Math.abs(q.y - y) < 8);
    if (o) return { x, y, hit: 'worm', worm: o };
  }
  return { x: x2, y: y2, hit: null };
}
/**
 * The streams of a Proton Stream projectile (p.net = [target, age, ...shooters]): one per living shooter, with its
 * muzzle, where the stream really ends (ground / another worm / out of range stop it) and whether it is `connected`
 * to the locked target. Host and guests both call this, so everybody sees the same streams. null when the target or
 * every shooter is gone.
 */
function protonGeom(p) {
  const ids = p.net.slice(2),
    t = wById(p.net[0]),
    shooters = ids.map(wById).filter(s => s && !s.dead);
  if (!t || !shooters.length) return null;
  const streams = shooters.map(s => {
    const f = t.x >= s.x ? 1 : -1,
      mx = s.x + f * 9,
      my = s.y - 4,
      d = Math.hypot(t.x - mx, t.y - my),
      k = d > PROTON_RANGE ? PROTON_RANGE / d : 1,
      r = streamRay(mx, my, mx + (t.x - mx) * k, my + (t.y - my) * k, ids);
    return { x: mx, y: my, ex: r.x, ey: r.y, hit: r.hit, worm: r.worm, connected: d <= PROTON_RANGE && (!r.hit || (r.hit === 'worm' && r.worm === t)) };
  });
  return { streams, t, shooters, n: streams.filter(s => s.connected).length };
}
/** The Proton Stream projectile in which worm `w` is one of the shooters, if any (drawn with a rifle). */
const protonRig = w => G.projs.find(p => p.t === 'proton' && !p.dead && p.net && p.net.indexOf(w.id, 2) >= 2);
// Proton Stream: the caster and up to two nearby teammates shoulder proton rifles and burn one locked worm. Every tick
// the target takes PROTON_DMG[n] where n is the number of streams that reach it (crossed streams from 2 up); at the
// end of the burn, if at least two still connect, the crossed streams detonate at the target (bigger with three).
// A stream stopped by ground or by another worm does not reach the target (a worm in the way is burnt instead). The
// shooters stand still and face the target; the lock follows it. A shooter that dies simply drops out.
registerProj('proton', {
  r: 1,
  grav: 0,
  spr: 'proton',
  fixedAngle: true,
  tick(p, dt) {
    p.life = (p.life || 0) + dt;
    p.net[1] = p.life;
    const g = protonGeom(p),
      end = PROTON_EQUIP + PROTON_FIRE;
    if (!g || g.t.dead) {
      p.dead = true;
      return false;
    }
    for (const s of g.shooters) {
      s.vx = 0;
      s.face = g.t.x >= s.x ? 1 : -1;
    }
    if (p.life >= PROTON_EQUIP && p.life < end) {
      p.tk = (p.tk || 0) + dt;
      while (p.tk >= PROTON_TICK) {
        p.tk -= PROTON_TICK;
        if (g.n) hurt(g.t, PROTON_DMG[Math.min(g.n, PROTON_DMG.length - 1)], { src: p.ow, noEnd: true });
        for (const s of g.streams) if (s.hit === 'worm' && s.worm !== g.t) hurt(s.worm, PROTON_DMG[1], { src: p.ow, noEnd: true });
        emit({ e: 'snd', s: 'zap' });
      }
    } else if (p.life >= end && !p.burst) {
      p.burst = true;
      if (g.n >= 2) explode(g.t.x, g.t.y, 34 + 6 * (g.n - 2), 30 + 10 * (g.n - 2), 300, { src: p.ow, fire: 3, noEnd: true });
    }
    if (p.life >= end + PROTON_FADE) p.dead = true;
    return false;
  },
});
