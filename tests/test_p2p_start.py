"""P2P start-up: a guest must have a valid camera, sea and worm positions the moment the
'start' message is handled (even if snapshots are late, lost or arrive before the level is
built) and must ask the host for a full snapshot until one arrives."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from common import game_page, finish, BASE

HOST = """([base]) => {
  const w = window.__wh;
  const cfg = Object.assign({seed:'p2p'}, base);
  w.newGame(cfg, [{name:'A',ctrl:'local'},{name:'B',ctrl:'remote'}]);
  const g = w.G; for (let i=0;i<30;i++) w.stepOnce(1/60);
  const start = {t:'start', cfg, teams: g.teams.map(t=>({id:t.id,name:t.name,ctrl:t.ctrl})),
    worms: g.worms.map(x=>({id:x.id,team:x.team,name:x.name,x:x.x,y:x.y,face:x.face})), my:1,
    snap: JSON.parse(JSON.stringify(snapshot(true)))};
  const old = JSON.parse(JSON.stringify({t:'start', cfg, teams:start.teams,
    worms: g.worms.map(x=>({id:x.id,team:x.team,name:x.name})), my:1}));
  return {start, old, snap: JSON.parse(JSON.stringify(snapshot(true)))};
}"""

CHECK = """([m]) => {
  NET.role='client'; window.__sent=[]; NET.send = x => window.__sent.push(x.t);
  clientMsg(m);
  const ok = v => isFinite(v);
  const out = {cam: ok(CAM.x)&&ok(CAM.y)&&ok(CAM.z)&&CAM.z>0, water: ok(G.waterY)&&ok(G.waterTarget),
    worms: G.worms.every(w=>ok(w.x)&&ok(w.y)), sent: window.__sent.slice()};
  for (let i=0;i<5;i++){ camFocus(1/60); }
  out.camAfter = ok(CAM.x)&&ok(CAM.y);
  return out;
}"""

fails = []
with game_page() as (ph, eh):
    d = ph.evaluate(HOST, [BASE])
for name, key in (('with positions', 'start'), ('legacy start (no positions)', 'old')):
    with game_page() as (pg, errors):
        r = pg.evaluate(CHECK, [d[key]])
        print(name, r)
        for k in ('cam', 'camAfter', 'water'):
            if not r[k]: fails.append(f'{name}: {k}')
        if key == 'start' and not r['worms']: fails.append('worms without positions')
        if 'ready' not in r['sent']: fails.append(f'{name}: no ready request')
        # a late snapshot repairs everything
        pg.evaluate("([s]) => clientMsg(s)", [d['snap']])
        r2 = pg.evaluate("G.worms.every(w=>isFinite(w.x)&&isFinite(w.y)) && isFinite(CAM.x)")
        if not r2: fails.append(f'{name}: snapshot did not fix state')
        fails += [f'page error {e}' for e in errors]
# a NaN camera recovers by itself
with game_page() as (pg, errors):
    pg.evaluate("NET.role='client'")
    r = pg.evaluate("([m]) => { clientMsg(m); CAM.x=NaN; CAM.y=NaN; camFocus(1/60); return isFinite(CAM.x)&&isFinite(CAM.y); }", [d['start']])
    if not r: fails.append('NaN camera did not recover')
# snapshots that arrive before the (async) start completes are kept
with game_page() as (pg, errors):
    r = pg.evaluate("""([m,s]) => { NET.role='client'; NET.send=()=>{}; NET.loading=true; clientMsg(s);
      const kept = !!NET.early; NET.loading=false; startClientGame(m); return kept && G.worms.every(w=>isFinite(w.x)); }""", [d['start'], d['snap']])
    if not r: fails.append('early snapshot lost')
finish(fails)
