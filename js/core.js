'use strict';

/**
 * @file core.js - Core registries & match state
 *
 * Physics constants, the weapon and projectile registries, the global match object G and small
 * accessors. Everything that wants to add content calls registerWeapon() / registerProj().
 *
 * Depends on: util
 * Globals defined: ENV_WEAPONS, envBlocked, GRAV, WIND_ACC, FALLV, WORM_R, RAD_TIME, RAD_DMG, RAD_EVERY, WEAPON_CATS, WEAPON_CAT, WEAPONS, WLIST, PTYPES, registerWeapon,
 *     registerProj, G, curInp, wById, teamOf, activeWorm, aimDir, teamAlive, emit, sched,
 *     MAX_WORMS_TOTAL, SEA_RISE_STEP, MAX_TEAMS, TEAM_COLORS, TEAM_NAMES, WORM_NAMES
 */

/**
 * Physics constants (pixels and seconds):
 *   GRAV      gravity acceleration (px/s^2)
 *   WIND_ACC  acceleration at full wind, multiplied by each projectile type's `wind` factor
 *   FALLV     impact speed above which a worm takes fall damage
 *   WORM_R    collision radius of a worm
 *   RAD_TIME, RAD_DMG, RAD_EVERY  Nuclear Test radiation: seconds it lasts, health lost, every how many seconds
 */
const GRAV = 600,
  WIND_ACC = 90,
  FALLV = 460,
  WORM_R = 6,
  RAD_TIME = 60,
  RAD_DMG = 1,
  RAD_EVERY = 5;
/** Registries filled by registerWeapon()/registerProj(): lookup by id, weapon list in menu order, projectile types. */
const WEAPONS = {},
  WLIST = [],
  PTYPES = {};
/**
 * Weapon categories shown as tabs in the weapon panel (`all` is the tab without a filter), in tab order.
 * A weapon's category is its `cat` field, or the entry in WEAPON_CAT below, or `special`.
 */
const WEAPON_CATS = ['body', 'short', 'long', 'destructive', 'anime', 'tools', 'special'];
const WEAPON_CAT = {};
for (const [cat, ids] of Object.entries({
  body: ['firepunch', 'dragonball', 'bat', 'kamikaze', 'hokuto', 'onigiri', 'gigantaxe', 'gandalf'], // direct contact with the worm's body
  short: ['shotgun', 'handgun', 'uzi', 'dynamite', 'mine', 'petrol', 'sheep', 'supersheep'], // close to the shooter
  long: ['bazooka', 'homing', 'mortar', 'grenade', 'cluster', 'banana', 'holy', 'airstrike', 'napalm', 'minestrike'],
  destructive: ['donkey', 'armageddon', 'nuke', 'earthquake', 'tsunami', 'thanos'], // hits the whole level
  anime: ['dragonfire', 'thunder', 'hammer', 'kamehameha', 'proton', 'avada', 'forcechoke', 'timecar', 'tornado', 'bullettime', 'rasenshuriken', 'shadowclone'], // fantasy and elemental powers
  tools: ['rope', 'jetpack', 'teleport', 'girder', 'blowtorch', 'drill', 'parachute'], // movement and digging
  special: ['scales', 'select', 'skip', 'surrender'], // everything else, and the turn controls
}))
  for (const id of ids) WEAPON_CAT[id] = cat;
/**
 * Environmental Chaos (cfg.env): these devastating environmental weapons cannot be chosen by the players any more; the game
 * triggers them by itself as natural disasters (see envChaos in match.js).
 */
const ENV_WEAPONS = ['tornado', 'thunder', 'tsunami', 'earthquake', 'armageddon'];
/** Is weapon `id` switched off by the Environmental Chaos mode of the running match? */
const envBlocked = id => !!(G && G.cfg && G.cfg.env && ENV_WEAPONS.includes(id));
/**
 * Adds a weapon to the game. Fields of `d`:
 *   id, name, code      identity; `code` is a 2-letter fallback badge for the icon
 *   cat                 category tab (one of WEAPON_CATS); default: WEAPON_CAT[id], else 'special'
 *   ammo                starting ammo, -1 = unlimited
 *   delay               first round in which it is available (Standard arsenal only)
 *   charge              true = hold Space to charge power, release to fire
 *   fuse                true = honours the 1-5 fuse keys
 *   click, instant      click: needs a map click; instant: acts as soon as it is fired
 *   noEnd, anyPhase     noEnd: using it does not end the turn; anyPhase: also usable while retreating
 *   shots               number of presses before the turn ends (shotgun = 2)
 *   needTarget          must have a target marker first (homing missile)
 *   fire(ctx)           performs the attack; ctx = {w, team, power, wdef, target}
 *                       return 'miss' to cancel without using ammo, 'keep' for tool-like weapons
 *   onSelect(w, team)   optional hook when the weapon is picked
 * An icon can be added in icons.js (ICON_DRAW[id]).
 */
function registerWeapon(d) {
  d.cat = d.cat || WEAPON_CAT[d.id] || 'special';
  WEAPONS[d.id] = d;
  WLIST.push(d);
  return d;
}
/**
 * Adds a projectile type. Fields of `d`: r (radius), grav, wind, bounce, fric (physics factors),
 * fuse (seconds), hit (explode on terrain contact), expl {r, d, push, k, fire} (explosion),
 * boom(p) (custom explosion), tick(p, dt) (custom per-tick logic; return false to skip the
 * default physics), spr (sprite name), trail (particle trail), passive (does not delay the turn
 * change, e.g. mines), mine/ctl/beep flags. See projectiles.js for examples.
 */
function registerProj(id, d) {
  PTYPES[id] = d;
  return d;
}

/* ===== Game state ===== */
/**
 * The whole match. Created by newGame() (host/local) or startClientGame() (online guest).
 * Main fields: cfg, teams[], worms[], projs[], fires[], objs[] (drums, crates), phase
 * ('turn' | 'retreat' | 'settle' | 'over'), active (worm id), ti (team index), timer, wind,
 * round, waterY, weapon (current selection), ev[] (events produced this tick), sched[]
 * (delayed actions).
 */
let G = null; // the whole match
/** Input record of the team that currently controls the active worm (host/local only). */
let curInp = null; // input of the team currently in control (host side)
/** Worm by id. */
const wById = id => G.worms.find(w => w.id === id);
/** Team that a worm belongs to. */
const teamOf = w => G.teams[w.team];
/** The worm whose turn it is, or null (menu, no active worm). */
const activeWorm = () => (G && G.active >= 0 ? wById(G.active) : null);
/** Unit aim direction of a worm: facing (+1/-1) mirrors the horizontal part; negative aim = up. */
const aimDir = w => [w.face * Math.cos(w.aim), Math.sin(w.aim)];
/** A team is alive while at least one of its worms is not dead. */
const teamAlive = t => t.worms.some(id => !wById(id).dead);
/**
 * Publishes a simulation event (explosion, damage number, message, sound ...). Terrain edits are
 * applied immediately so physics sees them in the same tick; visual/audio handling happens in
 * drainEvents() -> applyEvent(). The host also forwards events to online guests.
 */
function emit(e) {
  G.ev.push(e);
  applyTerrain(e);
}
/** Runs fn() after t seconds of simulation time (used for staggered bombs, bullet bursts ...). */
function sched(t, fn) {
  G.sched.push({ t, fn });
}

/** Upper bound for worms in a match; keeps the map playable (worms per team is reduced to fit). */
const MAX_WORMS_TOTAL = 40;
/** Pixels the water level climbs each time the "sea level rise" option triggers. */
const SEA_RISE_STEP = 30;
/** Maximum number of teams in one match (also the number of team colours / accessories). */
const MAX_TEAMS = 8;
/** Team colours: red, blue, yellow, green, orange, violet, cyan, pink. */
const TEAM_COLORS = [
  '#ff4d5e',
  '#3da5ff',
  '#ffd23f',
  '#52d98c',
  '#ff9a3d',
  '#b277ff',
  '#2fe0e8',
  '#ff7ac8',
];
/** Default team names, one per colour. */
const TEAM_NAMES = [
  'Red Raiders',
  'Blue Bandits',
  'Gold Gang',
  'Green Grubs',
  'Orange Outlaws',
  'Violet Vipers',
  'Cyan Crawlers',
  'Pink Pirates',
];
const WORM_NAMES = [
  'Wiggles',
  'Slimer',
  'Boris',
  'Nibbles',
  'Squirm',
  'Grub',
  'Kevin',
  'Inchy',
  'Noodle',
  'Gus',
  'Wormy',
  'Pip',
  'Tango',
  'Zed',
  'Larva',
  'Moss',
  'Crawler',
  'Fang',
  'Blob',
  'Dozer',
  'Mort',
  'Twitch',
  'Rasher',
  'Tubby',
  'Slick',
  'Bernard',
  'Lumpy',
  'Squiggy',
  'Otto',
  'Doug',
  'Fizz',
  'Rex',
  'Sprout',
  'Biscuit',
  'Pickle',
  'Mango',
  'Turnip',
  'Waffle',
  'Gizmo',
  'Pebble',
  'Nugget',
  'Sprocket',
  'Truffle',
  'Mochi',
  'Ziggy',
  'Pretzel',
  'Bagel',
  'Muffin',
  'Cobalt',
  'Ember',
  'Frost',
  'Gadget',
  'Hazel',
  'Ivy',
  'Juno',
  'Kiwi',
  'Lemon',
  'Maple',
  'Nova',
  'Olive',
  'Peanut',
  'Quill',
  'Rusty',
  'Sushi',
];
