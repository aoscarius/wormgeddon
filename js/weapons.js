'use strict';

/**
 * @file weapons.js - Weapons
 *
 * The weapon catalogue (registerWeapon records), firing helpers (rays, melee, air strikes),
 * weapon selection and the fire/charge state machine.
 *
 * Depends on: core, projectiles, combat, worms
 * Globals defined: muzzle, throwP, ray, melee, strike, surfaceAt, lightningRay, lightningBolt, quakeTick, tsunamiTick, cycleWorm,
 *     selectWeapon, holdingOther, handleFire, clickTarget, doFire
 */

/* ===== Weapons ===== */
/** Point just in front of the worm's hands along the aim direction: [x, y, dirX, dirY]. */
function muzzle(w) {
  const [dx, dy] = aimDir(w);
  return [w.x + dx * 10, w.y - 2 + dy * 10, dx, dy];
}
/**
 * Factory for thrown/launched projectile weapons: returns a fire() that spawns projectile `type`
 * with speed interpolated from lo to hi by the charge power (fuse taken from the 1-5 keys).
 */
function throwP(type, lo, hi, extra) {
  const fn = c => {
    const w = c.w,
      [mx, my, dx, dy] = muzzle(w),
      sp = lo + (hi - lo) * c.power;
    const e = Object.assign({}, extra || {});
    if (PTYPES[type].fuse != null && WEAPONS[c.wdef.id].fuse) e.fuse = G.weapon.fuse;
    return spawnProj(type, mx, my, dx * sp, dy * sp, w, e);
  };
  fn.launch = { type, lo, hi }; // lets the debug view predict the flight (see drawTrajectories)
  return fn;
}
/**
 * Instant-hit shot (shotgun, handgun, uzi): walks along the ray in 3 px steps and stops at the
 * first worm (damage + knockback) or terrain (tiny crater). Emits a tracer for the visuals.
 * @param {number} len max range;  dmg damage;  push knockback;  cr crater radius
 */
function ray(w, ang, len, dmg, push, cr) {
  let x = w.x + Math.cos(ang) * 8,
    y = w.y - 2 + Math.sin(ang) * 8,
    hw = null;
  const sx = x,
    sy = y;
  const dx = Math.cos(ang) * 3,
    dy = Math.sin(ang) * 3;
  for (let d = 0; d < len; d += 3) {
    x += dx;
    y += dy;
    for (const o of G.worms)
      if (!o.dead && o !== w && Math.abs(o.x - x) < 6 && Math.abs(o.y - y) < 8) {
        hw = o;
        break;
      }
    if (hw) break;
    if (solid(x, y)) {
      emit({ e: 'cv', x, y, r: cr, s: 0 });
      break;
    }
  }
  emit({ e: 'shot', x1: sx, y1: sy, x2: x, y2: y });
  if (hw) {
    hurt(hw, dmg, { src: w.id });
    hw.vx += Math.cos(ang) * push;
    hw.vy += Math.sin(ang) * push - 40;
    hw.grounded = false;
    hw.rope = null;
  } else if (y > G.waterY) emit({ e: 'splash', x, y: G.waterY });
}
/**
 * Close-range attack on worms within `o.reach` in front of the attacker.
 * o: reach, dmg, push (launch speed), fixed (launch along aim instead of up-and-forward),
 * cr (crater at the victim), k (visual style), self (the attacker lunges too).
 */
function melee(w, o) {
  const [dx, dy] = aimDir(w);
  let hit = false;
  for (const t of G.worms) {
    if (t === w || t.dead) continue;
    const rx = t.x - w.x,
      ry = t.y - w.y;
    if (Math.hypot(rx, ry) < o.reach && rx * w.face > -4) {
      hit = true;
      hurt(t, o.dmg, { src: w.id });
      const a = o.fixed ? Math.atan2(dy, dx) : Math.atan2(-0.9, w.face * 0.6);
      t.vx += Math.cos(a) * o.push;
      t.vy += Math.sin(a) * o.push;
      t.grounded = false;
      t.rope = null;
      if (o.cr) emit({ e: 'cv', x: t.x, y: t.y, r: o.cr, s: 1 });
    }
  }
  emit({ e: 'punch', x: w.x + w.face * 12, y: w.y - 2, k: o.k, f: w.face });
  if (hit) emit({ e: 'snd', s: 'hurt' });
  if (o.self) {
    w.vx = w.face * 120;
    w.vy = -260;
    w.grounded = false;
  }
}
/**
 * Click-targeted air strike: emits a plane and schedules `n` projectiles of `type` spread
 * `spread` px apart, flying in the thrower's facing direction at horizontal speed vx.
 */
function strike(c, n, type, spread, vx, extra) {
  const tx = c.target.x,
    dir = c.w.face || 1;
  emit({ e: 'plane', x: tx, dir });
  for (let i = 0; i < n; i++)
    sched(0.7 + i * 0.13, () => {
      spawnProj(
        type,
        tx + (i - (n - 1) / 2) * spread * dir,
        -90,
        dir * vx,
        160,
        c.w,
        Object.assign({ ow: c.w.id }, extra || {})
      );
    });
}

// Bazooka: charge for power; the rocket is pushed by the wind.
registerWeapon({
  id: 'bazooka',
  name: 'Bazooka',
  code: 'BZ',
  ammo: -1,
  delay: 0,
  charge: true,
  fire: throwP('rocket', 140, 800),
});
// Homing missile: set a target with a map click first, then charge and fire.
registerWeapon({
  id: 'homing',
  name: 'Homing Missile',
  code: 'HM',
  ammo: 2,
  delay: 1,
  charge: true,
  click: true,
  needTarget: true,
  fire(c) {
    const [mx, my, dx, dy] = muzzle(c.w), speed = 140 + (800 - 140) * c.power;
    return spawnProj('homing', mx, my, dx * speed, dy * speed, c.w, {
      tx: G.weapon.tx,
      ty: G.weapon.ty,
      a: Math.atan2(dy, dx),
      spd: speed,
    });
  },
});
// Mortar: high arcing shell that splits into bomblets.
registerWeapon({
  id: 'mortar',
  name: 'Mortar',
  code: 'MT',
  ammo: 4,
  delay: 1,
  charge: true,
  fire: throwP('mortar', 150, 780),
});
// Grenade: charge to throw, keys 1-5 set the fuse.
registerWeapon({
  id: 'grenade',
  name: 'Grenade',
  code: 'GR',
  ammo: -1,
  delay: 0,
  charge: true,
  fuse: true,
  fire: throwP('grenade', 60, 640),
});
// Cluster bomb: grenade that scatters fragments.
registerWeapon({
  id: 'cluster',
  name: 'Cluster Bomb',
  code: 'CB',
  ammo: 3,
  delay: 0,
  charge: true,
  fuse: true,
  fire: throwP('cluster', 60, 620),
});
// Banana bomb: very bouncy cluster of bananas (unlocks in round 4).
registerWeapon({
  id: 'banana',
  name: 'Banana Bomb',
  code: 'BN',
  ammo: 2,
  delay: 3,
  charge: true,
  fuse: true,
  fire: throwP('banana', 60, 600),
});
// Holy Hand Grenade: the biggest grenade (unlocks in round 5).
registerWeapon({
  id: 'holy',
  name: 'Holy Hand Grenade',
  code: 'HH',
  ammo: 1,
  delay: 4,
  charge: true,
  fuse: true,
  fire: throwP('holy', 60, 600),
});
// Petrol bomb: bursts into flames on impact.
registerWeapon({
  id: 'petrol',
  name: 'Petrol Bomb',
  code: 'PB',
  ammo: 2,
  delay: 1,
  charge: true,
  fire: throwP('petrol', 80, 560),
});
// Dynamite: dropped at the feet, 5 s fuse.
registerWeapon({
  id: 'dynamite',
  name: 'Dynamite',
  code: 'DY',
  ammo: 2,
  delay: 0,
  fire(c) {
    return spawnProj('dynamite', c.w.x + c.w.face * 8, c.w.y, c.w.face * 40, -60, c.w);
  },
});
// Mine: dropped at the feet, arms itself, triggers when a worm gets close.
registerWeapon({
  id: 'mine',
  name: 'Mine',
  code: 'MN',
  ammo: 3,
  delay: 0,
  fire(c) {
    return spawnProj('mine', c.w.x + c.w.face * 8, c.w.y, c.w.face * 40, -60, c.w);
  },
});
// Sheep: walks forward and hops obstacles; press Space again to detonate.
registerWeapon({
  id: 'sheep',
  name: 'Sheep',
  code: 'SH',
  ammo: 2,
  delay: 1,
  fire(c) {
    return spawnProj('sheep', c.w.x + c.w.face * 8, c.w.y, 0, 0, c.w, { grounded: false });
  },
});
// Super sheep: flies and can be steered; Space detonates.
registerWeapon({
  id: 'supersheep',
  name: 'Super Sheep',
  code: 'SS',
  ammo: 1,
  delay: 3,
  fire(c) {
    const [mx, my, dx, dy] = muzzle(c.w);
    return spawnProj('supersheep', mx, my - 4, 0, 0, c.w, { a: Math.atan2(dy, dx) });
  },
});
// Shotgun: two instant shots (ray hits, 20 damage each).
registerWeapon({
  id: 'shotgun',
  name: 'Shotgun',
  code: 'SG',
  ammo: -1,
  delay: 0,
  shots: 2,
  fire(c) {
    const w = c.w;
    emit({ e: 'snd', s: 'shot' });
    for (let i = 0; i < 2; i++) {
      const [dx, dy] = aimDir(w),
        a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.04;
      ray(w, a, 330, 20, 150, 7);
    }
  },
});
// Handgun: burst of six accurate bullets.
registerWeapon({
  id: 'handgun',
  name: 'Handgun',
  code: 'HG',
  ammo: 4,
  delay: 0,
  fire(c) {
    const w = c.w;
    for (let i = 0; i < 6; i++)
      sched(i * 0.13, () => {
        if (w.dead) return;
        emit({ e: 'snd', s: 'shot' });
        const [dx, dy] = aimDir(w);
        ray(w, Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.06, 300, 8, 60, 4);
      });
  },
});
// Uzi: 24 fast, inaccurate bullets.
registerWeapon({
  id: 'uzi',
  name: 'Uzi',
  code: 'UZ',
  ammo: 3,
  delay: 1,
  fire(c) {
    const w = c.w;
    for (let i = 0; i < 24; i++)
      sched(i * 0.05, () => {
        if (w.dead) return;
        if (i % 3 === 0) emit({ e: 'snd', s: 'shot' });
        const [dx, dy] = aimDir(w);
        ray(w, Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.16, 280, 3, 30, 3);
      });
  },
});
// Fire punch: close-range uppercut that launches the victim.
registerWeapon({
  id: 'firepunch',
  name: 'Fire Punch',
  code: 'FP',
  ammo: -1,
  delay: 0,
  fire(c) {
    melee(c.w, { reach: 24, dmg: 30, push: 470, k: 'fire', self: true });
  },
});
// Dragon ball: stronger punch that also digs a small hole.
registerWeapon({
  id: 'dragonball',
  name: 'Dragon Ball',
  code: 'DB',
  ammo: 2,
  delay: 1,
  fire(c) {
    melee(c.w, { reach: 34, dmg: 30, push: 620, k: 'dragon', cr: 14, self: true });
  },
});
// Baseball bat: huge knockback along the aim direction.
registerWeapon({
  id: 'bat',
  name: 'Baseball Bat',
  code: 'BT',
  ammo: 2,
  delay: 2,
  fire(c) {
    melee(c.w, { reach: 22, dmg: 25, push: 820, k: 'bat', fixed: true });
  },
});
// Kamikaze: the worm flies along the aim line and explodes on contact.
registerWeapon({
  id: 'kamikaze',
  name: 'Kamikaze',
  code: 'KZ',
  ammo: 2,
  delay: 1,
  noEnd: true,
  fire(c) {
    c.w.tool = { k: 'kami', t: 1.3 };
    c.w.grounded = false;
    emit({ e: 'snd', s: 'launch' });
    return 'keep';
  },
});
// Hokuto Hyakuretsu Ken: a gatling of punches on the worm in front, then a dash past it and "Tu sei già morto".
// The worm that was hit explodes and dies 3 s after the last blow (see hyakuTick / doomBlast in worms.js).
registerWeapon({
  id: 'hokuto',
  name: 'Hokuto Hyakuretsu Ken',
  code: 'HK',
  ammo: 1,
  delay: 4,
  noEnd: true,
  fire(c) {
    c.w.tool = { k: 'hyaku', t: 99, p: 0 };
    return 'keep';
  },
});
// Thanos' Gauntlet (extremely rare, crates only): the worm snaps its fingers and every worm in range, itself included,
// turns to dust that the wind blows away (see snapTick / dustTick in worms.js).
registerWeapon({
  id: 'thanos',
  name: "Thanos' Gauntlet",
  code: 'TG',
  ammo: 0,
  delay: 0,
  rare: true,
  noEnd: true,
  fire(c) {
    emit({ e: 'snd', s: 'inevitable' });
    c.w.tool = { k: 'snap', t: 99, p: 0 };
    return 'keep';
  },
});
// Matrix "Bullet Time": the world slows to BT_SLOW for BT_TIME s while the caster keeps full speed and cannot be hurt; with the
// weapon still selected, holding Fire sends a barrage of fast rounds that freeze in mid-air and speed up again when it ends.
registerWeapon({
  id: 'bullettime',
  name: 'Bullet Time',
  code: 'BT',
  ammo: 1,
  delay: 6,
  noEnd: true,
  fire(c) {
    if (G.bt && G.bt.t > 0) return 'miss';
    G.bt = { id: c.w.id, t: BT_TIME, cd: 0 };
    G.timer = 3 + BT_TIME;
    emit({ e: 'snd', s: 'bullettime' });
    emit({ e: 'msg', t: 'Bullet Time' });
    c.w.tool = { k: 'bt', t: 99, p: 0 };
    return 'keep';
  },
});
// Rasenshuriken: charge to throw a spinning wind shuriken (pushed by the wind); where it lands, or when Fire is pressed again
// in flight, it becomes a vortex that erodes the ground to dust, hurts and blows worms outward (see 'rasen' in projectiles.js).
registerWeapon({
  id: 'rasenshuriken',
  name: 'Rasenshuriken',
  code: 'RS',
  ammo: 1,
  delay: 5,
  charge: true,
  fire(c) {
    emit({ e: 'snd', s: 'whoosh' });
    return throwP('rasen', 250, 800)(c);
  },
});
// Shadow Clone Jutsu: smoke, and CLONE_N clones of the caster appear at random standing spots across the map. They look like
// worms of the team, always show full health and vanish when hit, wasting the attacker's turn (see spawnClone / clonePoof).
registerWeapon({
  id: 'shadowclone',
  name: 'Shadow Clone Jutsu',
  code: 'SC',
  ammo: 1,
  delay: 4,
  noEnd: true,
  instant: true,
  fire(c) {
    const taken = G.worms.filter(o => !o.dead).map(o => [o.x, o.y]);
    emit({ e: 'snd', s: 'poof' });
    emit({ e: 'poof', x: c.w.x, y: c.w.y - 4 });
    let n = 0;
    for (let i = 0; i < CLONE_N; i++) {
      const p = findSpot(taken, 60) || findSpot(taken, 20);
      if (!p) break;
      taken.push(p);
      spawnClone(c.w, p[0], p[1]);
      n++;
    }
    if (!n) {
      emit({ e: 'msg', t: 'No room for clones' });
      return 'miss';
    }
  },
});
// Force Choke: click a worm within FORCE_RANGE px; the caster raises an arm while the track plays, the worm is lifted into the
// air and choked (damage and blood), then flung away and hurt again when it hits the terrain (see forceTick in worms.js).
registerWeapon({
  id: 'forcechoke',
  name: 'Force Choke',
  code: 'FC',
  ammo: 1,
  delay: 8,
  click: true,
  instant: true,
  noEnd: true,
  fire(c) {
    let tw = null,
      best = 70;
    for (const o of G.worms) {
      if (o.dead || o === c.w) continue;
      const d = Math.hypot(o.x - c.target.x, o.y - c.target.y);
      if (d < best) {
        best = d;
        tw = o;
      }
    }
    if (!tw) {
      emit({ e: 'msg', t: 'Click a worm' });
      return 'miss';
    }
    if (Math.hypot(tw.x - c.w.x, tw.y - c.w.y) > FORCE_RANGE) {
      emit({ e: 'msg', t: 'Target too far' });
      return 'miss';
    }
    c.w.face = tw.x >= c.w.x ? 1 : -1;
    emit({ e: 'mark', x: tw.x, y: tw.y - 20 });
    emit({ e: 'snd', s: 'forcechoke' });
    c.w.tool = { k: 'force', t: 99, p: 0, tw: tw.id };
    return 'keep';
  },
});
// Avada Kedavra: click a worm; the wand points at it while the incantation plays, then a green beam finds its way through
// the open air around the terrain to the target and kills it on the spot. If it is walled in, the beam dies on the ground.
registerWeapon({
  id: 'avada',
  name: 'Avada Kedavra',
  code: 'AK',
  ammo: 1,
  delay: 8,
  click: true,
  instant: true,
  noEnd: true,
  fire(c) {
    // the target is the living worm closest to the click (within 70 px)
    let tw = null,
      best = 70;
    for (const o of G.worms) {
      if (o.dead || o === c.w) continue;
      const d = Math.hypot(o.x - c.target.x, o.y - c.target.y);
      if (d < best) {
        best = d;
        tw = o;
      }
    }
    if (!tw) {
      emit({ e: 'msg', t: 'Click a worm' });
      return 'miss';
    }
    c.w.face = tw.x >= c.w.x ? 1 : -1;
    emit({ e: 'say', x: c.w.x, y: c.w.y - 24, t: tr('Avada Kedavra!') });
    emit({ e: 'mark', x: tw.x, y: tw.y - 20 });
    emit({ e: 'snd', s: 'avada' });
    c.w.tool = { k: 'wand', t: 99, p: 0, tw: tw.id };
    return 'keep';
  },
});
// Gandalf's Staff: the track plays while the worm raises its staff; STAFF_DELAY s later it slams the staff down and the
// ground in front collapses into the sea (see staffTick / staffSlam in worms.js).
registerWeapon({
  id: 'gandalf',
  name: "Gandalf's Staff",
  code: 'GS',
  ammo: 1,
  delay: 5,
  noEnd: true,
  fire(c) {
    c.w.tool = { k: 'staff', t: 99, p: 0 };
    emit({ e: 'snd', s: 'gandalf' });
    emit({ e: 'say', x: c.w.x, y: c.w.y - 24, t: tr('You shall not pass!') });
    return 'keep';
  },
});
// Kamehameha: the worm charges an energy ball (4.5 s, aim locked when it starts), then fires a beam across the whole map
// along the aim (extra presses of Fire during the charge widen it x2 / x3, costing 1 more ammo each) that carves a tunnel and wrecks worms, mines, oil drums and crates (see kameFire / kamebeam).
registerWeapon({
  id: 'kamehameha',
  name: 'Kamehameha',
  code: 'KH',
  ammo: 1,
  delay: 6,
  noEnd: true,
  fire(c) {
    emit({ e: 'snd', s: 'kamevoice' });
    c.w.tool = { k: 'kame', t: 99, p: 0, a: c.w.aim, f: c.w.face, lv: 1 }; // the aim is locked for the whole charge
    return 'keep';
  },
});
// Oni Giri (Zoro's Ogre Cutter): three swords out, a short charge, then a dash straight ahead that slices every worm
// it passes through on the spot (see oniTick in worms.js).
registerWeapon({
  id: 'onigiri',
  name: 'Oni Giri',
  code: 'OG',
  ammo: 1,
  delay: 4,
  noEnd: true,
  fire(c) {
    c.w.tool = { k: 'oni', t: 99, p: 0 };
    return 'keep';
  },
});
// Proton Stream: click an enemy worm to lock on. The caster and the (up to two) living teammates closest to it shoulder
// proton rifles and burn the target; the streams cross at the target (see the 'proton' projectile). Needs a teammate.
registerWeapon({
  id: 'proton',
  name: 'Proton Stream',
  code: 'PS',
  ammo: 1,
  delay: 6,
  click: true,
  instant: true,
  noEnd: true,
  fire(c) {
    // the target is the living enemy worm closest to the click (within 70 px)
    let tw = null,
      best = 70;
    for (const o of G.worms) {
      if (o.dead || o.team === c.w.team) continue;
      const d = Math.hypot(o.x - c.target.x, o.y - c.target.y);
      if (d < best) {
        best = d;
        tw = o;
      }
    }
    if (!tw) {
      emit({ e: 'msg', t: 'Click an enemy worm' });
      return 'miss';
    }
    const inRange = o => Math.hypot(o.x - tw.x, o.y - tw.y) <= PROTON_MAX_DIST;
    const teammates = G.worms.filter(
      o => !o.dead && !o.sunk && o !== c.w && o.team === c.w.team
    );
    // Show this only when the team has no other living worms.
    if (!teammates.length) {
      emit({ e: 'msg', t: 'Needs a teammate' });
      return 'miss';
    }
    // the partners are the living teammates closest to the caster: with a bigger team, the nearest two (three shooters)
    const mates = teammates
      .filter(inRange)
      .sort((p, q) => Math.hypot(p.x - c.w.x, p.y - c.w.y) - Math.hypot(q.x - c.w.x, q.y - c.w.y))
      .slice(0, PROTON_SHOOTERS - 1);
    // The caster and at least one teammate must be within range.
    if (!inRange(c.w) || mates.length < 1) {
      emit({ e: 'msg', t: 'At least two worms must be within {0} px of the target', a: [PROTON_MAX_DIST] });
      return 'miss';
    }
    emit({ e: 'msg', t: 'Proton stream' });
    emit({ e: 'mark', x: tw.x, y: tw.y - 20 });
    emit({ e: 'snd', s: 'proton' });
    c.w.tool = { k: 'proton', t: 99, p: 0 };
    spawnProj('proton', c.w.x, c.w.y, 0, 0, c.w, { ow: c.w.id, net: [tw.id, 0, c.w.id, ...mates.map(m => m.id)] });
    return 'keep';
  },
});
// Gomu Gomu no Gigant Axe (Luffy): the worm raises a foot that grows huge, then slams it down 90 px ahead, crushing
// everything within 50 px (see axeTick / axeCrush in worms.js).
registerWeapon({
  id: 'gigantaxe',
  name: 'Gomu Gomu no Gigant Axe',
  code: 'GG',
  ammo: 1,
  delay: 5,
  noEnd: true,
  fire(c) {
    c.w.tool = { k: 'axe', t: 99, p: 0 };
    return 'keep';
  },
});
// Air strike: click a target; a plane drops five bombs.
registerWeapon({
  id: 'airstrike',
  name: 'Air Strike',
  code: 'AS',
  ammo: 1,
  delay: 2,
  click: true,
  instant: true,
  fire(c) {
    strike(c, 5, 'bomb', 30, 90);
  },
});
// Napalm strike: click a target; burning bombs.
registerWeapon({
  id: 'napalm',
  name: 'Napalm Strike',
  code: 'NP',
  ammo: 1,
  delay: 3,
  click: true,
  instant: true,
  fire(c) {
    strike(c, 7, 'napbomb', 24, 100);
  },
});
// Mine strike: click a target; the plane drops five mines.
registerWeapon({
  id: 'minestrike',
  name: 'Mine Strike',
  code: 'MS',
  ammo: 1,
  delay: 3,
  click: true,
  instant: true,
  fire(c) {
    strike(c, 5, 'mine', 34, 80);
  },
});
// Concrete Donkey: click a target; it lands, explodes, and keeps hopping and exploding to the end of the floor.
registerWeapon({
  id: 'donkey',
  name: 'Concrete Donkey',
  code: 'CD',
  ammo: 1,
  delay: 5,
  click: true,
  instant: true,
  fire(c) {
    const tx = c.target.x;
    emit({ e: 'snd', s: 'boom' });
    // The donkey falls straight down at the target and keeps digging down; facing only flips its sprite.
    sched(0.6, () => spawnProj('donkey', tx, -160, 0, 120, c.w, { ow: c.w.id }));
  },
});
// Armageddon: meteors rain on the whole map for about 11 s.
registerWeapon({
  id: 'armageddon',
  name: 'Armageddon',
  code: 'AR',
  ammo: 1,
  delay: 7,
  instant: true,
  fire(c) {
    G.arma = 11;
    emit({ e: 'flash', c: '#ff7a30' });
    emit({ e: 'msg', t: 'ARMAGEDDON' });
  },
});
// Nuclear test: hurts every worm (leaves at least 1 HP), max wind, water rises.
registerWeapon({
  id: 'nuke',
  name: 'Nuclear Test',
  code: 'NK',
  ammo: 1,
  delay: 7,
  instant: true,
  fire(c) {
    emit({ e: 'flash', c: '#ffffff' });
    emit({ e: 'nuke' });
    emit({ e: 'snd', s: 'boom', r: 90 });
    for (const w of G.worms)
      if (!w.dead) {
        const d = Math.min(w.hp - 1, rndi(35, 65));
        if (d > 0) {
          w.hp -= d;
          w.pend += d;
        }
        w.rad = RAD_TIME; // infected: see stepOnce
        w.radT = RAD_EVERY;
      }
    G.wind = G.wind > 0 ? 1 : -1;
    G.waterTarget -= 40;
    emit({ e: 'msg', t: 'Nuclear test!' });
  },
});
/**
 * Y of the first solid pixel at column x going down from `from` (null when there is none above the water).
 * Used by the sky weapons to find where something lands.
 */
function surfaceAt(x, from = 0) {
  for (let y = Math.max(0, from | 0); y < Math.min(T.h, G.waterY); y += 2) if (solid(x, y)) return y;
  return null;
}
/**
 * Walks a lightning bolt from (x1, y1) towards (x2, y2) in 3 px steps and returns where it really ends: the first
 * solid pixel or the first living worm (other than `skip`, the caster) on the way, else the aimed point itself.
 * Uses the same worm hit box as lightningBolt(), so every kind of lightning stops at what it meets first.
 * @param {number} skip id of a worm the bolt passes (the caster); -1 for none
 * @returns {{x: number, y: number, hit: 'ground'|'worm'|null}}
 */
function lightningRay(x1, y1, x2, y2, skip = -1) {
  const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 3));
  for (let i = 0; i <= n; i++) {
    const x = x1 + ((x2 - x1) * i) / n,
      y = y1 + ((y2 - y1) * i) / n;
    if (solid(x, y)) return { x, y, hit: 'ground' };
    if (G.worms.some(o => !o.dead && o.id !== skip && Math.abs(o.x - x) < 9 && Math.abs(o.y - y) < 8))
      return { x, y, hit: 'worm' };
  }
  return { x: x2, y: y2, hit: null };
}
/** One lightning strike: finds the first worm or ground below `x`, flashes, and blows a small fiery crater. */
function lightningBolt(x, owner) {
  let y = surfaceAt(x);
  for (let yy = 0; yy < (y == null ? G.waterY : y); yy += 3)
    if (G.worms.some(o => !o.dead && Math.abs(o.x - x) < 9 && Math.abs(o.y - yy) < 8)) {
      y = yy;
      break;
    }
  if (y == null) y = G.waterY - 4;
  emit({ e: 'bolt', x, y });
  explode(x, y, 20, 32, 200, { src: owner ? owner.id : -1, fire: 3 });
}
// Thunderstorm: click a target; five lightning bolts strike in and around it.
registerWeapon({
  id: 'thunder',
  name: 'Thunderstorm',
  code: 'TS',
  ammo: 1,
  delay: 4,
  click: true,
  instant: true,
  fire(c) {
    const tx = c.target.x;
    const environmental = c.w.id === -1;
    if (environmental) G.envThunder = 5;
    emit({ e: 'msg', t: 'THUNDERSTORM' });
    emit({ e: 'storm', x: tx, l: 2.6 });
    for (let i = 0; i < 5; i++)
      sched(0.6 + i * 0.4, () => {
        lightningBolt(clamp(tx + (i ? rnd(-110, 110) : 0), 8, T.w - 8), c.w);
        if (environmental) G.envThunder--;
      });
  },
});
// Dragon Fire: click a target; a dragon crosses the top of the level and breathes fire around it.
registerWeapon({
  id: 'dragonfire',
  name: 'Dragon Fire',
  code: 'DF',
  ammo: 1,
  delay: 5,
  click: true,
  instant: true,
  fire(c) {
    const tx = clamp(c.target.x, 0, T.w),
      face = c.w.face || 1,
      span = 150;
    // It flies just above the highest ground around the target, so it always sits "on top of the level".
    let top = G.waterY;
    for (let x = tx - span; x <= tx + span; x += 10) {
      const s = surfaceAt(clamp(x, 0, T.w - 1));
      if (s != null && s < top) top = s;
    }
    const y0 = clamp(top - 80, 30, G.waterY - 120);
    emit({ e: 'msg', t: 'DRAGON FIRE' });
    emit({ e: 'snd', s: 'roar' });
    spawnProj('dragon', face > 0 ? -110 : T.w + 110, y0, 0, 0, c.w, { face, tx, span, y0, ow: c.w.id });
  },
});
// Tornado: click a target; a twister walks along the ground for 8 s, lifting and flinging worms.
registerWeapon({
  id: 'tornado',
  name: 'Tornado',
  code: 'TN',
  ammo: 1,
  delay: 5,
  click: true,
  instant: true,
  fire(c) {
    const x = clamp(c.target.x, 20, T.w - 20),
      y = surfaceAt(x, Math.max(0, c.target.y - 120));
    emit({ e: 'msg', t: 'TORNADO' });
    spawnProj('tornado', x, y == null ? c.target.y : y, 0, 0, c.w, { ow: c.w.id, face: c.w.face || 1 });
  },
});
// Thor's Hammer: click on a worm (or the ground); the caster holds the hammer up and it charges with
// lightning from the sky, then the charge leaps from the hammer to the marked worm.
registerWeapon({
  id: 'hammer',
  name: "Thor's Hammer",
  code: 'TH',
  ammo: 1,
  delay: 5,
  click: true,
  instant: true,
  fire(c) {
    // the target is the living worm closest to the click (within 70 px), otherwise the clicked spot
    let tw = null,
      best = 70;
    for (const o of G.worms) {
      if (o.dead || o === c.w) continue;
      const d = Math.hypot(o.x - c.target.x, o.y - c.target.y);
      if (d < best) {
        best = d;
        tw = o;
      }
    }
    const tx = clamp(tw ? tw.x : c.target.x, 8, T.w - 8);
    emit({ e: 'msg', t: "THOR'S HAMMER" });
    if (tw) emit({ e: 'mark', x: tw.x, y: tw.y - 20 });
    // dark clouds gather over the caster, where the sky lightning feeds the hammer
    emit({ e: 'storm', x: c.w.x, l: HAMMER_CHARGE + 0.4 });
    spawnProj('mjolnir', c.w.x, c.w.y - 38, 0, 0, c.w, { tw: tw ? tw.id : -1, tx, ow: c.w.id, walk: 0 });
  },
});
// Time Car: a car comes back from the future behind the caster and drives off in the facing direction,
// setting fire to everything in front of it.
registerWeapon({
  id: 'timecar',
  name: 'Time Car',
  code: 'TC',
  ammo: 1,
  delay: 6,
  instant: true,
  fire(c) {
    const face = c.w.face || 1,
      x = clamp(c.w.x - face * 46, 10, T.w - 10),
      y = (surfaceAt(x, c.w.y - 40) ?? c.w.y + 8) - 8;
    emit({ e: 'msg', t: 'BACK FROM THE FUTURE' });
    emit({ e: 'tele', x, y: y - 4 });
    emit({ e: 'flash', c: '#cfe8ff' });
    emit({ e: 'snd', s: 'roar' });
    for (let i = 0; i < 14; i++) spawnFire(x, y, -face * rnd(20, 90), -rnd(20, 120), rnd(1, 3));
    spawnProj('timecar', x, y, 0, 0, c.w, { face, ow: c.w.id, hits: {} });
  },
});
/** One earthquake tick (called every 0.14 s while G.quake runs): cracks in the ground and jolts for the worms. */
function quakeTick() {
  G.quakeN = (G.quakeN || 0) + 1;
  for (let i = 0; i < 2; i++) {
    const x = rnd(20, T.w - 20),
      y = surfaceAt(x);
    if (y != null) emit({ e: 'cv', x, y: y + rnd(0, 4), r: rnd(5, 11), s: 0 });
  }
  const live = G.worms.filter(o => !o.dead);
  if (live.length && Math.random() < 0.3) {
    // now and then the ground opens right under somebody
    const v = pick(live),
      x = clamp(v.x + rnd(-14, 14), 4, T.w - 4),
      y = surfaceAt(x, v.y - 12);
    if (y != null) emit({ e: 'cv', x, y: y + 2, r: rnd(8, 13), s: 0 });
  }
  if (G.quakeN % 3 === 0)
    for (const o of live)
      if (o.grounded) {
        o.grounded = false;
        o.vy = -rnd(70, 130);
        o.vx += rnd(-30, 30);
        if (o.hp > 3) hurt(o, rndi(1, 2), { noEnd: true });
      }
}
// Earthquake: the whole map shakes for five seconds, cracking the ground and bouncing every worm.
registerWeapon({
  id: 'earthquake',
  name: 'Earthquake',
  code: 'EQ',
  ammo: 1,
  delay: 6,
  instant: true,
  fire(c) {
    G.quake = 5;
    G.quakeT = 0;
    emit({ e: 'quake', t: 5 });
    emit({ e: 'msg', t: 'EARTHQUAKE' });
  },
});
/** Tsunami wave: speed (px/s) and start offset (the front begins this far outside the shore). */
const TSU_SPEED = 360,
  TSU_START = -220;
/**
 * One tick of the tsunami. The front runs inland from the chosen shore. A worm, crate, drum, loose
 * projectile or flame it reaches is destroyed when it lies below the wave's height at that distance
 * (`H0` at the shore, falling linearly to 0 at `D` px inland), so the coast is wiped out and the
 * middle of the map is safe. Each thing is judged once, when the front passes it.
 */
function tsunamiTick(dt) {
  const s = G.tsu;
  s.t += dt;
  const front = TSU_START + TSU_SPEED * s.t,
    dist = x => (s.dir > 0 ? x : T.w - x),
    below = (x, y) => G.waterY - y < s.H0 * Math.max(0, 1 - dist(x) / s.D);
  for (const w of G.worms) {
    if (w.dead || s.hit.includes(w.id) || dist(w.x) > front) continue;
    s.hit.push(w.id);
    if (below(w.x, w.y)) sinkWorm(w, '{0} was swept away');
  }
  for (const o of G.objs) if (!o.kill && dist(o.x) <= front && below(o.x, o.y)) o.kill = true;
  for (const p of G.projs)
    if (p.t !== 'dragon' && p.t !== 'tornado' && dist(p.x) <= front && below(p.x, p.y)) p.dead = true;
  for (const f of G.fires) if (dist(f.x) <= front && below(f.x, f.y)) f.life = 0;
  if (front > s.D + 150) G.tsu = null;
}
// Tsunami: a giant wave hits the map from the left or the right (random) and sweeps the coast clean.
registerWeapon({
  id: 'tsunami',
  name: 'Tsunami',
  code: 'TW',
  ammo: 1,
  delay: 7,
  instant: true,
  fire(c) {
    const dir = Math.random() < 0.5 ? 1 : -1,
      D = clamp(T.w * 0.4, 500, 1100),
      H0 = G.waterY * 0.75;
    G.tsu = { dir, D, H0, t: 0, hit: [] };
    emit({ e: 'tsunami', dir, D, H0 });
    emit({ e: 'msg', t: 'TSUNAMI' });
  },
});
// Scales of Justice: sets every worm to the average health.
registerWeapon({
  id: 'scales',
  name: 'Scales of Justice',
  code: 'SJ',
  ammo: 1,
  delay: 5,
  instant: true,
  fire(c) {
    const al = G.worms.filter(w => !w.dead);
    const avg = Math.max(1, Math.round(al.reduce((s, w) => s + w.hp, 0) / al.length));
    for (const w of al) {
      w.pend += Math.max(0, w.hp - avg);
      w.hp = avg;
    }
    emit({ e: 'flash', c: '#c8e0ff' });
    emit({ e: 'msg', t: 'Scales of Justice' });
  },
});
// Ninja rope: fire to hook onto the terrain along the aim line; does not end the turn.
registerWeapon({
  id: 'rope',
  name: 'Ninja Rope',
  code: 'NR',
  ammo: -1,
  delay: 0,
  noEnd: true,
  anyPhase: true,
  fire(c) {
    const w = c.w,
      [dx, dy] = aimDir(w);
    let x = w.x,
      y = w.y - 4;
    const ang = Math.atan2(dy, dx);
    // Firing again lets go of the old rope first: a throw that finds no anchor leaves the worm free.
    const had = !!w.rope;
    w.rope = null;
    for (let d = 0; d < 290; d += 3) {
      x = w.x + Math.cos(ang) * d;
      y = w.y - 4 + Math.sin(ang) * d;
      if (solid(x, y)) {
        w.rope = { ax: x, ay: y, len: Math.max(20, Math.hypot(x - w.x, y - w.y)) };
        w.grounded = false;
        w.jet = null;
        emit({ e: 'snd', s: 'beep' });
        return 'keep';
      }
    }
    if (had) w.vy -= 20;
    return 'miss';
  },
});
// Jet pack: limited fuel; Space switches it off.
registerWeapon({
  id: 'jetpack',
  name: 'Jet Pack',
  code: 'JP',
  ammo: 2,
  delay: 1,
  noEnd: true,
  anyPhase: true,
  fire(c) {
    c.w.jet = { fuel: 100 };
    c.w.rope = null;
    c.w.grounded = false;
    return 'keep';
  },
});
// Teleport: click anywhere free to jump there. It uses up the turn (the usual 3 s retreat follow).
registerWeapon({
  id: 'teleport',
  name: 'Teleport',
  code: 'TP',
  ammo: 2,
  delay: 1,
  click: true,
  instant: true,
  fire(c) {
    const f = findFree(c.target.x, c.target.y, WORM_R, 30);
    if (!f) return 'miss';
    const w = c.w;
    emit({ e: 'tele', x: w.x, y: w.y });
    w.x = f[0];
    w.y = f[1];
    w.vx = w.vy = 0;
    w.grounded = false;
    w.rope = null;
    emit({ e: 'tele', x: w.x, y: w.y });
    emit({ e: 'snd', s: 'tele' });
  },
});
// Girder: click to place a steel beam (R / wheel rotates it).
registerWeapon({
  id: 'girder',
  name: 'Girder',
  code: 'GD',
  ammo: 3,
  delay: 0,
  click: true,
  instant: true,
  noEnd: true,
  fire(c) {
    emit({ e: 'gd', x: c.target.x, y: c.target.y, a: (G.weapon.ang * Math.PI) / 8, l: 64 });
    for (const w of G.worms)
      if (!w.dead && hitC(w.x, w.y, w.r)) {
        const f = findFree(w.x, w.y - 8, w.r, 40);
        if (f) {
          w.x = f[0];
          w.y = f[1];
          w.grounded = false;
        }
      }
  },
});
// Blowtorch: tunnels along the aim direction for 5 s.
registerWeapon({
  id: 'blowtorch',
  name: 'Blowtorch',
  code: 'BL',
  ammo: 3,
  delay: 1,
  noEnd: true,
  fire(c) {
    c.w.tool = { k: 'torch', t: 5 };
    return 'keep';
  },
});
// Pneumatic drill: digs straight down for 5 s.
registerWeapon({
  id: 'drill',
  name: 'Pneumatic Drill',
  code: 'PD',
  ammo: 2,
  delay: 1,
  noEnd: true,
  fire(c) {
    c.w.tool = { k: 'drill', t: 5 };
    return 'keep';
  },
});
// Parachute: selecting it arms a parachute for the next fall.
registerWeapon({
  id: 'parachute',
  name: 'Parachute',
  code: 'PC',
  ammo: 3,
  delay: 0,
  noEnd: true,
  anyPhase: true,
  instant: true,
  noFire: true,
  onSelect(w, t) {
    if (!w.chute) {
      w.chute = true;
      if (t.ammo.parachute > 0) t.ammo.parachute--;
      emit({ e: 'msg', t: 'Parachute ready' });
    }
  },
});
// Select worm: switch to another worm of your team (before firing).
registerWeapon({
  id: 'select',
  name: 'Select Worm',
  code: 'SW',
  ammo: 1,
  delay: 2,
  noEnd: true,
  instant: true,
  fire(c) {
    return cycleWorm(c.w, true);
  },
});
// Skip go: ends the turn without attacking.
registerWeapon({
  id: 'skip',
  name: 'Skip Go',
  code: 'SK',
  ammo: -1,
  delay: 0,
  instant: true,
  noEnd: true,
  fire(c) {
    toSettle();
    emit({ e: 'msg', t: 'Turn skipped' });
  },
});
// Surrender: press twice within 4 s; all your worms die.
registerWeapon({
  id: 'surrender',
  name: 'Surrender',
  code: 'SR',
  ammo: -1,
  delay: 0,
  instant: true,
  noEnd: true,
  fire(c) {
    if (G.time - G.surr > 4) {
      G.surr = G.time;
      emit({ e: 'msg', t: 'Press again to surrender' });
      return 'miss';
    }
    for (const id of teamOf(c.w).worms) {
      const w = wById(id);
      if (!w.dead) w.hp = 0;
    }
    toSettle();
    emit({ e: 'msg', t: '{0} surrenders', a: [teamOf(c.w).name] });
  },
});

/** Switches control to the next living worm of the same team (Select Worm / Tab). Not possible after firing. */
function cycleWorm(w, pay) {
  const t = teamOf(w),
    alive = t.worms.map(wById).filter(x => !x.dead);
  if (alive.length < 2) return 'miss';
  if (G.fired) return 'miss';
  const i = alive.indexOf(w),
    n = alive[(i + 1) % alive.length];
  G.active = n.id;
  w.tool = null;
  w.jet = null;
  emit({ e: 'snd', s: 'beep' });
  if (pay) {
    G.switched = true;
  }
  return pay && G.switched === false ? 'ok' : 'ok';
}

/**
 * Selects a weapon for the team whose turn it is (validates ammo, phase and state).
 * @param {number} fuse optional grenade fuse 1-5
 */
function selectWeapon(team, id, fuse) {
  const t = G.teams[team],
    w = activeWorm();
  if (!w || w.team !== team || !(G.phase === 'turn' || G.phase === 'retreat') || !avail(t, id))
    return;
  const d = WEAPONS[id];
  if (G.phase === 'retreat' && !d.anyPhase) return;
  if (G.weapon.ch) return;
  if (w.tool) return;
  // Choosing the weapon that is currently in use again detaches it (rope, jet pack).
  if (id === G.weapon.id && ((id === 'rope' && w.rope) || (id === 'jetpack' && w.jet))) {
    w.rope = null;
    w.jet = null;
    return;
  }
  G.weapon.id = id;
  G.weapon.pw = 0;
  G.weapon.shots = 0;
  G.weapon.tx = null;
  G.weapon.ty = null;
  if (fuse) G.weapon.fuse = clamp(fuse, 1, 5);
  if (d.onSelect) d.onSelect(w, t);
}

/**
 * True while the worm hangs on the ninja rope or flies with the jet pack and has another weapon
 * selected: Jump then fires that weapon and Space lets go of the rope / jet pack.
 */
function holdingOther(w) {
  return !!(w.rope || w.jet) && G.weapon.id !== 'rope' && G.weapon.id !== 'jetpack';
}

/* Fire handling for the active team's input */
/**
 * Fire/charge state machine for the active worm. Space pressed: charging weapons start charging,
 * the power grows for 1.8 s and the shot is released when Space is let go (or at full power);
 * other weapons fire immediately. A second press detonates a running sheep; Space also switches
 * off a jet pack or digging tool.
 */
function handleFire(w, t, inp, dt) {
  const W = G.weapon,
    d = WEAPONS[W.id];
  // detonate controllable sheep with fire
  if (inp.fireP) {
    const ctl = G.projs.find(p => (PTYPES[p.t].ctl || PTYPES[p.t].again) && p.ow === w.id);
    if (ctl) {
      detonate(ctl);
      inp.fireP = 0;
      return;
    }
  }
  // Space always lets go of the rope / jet pack, whatever weapon is selected; that frees aiming
  // and weapon changes again.
  if (inp.fireP && (w.rope || w.jet)) {
    emit({ e: 'snd', s: 'beep' });
    w.rope = null;
    w.jet = null;
    inp.fireP = 0;
    return;
  }
  // Kamehameha charge: every further press of Fire widens the beam (x2, then x3 at most)
  if (inp.fireP && w.tool && w.tool.k === 'kame') {
    inp.fireP = 0;
    // level n costs n charges of ammo (the first was spent when the charge began): one more per press
    if (w.tool.lv < KAME_MAX_LV) {
      if (t.ammo.kamehameha !== 0) {
        if (t.ammo.kamehameha > 0) t.ammo.kamehameha--;
        w.tool.lv++;
        emit({ e: 'snd', s: 'pick' });
        emit({ e: 'msg', t: 'Kamehameha x{0}', a: [w.tool.lv] });
      } else emit({ e: 'msg', t: 'Not enough Kamehameha ammo' });
    }
    return;
  }
  if (inp.fireP && w.tool && !TOOL_LOCKED[w.tool.k]) {
    w.tool.t = 0;
    inp.fireP = 0;
    return;
  }
  const can =
    (G.phase === 'turn' || (G.phase === 'retreat' && d.anyPhase)) &&
    !w.tool &&
    avail(t, W.id) &&
    !d.noFire &&
    !(w.jet && W.id === 'jetpack') &&
    !(d.needTarget && W.tx == null);
  // On the rope / jet pack with another weapon selected, Jump is the fire button (charging weapons
  // go out at 65% power, there is no way to hold the charge). The press never lets go of the rope/jetpack.
  if (inp.jump && holdingOther(w)) {
    inp.jump = 0;
    if (can && !d.click && !W.ch && !(d.charge && G.fired)) doFire(w, t, d, d.charge ? 0.65 : 1);
    return;
  } if (d.charge) {
    if (can && !W.ch && inp.fireP && !G.fired) {
      W.ch = true;
      W.pw = 0;
    }
    if (W.ch) {
      if (!inp.fire) doFire(w, t, d, Math.max(0.05, W.pw));
      else {
        W.pw += dt / 1.8;
        if (W.pw >= 1) {
          W.pw = 1;
          doFire(w, t, d, 1);
        }
      }
    }
    inp.fireP = 0;
    return;
  }
  if (can && inp.fireP && !d.click) doFire(w, t, d, 1);
  inp.fireP = 0;
}
/** Map click: sets the homing target, or fires a click-targeted weapon (strikes, teleport, girder). */
function clickTarget(w, t, x, y) {
  const W = G.weapon,
    d = WEAPONS[W.id];
  if (W.id === 'homing') {
    W.tx = x;
    W.ty = y;
    emit({ e: 'mark', x, y });
    return;
  }
  if (!d.click || !(G.phase === 'turn') || !avail(t, W.id) || w.tool) return;
  doFire(w, t, d, 1, { x, y });
}
/**
 * Executes a weapon: calls its fire(), spends ammo, and moves to the 3 s retreat phase unless the
 * weapon is `noEnd` or still has shots left (shotgun). Falls back to another weapon when the
 * ammo runs out.
 */
function doFire(w, t, d, power, target) {
  const W = G.weapon;
  W.ch = false;
  const r = d.fire({ w, team: t, power, wdef: d, target: target || null });
  if (r === 'miss') {
    W.pw = 0;
    return;
  }
  if (t.ammo[d.id] > 0) t.ammo[d.id]--;
  W.pw = 0;
  G.fired = G.fired || !d.noEnd;
  if (d.shots) {
    W.shots++;
    if (W.shots < d.shots) return;
  }
  if (!avail(t, d.id) && !['rope'].includes(d.id)) {
    /* out of ammo, fall back */
  }
  if (!d.noEnd) {
    // A turn-ending shot fired from the rope / jet pack lets go of them: the turn is over.
    if (!holdingOther(w)) {
      w.rope = null;
      w.jet = null;
    }
    if (G.phase === 'turn') {
      G.phase = 'retreat';
      G.timer = 3;
    }
  }
  if (d.id === 'homing') {
    W.tx = null;
    W.ty = null;
  }
  // (Bullet Time stays selected while it runs: it is the pistol that fires the barrage)
  if (!avail(t, W.id) && !(W.id === 'bullettime' && G.bt)) {
    const f = WLIST.find(x => avail(t, x.id) && !x.noFire);
    if (f) W.id = f.id;
  }
}
