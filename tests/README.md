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
| `smoke.py` | all level styles, bot-only matches with 2 and 8 teams, missing Italian translations, 36+ weapons, donkey |
| `test_weapons.py` | every weapon fires without errors and the turn always ends |
| `test_bots.py` | bots do not idle until the turn timer runs out |
| `test_movement.py` | worm leaving the map dies; on rope / jet pack Jump fires the selected weapon, Space lets go |
| `test_build.py` | `node build/build.js` output: one hashed minified js/css, `.gz`/`.br` copies, served over http the game loads, lists all maps and plays (skipped without `cd build && npm install`) |
| `test_chat.py` | chat: cleaning, host stamping (no spoofing), flood control, no HTML injection, lobby + in-game UI, offline = no chat |

`common.py` holds the shared browser helper. A new test is a `test_*.py` file using
`with game_page() as (page, errors): ...` and ending with `finish(errors)`; `run_all.py` finds it.
Set `CHROMIUM_PATH` if Chromium is not in a standard place. The sandbox flag `--no-sandbox` is always passed.
