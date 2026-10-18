// Simulador físico de la medición de anteojos: cámara pinhole, anteojo de dos lentes delgadas con aro,
// pantalla de compu con el patrón, bisel y fondo. Unidades: mm. Potencias en dioptrías (1/m).
'use strict';
const deg = Math.PI / 180;

function rotYPR(yaw, pitch, roll) {
  const [cy, sy, cp, sp, cr, sr] = [Math.cos(yaw * deg), Math.sin(yaw * deg), Math.cos(pitch * deg), Math.sin(pitch * deg), Math.cos(roll * deg), Math.sin(roll * deg)];
  const Rx = [[1, 0, 0], [0, cp, -sp], [0, sp, cp]], Ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]], Rz = [[cr, -sr, 0], [sr, cr, 0], [0, 0, 1]];
  const mul = (A, B) => A.map((r, i) => B[0].map((_, j) => r.reduce((s, _, k) => s + A[i][k] * B[k][j], 0)));
  return mul(Rz, mul(Ry, Rx));
}

// Matriz de potencia 2×2 en coordenadas de cámara (y hacia abajo). Meridiano phi en convención "y arriba"
// del marco del anteojo, girado por rho (ángulo del horizontal del anteojo en la imagen, y arriba).
function powerMatrix(Pa, Pb, phi, rho) {
  const m = (P, a) => { const t = (a + rho) * deg, u = [Math.cos(t), -Math.sin(t)]; return [[P * u[0] * u[0], P * u[0] * u[1]], [P * u[1] * u[0], P * u[1] * u[1]]]; };
  const A = m(Pa / 1000, phi), B = m(Pb / 1000, phi + 90);
  return [[A[0][0] + B[0][0], A[0][1] + B[0][1]], [A[1][0] + B[1][0], A[1][1] + B[1][1]]];
}

/*
 opts:
  W,H,f            cámara (px)
  D                distancia cámara–centro del patrón (mm)
  yaw,pitch,roll   orientación del patrón respecto de la cámara (grados)
  PAT              geometría del patrón (mm)
  scaleTrue        tamaño real del patrón / tamaño supuesto (error de calibración de la pantalla)
  glasses: { u, off:[x,y] (mm, en el plano de la lente, respecto del eje cámara→centro del patrón),
             lens:{Pa,Pb,phi}, other:{Pa,Pb,phi}, side:'OD'|'OI', ax, ay, rim, pd, rollErr }
*/
function render(o) {
  const W = o.W || 1280, H = o.H || 720, f = o.f, cx = W / 2, cy = H / 2;
  const P = o.PAT, k = o.scaleTrue || 1;
  let R = rotYPR(o.yaw || 0, o.pitch || 0, o.roll || 0);
  let r1 = [R[0][0], R[1][0], R[2][0]], r2 = [R[0][1], R[1][1], R[2][1]], n = [R[0][2], R[1][2], R[2][2]];
  let t = [0, 0, o.D];
  let nt = n[2] * o.D;
  const R0m = R, cam = o.cam || { yaw: 0, pitch: 0 }, rsc = o.rsCam;
  function camPose(fr) {
    // Giro de la cámara sobre su propio centro (muñeca): rota orientación y posición del patrón.
    const Rc = rotYPR(cam.yaw + (rsc ? rsc.dyaw * fr : 0), cam.pitch + (rsc ? rsc.dpitch * fr : 0), 0);
    const mul = (A, B) => A.map((r, i) => B[0].map((_, j) => r.reduce((s, _, k) => s + A[i][k] * B[k][j], 0)));
    const Rr = mul(Rc, R0m), tt = [Rc[0][2] * o.D, Rc[1][2] * o.D, Rc[2][2] * o.D];
    return { Rr, tt };
  }
  if (o.cam || o.rsCam) { const p0 = camPose(0); R = p0.Rr; t = p0.tt; r1 = [R[0][0], R[1][0], R[2][0]]; r2 = [R[0][1], R[1][1], R[2][1]]; n = [R[0][2], R[1][2], R[2][2]]; nt = n[0] * t[0] + n[1] * t[1] + n[2] * t[2]; }
  const rs = o.rs; // obturador rodante: grados de giro acumulados durante la lectura del cuadro
  const img = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
  const g = o.glasses;
  let L = null;
  if (g) {
    // Eje cámara→centro del patrón: en coordenadas de cámara apunta a t (= (0,0,D)).
    const dl = g.u * o.D;                     // distancia de la cámara al plano de la lente
    const rho = Math.atan2(-r1[1], r1[0]) / deg + (g.rollErr || 0); // horizontal del anteojo = horizontal de la pantalla
    const hx = [Math.cos(rho * deg), -Math.sin(rho * deg)], hy = [Math.sin(rho * deg), Math.cos(rho * deg)]; // ejes del anteojo en la imagen (y abajo)
    const c0 = [g.off[0] * hx[0] + g.off[1] * hy[0], g.off[0] * hx[1] + g.off[1] * hy[1]];
    const sgn = g.side === 'OI' ? 1 : -1;     // la otra lente queda del lado nasal
    const pd = g.pd || 62;
    const c1 = [c0[0] + sgn * pd * hx[0], c0[1] + sgn * pd * hx[1]];
    L = { dl, hx, hy, ax: g.ax || 26, ay: g.ay || 18, rim: g.rim || 4,
      lenses: [{ c: c0, M: powerMatrix(g.lens.Pa, g.lens.Pb, g.lens.phi, rho) }, { c: c1, M: powerMatrix((g.other || g.lens).Pa, (g.other || g.lens).Pb, (g.other || g.lens).phi, rho) }] };
  }
  const R0 = P.R, rd = P.dotD / 2, hs = P.mkSize / 2, step = 2 * Math.PI / P.nDots;
  function shade(X, Y) {
    X /= k; Y /= k; // coordenadas en mm "supuestos"
    if (Math.abs(X) > 160 / k || Math.abs(Y) > 100 / k) {
      if (Math.abs(X) < 172 / k && Math.abs(Y) < 112 / k) return 22; // bisel
      return 118;                                                      // fondo de la habitación
    }
    for (let i = 0; i < 4; i++) { const m = P.mk[i]; if (Math.abs(X - m[0]) <= hs && Math.abs(Y - m[1]) <= hs) return 25; }
    const r = Math.hypot(X, Y);
    if (Math.abs(r - R0) <= rd) {
      const a = Math.round(Math.atan2(Y, X) / step) * step;
      const dx = X - R0 * Math.cos(a), dy = Y - R0 * Math.sin(a);
      if (dx * dx + dy * dy <= rd * rd) return 25;
    }
    return 242;
  }
  const subs = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
  for (let y = 0; y < H; y++) {
    if (rsc) {
      const p0 = camPose(y / H - 0.5); R = p0.Rr; t = p0.tt;
      r1 = [R[0][0], R[1][0], R[2][0]]; r2 = [R[0][1], R[1][1], R[2][1]]; n = [R[0][2], R[1][2], R[2][2]]; nt = n[0] * t[0] + n[1] * t[1] + n[2] * t[2];
    }
    if (rs) {
      const fr = y / H - 0.5;
      R = rotYPR((o.yaw || 0) + (rs.dyaw || 0) * fr, (o.pitch || 0) + (rs.dpitch || 0) * fr, (o.roll || 0) + (rs.droll || 0) * fr);
      r1 = [R[0][0], R[1][0], R[2][0]]; r2 = [R[0][1], R[1][1], R[2][1]]; n = [R[0][2], R[1][2], R[2][2]]; nt = n[2] * o.D;
    }
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let s = 0; s < 4; s++) {
        let dx = (x + subs[s][0] - cx) / f, dy = (y + subs[s][1] - cy) / f;
        let qx = 0, qy = 0, qz = 0, val = -1;
        if (L) {
          const px = dx * L.dl, py = dy * L.dl;
          for (let li = 0; li < 2; li++) {
            const ln = L.lenses[li];
            const ex = px - ln.c[0], ey = py - ln.c[1];
            const lx = ex * L.hx[0] + ey * L.hx[1], ly = ex * L.hy[0] + ey * L.hy[1];
            const e = (lx * lx) / (L.ax * L.ax) + (ly * ly) / (L.ay * L.ay);
            if (e <= 1) { dx -= ln.M[0][0] * ex + ln.M[0][1] * ey; dy -= ln.M[1][0] * ex + ln.M[1][1] * ey; qx = px; qy = py; qz = L.dl; break; }
            const eo = (lx * lx) / ((L.ax + L.rim) * (L.ax + L.rim)) + (ly * ly) / ((L.ay + L.rim) * (L.ay + L.rim));
            if (eo <= 1) { val = 30; break; } // aro del anteojo
          }
        }
        if (val < 0) {
          const nd = n[0] * dx + n[1] * dy + n[2];
          const sP = (nt - (n[0] * qx + n[1] * qy + n[2] * qz)) / nd;
          const Xc = qx + sP * dx - t[0], Yc = qy + sP * dy - t[1], Zc = qz + sP - t[2];
          val = shade(Xc * r1[0] + Yc * r1[1] + Zc * r1[2], Xc * r2[0] + Yc * r2[1] + Zc * r2[2]);
        }
        acc += val;
      }
      const v = Math.max(0, Math.min(255, Math.round(acc / 4 + (Math.random() - 0.5) * 14)));
      const j = (y * W + x) * 4; img.data[j] = img.data[j + 1] = img.data[j + 2] = v; img.data[j + 3] = 255;
    }
  }
  return img;
}

// Focal en px para un lente equivalente a f35 mm en un sensor W×H.
function focalPx(f35, W, H) { return (Math.hypot(W, H) / 2) / (43.27 / (2 * f35)); }

// Generador pseudoaleatorio con semilla, para que las pruebas sean reproducibles.
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// Un barrido realista: el anteojo va de cerca de la pantalla a cerca del celular y vuelve; el celular tiembla un poco.
function sweepFrames({ seed = 1, n = 70, D = 500, f35 = 26, lens, other, side = 'OD', wander = 6, jumpProb = 0.08, jump = 18, ax = 26, ay = 18, scaleTrue = 1, rollErr = 0 }) {
  const rnd = rng(seed), frames = [];
  for (let i = 0; i < n; i++) {
    const ph = i / (n - 1);
    const u = 0.9 - 0.78 * Math.sin(Math.PI * ph * 2) ** 2; // pantalla → celular → pantalla, dos pasadas
    let off = [(rnd() - 0.5) * 2 * wander, (rnd() - 0.5) * 2 * wander];
    if (rnd() < jumpProb) off = [(rnd() - 0.5) * 2 * jump, (rnd() - 0.5) * 2 * jump];
    frames.push({ t: i * 120, D: D + (rnd() - 0.5) * 30, yaw: (rnd() - 0.5) * 8, pitch: (rnd() - 0.5) * 8, roll: (rnd() - 0.5) * 10, f35,
      glasses: { u, off, lens, other, side, ax, ay, rollErr }, scaleTrue });
  }
  return frames;
}

module.exports = { render, focalPx, rng, sweepFrames, rotYPR };
