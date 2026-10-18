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
