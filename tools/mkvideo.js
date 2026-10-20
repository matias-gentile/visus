// Genera un video Y4M para usar como cámara falsa de Chromium.
//   node tools/mkvideo.js         → tools/out/lens.y4m: 3 s sin anteojo y 15 s de barrido con −2,50 a 50 cm de la pantalla
//   node tools/mkvideo.js --rig   → tools/out/rig.y4m: soporte impreso, 2 s sin anteojo y 8 s con −2,50 −0,75 × 160 quieto
'use strict';
const fs = require('fs');
const path = require('path');
const VC = require('./vc-loader');
const S = require('./sim');

const rig = process.argv.includes('--rig');
const out = path.join(__dirname, 'out', rig ? 'rig.y4m' : 'lens.y4m');
fs.mkdirSync(path.dirname(out), { recursive: true });
const W = 1280, H = 720, fps = 10, f = S.focalPx(26, W, H), D = rig ? 300 : 500;
// En el soporte: meridiano de 20° con −2,50 y el de 110° con −3,25 → −2,50 −0,75 × 160 (TABO, visto desde el usuario).
const lens = rig ? { Pa: -2.5, Pb: -3.25, phi: 20 } : { Pa: -2.5, Pb: -2.5, phi: 0 };
const R = S.rng(42);
const fd = fs.openSync(out, 'w');
fs.writeSync(fd, `YUV4MPEG2 W${W} H${H} F${fps}:1 Ip A1:1 C420jpeg\n`);
const uv = Buffer.alloc((W / 2) * (H / 2) * 2, 128);
const total = (rig ? 10 : 18) * fps;
for (let i = 0; i < total; i++) {
  const t = i / fps;
  if (rig) {
    const o = { W, H, f, D, roll: 0.3, PAT: VC.PAT_RIG, cam: { yaw: 1, pitch: 3 } };
    if (t >= 2) o.glasses = { u: 0.5, off: [2, 3], lens, side: 'OD', ax: 26, ay: 18 };
    writeFrame(S.render(o));
    continue;
  }
  const o = { W, H, f, D: D + (R() - 0.5) * 4, yaw: 3 + (R() - 0.5) * 0.6, pitch: -2 + (R() - 0.5) * 0.6, roll: 2, PAT: VC.PAT };
  if (t >= 3) {
    const u = 0.9 - 0.78 * Math.sin(Math.PI * ((t - 3) / 15) * 2) ** 2;
    o.glasses = { u, off: [(R() - 0.5) * 10, (R() - 0.5) * 8], lens, side: 'OD' };
  }
  writeFrame(S.render(o));
  if (i % 30 === 0) process.stdout.write(`\r${i}/${total} cuadros`);
}
function writeFrame(img) {
  const y = Buffer.alloc(W * H);
  for (let k = 0; k < W * H; k++) y[k] = img.data[k * 4];
  fs.writeSync(fd, 'FRAME\n'); fs.writeSync(fd, y); fs.writeSync(fd, uv);
}
fs.closeSync(fd);
console.log(`\rVideo listo: ${out} (${total} cuadros)`);
