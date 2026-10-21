#!/usr/bin/env node
/**
 * build/build.js - produces a minified, compressed, deployable copy of the game.
 *
 *   cd build && npm install        # once (esbuild + html-minifier-terser, build-time only)
 *   node build/build.js            # -> dist/  (upload this folder to any static web host)
 *
 * Options:
 *   --out DIR        write to DIR instead of ./dist
 *   --no-compress    skip the pre-compressed .gz / .br copies
 *   --single         instead of a folder, write ONE self-contained dist/wormgeddon.html (+ .fragment.html)
 *                    with every image of maps/ embedded; handy for a quick share, bigger and uncached
 *
 * Deploy output (default):
 *   dist/index.html                    minified page (menu markup, HUD, links to the files below)
 *   dist/assets/style.<hash>.css       all CSS, minified
 *   dist/assets/app.<hash>.js          all js/*.js in load order, concatenated and minified
 *   dist/maps/*.png + manifest.json    the map library (manifest generated from the folder)
 *   dist/sounds/*                      audio files
 *   dist/**\/*.gz, *.br                pre-compressed copies of the text files (gzip -9, brotli q11)
 * The hash in the file names changes only when the content changes, so the assets can be cached
 * "forever" (Cache-Control: max-age=31536000, immutable) while index.html stays short-lived.
 * Servers such as nginx (gzip_static / brotli_static) serve the .gz / .br files automatically.
 *
 * The development entry point stays index.html: it loads css/style.css and js/*.js with plain
 * <script> tags (no bundler, no ES modules). The game itself has no dependencies.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

let esbuild, htmlMin;
try {
  esbuild = require('esbuild');
  htmlMin = require('html-minifier-terser');
} catch (e) {
  console.error('Build dependencies missing. Run once:  cd build && npm install');
  process.exit(1);
}

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const single = args.includes('--single');
const compress = !args.includes('--no-compress');
const outIdx = args.indexOf('--out');
const outDir = path.resolve(outIdx >= 0 && args[outIdx + 1] ? args[outIdx + 1] : path.join(root, 'dist'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const hash = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 8);
const kb = n => (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';

/* ---- 1. Sources: index.html, its css and its scripts in load order ---- */
let html = read('index.html');
const cssFiles = [];
html = html.replace(/[ \t]*<link rel="stylesheet" href="(css\/[^"]+)"\s*\/?>\n?/g, (_, href) => {
  cssFiles.push(href);
  return '@@CSS@@\n';
});
const jsFiles = [];
html = html.replace(/[ \t]*<script src="(js\/[^"]+)"><\/script>\n?/g, (_, src) => {
  jsFiles.push(src);
  return '';
});
html = html.replace(/\s*<!-- Game modules\.[^>]*-->\n?/, '\n');
if (!jsFiles.length || !cssFiles.length) throw new Error('index.html: no local css/js found');

// All scripts become ONE classic script, so top-level names stay shared globals exactly as in development.
const jsSrc = jsFiles.map(f => `/* ---- ${f} ---- */\n${read(f)}`).join('\n');
const js = esbuild.transformSync(jsSrc, { minify: true, target: 'es2020', legalComments: 'none' }).code;
const css = cssFiles
  .map(f => esbuild.transformSync(read(f), { loader: 'css', minify: true, legalComments: 'none' }).code)
  .join('');

/* ---- 2. Maps ---- */
const IMG_RE = /\.(png|bmp|gif|webp|jpe?g)$/i;
const MIME = { png: 'image/png', bmp: 'image/bmp', gif: 'image/gif', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
const prettyName = f => f.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/^./, c => c.toUpperCase());
/** Maps in manifest order (maps/manifest.json), then the remaining images alphabetically. */
function listMaps() {
  const dir = path.join(root, 'maps');
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => IMG_RE.test(f));
  let list = [];
  const mf = path.join(dir, 'manifest.json');
  if (fs.existsSync(mf)) {
    try {
      const j = JSON.parse(fs.readFileSync(mf, 'utf8'));
      const arr = Array.isArray(j) ? j : j.maps || j.levels || [];
      list = arr.map(e => (typeof e === 'string' ? { file: e } : e)).filter(e => e && files.includes(e.file));
    } catch (err) {
      console.warn('maps/manifest.json is not valid JSON:', err.message);
    }
  }
  const seen = new Set(list.map(e => e.file));
  for (const f of files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })))
    if (!seen.has(f)) list.push({ file: f });
  return list.map(e => ({ name: e.name || prettyName(e.file), file: e.file }));
}
const maps = listMaps();

/* ---- 3. Page ---- */
const htmlOpts = {
  collapseWhitespace: true,
  conservativeCollapse: false,
  removeComments: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  minifyCSS: true,
  minifyJS: false,
  keepClosingSlash: false,
};

(async () => {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const written = []; // files of the output, for the size report / compression

  if (single) {
    const bundle = maps.map(m => ({
      ...m,
      data: `data:${MIME[m.file.split('.').pop().toLowerCase()]};base64,` + fs.readFileSync(path.join(root, 'maps', m.file)).toString('base64'),
    }));
    let page = html.replace('@@CSS@@', () => `<style>${css}</style>`);
    page = page.replace('</body>', () => `<script>window.MAPS_BUNDLE=${JSON.stringify(bundle)};</script><script>${js}</script></body>`);
    page = await htmlMin.minify(page, htmlOpts);
    fs.writeFileSync(path.join(outDir, 'wormgeddon.html'), page);
    const body = page.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];
    const head = [page.match(/<title>.*?<\/title>/)[0], ...(page.match(/<link[^>]*fonts\.googleapis\.com[^>]*>/g) || []), page.match(/<style>[\s\S]*?<\/style>/)[0]].join('');
    fs.writeFileSync(path.join(outDir, 'wormgeddon.fragment.html'), head + body);
    written.push('wormgeddon.html', 'wormgeddon.fragment.html');
    if (fs.existsSync(path.join(root, 'sounds')))
      console.warn('note: sounds/ is not embedded in --single; copy it next to the page for audio files.');
  } else {
    const assets = path.join(outDir, 'assets');
    fs.mkdirSync(assets, { recursive: true });
    const jsName = `app.${hash(js)}.js`,
      cssName = `style.${hash(css)}.css`;
    fs.writeFileSync(path.join(assets, jsName), js);
    fs.writeFileSync(path.join(assets, cssName), css);
    let page = html.replace('@@CSS@@', `<link rel="stylesheet" href="assets/${cssName}" />`);
    page = page.replace('</body>', `<script src="assets/${jsName}"></script></body>`);
    page = await htmlMin.minify(page, htmlOpts);
    fs.writeFileSync(path.join(outDir, 'index.html'), page);
    written.push('index.html', `assets/${cssName}`, `assets/${jsName}`);

    // Maps: images as they are (PNG is already compressed) + a complete manifest.
    if (maps.length) {
      fs.mkdirSync(path.join(outDir, 'maps'));
      for (const m of maps) {
        fs.copyFileSync(path.join(root, 'maps', m.file), path.join(outDir, 'maps', m.file));
        written.push('maps/' + m.file);
      }
      fs.writeFileSync(path.join(outDir, 'maps', 'manifest.json'), JSON.stringify({ maps }));
      written.push('maps/manifest.json');
    }
    // Everything else the page loads at run time by path.
    for (const d of ['sounds']) {
      const src = path.join(root, d);
      if (!fs.existsSync(src)) continue;
      fs.mkdirSync(path.join(outDir, d), { recursive: true });
      for (const f of fs.readdirSync(src)) {
        if (!fs.statSync(path.join(src, f)).isFile() || /\.(md|txt)$/i.test(f)) continue;
        fs.copyFileSync(path.join(src, f), path.join(outDir, d, f));
        written.push(`${d}/${f}`);
      }
    }
  }

  /* ---- 4. Pre-compressed copies of the text files + report ---- */
  let rawTotal = 0, gzTotal = 0, brTotal = 0;
  const rows = [];
  for (const f of written) {
    const p = path.join(outDir, f),
      buf = fs.readFileSync(p);
    const text = /\.(html|css|js|json|svg)$/.test(f);
    let gz = 0, br = 0;
    if (text && compress) {
      const g = zlib.gzipSync(buf, { level: 9 }),
        b = zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length } });
      fs.writeFileSync(p + '.gz', g);
      fs.writeFileSync(p + '.br', b);
      gz = g.length;
      br = b.length;
    }
    if (text) rows.push([f, buf.length, gz, br]);
    rawTotal += buf.length;
  }
  console.log(`${path.relative(process.cwd(), outDir) || '.'}/  (${written.length} files, ${kb(rawTotal)} total)`);
  for (const [f, raw, gz, br] of rows)
    console.log(`  ${f.padEnd(34)} ${kb(raw).padStart(8)}${compress ? `   gzip ${kb(gz).padStart(7)}   brotli ${kb(br).padStart(7)}` : ''}`);
  console.log(`  ${jsFiles.length} scripts -> 1, ${cssFiles.length} stylesheet(s) -> 1, ${maps.length} maps`);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
