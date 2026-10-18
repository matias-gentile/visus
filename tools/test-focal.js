// Prueba de la calibración de la focal sin cinta: vistas inclinadas y quietas, con el celular girando sobre la muñeca
// y obturador rodante durante los movimientos. Uso: node tools/test-focal.js
'use strict';
const VC = require('./vc-loader');
const S = require('./sim');

const W = 1280, H = 720, Lp = 1280, readout = 25; // ms de lectura del sensor
const R = S.rng(5);
let worst = 0;
for (const [f35, wrist] of [[26, 1], [26, 2], [13, 1.5]]) {
  const f = S.focalPx(f35, W, H);
  const poses = [[0, 0], [26, 3], [-24, 6], [2, 22], [-4, -20], [22, -12]];
  const seq = [];
  for (let k = 1; k < poses.length; k++) {
    const [a0, b0] = poses[k - 1], [a1, b1] = poses[k];
    for (let i = 0; i < 8; i++) { const s = (i + 1) / 8; seq.push({ yaw: a0 + (a1 - a0) * s, pitch: b0 + (b1 - b0) * s, vy: (a1 - a0) / 0.8, vp: (b1 - b0) / 0.8 }); }
    for (let i = 0; i < 10; i++) seq.push({ yaw: a1 + (R() - 0.5) * 0.4, pitch: b1 + (R() - 0.5) * 0.4, vy: (R() - 0.5) * 4, vp: (R() - 0.5) * 4 });
  }
  let prev = null; const eqs = [];
  for (const q of seq) {
    const rs = { dyaw: q.vy * readout / 1000 * (1 + wrist), dpitch: q.vp * readout / 1000 * (1 + wrist) };
    const img = S.render({ W, H, f, D: 480, yaw: q.yaw, pitch: q.pitch, roll: 2, PAT: VC.PAT, cam: { yaw: wrist * q.yaw * 0.2, pitch: wrist * q.pitch * 0.2 }, rsCam: rs });
    const r = VC.analyzePattern(img, f, Lp);
    if (r.ok && prev && prev.ok) {
      let d = 0; for (let i = 0; i < 4; i++) d += Math.hypot(r.markers[i][0] - prev.markers[i][0], r.markers[i][1] - prev.markers[i][1]);
      r.still = (d / 4) / Lp < 0.006; // mismo umbral que la app
    }
    if (r.ok && r.calEq && r.still) eqs.push(r.calEq);
    prev = r;
  }
  const est = VC.focalJoint(eqs) * Lp, err = (est / f - 1) * 100;
  worst = Math.max(worst, Math.abs(err));
  console.log(`lente ${f35} mm, muñeca ×${wrist}: ${eqs.length} vistas quietas → error de la focal ${err.toFixed(2)} %`);
}
console.log(worst < 2 ? '\nOK (error < 2 %)' : '\nFALLA (error ≥ 2 %)');
process.exit(worst < 2 ? 0 : 1);
