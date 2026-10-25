#!/usr/bin/env python3
"""Generate CHANGELOG.md from the git history, oldest commit first.

    python3 tools/changelog.py            # rewrite CHANGELOG.md
    python3 tools/changelog.py --check    # exit 1 when CHANGELOG.md is out of date (CI / hooks)
    python3 tools/changelog.py --stdout   # print instead of writing

Every commit becomes one entry. Its subject and body are split into sentences and each sentence is
filed under Added / Fixed / Changed / Refactored / Docs / Tests by its leading verb (or by a
conventional prefix such as `feat:`, `fix(net):`, `refactor:`). Sentences that do not start with a
known verb keep the commit's main category. The file is rebuilt from scratch on each run, so it is
reproducible: the same history always gives the same file. See docs/DEVELOPING.md ("Changelog").
"""
import argparse, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'CHANGELOG.md')
ORDER = ['Added', 'Fixed', 'Changed', 'Refactored', 'Docs', 'Tests']

PREFIX = {'feat': 'Added', 'feature': 'Added', 'add': 'Added', 'fix': 'Fixed', 'bugfix': 'Fixed',
          'refactor': 'Refactored', 'docs': 'Docs', 'doc': 'Docs', 'test': 'Tests', 'tests': 'Tests',
          'perf': 'Changed', 'chore': 'Changed', 'style': 'Changed', 'build': 'Changed', 'ci': 'Changed'}
VERBS = [  # (category, regex of leading verbs)
    ('Refactored', r'refactor\w*|restructur\w*|reorganiz\w*|reorganis\w*|clean(?:ed)?\s?up|simplif\w*|extract\w*|rename\w*|move[ds]?'),
    ('Fixed', r'fix\w*|resolv\w*|correct\w*|repair\w*|restor\w*|prevent\w*|solv\w*|patch\w*|adjust\w*'),
    ('Added', r'add\w*|implement\w*|introduc\w*|creat\w*|embed\w*|support\w*|new|enabl\w*|includ\w*'),
    ('Docs', r'document\w*|doc'),
    ('Tests', r'test\w*'),
    ('Changed', r'update\w*|enhanc\w*|improv\w*|modif\w*|chang\w*|replac\w*|remov\w*|tweak\w*|tune[ds]?|reduc\w*|increas\w*|make|made|ensure\w*|upgrad\w*'),
]


def git(*args):
    return subprocess.run(['git', '-C', ROOT, *args], check=True, capture_output=True, text=True).stdout


def sentences(text):
    text = re.sub(r'\s+', ' ', text.strip())
    # split at ". " before a capital letter, but not inside things like "build/build.js" or "e.g."
    parts = re.split(r'(?<=[.!?])\s+(?=[A-Z`])', text)
    return [p.strip().rstrip('.').strip() for p in parts if p.strip().strip('.')]


def classify(sentence, default=None):
    m = re.match(r'^(\w+)(?:\([^)]*\))?!?:\s*(.*)$', sentence)
    if m and m.group(1).lower() in PREFIX:
        return PREFIX[m.group(1).lower()], m.group(2)
    first = re.match(r'^[`\W]*([A-Za-z]+)', sentence)
    word = first.group(1).lower() if first else ''
    for cat, rx in VERBS:
        if re.fullmatch(rx, word):
            return cat, sentence
    return default, sentence


def entries(upto='HEAD'):
    raw = git('log', upto, '--reverse', '--topo-order', '--no-merges', '--format=%H%x1f%h%x1f%ad%x1f%an%x1f%s%x1f%b%x1e', '--date=short')
    out = []
    for rec in raw.split('\x1e'):
        rec = rec.strip('\n')
        if not rec.strip():
            continue
        full, short, date, author, subject, body = rec.split('\x1f')
        body = '\n'.join(l for l in body.splitlines() if not re.match(r'^(Co-Authored-By|Claude-Session|Signed-off-by):', l, re.I))
        items, main = [], None
        for i, s in enumerate(sentences(subject + '. ' + body if body.strip() else subject)):
            cat, text = classify(s, main)
            if cat is None:
                cat = 'Changed'
            if i == 0:
                main = cat  # unlabeled follow-up sentences share the commit's main category
            text = text[0].upper() + text[1:]
            if text not in [t for _, t in items]:
                items.append((cat, text))
        out.append({'hash': full, 'short': short, 'date': date, 'author': author, 'subject': subject, 'items': items})
    return out


def remote():
    try:
        url = git('config', '--get', 'remote.origin.url').strip()
    except subprocess.CalledProcessError:
        return None
    m = re.match(r'(?:git@github\.com:|https://github\.com/)(.+?)(?:\.git)?$', url)
    return f'https://github.com/{m.group(1)}' if m else None


def render(upto='HEAD'):
    es, base = entries(upto), remote()
    lines = ['# Changelog', '',
             'Generated from the git history by `python3 tools/changelog.py` - do not edit by hand.',
             'Commits are listed from the first one to the most recent; each is split into what was added,',
             'fixed, changed or refactored.', '']
    lines.append(f'{len(es)} commits, {es[0]["date"]} to {es[-1]["date"]}. Up to commit `{es[-1]["hash"]}`.' if es else 'No commits yet.')
    lines.append('')
    day = None
    for e in es:
        if e['date'] != day:
            day = e['date']
            lines += [f'## {day}', '']
        ref = f'[`{e["short"]}`]({base}/commit/{e["hash"]})' if base else f'`{e["short"]}`'
        lines += [f'### {ref}', '']
        for cat in ORDER:
            its = [t for c, t in e['items'] if c == cat]
            if its:
                lines.append(f'**{cat}**')
                lines += [f'- {t}' for t in its]
                lines.append('')
    return '\n'.join(lines).rstrip() + '\n'


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--check', action='store_true', help='fail if CHANGELOG.md is not up to date')
    ap.add_argument('--stdout', action='store_true', help='print the changelog instead of writing it')
    a = ap.parse_args()
    text = render()
    if a.stdout:
        sys.stdout.write(text)
    elif a.check:
        cur = open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
        # The commit that stores the changelog cannot list itself, so the file is compared with the history
        # up to the commit it names; later commits must then touch nothing but CHANGELOG.md.
        m = re.search(r'Up to commit `([0-9a-f]{40})`', cur)
        try:
            ok = bool(m) and render(m.group(1)) == cur
            if ok:
                later = git('diff', '--name-only', m.group(1), 'HEAD').split()
                ok = all(f == 'CHANGELOG.md' for f in later)
        except subprocess.CalledProcessError:
            ok = False
        if not ok:
            print('CHANGELOG.md is out of date: run python3 tools/changelog.py')
            return 1
        print('CHANGELOG.md is up to date')
    else:
        open(OUT, 'w', encoding='utf-8').write(text)
        print(f'wrote {OUT}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
