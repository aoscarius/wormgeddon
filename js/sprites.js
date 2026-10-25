'use strict';

/**
 * @file sprites.js - Sprites
 *
 * Canvas drawings of projectiles and map objects.
 *
 * Depends on: view, core
 * Globals defined: spriteProj, drawObj
 */

/** Draws a projectile at its position; the look is chosen by the projectile type's `spr` name. Also shows the fuse number for fused types. */
function spriteProj(p) {
  const d = PTYPES[p.t];
  ctx2.save();
  ctx2.translate(p.x, p.y);
  switch (d.spr) {
    case 'rocket':
      ctx2.rotate(p.a);
      ctx2.fillStyle = '#9aa6b2';
      ctx2.fillRect(-7, -2.2, 11, 4.4);
      ctx2.fillStyle = '#e03a2e';
      ctx2.beginPath();
      ctx2.moveTo(4, -2.4);
      ctx2.lineTo(9, 0);
      ctx2.lineTo(4, 2.4);
      ctx2.fill();
      ctx2.fillStyle = '#3a4048';
      ctx2.fillRect(-8, -3.4, 3, 6.8);
      break;
    case 'shell':
      ctx2.rotate(p.a);
      ctx2.fillStyle = '#c9a54a';
      ctx2.fillRect(-5, -2.5, 10, 5);
      ctx2.fillStyle = '#6b4a14';
      ctx2.fillRect(2, -2.5, 3, 5);
      break;
    case 'grenade':
      ctx2.fillStyle = '#3f7a2e';
      ctx2.strokeStyle = '#1b3a14';
      ctx2.lineWidth = 1;
      ctx2.beginPath();
      ctx2.arc(0, 0, 4.4, 0, TAU);
      ctx2.fill();
      ctx2.stroke();
      ctx2.fillStyle = '#ccc';
      ctx2.fillRect(-1, -7, 2, 3);
      break;
    case 'cluster':
      ctx2.fillStyle = '#6a8a2a';
      ctx2.beginPath();
      ctx2.arc(0, 0, 4.6, 0, TAU);
      ctx2.fill();
      ctx2.fillStyle = '#ffb02e';
      for (let i = 0; i < 4; i++) {
        ctx2.beginPath();
        ctx2.arc(Math.cos(i * 1.6) * 2.4, Math.sin(i * 1.6) * 2.4, 1.1, 0, TAU);
        ctx2.fill();
      }
      break;
    case 'banana':
      ctx2.rotate(p.age * 6);
      ctx2.strokeStyle = '#ffd92e';
      ctx2.lineWidth = 3.6;
      ctx2.lineCap = 'round';
      ctx2.beginPath();
      ctx2.arc(0, 0, 5.4, 0.5, 2.7);
      ctx2.stroke();
      ctx2.strokeStyle = '#8a6a10';
      ctx2.lineWidth = 1;
      ctx2.beginPath();
      ctx2.arc(0, 0, 5.4, 0.5, 2.7);
      ctx2.stroke();
      break;
    case 'holy': {
      ctx2.fillStyle = '#ffe27a';
      ctx2.strokeStyle = '#b8860b';
      ctx2.lineWidth = 1;
      ctx2.beginPath();
      ctx2.arc(0, 0, 5, 0, TAU);
      ctx2.fill();
      ctx2.stroke();
      ctx2.fillStyle = '#b8860b';
      ctx2.fillRect(-0.9, -8, 1.8, 5);
      ctx2.fillRect(-2.6, -6.6, 5.2, 1.6);
      const g2 = ctx2.createRadialGradient(0, 0, 2, 0, 0, 18);
      g2.addColorStop(0, 'rgba(255,240,150,.5)');
      g2.addColorStop(1, 'rgba(255,240,150,0)');
      ctx2.fillStyle = g2;
      ctx2.beginPath();
      ctx2.arc(0, 0, 18, 0, TAU);
      ctx2.fill();
      break;
    }
    case 'dynamite':
      ctx2.rotate(Math.sin(p.age * 3) * 0.1);
      ctx2.fillStyle = '#c8322a';
      ctx2.fillRect(-2.5, -7, 5, 14);
      ctx2.fillStyle = '#7a1710';
      ctx2.fillRect(-2.5, -2, 5, 2);
      ctx2.strokeStyle = '#ddd';
      ctx2.beginPath();
      ctx2.moveTo(0, -7);
      ctx2.lineTo(2, -10);
      ctx2.stroke();
      if (Math.random() < 0.7) {
        ctx2.fillStyle = '#ffd23f';
        ctx2.fillRect(1, -12, 2.4, 2.4);
      }
      break;
    case 'petrol':
      ctx2.fillStyle = '#d6561c';
      ctx2.fillRect(-4, -4, 8, 8);
      ctx2.fillStyle = '#222';
      ctx2.fillRect(-1.5, -6, 3, 2);
      break;
    case 'mine': {
      ctx2.fillStyle = '#3e4048';
      ctx2.strokeStyle = '#15161a';
      ctx2.beginPath();
      ctx2.ellipse(0, 1, 6, 3.6, 0, Math.PI, TAU);
      ctx2.fill();
      ctx2.stroke();
      ctx2.fillRect(-6, 1, 12, 1.8);
      const on =
        p.fuse != null ? Math.floor(G.time * 10) % 2 : Math.floor(G.time * 1.5) % 2 && p.age > 1.2;
      ctx2.fillStyle = on ? '#ff4a3a' : '#702018';
      ctx2.beginPath();
      ctx2.arc(0, -1.6, 1.5, 0, TAU);
      ctx2.fill();
      break;
    }
    case 'bomb':
      ctx2.rotate(p.a);
      ctx2.fillStyle = p.t === 'napbomb' ? '#d6561c' : '#30343c';
      ctx2.beginPath();
      ctx2.ellipse(0, 0, 6, 3.4, 0, 0, TAU);
      ctx2.fill();
      ctx2.fillRect(-9, -3, 3, 6);
      break;
    case 'donkey': {
      // Faces the direction it hops in; legs scissor while it is on the move.
      ctx2.scale(p.face || 1, 1);
      const sw = Math.sin(p.age * 14) * 3;
      ctx2.fillStyle = '#6a6a6a';
      ctx2.strokeStyle = '#333';
      ctx2.lineWidth = 1;
      for (const [lx, o] of [
        [-9, sw],
        [-5, -sw],
        [3, -sw],
        [7, sw],
      ]) {
        ctx2.fillRect(lx + o * 0.4, 3, 3, 8);
        ctx2.strokeRect(lx + o * 0.4, 3, 3, 8);
      }
      ctx2.fillStyle = '#9a9a9a';
      ctx2.lineWidth = 1.2;
      ctx2.fillRect(-12, -7, 24, 11);
      ctx2.strokeRect(-12, -7, 24, 11);
      ctx2.fillRect(8, -14, 9, 9);
      ctx2.strokeRect(8, -14, 9, 9);
      ctx2.fillRect(9, -19, 2.4, 5);
      ctx2.fillRect(14, -19, 2.4, 5);
      ctx2.strokeStyle = '#555';
      ctx2.beginPath();
      ctx2.moveTo(-12, -4);
      ctx2.quadraticCurveTo(-17, -2, -15, 4);
      ctx2.stroke();
      ctx2.fillStyle = '#111';
      ctx2.fillRect(14, -12, 1.8, 1.8);
      break;
    }
    case 'dragon': {
      // Green dragon seen from the side, flapping its wings; a flame cone comes out while it breathes.
      ctx2.scale((p.face || 1) * 1.5, 1.5);
      const fl = Math.sin(G.time * 9);
      ctx2.lineCap = 'round';
      ctx2.lineJoin = 'round';
      ctx2.strokeStyle = '#2a5f25';
      ctx2.lineWidth = 5;
      ctx2.beginPath();
      ctx2.moveTo(-12, 3);
      ctx2.quadraticCurveTo(-26, 10 + fl * 2, -36, -3 + fl * 3);
      ctx2.stroke();
      ctx2.fillStyle = '#3d8a35';
      ctx2.strokeStyle = '#1b3a14';
      ctx2.lineWidth = 1;
      ctx2.beginPath(); // wing
      ctx2.moveTo(-4, -4);
      ctx2.lineTo(-20, -26 - fl * 12);
      ctx2.lineTo(-8, -18 - fl * 8);
      ctx2.lineTo(-3, -30 - fl * 12);
      ctx2.lineTo(6, -6);
      ctx2.closePath();
      ctx2.fill();
      ctx2.stroke();
      ctx2.fillStyle = '#4fa545';
      ctx2.beginPath();
      ctx2.ellipse(0, 0, 16, 8, 0, 0, TAU);
      ctx2.fill();
      ctx2.stroke();
      ctx2.fillStyle = '#d9c46a';
      ctx2.beginPath();
      ctx2.ellipse(1, 3, 12, 4, 0, 0, Math.PI);
      ctx2.fill();
      ctx2.fillStyle = '#4fa545';
      ctx2.beginPath(); // neck + head
      ctx2.moveTo(10, -2);
      ctx2.quadraticCurveTo(18, -12, 22, -8);
      ctx2.lineTo(34, -6);
      ctx2.lineTo(34, 0);
      ctx2.lineTo(23, 1);
      ctx2.quadraticCurveTo(18, 6, 10, 5);
      ctx2.closePath();
      ctx2.fill();
      ctx2.stroke();
      ctx2.fillStyle = '#ffe14a';
      ctx2.fillRect(22, -8, 3, 3);
      ctx2.fillStyle = '#c33';
      ctx2.beginPath(); // horn
      ctx2.moveTo(19, -10);
      ctx2.lineTo(14, -18);
      ctx2.lineTo(23, -11);
      ctx2.fill();
      if (p.walk) {
        const f = 0.8 + 0.2 * Math.sin(G.time * 40);
        for (const [col, k] of [
          ['rgba(255,90,20,.85)', 1],
          ['rgba(255,210,70,.9)', 0.6],
        ]) {
          ctx2.fillStyle = col;
          ctx2.beginPath();
          ctx2.moveTo(34, -2);
          ctx2.lineTo(34 + 40 * k * f, -10 * k);
          ctx2.lineTo(34 + 52 * k * f, 6 * k);
          ctx2.lineTo(34 + 30 * k * f, 14 * k);
          ctx2.closePath();
          ctx2.fill();
        }
      }
      break;
    }
    case 'tornado': {
      // Funnel drawn as stacked rings, widest at the top, with debris orbiting it. (0,0) is the foot.
      const n = 12;
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1),
          y = -k * 150,
          rx = 6 + k * 54,
          ox = Math.sin(G.time * 6 + i * 0.7) * 7 * k;
        ctx2.fillStyle = `rgba(${150 - k * 30 | 0},${140 - k * 25 | 0},${132 - k * 20 | 0},${0.7 - k * 0.2})`;
        ctx2.beginPath();
        ctx2.ellipse(ox, y, rx, 5 + k * 4, 0, 0, TAU);
        ctx2.fill();
      }
      ctx2.fillStyle = '#5b4632';
      for (let i = 0; i < 9; i++) {
        const k = (i * 0.37 + G.time * 0.4) % 1,
          a = G.time * 7 + i * 2.1;
        ctx2.fillRect(Math.cos(a) * (10 + k * 62) - 1.5, -k * 150 + Math.sin(a) * 6 - 1.5, 3, 3);
      }
      break;
    }
    case 'proton': {
      // Drawn in world coordinates: a glow at each muzzle, then two wavy orange streams that run to the target and a
      // little past it so that they cross there, with sparks where each stream ends and a flare at the crossing.
      const gm = protonGeom(p);
      if (!gm) break;
      const life = p.net[3],
        endT = PROTON_EQUIP + PROTON_FIRE,
        firing = life >= PROTON_EQUIP && life < endT + PROTON_FADE,
        fade = life > endT ? Math.max(0, 1 - (life - endT) / PROTON_FADE) : 1,
        crossing = gm.a.connected && gm.b.connected;
      ctx2.translate(-p.x, -p.y);
      ctx2.globalCompositeOperation = 'lighter';
      ctx2.lineCap = 'round';
      ctx2.lineJoin = 'round';
      ctx2.globalAlpha = fade;
      const glow = (x, y, r, c0) => {
        const rg = ctx2.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, '#fff');
        rg.addColorStop(0.4, c0);
        rg.addColorStop(1, 'rgba(255,100,20,0)');
        ctx2.fillStyle = rg;
        ctx2.beginPath();
        ctx2.arc(x, y, r, 0, TAU);
        ctx2.fill();
      };
      for (const s of [gm.a, gm.b]) {
        glow(s.x, s.y, life < PROTON_EQUIP ? 3 + (9 * life) / PROTON_EQUIP : 9 + Math.sin(G.time * 40) * 2, 'rgba(255,200,80,.9)');
        if (!firing) continue;
        let ex = s.ex,
          ey = s.ey;
        if (s.connected) {
          const d = Math.hypot(gm.t.x - s.x, gm.t.y - s.y) || 1;
          ex = gm.t.x + ((gm.t.x - s.x) / d) * 24;
          ey = gm.t.y + ((gm.t.y - s.y) / d) * 24;
        }
        const len = Math.hypot(ex - s.x, ey - s.y) || 1,
          nx = -(ey - s.y) / len,
          ny = (ex - s.x) / len,
          N = 16;
        for (const [lw, al, col] of [
          [9, 0.3, '#ff6a10'],
          [4.5, 0.75, '#ffb030'],
          [1.8, 1, '#fff6c8'],
        ]) {
          ctx2.strokeStyle = col;
          ctx2.globalAlpha = al * fade;
          ctx2.lineWidth = lw;
          ctx2.beginPath();
          for (let i = 0; i <= N; i++) {
            const k = i / N,
              off = Math.sin(k * 14 - G.time * 38 + (s === gm.a ? 0 : 2)) * 4 * Math.min(1, k * 4);
            const x = s.x + (ex - s.x) * k + nx * off,
              y = s.y + (ey - s.y) * k + ny * off;
            i ? ctx2.lineTo(x, y) : ctx2.moveTo(x, y);
          }
          ctx2.stroke();
        }
        ctx2.globalAlpha = fade;
        ctx2.strokeStyle = '#ffe08a';
        ctx2.lineWidth = 1.4;
        for (let i = 0; i < 6; i++) {
          const an = Math.random() * TAU,
            r0 = 3 + Math.random() * 4,
            r1 = r0 + 5 + Math.random() * 9;
          ctx2.beginPath();
          ctx2.moveTo(s.ex + Math.cos(an) * r0, s.ey + Math.sin(an) * r0);
          ctx2.lineTo(s.ex + Math.cos(an) * r1, s.ey + Math.sin(an) * r1);
          ctx2.stroke();
        }
      }
      if (firing && crossing) {
        const k = 1 + Math.sin(G.time * 30) * 0.15;
        glow(gm.t.x, gm.t.y, 26 * k, 'rgba(255,170,40,.9)');
        ctx2.strokeStyle = '#fff2b0';
        ctx2.lineWidth = 1.6;
        for (let i = 0; i < 14; i++) {
          const an = Math.random() * TAU,
            r1 = 12 + Math.random() * 26;
          ctx2.beginPath();
          ctx2.moveTo(gm.t.x + Math.cos(an) * 8, gm.t.y + Math.sin(an) * 8);
          ctx2.lineTo(gm.t.x + Math.cos(an) * r1, gm.t.y + Math.sin(an) * r1);
          ctx2.stroke();
        }
      }
      ctx2.globalCompositeOperation = 'source-over';
      ctx2.globalAlpha = 1;
      break;
    }
    case 'kamebeam': {
      // Drawn in world coordinates between the tail and the head: layered blue glow, white core, wisps and orbs.
      const n = p.net;
      if (!n) break;
      ctx2.translate(-p.x, -p.y);
      const [ox, oy, a, hd, tl, L] = n,
        dx = Math.cos(a),
        dy = Math.sin(a),
        ax = ox + dx * tl,
        ay = oy + dy * tl,
        bx = ox + dx * hd,
        by = oy + dy * hd,
        pulse = 1 + Math.sin(G.time * 45) * 0.08,
        gr = ctx2.createLinearGradient(ax, ay, bx, by);
      gr.addColorStop(0, 'rgba(90,180,255,0.2)'); // the tail trails off while the head is still racing ahead
      gr.addColorStop(1, 'rgba(170,225,255,1)');
      ctx2.globalCompositeOperation = 'lighter';
      ctx2.lineCap = 'round';
      ctx2.strokeStyle = gr;
      for (const [w, al] of [
        [KAME_R * 2 * pulse, 0.28],
        [KAME_R * 1.4 * pulse, 0.5],
        [KAME_R * 0.8 * pulse, 0.85],
      ]) {
        ctx2.globalAlpha = al;
        ctx2.lineWidth = w;
        ctx2.beginPath();
        ctx2.moveTo(ax, ay);
        ctx2.lineTo(bx, by);
        ctx2.stroke();
      }
      ctx2.globalAlpha = 0.95;
      ctx2.strokeStyle = '#fff';
      ctx2.lineWidth = KAME_R * 0.35 * pulse;
      ctx2.beginPath();
      ctx2.moveTo(ax, ay);
      ctx2.lineTo(bx, by);
      ctx2.stroke();
      // energy wisps streaming along the beam
      ctx2.globalAlpha = 0.6;
      ctx2.strokeStyle = '#cfeaff';
      ctx2.lineWidth = 1.5;
      for (let i = 0; i < 10; i++) {
        const s0 = tl + Math.random() * Math.max(1, hd - tl),
          off = (Math.random() - 0.5) * KAME_R * 1.8,
          len = 20 + Math.random() * 90;
        ctx2.beginPath();
        ctx2.moveTo(ox + dx * s0 - dy * off, oy + dy * s0 + dx * off);
        ctx2.lineTo(ox + dx * Math.max(tl, s0 - len) - dy * off, oy + dy * Math.max(tl, s0 - len) + dx * off);
        ctx2.stroke();
      }
      // orbs at the muzzle (until the tail has left it) and at the racing head
      ctx2.globalAlpha = 1;
      for (const [x, y, r, on] of [
        [ox, oy, KAME_R * 0.9 * pulse, tl < 1],
        [bx, by, KAME_R * 1.5 * pulse, hd < L],
      ]) {
        if (!on) continue;
        const rg = ctx2.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, 'rgba(255,255,255,1)');
        rg.addColorStop(0.45, 'rgba(150,215,255,.8)');
        rg.addColorStop(1, 'rgba(60,140,255,0)');
        ctx2.fillStyle = rg;
        ctx2.beginPath();
        ctx2.arc(x, y, r, 0, TAU);
        ctx2.fill();
      }
      ctx2.globalCompositeOperation = 'source-over';
      ctx2.globalAlpha = 1;
      break;
    }
    case 'mjolnir': {
      // A stout hammer held up over the caster; it shakes and crackles more and more while it charges.
      const k = p.walk || 0,
        sh = Math.sin(G.time * 50) * k * 1.4;
      ctx2.translate(sh, 0);
      ctx2.rotate(-0.35);
      ctx2.fillStyle = '#7a5230';
      ctx2.strokeStyle = '#2b1c10';
      ctx2.lineWidth = 1;
      ctx2.fillRect(-1.8, -4, 3.6, 22);
      ctx2.strokeRect(-1.8, -4, 3.6, 22);
      ctx2.fillStyle = '#9aa8ba';
      ctx2.beginPath();
      ctx2.rect(-10, -12, 20, 11);
      ctx2.fill();
      ctx2.stroke();
      ctx2.fillStyle = '#cfd8e4';
      ctx2.fillRect(-9, -11, 18, 3);
      ctx2.save();
      ctx2.rotate(0.35);
      ctx2.strokeStyle = `rgba(190,225,255,${0.4 + 0.6 * k})`;
      ctx2.lineWidth = 1.4;
      ctx2.shadowColor = '#7fc4ff';
      ctx2.shadowBlur = 6 + 10 * k;
      for (let i = 0; i < 2 + Math.round(5 * k); i++) {
        const a = G.time * 9 + i * 2.4,
          r0 = 10;
        ctx2.beginPath();
        ctx2.moveTo(Math.cos(a) * r0, -8 + Math.sin(a) * r0);
        ctx2.lineTo(Math.cos(a + 0.2) * (r0 + 7 + 6 * Math.sin(G.time * 31 + i)), -8 + Math.sin(a + 0.2) * (r0 + 9));
        ctx2.stroke();
      }
      ctx2.restore();
      break;
    }
    case 'timecar': {
      // A low retro wedge-shaped sports car seen from the side, wheels glowing, flames out of the back.
      ctx2.scale(p.face || 1, 1);
      const fl = 0.8 + 0.2 * Math.sin(G.time * 45);
      for (const [col, k] of [
        ['rgba(255,110,30,.9)', 1],
        ['rgba(255,225,110,.95)', 0.55],
      ]) {
        ctx2.fillStyle = col;
        ctx2.beginPath();
        ctx2.moveTo(-14, 2);
        ctx2.lineTo(-14 - 30 * k * fl, -3 * k);
        ctx2.lineTo(-14 - 44 * k * fl, 4);
        ctx2.lineTo(-14 - 28 * k * fl, 9 * k);
        ctx2.closePath();
        ctx2.fill();
      }
      ctx2.fillStyle = '#b9c2cc';
      ctx2.strokeStyle = '#2a323c';
      ctx2.lineWidth = 1;
      ctx2.beginPath();
      ctx2.moveTo(-15, 3);
      ctx2.lineTo(-15, -3);
      ctx2.lineTo(-6, -5);
      ctx2.lineTo(-2, -10);
      ctx2.lineTo(8, -10);
      ctx2.lineTo(13, -4);
      ctx2.lineTo(18, -2);
      ctx2.lineTo(18, 4);
      ctx2.closePath();
      ctx2.fill();
      ctx2.stroke();
      ctx2.fillStyle = '#6cc3ff';
      ctx2.beginPath();
      ctx2.moveTo(-1, -4);
      ctx2.lineTo(1, -8.5);
      ctx2.lineTo(7, -8.5);
      ctx2.lineTo(10, -4);
      ctx2.closePath();
      ctx2.fill();
      ctx2.fillStyle = '#ffe14a';
      ctx2.fillRect(16, -2, 3, 2);
      for (const wx of [-8, 11]) {
        ctx2.fillStyle = '#222';
        ctx2.beginPath();
        ctx2.arc(wx, 4, 4.2, 0, TAU);
        ctx2.fill();
        ctx2.strokeStyle = '#ff9a3a';
        ctx2.lineWidth = 1.2;
        ctx2.beginPath();
        ctx2.arc(wx, 4, 2.6, 0, TAU);
        ctx2.stroke();
      }
      break;
    }
    case 'meteor': {
      const g2 = ctx2.createRadialGradient(0, 0, 1, 0, 0, 9);
      g2.addColorStop(0, '#fff3a0');
      g2.addColorStop(0.5, '#ff7a1f');
      g2.addColorStop(1, 'rgba(255,60,0,0)');
      ctx2.fillStyle = g2;
      ctx2.beginPath();
      ctx2.arc(0, 0, 9, 0, TAU);
      ctx2.fill();
      break;
    }
    case 'sheep':
    case 'ssheep': {
      const s = p.face || 1;
      ctx2.scale(p.t === 'ssheep' ? 1 : s, 1);
      if (p.t === 'ssheep') ctx2.rotate(p.a);
      ctx2.fillStyle = '#f4f4f4';
      ctx2.strokeStyle = '#999';
      ctx2.lineWidth = 1;
      ctx2.beginPath();
      ctx2.arc(-1, -1, 6, 0, TAU);
      ctx2.arc(-4, 1, 4, 0, TAU);
      ctx2.fill();
      ctx2.fillStyle = '#222';
      ctx2.beginPath();
      ctx2.arc(5.5, -1, 2.8, 0, TAU);
      ctx2.fill();
      ctx2.fillStyle = '#fff';
      ctx2.fillRect(5, -2.4, 1.2, 1.2);
      const lg = Math.sin(p.walk || 0) * 2;
      ctx2.fillStyle = '#222';
      ctx2.fillRect(-3 + lg, 4, 1.6, 3);
      ctx2.fillRect(2 - lg, 4, 1.6, 3);
      if (p.t === 'ssheep') {
        ctx2.fillStyle = '#e03a2e';
        ctx2.beginPath();
        ctx2.moveTo(-3, -3);
        ctx2.lineTo(-12, -6);
        ctx2.lineTo(-11, 2);
        ctx2.fill();
      }
      break;
    }
    default:
      ctx2.fillStyle = d.col || '#ddd';
      ctx2.beginPath();
      ctx2.arc(0, 0, d.r || 2, 0, TAU);
      ctx2.fill();
  }
  ctx2.restore();
  if (d.beep && p.fuse != null) {
    ctx2.fillStyle = '#fff';
    ctx2.strokeStyle = '#000';
    ctx2.lineWidth = 2.5 / CAM.s;
    ctx2.font = `bold ${13 / CAM.s}px sans-serif`;
    ctx2.textAlign = 'center';
    const s = String(Math.ceil(p.fuse));
    ctx2.strokeText(s, p.x, p.y - 12);
    ctx2.fillText(s, p.x, p.y - 12);
  }
}
/** Draws an oil drum (flashes when lit) or a supply crate (with a parachute while falling). */
function drawObj(o) {
  ctx2.save();
  ctx2.translate(o.x, o.y);
  if (o.k === 'drum') {
    const fl = o.lit && Math.floor(G.time * 14) % 2;
    ctx2.fillStyle = fl ? '#ffb02e' : '#b8382b';
    ctx2.strokeStyle = '#4a120c';
    ctx2.lineWidth = 1.2;
    ctx2.fillRect(-6, -8, 12, 16);
    ctx2.strokeRect(-6, -8, 12, 16);
    ctx2.fillStyle = '#ffd23f';
    ctx2.beginPath();
    ctx2.moveTo(0, -5);
    ctx2.lineTo(3, 1);
    ctx2.lineTo(-3, 1);
    ctx2.fill();
    ctx2.fillStyle = '#4a120c';
    ctx2.fillRect(-6, -3, 12, 1.2);
    ctx2.fillRect(-6, 3, 12, 1.2);
  } else if (o.k === 'crate') {
    if (!o.landed) {
      ctx2.fillStyle = '#f0f0f0';
      ctx2.strokeStyle = '#888';
      ctx2.beginPath();
      ctx2.arc(0, -24, 14, Math.PI, 0);
      ctx2.fill();
      ctx2.stroke();
      ctx2.beginPath();
      ctx2.moveTo(-14, -24);
      ctx2.lineTo(-6, -6);
      ctx2.moveTo(14, -24);
      ctx2.lineTo(6, -6);
      ctx2.stroke();
    }
    ctx2.fillStyle = o.type === 'health' ? '#f4f4f4' : o.type === 'weapon' ? '#caa05a' : '#6ab0d8';
    ctx2.strokeStyle = '#3a2a14';
    ctx2.lineWidth = 1.4;
    ctx2.fillRect(-7, -7, 14, 14);
    ctx2.strokeRect(-7, -7, 14, 14);
    if (o.type === 'health') {
      ctx2.fillStyle = '#d83030';
      ctx2.fillRect(-1.6, -5, 3.2, 10);
      ctx2.fillRect(-5, -1.6, 10, 3.2);
    } else {
      ctx2.strokeStyle = '#3a2a14';
      ctx2.beginPath();
      ctx2.moveTo(-7, -7);
      ctx2.lineTo(7, 7);
      ctx2.moveTo(7, -7);
      ctx2.lineTo(-7, 7);
      ctx2.stroke();
    }
  }
  ctx2.restore();
}
