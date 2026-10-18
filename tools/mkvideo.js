// Genera un video Y4M para usar como cámara falsa de Chromium: 3 s sin anteojo y 15 s de barrido con una lente
// de −2,50 a 50 cm de la pantalla. Uso: node tools/mkvideo.js [salida.y4m]  (por defecto tools/out/lens.y4m)
'use strict';
const fs = require('fs');
const path = require('path');
const VC = require('./vc-loader');
const S = require('./sim');

const out = process.argv[2] || path.join(__dirname, 'out', 'lens.y4m');
fs.mkdirSync(path.dirname(out), { recursive: true });
const W = 1280, H = 720, fps = 10, f = S.focalPx(26, W, H), D = 500;
const lens = { Pa: -2.5, Pb: -2.5, phi: 0 };
const R = S.rng(42);
const fd = fs.openSync(out, 'w');
fs.writeSync(fd, `YUV4MPEG2 W${W} H${H} F${fps}:1 Ip A1:1 C420jpeg\n`);
const uv = Buffer.alloc((W / 2) * (H / 2) * 2, 128);
const total = 18 * fps;
for (let i = 0; i < total; i++) {
  const t = i / fps;
  const o = { W, H, f, D: D + (R() - 0.5) * 4, yaw: 3 + (R() - 0.5) * 0.6, pitch: -2 + (R() - 0.5) * 0.6, roll: 2, PAT: VC.PAT };
  if (t >= 3) {
    const u = 0.9 - 0.78 * Math.sin(Math.PI * ((t - 3) / 15) * 2) ** 2;
    o.glasses = { u, off: [(R() - 0.5) * 10, (R() - 0.5) * 8], lens, side: 'OD' };
  }
  const img = S.render(o), y = Buffer.alloc(W * H);
  for (let k = 0; k < W * H; k++) y[k] = img.data[k * 4];
  fs.writeSync(fd, 'FRAME\n'); fs.writeSync(fd, y); fs.writeSync(fd, uv);
  if (i % 30 === 0) process.stdout.write(`\r${i}/${total} cuadros`);
}
fs.closeSync(fd);
console.log(`\rVideo listo: ${out} (${total} cuadros)`);
