"""Shared helpers for the browser tests: launch Chromium, open the game, collect page errors."""
import contextlib
import os
import pathlib
import shutil

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX_URL = (ROOT / "index.html").as_uri()
DIST_URL = (ROOT / "dist" / "index.html").as_uri()

# A few ready-to-use match settings (same keys as the options screen).
BASE = dict(style="hills", theme="grass", size="m", hp=100, turnTime=45, arsenal="full",
            mines=0, drums=0, crates=0, sd=0, worms=3, rise=0)


def chromium_path():
    """CHROMIUM_PATH env var, else the common sandbox location, else Playwright's own browser."""
    for c in (os.environ.get("CHROMIUM_PATH"), "/opt/pw-browsers/chromium"):
        if c and pathlib.Path(c).exists():
            return c
    return shutil.which("chromium") or shutil.which("chromium-browser") or None


@contextlib.contextmanager
def game_page(url=None, viewport=None, wait=500, mobile=False):
    """Yields (page, errors). `errors` collects uncaught page exceptions; tests should assert it is empty.

    Set WH_BUILD=1 to test dist/wormgeddon.html instead of the development index.html.
    """
    url = url or (DIST_URL if os.environ.get("WH_BUILD") else INDEX_URL)
    errors = []
    with sync_playwright() as p:
        kw = {"args": ["--no-sandbox"]}
        exe = chromium_path()
        if exe:
            kw["executable_path"] = exe
        browser = p.chromium.launch(**kw)
        if mobile:  # touch device: coarse pointer, so the on-screen gamepad is built
            ctx = browser.new_context(viewport=viewport or {"width": 740, "height": 360}, has_touch=True, is_mobile=True)
            page = ctx.new_page()
        else:
            page = browser.new_page(**({"viewport": viewport} if viewport else {}))
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(url)
        page.wait_for_timeout(wait)
        try:
            yield page, errors
        finally:
            browser.close()


def finish(errors):
    """Prints page errors and exits non-zero when there are any."""
    if errors:
        print("PAGE ERRORS:", *errors, sep="\n")
        raise SystemExit(1)
    print("OK")
