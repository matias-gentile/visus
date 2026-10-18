// Carga el módulo de visión (VC) directamente desde index.html, entre las marcas /*VC-START*/ y /*VC-END*/.
// Así las pruebas siempre usan el mismo código que la página, sin copiarlo a mano.
'use strict';
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/\/\*VC-START\*\/([\s\S]*)\/\*VC-END\*\//);
if (!m) throw new Error('No encontré las marcas /*VC-START*/ … /*VC-END*/ en index.html');
module.exports = new Function(m[1] + '\nreturn VC;')();
