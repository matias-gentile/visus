// Estación de autoexamen de Visus: modelo paramétrico en JSCAD.
//
// Uso:  npm install && node estacion.js
// Genera los STL en stl/ y el visor 3D en index.html (con la geometría incrustada).
//
// Coordenadas del ensamblado (mm): X a lo ancho (+X = derecha de la persona), Y hacia adelante
// (0 = córnea, nominal), Z hacia arriba (0 = cara superior de la base).
// Cada pieza entra en una cama de 180 × 180 mm y se imprime sin soportes, en la orientación de `rx`.
'use strict';
const fs = require('fs');
const path = require('path');
const { primitives, booleans, transforms, extrusions, expansions, measurements, geometries, text } = require('@jscad/modeling');
const stl = require('@jscad/stl-serializer');

const { cuboid, cylinder, ellipsoid, polygon } = primitives;
const { union, subtract } = booleans;
const { translate, rotateX, transform } = transforms;
const { extrudeLinear } = extrusions;

/* ---------- medidas principales ---------- */
const P = {
  Zeye: 125,        // altura de los ojos y del centro de la pantalla sobre la base
  chin: 115,        // de la pupila al fondo de la mentonera (adulto promedio; 100–130 entra en la ventana)
  foreheadY: 8,     // centro del apoyo de frente, delante de la córnea
  baseT: 8,         // espesor de las bases
  clear: 0.2,       // juego de encastres y colas de milano, por lado
  slide: 0.3,       // juego de lo que desliza (carro y placas), por lado
  frame: { back: 5, front: 38, z0: 12, post: [64, 80], glasses: 24 },
  // Visor: ventana de 44 mm de alto con lugar para la nariz. Las placas entran arriba en una ranura de 3,2 mm y abajo
  // apoyan en una repisa con un borde de 1 mm. Para sacarlas: levantar, sacar el borde de abajo hacia adelante y bajar.
  visor: { y0: 28, gY: [31.4, 34.6], win: 22, top: 7, upper: 10, ledge: 4, lower: 20, lip: [35, 36, 1], step: 7, nose: 16 },
  plate: { t: 2.4, h: 53, paddle: 48, pinhole: 34, hole: 1.4, web: 0.8 },
  rail: { half: 35, start: 45, cabEnd: 75, seg: 160, n: 4 },
  rib: { neck: 10, top: 13, h: 6 },
  // Carro: y = 0 es el plano de la pantalla a la altura de los ojos (celular de 10 mm con funda).
  carro: { front: -25, rear: 35, half: 17.5, ledgeZ: 53, ledgeDepth: 16, tilt: 6, t: 10, top: 150, ledgeHalf: 44, backHalf: 30 },
  peg: { d: 6, head: 11, hole: 6.4 },
  stops: [30, 40]   // agujeros para el tope: agudeza a 40 cm y Amsler a 30 cm
};
P.chinZ = P.Zeye - P.chin;
P.pinholes = { dx: 4, cols: [[-15, -10, -5, 0, 5, 10, 15], [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5]] };
const deg = Math.PI / 180;
// Centro del agujero del tope para que el carro quede con la pantalla a D cm.
const pegY = D => 10 * D + P.carro.rear + P.peg.head / 2 + P.slide;
const segY = k => P.rail.cabEnd + k * P.rail.seg;
// Distancia máxima ojo-pantalla con n tramos: el carro contra el tope del final.
const maxD = n => (segY(n) - 12 - P.peg.head / 2 - P.slide - P.carro.rear) / 10;
P.maxD = { 3: maxD(3), 4: maxD(4) };

/* ---------- ayudas ---------- */
function ccw(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; a += x0 * y1 - x1 * y0; }
  return a < 0 ? pts.slice().reverse() : pts;
}
const box = (x0, x1, y0, y1, z0, z1) => cuboid({ size: [x1 - x0, y1 - y0, z1 - z0], center: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] });
const mirrorX = (x0, x1, ...r) => [box(-x1, -x0, ...r), box(x0, x1, ...r)];
// Prisma con sección en el plano YZ (puntos [y, z]) extruido a lo largo de X entre x0 y x1.
function prismYZ(pts, x0, x1) {
  const g = extrudeLinear({ height: x1 - x0 }, polygon({ points: ccw(pts) }));
  return transform([0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, x0, 0, 0, 1], g);
}
// Prisma con sección en el plano XZ (puntos [x, z]) extruido a lo largo de Y entre y0 e y1.
function prismXZ(pts, y0, y1) {
  const g = extrudeLinear({ height: y1 - y0 }, polygon({ points: ccw(pts) }));
  return transform([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, y1, 0, 1], g);
}
const prismXY = (pts, z0, z1) => translate([0, 0, z0], extrudeLinear({ height: z1 - z0 }, polygon({ points: ccw(pts) })));
const rotAbout = (angDeg, y0, z0, g) => translate([0, y0, z0], rotateX(angDeg * deg, translate([0, -y0, -z0], g)));
const cylZ = (r, x, y, z0, z1, segments = 32) => cylinder({ radius: r, height: z1 - z0, center: [x, y, (z0 + z1) / 2], segments });
// Cola de milano en la base: cuello en yNeck, extremo ancho en yEnd.
const dovetail = (yNeck, yEnd, c = 0, z0 = -P.baseT, z1 = 0) => {
  const s = Math.sign(yEnd - yNeck);
  return prismXY([[-8 - c, yNeck - s * c], [8 + c, yNeck - s * c], [12 + c, yEnd + s * c], [-12 - c, yEnd + s * c]], z0, z1);
};
// Riel del carro: cola de milano corrida (cuello abajo), de y0 a y1.
// Con juego c, el canal del carro copia la cara inclinada a c mm y sube hasta h + c.
const ribProfile = (c = 0, zBot = 0) => {
  const { neck, top, h } = P.rib, w = z => neck + (z / h) * (top - neck) + c;
  return [[-w(zBot), zBot], [w(zBot), zBot], [w(h + c), h + c], [-w(h + c), h + c]];
};
const rib = (y0, y1) => prismXZ(ribProfile(), y0, y1);

// Texto grabado: trazos de la fuente de JSCAD engrosados, con la base en X y la parte de arriba hacia +Y.
function engraveText(str, xLeft, yMid, h, depth) {
  const segs = text.vectorText({ height: 10, input: str });
  let mnx = 1e9, mny = 1e9, mxy = -1e9;
  segs.forEach(s => s.forEach(([x, y]) => { mnx = Math.min(mnx, x); mny = Math.min(mny, y); mxy = Math.max(mxy, y); }));
  const k = h / (mxy - mny);
  const shapes = segs.map(s => expansions.expand({ delta: 0.5, corners: 'round', segments: 8 },
    geometries.path2.fromPoints({}, s.map(([x, y]) => [xLeft + (x - mnx) * k, yMid + (y - (mny + mxy) / 2) * k]))));
  return translate([0, 0, -depth], extrudeLinear({ height: depth + 1 }, union(...shapes)));
}

/* ---------- cabezal: base con mentonera, encastres del marco y comienzo del riel ---------- */
function cabezal() {
  const c = P.clear, [px0, px1] = P.frame.post;
  let plate = union(box(-84, 84, -46, 46, -P.baseT, 0), box(-P.rail.half, P.rail.half, 40, P.rail.cabEnd, -P.baseT, 0), dovetail(P.rail.cabEnd, P.rail.cabEnd + 12));
  const sockets = mirrorX(px0 - 4, px1 + 4, P.frame.back + 1, P.frame.front + 4, 0, P.frame.z0);
  const chinBlock = box(-36, 36, -44, 18, 0, P.chinZ + 8);
  let g = union(plate, chinBlock, ...sockets,
    rib(P.rail.start, P.rail.cabEnd),
    box(-P.carro.half, P.carro.half, 38, P.rail.start, 0, 14));   // tope del carro: la pantalla no se acerca a menos de 7 cm
  // Encastres de las espigas del marco.
  g = subtract(g, ...mirrorX(px0 + 2 - c, px1 - 2 + c, P.frame.back + 6 - c, P.frame.front + c, -5 - c, P.frame.z0 + 1));
  // Mentonera: casquete elíptico de 8 mm de hondo, con el fondo a P.chinZ.
  g = subtract(g, ellipsoid({ radius: [31, 27, 13], center: [0, -13, P.chinZ + 13], segments: 48 }));
  return g;
}

/* ---------- marco: postes, apoyo de frente y visor con la ranura de las placas ---------- */
function marco() {
  const { Zeye } = P, V = P.visor, F = P.frame, [x0, x1] = F.post;
  const zTop = Zeye + V.win, zLedge = Zeye - V.win - V.ledge, zLow = Zeye - V.win - V.lower;
  let g = union(
    ...mirrorX(x0, x1, F.back, F.front, F.z0, Zeye + 48),                    // postes
    ...mirrorX(x0 + 2, x1 - 2, F.back + 6, F.front, -5, F.z0),               // espigas
    box(-x1, x1, F.back, F.front, Zeye + 32, Zeye + 48),                     // apoyo de frente
    box(-x1, x1, V.y0, F.front, zTop, zTop + V.upper),                       // riel superior del visor
    ...mirrorX(V.nose, x1, V.y0, F.front, zLow, Zeye - V.win)                // riel inferior, con lugar para la nariz
  );
  // Ranura de arriba: guía el borde superior de las placas y deja levantarlas 1,5 mm. El labio de adelante es corto
  // (solo los 4 mm de arriba), para poder inclinar la placa al sacarla.
  g = subtract(g, box(-x0, x0, V.gY[0], V.gY[1], zTop - 1, zTop + V.top));
  g = subtract(g, box(-x0, x0, V.gY[1] - 0.01, F.front + 1, zTop - 1, zTop + V.top - 4));
  // Repisa de abajo: las placas apoyan contra el labio de atrás y un borde de 1 mm adelante; más adelante el riel baja,
  // para que el borde de abajo de la placa pueda salir y la placa se suelte de la ranura de arriba.
  const [l0, l1, lh] = V.lip;
  g = subtract(g, box(-x0, x0, V.gY[0], F.front + 1, zLedge, Zeye - V.win + 1));
  g = subtract(g, box(-x0, x0, l1, F.front + 1, zLedge - V.step, zLedge + 1));
  g = union(g, ...mirrorX(V.nose, x0, l0, l1, zLedge - 1, zLedge + lh));
  // Parte de atrás de los postes a la altura de los ojos: lugar para las bisagras y patillas de los anteojos.
  g = subtract(g, ...mirrorX(x0 - 1, x1 + 1, F.back - 1, F.glasses, Zeye - 30, Zeye + 32));
  // Apoyo de frente apenas cóncavo (3 mm), para que la cabeza se centre sola.
  g = subtract(g, cylZ(120, 0, P.foreheadY - 120, Zeye + 31, Zeye + 49, 96));
  return g;
}

/* ---------- tramos del riel, con la escala en cm de la distancia ojo-pantalla ---------- */
function escala(y0, y1) {
  const cuts = [];
  for (let mm = Math.ceil(y0 / 5) * 5; mm <= y1; mm += 5) {
    if (mm < y0 + 1.5 || mm > y1 - 1.5) continue;
    const len = mm % 50 === 0 ? 5 : mm % 10 === 0 ? 3 : 1.6;
    cuts.push(box(21, 21 + len, mm - 0.4, mm + 0.4, -0.8, 1));
    if (mm % 50 === 0) cuts.push(engraveText(String(mm / 10), 27, mm, 6, 0.8));
  }
  return cuts;
}
function tramo(k, engrave = true) {
  const y0 = segY(k), y1 = y0 + P.rail.seg, h = P.rail.half;
  const plate = subtract(union(box(-h, h, y0, y1, -P.baseT, 0), dovetail(y1, y1 + 12)), dovetail(y0, y0 + 12, P.clear, -P.baseT - 1, 0));
  let g = union(plate, rib(y0, y1));
  const holes = P.stops.map(pegY).filter(y => y > y0 + 18 && y < y1 - 18);
  holes.push(y1 - 12); // tope del final: sirve en el tramo que quede último
  g = subtract(g, ...holes.map(y => cylZ(P.peg.hole / 2, 0, y, -P.baseT + 2, P.rib.h + 1, 24)));
  if (engrave) g = subtract(g, ...escala(y0, y1));
  return g;
}

/* ---------- carro del celular ---------- */
function carro() {
  const C = P.carro, s = P.slide;
  let foot = box(-C.half, C.half, C.front, C.rear, s, 16);
  foot = subtract(foot, prismXZ(ribProfile(s, -1), C.front - 1, C.rear + 1));
  // Indicador de la escala: su punta marca dónde queda la pantalla.
  const pointer = prismXY([[C.half - 0.1, -4], [C.half - 0.1, 4], [C.half + 3.6, 0]], s, s + 2);
  // Soporte del celular, armado derecho y después inclinado 6° hacia atrás alrededor del punto (y = t, z = Zeye).
  const yL = C.t - C.ledgeDepth, zL = C.ledgeZ;
  const lip = subtract(box(-C.ledgeHalf, C.ledgeHalf, yL, yL + 3, zL, zL + 5), prismXZ([[-1.6, zL + 5.1], [1.6, zL + 5.1], [0, zL + 2.6]], yL - 1, yL + 4));
  const holder = union(
    box(-C.backHalf, C.backHalf, C.t, C.t + 4, zL - 6, C.top),        // respaldo
    box(-C.ledgeHalf, C.ledgeHalf, yL, C.t + 4, zL - 6, zL),          // estante (sigue debajo del respaldo)
    lip,                                                              // labio, con muesca al centro
    box(-C.half, C.half, yL, C.t + 4, 8, zL - 1),                     // columna
    ...[-1, 1].map(sg => prismXZ([[sg * C.half, zL - 6], [sg * C.ledgeHalf, zL - 6], [sg * C.half, zL - 6 - (C.ledgeHalf - C.half)]], yL, C.t + 4)) // escuadras a 45°
  );
  return union(foot, pointer, rotAbout(-C.tilt, C.t, P.Zeye, holder));
}

/* ---------- placas del visor ---------- */
// Las placas apoyan en la repisa (abajo) y su borde superior queda 3,5 mm adentro de la ranura de arriba.
const plateY = () => (P.visor.gY[0] + P.visor.gY[1]) / 2;
const plateZ0 = () => P.Zeye - P.visor.win - P.visor.ledge;
function placa(width, xc) {
  const T = P.plate, y = plateY(), z0 = plateZ0();
  return box(xc - width / 2, xc + width / 2, y - T.t / 2, y + T.t / 2, z0, z0 + T.h);
}
// Perilla en la cara de adelante, a la altura de la ventana: asoma 1 mm por delante del visor.
const perilla = (x) => { const y1 = plateY() + P.plate.t / 2; return box(x - 1.5, x + 1.5, y1 - 0.5, P.frame.front + 1, P.Zeye - 10, P.Zeye + 10); };
function paleta(xc = -32) { return union(placa(P.plate.paddle, xc), perilla(xc)); }
// Placa estenopeica: dos columnas de agujeritos de 1,4 mm, una corrida 2,5 mm respecto de la otra, en una zona afinada a 0,8 mm.
function estenopeico(xc = 32) {
  const T = P.plate, y = plateY(), y1 = y + T.t / 2, k = T.pinhole / 2 - 4;
  let g = union(placa(T.pinhole, xc), perilla(xc - k), perilla(xc + k));
  g = subtract(g, box(xc - 7.5, xc + 7.5, y - T.t / 2 + T.web, y1 + 1, P.Zeye - 18.5, P.Zeye + 18.5));
  const holes = [];
  P.pinholes.cols[0].forEach(z => holes.push([xc - P.pinholes.dx, z]));
  P.pinholes.cols[1].forEach(z => holes.push([xc + P.pinholes.dx, z]));
  const pin = rotateX(90 * deg, cylinder({ radius: T.hole / 2, height: 6, center: [0, 0, 0], segments: 16 }));
  g = subtract(g, ...holes.map(([x, z]) => translate([x, y, P.Zeye + z], pin)));
  return g;
}

/* ---------- topes ---------- */
function topes() {
  const { d, head } = P.peg;
  const one = x => union(cylZ(d / 2, x, 0, 0, 11.5, 24), cylZ(head / 2, x, 0, 11.5, 21.5, 32));
  return union(one(-9), one(9));
}

/* ---------- salida ---------- */
const PARTS = [
  { file: 'cabezal', name: 'Cabezal con mentonera', build: () => cabezal(), color: '#d9e4e6', rx: 0 },
  { file: 'marco', name: 'Marco: apoyo de frente y visor', build: () => marco(), color: '#bcd6db', rx: -90, note: 'acostado sobre la cara de adelante' },
  ...[0, 1, 2, 3].map(k => ({ file: `tramo-${k + 1}`, name: `Tramo ${k + 1} del riel` + (k === 3 ? ' (opcional)' : ''), build: e => tramo(k, e), color: k % 2 ? '#cfdde0' : '#d9e4e6', rx: 0, optional: k === 3 })),
  { file: 'carro', name: 'Carro del celular', build: () => carro(), color: '#bcd6db', rx: 0, at: 400 },
  { file: 'paleta', name: 'Paleta tapaojo', build: () => paleta(), color: '#2f3b42', rx: 90, note: 'acostada, perilla arriba' },
  { file: 'estenopeico', name: 'Placa estenopeica', build: () => estenopeico(), color: '#f0c987', rx: 90, note: 'acostada, perillas arriba', alt: true },
  { file: 'topes', name: 'Topes (2)', build: () => topes(), color: '#f0c987', rx: 180, note: 'con la cabeza abajo', extra: true }
];

function triangles(geom) {
  const tris = [];
  for (const poly of geometries.geom3.toPolygons(geom)) { const v = poly.vertices; for (let i = 1; i < v.length - 1; i++) tris.push(v[0], v[i], v[i + 1]); }
  return tris.flat().map(n => Math.round(n * 10) / 10);
}
function printable(geom, rx) {
  const g = rx ? rotateX(rx * deg, geom) : geom;
  const [[x0, y0, z0], [x1, y1]] = measurements.measureBoundingBox(g);
  return translate([-(x0 + x1) / 2, -(y0 + y1) / 2, -z0], g);
}

if (require.main === module) {
  const outDir = path.join(__dirname, 'stl');
  fs.mkdirSync(outDir, { recursive: true });
  const report = [], viewer = { P, parts: [] };
  for (const p of PARTS) {
    const geom = p.build(true);
    const pr = printable(geom, p.rx);
    const data = stl.serialize({ binary: true }, pr);
    fs.writeFileSync(path.join(outDir, p.file + '.stl'), Buffer.concat(data.map(d => Buffer.from(d))));
    const [[x0, y0, z0], [x1, y1, z1]] = measurements.measureBoundingBox(pr);
    const vol = measurements.measureVolume(geom) / 1000;
    report.push(`${p.file.padEnd(13)} ${(x1 - x0).toFixed(0).padStart(4)} × ${(y1 - y0).toFixed(0).padStart(4)} × ${(z1 - z0).toFixed(0).padStart(4)} mm  ${vol.toFixed(0).padStart(4)} cm³`);
    if (Math.max(x1 - x0, y1 - y0) > 180 || z1 - z0 > 180) report.push(`  ¡ojo! ${p.file} no entra en una cama de 180 mm`);
    // Para el visor, sin la escala grabada (pesa mucho y no se ve a esa escala).
    const vg = p.file.startsWith('tramo') ? p.build(false) : geom;
    viewer.parts.push({ id: p.file, name: p.name, file: p.file + '.stl', color: p.color, rx: p.rx, note: p.note || '', optional: !!p.optional, alt: !!p.alt, extra: !!p.extra, at: p.at || 0,
      size: [x1 - x0, y1 - y0, z1 - z0].map(Math.round), vol: Math.round(vol), tris: triangles(vg) });
  }
  const tpl = fs.readFileSync(path.join(__dirname, 'visor.template.html'), 'utf8').replace('/*DATOS*/', 'window.ESTACION = ' + JSON.stringify(viewer) + ';');
  fs.writeFileSync(path.join(__dirname, 'index.html'), '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body>\n' + tpl + '\n</body>\n</html>\n');
  if (process.env.VISOR_SOLO) fs.writeFileSync(process.env.VISOR_SOLO, tpl);
  console.log('Pieza          ancho × largo × alto   volumen\n' + report.join('\n'));
  console.log(`Distancia máxima: ${P.maxD[3].toFixed(1)} cm con 3 tramos, ${P.maxD[4].toFixed(1)} cm con 4.`);
}

module.exports = { P, PARTS, cabezal, marco, tramo, carro, paleta, estenopeico, topes, pegY, segY, plateY, plateZ0, box, rotAbout };
