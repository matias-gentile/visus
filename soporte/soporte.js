// Soporte para medir anteojos con Visus: modelo paramétrico en JSCAD.
//
// Uso:  npm install && node soporte.js
// Genera los STL en stl/ y la geometría para el visor en visor-datos.js.
//
// Coordenadas del ensamblado (mm): X a lo ancho, Y a lo largo del riel (0 = cara del tablero del patrón,
// crece hacia el celular), Z hacia arriba (0 = cara superior de la base).
// Todas las piezas entran en una cama de 180 × 180 mm y se imprimen tal como se arman, sin soportes.
'use strict';
const fs = require('fs');
const path = require('path');
const { primitives, booleans, transforms, extrusions, measurements } = require('@jscad/modeling');
const stl = require('@jscad/stl-serializer');

const { cuboid, polygon } = primitives;
const { union, subtract } = booleans;
const { translate, rotateX, transform } = transforms;
const { extrudeLinear } = extrusions;

/* ---------- medidas principales ---------- */
const P = {
  D: 300,          // de la cara del tablero del patrón a la cara donde apoya la espalda del celular (a la altura del eje)
  H0: 80,          // altura del eje óptico (cámara, centro de la lente y centro del círculo) sobre la base
  U: 0.5,          // posición del atril: mitad del camino
  baseT: 8,        // espesor de la base
  wall: 4,         // espesor de paredes
  tiltPaper: 4,    // el tablero se inclina hacia atrás, para que la tarjeta apoye sola
  tiltPhone: 3,    // la pared del celular se inclina hacia el patrón, para que el celular apoye solo
  shelfTop: 40,    // altura del estante del celular (con suplementos de 5, 10 y 20 mm)
  pegTop: 50,      // altura de los apoyos del anteojo: centra lentes de 52 mm; las más bajas se suben con suplementos de 4 y 8 mm
  clear: 0.2,      // juego de las colas de milano, por lado
  card: [110, 150], // tarjeta del patrón (ancho × alto), apoyada sobre un labio a 5 mm: su centro queda a la altura del eje
  lip: 5,
  // Patrón del soporte (igual que PAT_RIG en index.html): cuadrados de 12 mm y círculo de 12 puntos.
  pattern: { mk: [[-42, -66], [42, -66], [42, 66], [-42, 66]], mkSize: 12, R: 11, nDots: 12, dotD: 4.4 }
};
const deg = Math.PI / 180;

/* ---------- ayudas ---------- */
// JSCAD necesita los polígonos en sentido antihorario; si vienen al revés, se invierten.
function ccw(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; a += x0 * y1 - x1 * y0; }
  return a < 0 ? pts.slice().reverse() : pts;
}
const box = (x0, x1, y0, y1, z0, z1) => cuboid({ size: [x1 - x0, y1 - y0, z1 - z0], center: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] });
// Prisma con sección en el plano YZ (puntos [y, z]) extruido a lo largo de X entre x0 y x1.
function prismYZ(pts, x0, x1) {
  const g = extrudeLinear({ height: x1 - x0 }, polygon({ points: ccw(pts) }));
  // (a, b, c) → (X, Y, Z) = (c + x0, a, b): permutación cíclica, conserva la orientación.
  return transform([0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, x0, 0, 0, 1], g);
}
// Prisma con sección en el plano XZ (puntos [x, z]) extruido a lo largo de Y entre y0 e y1.
function prismXZ(pts, y0, y1) {
  const g = extrudeLinear({ height: y1 - y0 }, polygon({ points: ccw(pts) }));
  // (a, b, c) → (a, y1 − c, b): conserva la orientación.
  return transform([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, y1, 0, 1], g);
}
// Prisma con sección en el plano XY extruido a lo largo de Z entre z0 y z1.
const prismXY = (pts, z0, z1) => translate([0, 0, z0], extrudeLinear({ height: z1 - z0 }, polygon({ points: ccw(pts) })));
const rotAbout = (angDeg, y0, z0, g) => translate([0, y0, z0], rotateX(angDeg * deg, translate([0, -y0, -z0], g)));

// Cola de milano: cuello angosto en yNeck, extremo ancho en yEnd.
const dovetail = (yNeck, yEnd, c = 0, z0 = -P.baseT, z1 = 0) => {
  const s = Math.sign(yEnd - yNeck);
  return prismXY([[-8 - c, yNeck - s * c], [8 + c, yNeck - s * c], [12 + c, yEnd + s * c], [-12 - c, yEnd + s * c]], z0, z1);
};

/* ---------- pieza A: base del patrón con tablero ---------- */
function partA() {
  const base = union(
    box(-65, 65, -18, 12, -P.baseT, 0),
    box(-30, 30, -18, 100, -P.baseT, 0),
    dovetail(100, 112)
  );
  const [cw] = P.card;
  let board = union(
    box(-65, 65, -P.wall, 0, -6, 165),          // tablero: la tarjeta apoya en su cara (Y = 0 a la altura del eje)
    box(-cw / 2 - 2, cw / 2 + 2, 0, 3, -2, P.lip)  // labio donde apoya el borde inferior de la tarjeta
  );
  board = rotAbout(P.tiltPaper, 0, P.H0, board);
  const ribs = [-45, 45].map(x => prismYZ([[-18, 0], [2.5, 0], [-6, 120]], x - 2, x + 2));
  return union(base, board, ...ribs);
}

/* ---------- pieza M: base del medio con el atril del anteojo ---------- */
function partM() {
  const yPlate = P.U * P.D; // cara del atril del lado de la cámara
  let base = box(-60, 60, 100, 200, -P.baseT, 0);
  base = subtract(base, dovetail(100, 112, P.clear, -P.baseT - 1, 1), dovetail(200, 188, P.clear, -P.baseT - 1, 1));
  const win = [[-34, 38], [34, 38], [34, 112], [20, 126], [-20, 126], [-34, 112]];
  let plate = box(-85, 85, yPlate - 5, yPlate, -4, 135);
  plate = subtract(plate, prismXZ(win, yPlate - 6, yPlate + 1));
  // Apoyos del anteojo, del lado de la cámara, a los costados de la ventana (con chaflán a 45° para imprimir sin soportes).
  const peg = [[yPlate, P.pegTop - 18], [yPlate, P.pegTop], [yPlate + 12, P.pegTop], [yPlate + 12, P.pegTop - 6]];
  const pegs = [[-56, -36], [36, 56]].map(([a, b]) => prismYZ(peg, a, b));
  const ribs = [-72, 72].map(x => prismYZ([[110, 0], [yPlate - 4, 0], [yPlate - 4, 70]], x - 2, x + 2));
  return union(base, plate, ...pegs, ...ribs);
}

/* ---------- pieza B: base del celular con pared y estante ---------- */
function partB() {
  const base = union(
    box(-30, 30, 200, 290, -P.baseT, 0),
    box(-85, 85, 268, 322, -P.baseT, 0),
    dovetail(200, 188)
  );
  const win = [[-35, 50], [35, 50], [35, 95], [20, 110], [-20, 110], [-35, 95]];
  let wall = box(-85, 85, P.D - P.wall, P.D, -6, 135);
  wall = subtract(wall, prismXZ(win, P.D - P.wall - 1, P.D + 1));
  const shelf = prismYZ([[P.D, P.shelfTop - 20], [P.D, P.shelfTop], [P.D + 14, P.shelfTop], [P.D + 14, P.shelfTop - 6]], -85, 85);
  // Marca del centro: una muesca en el borde del estante para alinear la cámara.
  const notch = prismXY([[-1.5, P.D + 14.5], [1.5, P.D + 14.5], [0, P.D + 11]], P.shelfTop - 3, P.shelfTop + 1);
  const tilted = rotAbout(P.tiltPhone, P.D, P.H0, subtract(union(wall, shelf), notch));
  const ribs = [-60, -80, 60, 80].map(x => prismYZ([[270, 0], [306, 0], [296.5, 90]], x - 2, x + 2));
  return union(base, tilted, ...ribs);
}

/* ---------- suplementos ---------- */
const shimsPhone = () => [5, 10, 20].map((h, i) => box(-75, 75, i * 18, i * 18 + 13, 0, h));
const shimsPegs = () => [[4, 0], [4, 1], [8, 2], [8, 3]].map(([h, i]) => box(i * 24, i * 24 + 18, 0, 11, 0, h));

/* ---------- salida ---------- */
const parts = [
  { file: 'a-patron', name: 'Base del patrón', geom: partA(), color: '#d9e4e6' },
  { file: 'm-atril', name: 'Atril del anteojo', geom: partM(), color: '#bcd6db' },
  { file: 'b-celular', name: 'Base del celular', geom: partB(), color: '#d9e4e6' },
  { file: 'suplementos-celular', name: 'Suplementos del celular (5, 10 y 20 mm)', geom: union(...shimsPhone()), color: '#f0c987', print: true },
  { file: 'suplementos-anteojo', name: 'Suplementos del anteojo (2 de 4 mm y 2 de 8 mm)', geom: union(...shimsPegs()), color: '#f0c987', print: true }
];

const outDir = path.join(__dirname, 'stl');
fs.mkdirSync(outDir, { recursive: true });
const report = [];
const viewer = { P, parts: [] };
for (const p of parts) {
  // Para imprimir: apoyar la pieza en Z = 0 y centrarla en X/Y.
  const [[x0, y0, z0], [x1, y1, z1]] = measurements.measureBoundingBox(p.geom);
  const printable = translate([-(x0 + x1) / 2, -(y0 + y1) / 2, -z0], p.geom);
  const data = stl.serialize({ binary: true }, printable);
  fs.writeFileSync(path.join(outDir, p.file + '.stl'), Buffer.concat(data.map(d => Buffer.from(d))));
  const vol = measurements.measureVolume(p.geom) / 1000;
  report.push(`${p.file.padEnd(22)} ${(x1 - x0).toFixed(0).padStart(4)} × ${(y1 - y0).toFixed(0).padStart(4)} × ${(z1 - z0).toFixed(0).padStart(4)} mm   ${vol.toFixed(0).padStart(4)} cm³`);
  // Para el visor: triángulos en coordenadas del ensamblado (los suplementos se muestran aparte).
  const tris = [];
  for (const poly of p.geom.polygons) {
    const v = poly.vertices;
    for (let i = 1; i < v.length - 1; i++) tris.push(v[0], v[i], v[i + 1]);
  }
  viewer.parts.push({ name: p.name, file: p.file + '.stl', color: p.color, print: !!p.print, tris: tris.flat().map(n => Math.round(n * 10) / 10) });
  const big = Math.max(x1 - x0, y1 - y0);
  if (big > 180 || z1 - z0 > 180) report.push(`  ¡ojo! ${p.file} no entra en una cama de 180 mm`);
}
// Visor 3D: la plantilla con la geometría incrustada. index.html es la página completa para GitHub Pages;
// con VISOR_SOLO=archivo.html se escribe además solo el contenido, sin <html>/<head>/<body>.
const tpl = fs.readFileSync(path.join(__dirname, 'visor.template.html'), 'utf8').replace('/*DATOS*/', 'window.SOPORTE = ' + JSON.stringify(viewer) + ';');
fs.writeFileSync(path.join(__dirname, 'index.html'), '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body>\n' + tpl + '\n</body>\n</html>\n');
if (process.env.VISOR_SOLO) fs.writeFileSync(process.env.VISOR_SOLO, tpl);
console.log('Pieza                  ancho × largo × alto      volumen\n' + report.join('\n'));
