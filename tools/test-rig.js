// Prueba del modo «con el soporte»: patrón impreso a 30 cm, lente fija a mitad de camino, celular apaisado
// e inclinado 4°, armazones de distintas alturas y patrón impreso con escala corrida (no debería importar).
// Uso: node tools/test-rig.js
'use strict';
const VC = require('./vc-loader');
const S = require('./sim');

const W = 1280, H = 720, f = S.focalPx(26, W, H), D = 300;
const fmt = x => (x < 0 ? '−' : x > 0 ? '+' : '') + Math.abs(x).toFixed(2).replace('.', ',');
const rxs = r => !r ? '—' : r.fail ? 'sin resultado (' + r.fail + ')' : r.weak ? 'plano' : (r.C ? `${fmt(r.S)} ${fmt(r.C)} × ${r.axis}` : `${fmt(r.S)} esf`);
const CASES = [
  // [esperado, lente, altura media del aro (mm), descentrado (mm), escala de impresión]
  ['−2,50 esf', { Pa: -2.5, Pb: -2.5, phi: 0 }, 17, [2, 3], 1],
  ['−2,00 −1,00 × 150', { Pa: -2, Pb: -3, phi: 30 }, 20, [-4, 1], 0.96],
  ['+2,50 esf', { Pa: 2.5, Pb: 2.5, phi: 0 }, 16, [1, -3], 1],
  ['+4,50 −0,75 × 100', { Pa: 3.75, Pb: 4.5, phi: 170 }, 19, [0, 2], 1],
  ['−6,00 −1,50 × 70', { Pa: -6, Pb: -7.5, phi: 110 }, 22, [3, -2], 0.94],
  ['−0,75 esf', { Pa: -0.75, Pb: -0.75, phi: 0 }, 24, [-2, 4], 1],
  ['plano', { Pa: 0, Pb: 0, phi: 0 }, 18, [0, 0], 1],
];
const R = S.rng(9);
let ok = 0;
for (const [exp, lens, ay, off, scale] of CASES) {
  const frames = [];
  for (let i = 0; i < 14; i++) {
    const img = S.render({ W, H, f, D, roll: 90 + (R() - 0.5) * 0.4, pitch: 0, yaw: 0, PAT: VC.PAT_RIG, scaleTrue: scale,
      cam: { yaw: 1.5, pitch: 3 }, glasses: { u: 0.5, off, lens, side: 'OD', ax: 26, ay } });
    const r = VC.analyzePattern(img, f, W, VC.PAT_RIG);
    if (r.ok && r.fit) frames.push({ P1: VC.powerAt(r.M1, D), P2: VC.powerAt(r.M2, D), phi1: r.phi1 });
  }
  const res = VC.lensStatic(frames), got = rxs(res), good = got === exp;
  ok += good ? 1 : 0;
  console.log(`${exp.padEnd(20)} aro ±${ay} mm, escala ${scale} → ${got.padEnd(22)} ${good ? '✓' : '✗'}  cuadros ${frames.length}/14, confianza ${res.conf || '-'}`);
}
console.log(`\n${ok}/${CASES.length} exactos`);
process.exit(ok === CASES.length ? 0 : 1);
