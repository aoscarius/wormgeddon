"""Touch gamepad: Jump / Fire change look and meaning on the rope or jet pack with another weapon selected."""
from common import game_page, finish, BASE

with game_page(mobile=True) as (pg, errors):
    assert pg.evaluate("matchMedia('(pointer:coarse)').matches"), "needs a touch emulation"
    r = pg.evaluate("""([base]) => {
      const w = window.__wh;
      w.newGame(Object.assign({seed: 'tj'}, base), [{name:'A',ctrl:'local'},{name:'B',ctrl:'local'}]);
      enterGame(); for (let i = 0; i < 90; i++) w.stepOnce(1/60);
      const g = w.G, a = g.worms.find(x => x.id === g.active), j = () => document.getElementById('tjump'), f = () => document.getElementById('tfire');
      const snap = () => ({shoot: j().classList.contains('shoot'), release: f().classList.contains('release'), img: j().querySelector('img') ? j().querySelector('img').getAttribute('src').slice(0, 10) : null, tag: (j().querySelector('.tag') || {}).textContent || null, jl: j().getAttribute('aria-label'), fl: f().getAttribute('aria-label')});
      touchFx(); const idle = snap();
      g.weapon.id = 'jetpack'; edge('fireP'); w.stepOnce(1/60); touchFx(); const jetOwn = snap();   // jet pack selected: normal buttons
      g.weapon.id = 'bazooka'; touchFx(); const alt = snap();                                        // other weapon: new meaning
      setLang('it'); j().dataset.mode = ''; touchFx(); const it = snap(); setLang('en');
      edge('fireP'); w.stepOnce(1/60); j().dataset.mode = 'x'; touchFx(); const after = snap();      // let go: back to normal
      return {idle, jetOwn, alt, it, after};
    }""", [BASE])
    print(r)
    assert not r["idle"]["shoot"] and not r["idle"]["release"] and r["idle"]["jl"] == "Jump"
    assert not r["jetOwn"]["shoot"]
    assert r["alt"]["shoot"] and r["alt"]["release"] and r["alt"]["img"].startswith("data:image") and r["alt"]["tag"] == "FIRE"
    assert r["alt"]["jl"] == "Fire selected weapon" and r["alt"]["fl"] == "Let go"
    assert r["it"]["tag"] == "FUOCO" or r["it"]["jl"] == "Spara l’arma scelta"
    assert not r["after"]["shoot"] and not r["after"]["release"] and r["after"]["jl"] == "Jump"
    pg.screenshot(path="/tmp/touch-alt.png")
    finish(errors)
