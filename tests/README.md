# Tests

Headless browser tests (Playwright + Chromium) that drive the real game through `window.__wh`
and the page globals. Python 3.9+.

## Setup

```bash
pip install -r tests/requirements.txt
playwright install chromium        # once; or set CHROMIUM_PATH=/path/to/chrome
```

## Run

```bash
python3 tests/run_all.py           # everything, non-zero exit code on failure
python3 tests/smoke.py             # or a single test
WH_BUILD=1 python3 tests/run_all.py   # test the minified dist/index.html (run node build/build.js first)
```

| File | Checks |
| --- | --- |
| `smoke.py` | all level styles, bot-only matches with 2 and 8 teams, missing Italian translations, 41+ weapons, donkey |
| `test_weapons.py` | every weapon fires without errors and the turn always ends |
| `test_bots.py` | bots do not idle until the turn timer runs out |
| `test_movement.py` | worm leaving the map dies; on rope / jet pack Jump fires the selected weapon, Space lets go |
| `test_build.py` | `node build/build.js` output: one hashed minified js/css, `.gz`/`.br` copies, served over http the game loads, lists all maps and plays (skipped without `cd build && npm install`) |
| `test_special_weapons.py` | Earthquake (cracks the ground, ends), Dragon Fire (dragon + flames), Thunderstorm (5 bolts, damage), Tornado (lifts a worm), Thor's Hammer (charges, then strikes), Time Car (drives through and pushes a worm); each turn still ends |
| `test_tsunami.py` | Tsunami from the left / right kills the worm at that coast, spares the one in the middle, and ends |
| `test_arsenals.py` | Special / Anime / Melee / Artillery only: ammo table, crate contents, panel and tabs, bots play with weapons of the set, menu + Italian |
| `test_themes.py` | Halloween / Christmas / Manga: props and look differ, deterministic from the seed, props vanish with their ground, terrain texture hook, hats, `Random` never picks a special theme, `Seasonal` by date, menu + Italian names |
| `test_weapon_keys.py` | weapon panel by keyboard only: cursor on the armed weapon, arrows / Home / End, Tab categories, letter jump, Enter / Space arm and close, empty weapons refused, Esc, game keys back |
| `test_sky.py` | day / night / cloudy / rainy render (night much darker, rain darker than cloud), defaults to day, `random` yields concrete skies |
| `test_audio.py` | Holy Hand Grenade choir plays once, with the blast, MP3s respect mute and stop, the dragon roars instead of singing |
| `test_damage_display.py` | a hit keeps the old health on screen (label, team bars, guest snapshot) until `-N` is announced, then counts down; heals show at once |
| `test_touch.py` | touch emulation (`game_page(mobile=True)`): on rope / jet pack with another weapon, Jump shows the weapon icon + FIRE tag and Fire becomes "let go"; reverts afterwards, Italian labels |
| `test_invite.py` | host invite button (icon) + copy / share (stubbed clipboard and share sheet), disabled again on close; `?join=CODE` joins at once with a saved name, drops the query, lobby chat visible (fake PeerJS) |
| `test_fall.py` | jumps and back-flips are harmless, a long drop hurts |
| `test_camera.py` | camera goes to impacts and flying worms, manual pan yields to action |
| `test_homing.py` | homing missile explodes at a marked point in empty sky and on a worm instead of circling until its fuse ends |
| `test_weapon_tabs.py` | every weapon has a category, the weapon panel tabs filter the grid (All shows everything), the tab is remembered, Italian labels |
| `test_splatter.py` | blood particles appear when Splatter Mode is enabled and are suppressed when disabled |
| `test_radiation.py` | Nuclear Test infects every worm: RAD_DMG health every RAD_EVERY s for RAD_TIME s (read from core.js), never lethal |
| `test_tools.py` | blowtorch keeps its heading and drops into holes; torch and drill hurt the worms they touch, not their user |
| `test_tornado.py` | the tornado really hurts a worm in the funnel and lifts mines and oil drums |
| `test_teamsbar.py` | team bars sorted by total health, rows slide when two teams swap, ties keep team order |
| `test_p2p_start.py` | guest start-up: finite camera, sea and worm positions right after `start` (also with an old host), `ready` request, early snapshots kept, NaN camera recovers |
| `test_changelog.py` | `tools/changelog.py`: oldest-first order, verb / `feat:` / `fix:` classification, trailers dropped, reproducible, `--check`; the real CHANGELOG.md is well formed (no browser) |
| `test_chat.py` | chat: cleaning, host stamping (no spoofing), flood control, no HTML injection, lobby + in-game UI, offline = no chat |
| `test_hammer_collision.py` | Thor's Hammer lightning ends at the first obstacle: a clear line reaches the target, a wall (girder) or another worm in between takes the strike and shields the target |
| `test_kenshiro.py` | Hokuto Hyakuretsu Ken: punch barrage on the worm in front, voice lines (speech stubbed), dash past it to a safe distance, victim dies exactly 3 s after the last blow, turn waits for it, misses mark nobody, tool is not cancellable |
| `test_kamehameha.py` | Kamehameha: 1.3 s charge, beam across the whole map, tunnel of fixed radius (carved vs. untouched pixels), worm damaged, mine / oil drum / crate destroyed, bystanders and shooter unharmed, angled shot leaves other terrain alone, beam geometry reaches guests |
| `test_zoro.py` | Oni Giri: ~0.9 s charge, the dash slices each worm in line exactly once for the right damage as the attacker passes through it, worms behind / out of reach / the attacker unharmed, a miss still dashes, Space and the turn clock can't interrupt it |
| `test_proton.py` | Proton Stream: caster + up to the 2 nearest teammates shoot (3 on a 3-team, only the nearest on a 5-team, the remaining ones when others are dead), crossed streams (6 / 10 per tick + blast), a blocked stream, out of range, a worm in the way is burnt instead, shooters never block each other, a shooter dying drops out, misses cost nothing, caster locked while streaming, guests get the lock |

`common.py` holds the shared browser helper. A new test is a `test_*.py` file using
`with game_page() as (page, errors): ...` and ending with `finish(errors)`; `run_all.py` finds it.
Set `CHROMIUM_PATH` if Chromium is not in a standard place. The sandbox flag `--no-sandbox` is always passed.
