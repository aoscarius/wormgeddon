# Build

Produces a **minified, hashed and pre-compressed** copy of the game that you upload to any static web
host. The game itself has no dependencies; only the build uses two npm packages
([esbuild](https://esbuild.github.io/) and [html-minifier-terser](https://github.com/terser/html-minifier-terser)).

```bash
cd build && npm install        # once
cd .. && node build/build.js   # -> dist/
```

Options: `--out DIR` (another output folder), `--no-compress` (skip `.gz` / `.br`),
`--single` (see below). Paths are resolved from the repository root, run it from anywhere.

## Output (`dist/`, git-ignored)

| File | Content |
| --- | --- |
| `index.html` | minified page (menu markup + HUD) linking the files below |
| `assets/style.<hash>.css` | all CSS, minified |
| `assets/app.<hash>.js` | all `js/*.js` in load order, one minified script (~130 KB, ~42 KB brotli) |
| `maps/*.png`, `maps/manifest.json` | the map library; the manifest is generated from the folder (manifest order first, then alphabetical) |
| `sounds/*` | audio files |
| `*.gz`, `*.br` | pre-compressed copies of the text files (gzip -9, brotli quality 11) |

Upload the whole folder. Hints for the server:

* `assets/*` can be cached for a year (`Cache-Control: public, max-age=31536000, immutable`): the hash in the
  name changes whenever the content does. Keep `index.html` and `maps/manifest.json` short-lived (or `no-cache`).
* nginx: `gzip_static on;` (and `brotli_static on;` with the brotli module) serve the pre-compressed files.
  Other hosts (GitHub Pages, Netlify, Cloudflare Pages, S3 + CDN) compress on their own.
* Online play needs HTTPS or localhost (WebRTC) and access to the PeerJS CDN (`unpkg.com`).
* To add a map just put the PNG into `maps/` and rebuild.

## What the build does

1. Reads `index.html`; the local `<link>` / `<script src="js/...">` tags are replaced, in the same order.
2. Concatenates the scripts into **one classic script** and minifies it, so top-level names stay shared
   globals exactly as in development (no ES modules, no bundler semantics).
3. Minifies CSS and HTML, writes content-hashed asset names, copies `maps/` and `sounds/`, compresses.
4. Prints a size report.

## `--single`: one self-contained file

`node build/build.js --single` writes `dist/wormgeddon.html` (and `wormgeddon.fragment.html`, without the
document wrappers) with minified code and **every map and sound embedded** (`window.MAPS_BUNDLE`, `window.SOUNDS_BUNDLE`; about 2.9 MB). Handy for
sending the game as one file or running it from `file://`; it is bigger and cached as a whole; for a real deployment use the default folder build.

## Testing the build

```bash
node build/build.js && WH_BUILD=1 python3 tests/run_all.py    # all tests against dist/index.html
python3 tests/test_build.py                                   # builds to a temp folder, serves it over http
```
