// Prueba de la medición de anteojos con barridos simulados (trazado de rayos).
// Uso: node tools/test-lens.js          (completo, unos 3 minutos)
//      node tools/test-lens.js --quick  (3 casos, menos de 1 minuto)
// Sale con código 1 si algún caso no da la graduación exacta.
'use strict';
const VC = require('./vc-loader');
const S = require('./sim');

const quick = process.argv.includes('--quick');
const W = 1280, H = 720, f = S.focalPx(26, W, H);
const fmt = x => (x < 0 ? '−' : x > 0 ? '+' : '') + Math.abs(x).toFixed(2).replace('.', ',');
const rxs = r => !r ? '—' : r.fail ? 'sin resultado (' + r.fail + ')' : r.weak ? 'plano' : (r.C ? `${fmt(r.S)} ${fmt(r.C)} × ${r.axis}` : `${fmt(r.S)} esf`);

// [nombre esperado, meridianos de la lente: potencia Pa en el meridiano phi (y arriba, visto desde el lado del usuario), Pb a 90°]
const ALL = [
  ['−2,50 esf', { Pa: -2.5, Pb: -2.5, phi: 0 }],
  ['−2,00 −1,00 × 150', { Pa: -2, Pb: -3, phi: 30 }],
  ['−4,50 −0,75 × 10', { Pa: -4.5, Pb: -5.25, phi: 170 }],
  ['+2,50 esf', { Pa: 2.5, Pb: 2.5, phi: 0 }],
  ['+3,50 −1,00 × 90', { Pa: 2.5, Pb: 3.5, phi: 0 }],
  ['−0,75 esf', { Pa: -0.75, Pb: -0.75, phi: 0 }],
  ['−7,00 esf', { Pa: -7, Pb: -7, phi: 0 }],
  ['−3,25 −2,00 × 45', { Pa: -3.25, Pb: -5.25, phi: 135 }],
];
const CASES = quick ? [ALL[0], ALL[1], ALL[3]] : ALL;
const HANDS = quick ? [[3, 0.08, 6]] : [[3, 0.08, 6], [11, 0.25, 10], [29, 0.15, 8]]; // [semilla, prob. de salto, temblor mm]

// Mismo control de movimiento que la app: el círculo no puede correrse más de 120 mm/s.
function markMoving(frames) {
  let p = null;
  return frames.map(fr => {
    if (p && fr.t - p.t < 400) fr.moving = Math.hypot(fr.ringC[0] - p.ringC[0], fr.ringC[1] - p.ringC[1]) / ((fr.t - p.t) / 1000) > 120;
    p = fr; return fr;
  });
}

let ok = 0, n = 0;
const t0 = Date.now();
for (const [exp, lens] of CASES) {
  for (const [seed, jumpProb, wander] of HANDS) {
    const sweep = S.sweepFrames({ seed, n: quick ? 40 : 60, lens, jumpProb, wander, jump: 22 });
    const got = [];
    for (const q of sweep) {
      const r = VC.analyzePattern(S.render({ W, H, f, D: q.D, yaw: q.yaw, pitch: q.pitch, roll: q.roll, PAT: VC.PAT, glasses: q.glasses }), f, W);
      if (r.ok && r.fit && r.P1 != null && r.Dmm > 250 && r.Dmm < 1000) got.push(Object.assign(r, { t: q.t }));
    }
    const res = VC.lensRobust(markMoving(got));
    const good = rxs(res) === exp;
    n++; ok += good ? 1 : 0;
    console.log(`${exp.padEnd(20)} semilla ${String(seed).padStart(2)} → ${rxs(res).padEnd(22)} ${good ? '✓' : '✗'}  confianza ${res.conf || '-'}, cuadros usados ${res.inliers}/${res.n}`);
  }
}
console.log(`\n${ok}/${n} exactos · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(ok === n ? 0 : 1);
