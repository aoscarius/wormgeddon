"""Build: node build/build.js makes a minified, hashed, compressed deployable folder that really works.

Skipped (exit 0) when Node or the build dependencies (cd build && npm install) are missing.
"""
import functools
import http.server
import pathlib
import shutil
import subprocess
import tempfile
import threading

from common import ROOT, game_page, finish

if not shutil.which("node") or not (ROOT / "build" / "node_modules" / "esbuild").exists():
    print("SKIP: node or build/node_modules missing (cd build && npm install)")
    raise SystemExit(0)

out = pathlib.Path(tempfile.mkdtemp(prefix="wh-build-"))
r = subprocess.run(["node", str(ROOT / "build" / "build.js"), "--out", str(out)], capture_output=True, text=True)
print(r.stdout)
assert r.returncode == 0, r.stderr

js = list((out / "assets").glob("app.*.js"))
css = list((out / "assets").glob("style.*.css"))
assert len(js) == 1 and len(css) == 1, "one hashed js and one hashed css"
src = sum(f.stat().st_size for f in (ROOT / "js").glob("*.js"))
assert js[0].stat().st_size < src * 0.6, "js must be minified"
for f in (js[0], css[0], out / "index.html", out / "maps" / "manifest.json"):
    assert f.with_name(f.name + ".gz").exists() and f.with_name(f.name + ".br").exists(), f"missing .gz/.br for {f.name}"
page = (out / "index.html").read_text()
assert js[0].name in page and css[0].name in page and "js/util.js" not in page and "css/style.css" not in page
assert (out / "sounds").exists() == (ROOT / "sounds").exists()

# Serve the folder over http (so the maps/ manifest is fetched like on a real host) and play a bit.
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(out))
handler.log_message = lambda *a, **k: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
try:
    with game_page(url=f"http://127.0.0.1:{srv.server_address[1]}/index.html", wait=1500) as (pg, errors):
        n_maps = len(list((out / "maps").glob("*.png")))
        listed = pg.evaluate("document.querySelectorAll('#oLib option').length - 1")
        print("maps in the library:", listed, "of", n_maps)
        assert listed == n_maps
        ok = pg.evaluate("""() => { const w = window.__wh;
          w.newGame({seed:'b', style:'hills', theme:'grass', size:'m', hp:100, turnTime:30, arsenal:'std', mines:0, drums:0, crates:0, sd:0, worms:2},
                    [{name:'A',ctrl:'ai'},{name:'B',ctrl:'ai'}]);
          for (let i = 0; i < 60*20; i++) w.stepOnce(1/60);
          return w.G.worms.length === 4 && !w.missingTranslations().length; }""")
        assert ok
        finish([e for e in errors if "fonts.googleapis" not in e and "peerjs" not in e.lower()])
finally:
    srv.shutdown()
    shutil.rmtree(out, ignore_errors=True)
