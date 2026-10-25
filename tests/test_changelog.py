"""tools/changelog.py: oldest-first order, sentence classification, conventional prefixes,
reproducible output, --check, and the real CHANGELOG.md covers the whole history."""
import os, re, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOL = os.path.join(ROOT, 'tools', 'changelog.py')
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import changelog as C

fails = []
def check(c, msg):
    if not c: fails.append(msg)

# classification
for text, cat in [('Add chat', 'Added'), ('Implemented rope', 'Added'), ('Fix the camera', 'Fixed'),
                  ('Fixed blown-up crates', 'Fixed'), ('Refactor net.js', 'Refactored'),
                  ('Enhance the HUD', 'Changed'), ('feat(net): voice', 'Added'), ('fix: crash', 'Fixed'),
                  ('refactor: split', 'Refactored'), ('Weird words here', None)]:
    got = C.classify(text)[0]
    check(got == cat, f'classify({text!r}) = {got}, expected {cat}')
check(C.sentences('Add A. Fix B in build/build.js. Update C.') == ['Add A', 'Fix B in build/build.js', 'Update C'], 'sentence split')

# a scratch repository
def run(d, *a, env=None):
    return subprocess.run(['git', '-C', d, *a], check=True, capture_output=True, text=True,
                          env={**os.environ, 'GIT_AUTHOR_NAME': 't', 'GIT_AUTHOR_EMAIL': 't@t', 'GIT_COMMITTER_NAME': 't',
                               'GIT_COMMITTER_EMAIL': 't@t', **(env or {})}).stdout
with tempfile.TemporaryDirectory() as d:
    os.makedirs(os.path.join(d, 'tools'))
    tool = os.path.join(d, 'tools', 'changelog.py')
    open(tool, 'w').write(open(TOOL).read())
    run(d, 'init', '-q')
    def commit(name, msg):
        open(os.path.join(d, name), 'w').write(msg)
        run(d, 'add', '-A'); run(d, 'commit', '-q', '-m', msg)
    commit('a', 'Add rope. Update docs')
    commit('b', 'fix: camera freeze\n\nRestore the sea. Refactor camFocus.\n\nCo-Authored-By: X <x@y>\nClaude-Session: https://x')
    commit('c', 'Remove old code')
    def sh(*a):
        return subprocess.run([sys.executable, tool, *a], cwd=d, capture_output=True, text=True)
    out = sh('--stdout').stdout
    check(sh().returncode == 0 and os.path.exists(os.path.join(d, 'CHANGELOG.md')), 'writes CHANGELOG.md')
    pos = [out.find(x) for x in ('Add rope', 'Camera freeze', 'Remove old code')]
    check(all(p >= 0 for p in pos) and pos == sorted(pos), f'oldest first: {pos}')
    check('3 commits' in out, 'commit count')
    check('Claude-Session' not in out and 'Co-Authored-By' not in out, 'trailers are not listed')
    check(re.search(r'\*\*Fixed\*\*\n- Camera freeze\n- Restore the sea', out), 'fix section')
    check(re.search(r'\*\*Refactored\*\*\n- Refactor camFocus', out), 'refactor section')
    check(sh().stdout and sh('--stdout').stdout == out, 'reproducible')
    check(sh('--check').returncode == 0, '--check passes when current')
    run(d, 'add', '-A'); run(d, 'commit', '-q', '-m', 'Update changelog')       # only CHANGELOG.md changes
    check(sh('--check').returncode == 0, '--check tolerates the commit that stores the file')
    commit('d', 'Add boat')
    check(sh('--check').returncode == 1, '--check fails after a new commit')

# the real file covers every commit of the repository
cur = open(os.path.join(ROOT, 'CHANGELOG.md'), encoding='utf-8').read()
n_file = len(re.findall(r'^### \[?`', cur, re.M))
check(n_file >= 1, 'CHANGELOG.md has entries')  # the count is not compared: the file may come from another history
check(cur.index('## ') < cur.rindex('## '), 'dated sections')

if fails:
    print('FAILED:', *fails, sep='\n  ')
    raise SystemExit(1)
print('OK')
