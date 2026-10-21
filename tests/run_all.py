"""Runs every test_*.py / smoke.py in this folder and reports a summary. Exit code 1 on any failure."""
import pathlib
import subprocess
import sys

here = pathlib.Path(__file__).resolve().parent
files = [here / "smoke.py"] + sorted(here.glob("test_*.py"))
failed = []
for f in files:
    print(f"\n=== {f.name} ===", flush=True)
    if subprocess.run([sys.executable, str(f)], cwd=here).returncode:
        failed.append(f.name)
print("\n" + ("FAILED: " + ", ".join(failed) if failed else "ALL PASSED"))
sys.exit(1 if failed else 0)
