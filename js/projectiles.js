'use strict';

/**
 * @file projectiles.js - Projectiles
 *
 * Projectile spawning/updating and the data-driven projectile types (rocket, grenade, sheep,
 * donkey ...). Each type is a registerProj() record: physics flags, optional tick() hook and
 * boom()/expl explosion data.
 *
 * Depends on: core, combat, collision
 * Globals defined: spawnProj, spawnFire, detonate, updateProj, fuseTick, gr, DONKEY_MAX_HOPS, HAMMER_CHARGE, CAR_MAX_AGE
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
  const c = stepBody(p, dt);
  if (!d.fixedAngle) p.a = Math.atan2(p.vy, p.vx);
  if (c) {
    if (d.hit) {
      detonate(p);
      return;
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
  grav: 0,
  wind: 0.2,
  hit: true,
  spr: 'rocket',
  trail: 'smoke',
  fuse: 9,
  fixedAngle: true,
  tick(p, dt) {
    const tx = p.tx,
      ty = p.ty;
    if (tx != null) {
      const want = Math.atan2(ty - p.y, tx - p.x);
      let df = want - p.a;
      while (df > Math.PI) df -= TAU;
      while (df < -Math.PI) df += TAU;
      p.a += clamp(df, -2.6 * dt, 2.6 * dt);
    }
    const s = Math.min(340, 120 + p.age * 400);
    p.vx = Math.cos(p.a) * s;
    p.vy = Math.sin(p.a) * s;
    p.vx += G.wind * WIND_ACC * 0.2 * dt;
    const c = stepBody(p, dt);
    if (c) detonate(p);
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
    for (const w of G.worms) {
      if (w.dead) continue;
      const dx = p.x - w.x,
        h = p.y - w.y; // height above the funnel's foot
      if (Math.abs(dx) > 95 || h < -30 || h > 190) continue;
      w.grounded = false;
      w.rope = null;
      w.tw = (w.tw || 0) - dt;
      // inward pull plus a lift that fades out near the top, and a sideways swirl
      w.vx += clamp(dx, -60, 60) * 5 * dt + Math.sin(p.age * 5 + w.id) * 160 * dt;
      if (h < 150 && w.vy > -190) w.vy -= 1500 * dt;
      if (h >= 150 && w.tw <= 0) {
        // thrown out from the top
        w.tw = 1.2;
        w.vx = (dx > 0 ? -1 : 1) * rnd(160, 300);
        w.vy = -rnd(60, 160);
      }
      if (Math.abs(dx) < 40) {
        w.twd = (w.twd || 0) - dt;
        if (w.twd <= 0) {
          w.twd = 0.5;
          if (w.hp > 2) hurt(w, 1, { noEnd: true });
        }
      }
    }
    return false;
  },
});
/** Seconds Thor's Hammer charges before the strike. */
const HAMMER_CHARGE = 1.8;
/**
 * Thor's Hammer: hovers over its caster while charging (`walk` goes 0..1, guests draw the sparks from it),
 * then strikes the chosen worm (it follows him until the last moment) with a big bolt, and lesser bolts
 * around it a moment later.
 */
registerProj('mjolnir', {
  r: 8,
  spr: 'mjolnir',
  fixedAngle: true,
  tick(p, dt) {
    const o = wById(p.ow);
    if (o && !o.dead) {
      p.x = o.x;
      p.y = o.y - 38 - Math.sin(p.age * 4) * 2;
    }
    p.walk = Math.min(1, p.age / HAMMER_CHARGE);
    if (!p.struck && p.age >= HAMMER_CHARGE) {
      p.struck = true;
      const t = p.tw >= 0 ? wById(p.tw) : null;
      if (t && !t.dead) p.tx = t.x;
      const x = clamp(p.tx, 8, T.w - 8);
      let y = surfaceAt(x);
      if (t && !t.dead) y = t.y;
      if (y == null) y = G.waterY - 4;
      emit({ e: 'bolt', x, y });
      emit({ e: 'flash', c: '#e8f2ff' });
      explode(x, y, 42, 70, 360, { k: 1, src: p.ow, fire: 5 });
      for (let i = 0; i < 4; i++) sched(0.25 + i * 0.25, () => lightningBolt(clamp(x + rnd(-90, 90), 8, T.w - 8), o));
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
