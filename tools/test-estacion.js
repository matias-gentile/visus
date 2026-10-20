// Revisa la geometría de la estación de autoexamen (estacion/estacion.js) sin imprimir nada:
// juegos y choques entre piezas, lugar para la cara y los anteojos, líneas de mirada, oclusión
// con la paleta, cobertura de los agujeritos y zonas que quedarían en el aire al imprimir.
//
// Uso: (cd estacion && npm install) && node tools/test-estacion.js
'use strict';
const path = require('path');
const E = require('../estacion/estacion.js');
const J = require(path.join(__dirname, '../estacion/node_modules/@jscad/modeling'));
const { intersect, union } = J.booleans;
const { translate, rotateX } = J.transforms;
const { cylinder, ellipsoid, polygon } = J.primitives;
const { measureVolume, measureBoundingBox } = J.measurements;
const { P, box } = E;

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok   ' : 'FALLA'} ${name}${detail ? ' · ' + detail : ''}`); if (!ok) fails++; };
const overlap = (a, b) => { const g = intersect(a, b); return g.polygons.length ? measureVolume(g) : 0; };
const fmt = (x, d = 1) => x.toFixed(d);

const marco = E.marco(), cabezal = E.cabezal();
const tramos = [0, 1, 2, 3].map(k => E.tramo(k, false));
const riel = union(cabezal, ...tramos.slice(0, 3));
const carroAt = (D, dz = 0) => translate([0, 10 * D, dz], E.carro());

/* 1. El carro desliza por todo el riel sin rozar, y no se puede levantar. */
{
  const Ds = [7, 10, 23.5, 30, 39.5, 40, 50];
  const worst = Math.max(...Ds.map(D => overlap(carroAt(D), riel)));
  check('el carro no roza el riel en ningún tramo', worst < 0.5, `superposición máx. ${fmt(worst, 2)} mm³`);
  check('el carro queda atrapado en el riel (no se levanta)', overlap(carroAt(30, 1.2), riel) > 5);
  const behind = overlap(translate([0, -1, 0], carroAt(7)), riel);
  check('el tope del cabezal frena el carro a 7 cm', behind > 1, `a 6,9 cm choca ${fmt(behind)} mm³`);
}

/* 2. Los topes dejan la pantalla justo a 30 y 40 cm, y el del final a la distancia máxima. */
{
  P.stops.forEach(D => {
    const yPeg = E.pegY(D), gap = yPeg - P.peg.head / 2 - (10 * D + P.carro.rear);
    const k = tramos.findIndex((t, i) => yPeg > E.segY(i) && yPeg < E.segY(i + 1));
    check(`tope de ${D} cm: agujero en el tramo ${k + 1}, el carro apoya con ${fmt(gap, 2)} mm de juego`, gap > 0 && gap < 0.5 && k >= 0);
  });
  check('alcance con 3 tramos ≥ 50 cm (miopía desde −2,00)', P.maxD[3] >= 50, fmt(P.maxD[3]) + ' cm');
  check('alcance con 4 tramos ≥ 65 cm (miopía desde −1,50)', P.maxD[4] >= 65, fmt(P.maxD[4]) + ' cm');
}

/* 3. Las placas se cuelgan en el visor: corren de costado, no se caen y se sacan levantándolas. */
{
  const [x0] = P.frame.post, T = P.plate;
  const span = w => { const out = []; for (let x = -(x0 - w / 2 - 0.5); x <= x0 - w / 2 - 0.5; x += 4) out.push(x); return out; };
  const worst = Math.max(...span(T.paddle).map(x => overlap(E.paleta(x), marco)));
  check('la paleta corre de un costado al otro de la ventana', worst < 0.01, `superposición máx. ${fmt(worst, 3)} mm³`);
  const worst2 = Math.max(...span(T.pinhole).map(x => overlap(E.estenopeico(x), marco)));
  check('la placa estenopeica corre de un costado al otro', worst2 < 0.01, `superposición máx. ${fmt(worst2, 3)} mm³`);
  check('la paleta no se cae hacia adelante (borde de abajo)', overlap(translate([0, 1, 0], E.paleta(-32)), marco) > 0.5);
  check('la paleta no se cae hacia adelante (ranura de arriba)', overlap(translate([0, 1, 1.3], E.paleta(-32)), marco) > 0.5);
  check('la paleta no se cae hacia atrás', overlap(translate([0, -1, 0], E.paleta(-32)), marco) > 0.5);
  // Para sacarla: se levanta 1,5 mm, se inclina 5,5° sacando el borde de abajo hacia adelante y se baja 7,5 mm.
  const lift = 1.5, ang = 5.5, zTop = E.plateZ0() + T.h + lift, yBack = E.plateY() - T.t / 2;
  const pose = (dz, a) => E.rotAbout(a, yBack, zTop, translate([0, 0, lift], E.paleta(-32)));
  check('levantada 1,5 mm no roza', overlap(translate([0, 0, lift], E.paleta(-32)), marco) < 0.01);
  check('levantada e inclinada 5,5° no roza', overlap(pose(0, ang), marco) < 0.01);
  let worstDrop = 0;
  for (let dz = 0; dz <= 7.5; dz += 0.5) worstDrop = Math.max(worstDrop, overlap(translate([0, 0, -dz], pose(0, ang)), marco));
  check('inclinada, baja 7,5 mm sin rozar', worstDrop < 0.01, `superposición máx. ${fmt(worstDrop, 3)} mm³`);
  const out = translate([0, 0, -7.5], pose(0, ang));
  const topOut = measureBoundingBox(out)[1][2] < P.Zeye + P.visor.win - 0.3;
  check('ya fuera de la ranura, sale hacia adelante', topOut && overlap(translate([0, 12, 0], out), marco) < 0.01);
  // Paleta y estenopeico juntos, uno frente a cada ojo, con lugar para correr el estenopeico ±8 mm.
  let clash = 0;
  for (const h of [27, 32, 37]) for (const d of [-8, 0, 8]) clash = Math.max(clash, overlap(E.paleta(-h), E.estenopeico(h + d)));
  check('la paleta y la placa estenopeica entran juntas (DP 54–74 mm)', clash < 0.01);
}

/* 4. Lugar para la cara y para anteojos grandes. */
const Z = P.Zeye;
const face = {
  cabeza: ellipsoid({ radius: [75, 98, 118], center: [0, -88.3, Z + 10], segments: 48 }),
  cejas: box(-50, 50, -10, 16, Z + 15, Z + 30),
  boca: box(-25, 25, -5, 18, Z - 75, Z - 55),
  menton: ellipsoid({ radius: [22, 18, 14], center: [0, -13, P.chinZ + 14], segments: 32 }),  // el mentón se acomoda en el fondo de la mentonera
  anteojos: box(-68, 68, 10, 22, Z - 22, Z + 26),
  patillas: union(box(-72, -62, -90, 22, Z + 2, Z + 14), box(62, 72, -90, 22, Z + 2, Z + 14))
};
// Nariz: perfil en el plano (Y, Z), de la raíz (8 mm delante de la córnea) a la punta (34 mm), 22 mm de ancho.
face.nariz = translate([-11, 0, 0], J.transforms.transform([0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1], J.extrusions.extrudeLinear({ height: 22 }, polygon({ points: [[0, Z + 7], [0, Z - 47], [34, Z - 43], [8, Z + 7]] }))));
{
  const solid = union(marco, cabezal, carroAt(7), E.paleta(-32));
  Object.entries(face).forEach(([k, g]) => {
    const v = overlap(g, solid);
    check(`lugar para ${k}`, v < 1, v ? `${fmt(v)} mm³ de choque` : '');
  });
  const [[, y0], [, y1]] = measureBoundingBox(intersect(face.cabeza, box(-30, 30, -200, 200, Z + 32, Z + 48)));
  check('la frente apoya en el apoyo (a 8 mm de la córnea)', Math.abs(y1 - P.foreheadY) < 1.5, `frente en Y = ${fmt(y1)}`);
}

/* 5. Líneas de mirada libres, y la paleta tapa el otro ojo. */
const ray = (a, b, r = 1.75) => {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d);
  const c = cylinder({ radius: r, height: L, segments: 12 });
  // Cilindro sobre Z → alinear con d.
  const ax = Math.atan2(Math.hypot(d[0], d[1]), d[2]), az = Math.atan2(d[1], d[0]);
  const g = J.transforms.rotateZ(az, J.transforms.rotateY(ax, c));
  return translate([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], g);
};
{
  const blockers = union(marco, cabezal, E.paleta(-32)), occluder = union(marco, E.paleta(-32));
  let bad = [], cover = [];
  for (const ipd of [54, 64, 74]) for (const dz of [-15, 0, 15]) for (const D of [15, 30, 40, 50]) {
    const eye = [ipd / 2, 0, Z + dz], T = [0, 10 * D - 2, Z];
    if (overlap(ray(eye, T), union(blockers, carroAt(D))) > 0.05) bad.push(`DP ${ipd}, ${dz > 0 ? '+' : ''}${dz} mm, ${D} cm`);
    // El ojo tapado no tiene que ver la zona de las figuras (±25 mm del centro); desde 25 cm, tampoco las esquinas
    // de un celular de 67 × 140 mm. Más cerca, alguna esquina lejana puede asomar por debajo, donde en la cara está la nariz.
    const other = [-ipd / 2, 0, Z + dz];
    const pts = [[0, 0], [-25, -25], [25, -25], [-25, 25], [25, 25]].concat(D >= 25 ? [[-33, -68], [33, -68], [-33, 68], [33, 68]] : []);
    for (const [sx, sz] of pts) {
      const r = ray(other, [sx, 10 * D - 2, Z + sz], 1.75), y = E.plateY(), t = P.plate.t / 2;
      const full = overlap(r, box(-500, 500, y - t, y + t, -500, 500));
      if (overlap(r, occluder) < 0.98 * full) cover.push(`DP ${ipd}, ${dz} mm, ${D} cm, esquina ${sx},${sz}`);
    }
  }
  check('el ojo que mira ve el centro de la pantalla (DP 54–74 mm, ojos ±15 mm, 15–50 cm)', !bad.length, bad.slice(0, 3).join('; '));
  check('la paleta y el visor le tapan la pantalla al otro ojo', !cover.length, cover.slice(0, 3).join('; '));
}

/* 6. Agujeritos: siempre hay uno frente a la pupila, y nunca dos a la vez. */
{
  const yPlate = E.plateY(), yPupil = -3, Dt = 400, m = (Dt - yPupil) / (Dt - yPlate);
  const rh = P.plate.hole / 2 - 0.1; // los agujeros chicos salen ~0,2 mm más angostos
  const holes = [...P.pinholes.cols[0], ...P.pinholes.cols[1]];
  const reach = rp => dz => holes.some(z => Math.abs(z * m - dz) <= rp + rh * m);
  let gap = null;
  for (let dz = -18; dz <= 18; dz += 0.25) if (!reach(1.5)(dz)) { gap = dz; break; }
  check('con pupila de 3 mm siempre hay un agujerito alineado (ojos ±18 mm)', gap === null, gap !== null ? `sin agujero a ${gap} mm` : '');
  const col = P.pinholes.cols[0], step = (col[1] - col[0]) * m;
  const rpMax = step / 2 - rh * m;
  check('no entran dos agujeritos de la misma columna en la pupila', rpMax * 2 >= 4, `hasta ${fmt(rpMax * 2)} mm de pupila`);
  check('las dos columnas no entran juntas en la pupila', 2 * P.pinholes.dx * m - 2 * rh * m > 6);
}

/* 7. Tamaño de cama y zonas en el aire al imprimir. */
{
  for (const p of E.PARTS) {
    let g = p.build(false);
    if (p.rx) g = rotateX(p.rx * Math.PI / 180, g);
    const [[x0, y0, z0], [x1, y1, z1]] = measureBoundingBox(g);
    g = translate([0, 0, -z0], g);
    // Caras que miran hacia abajo, fuera de la cama: puentes (horizontales, hasta 30 mm de luz) y voladizos (más de 50° desde la vertical).
    let bridge = 0, over = 0, big = 0;
    for (const poly of J.geometries.geom3.toPolygons(g)) {
      const v = poly.vertices; if (v.length < 3) continue;
      const a = [v[1][0] - v[0][0], v[1][1] - v[0][1], v[1][2] - v[0][2]];
      let nx = 0, ny = 0, nz = 0, area = 0;
      for (let i = 1; i < v.length - 1; i++) {
        const u = [v[i][0] - v[0][0], v[i][1] - v[0][1], v[i][2] - v[0][2]], w = [v[i + 1][0] - v[0][0], v[i + 1][1] - v[0][1], v[i + 1][2] - v[0][2]];
        const c = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
        nx += c[0]; ny += c[1]; nz += c[2];
      }
      area = Math.hypot(nx, ny, nz) / 2; if (!area) continue;
      const cz = nz / (2 * area), zmin = Math.min(...v.map(p => p[2]));
      if (zmin < 0.2) continue;
      if (cz < -0.99) { bridge += area; const xs = v.map(p => p[0]), ys = v.map(p => p[1]); big = Math.max(big, Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))); }
      else if (cz < -0.77) over += area;
    }
    const fits = Math.max(x1 - x0, y1 - y0) <= 180 && z1 - z0 <= 180;
    check(`${p.file}: entra en 180 mm y no necesita soportes`, fits && over < 1 && big <= 30,
      `${fmt(x1 - x0, 0)} × ${fmt(y1 - y0, 0)} × ${fmt(z1 - z0, 0)} mm · puentes ${fmt(bridge, 0)} mm² (el más ancho ${fmt(big)} mm) · voladizos ${fmt(over, 0)} mm²`);
  }
}

console.log(fails ? `\n${fails} revisiones fallaron` : '\nTodo bien');
process.exit(fails ? 1 : 0);
