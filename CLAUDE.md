# Visus — contexto para Claude Code

Prototipo de chequeo visual desde el celular, publicado con GitHub Pages desde `main` (carpeta raíz):
https://matias-gentile.github.io/visus/. El autor es Matías (Argentina). Escribí los textos de la app en español rioplatense, con voseo.

## Estructura

Todo vive en un solo archivo, **`index.html`**, sin build ni servidor. Las únicas dependencias externas son MediaPipe Face Landmarker (jsDelivr y Google Storage) y Google Fonts.

Dentro de `index.html`:
- **CSS:** tokens de color en `:root` con modo oscuro, y una pantalla por `<section data-screen="…">`.
- **`VC`, entre `/*VC-START*/` y `/*VC-END*/`:** módulo de visión puro, sin DOM. Las pruebas lo cargan desde ahí con `tools/vc-loader.js`, así que **no borres esas marcas**. Contiene:
  - `analyzePattern(img, fProc, Lp)`: detecta los 4 marcadores, calcula la homografía, ajusta una elipse al anillo de 12 puntos y devuelve aumentos `M1`/`M2`, eje `phi1`, distancia `Dmm` y ecuaciones de calibración.
  - `lensRobust(frames)`: estimación robusta de la graduación sobre todo el barrido.
  - `focalJoint(eqs)`: focal normalizada por el lado largo, por mínimos cuadrados conjuntos.
  - `rxFromVec`, `tabo`, `exifF35` y otras utilidades.
- **App:** navegación con `go(name)`. Cámara frontal: `Cam`, `frontLoop`, escala facial. Cámara trasera: `Lens`, `rearLoop`, `openRear`. Después vienen los tests de agudeza, Amsler y graduación, y el informe.
- **`#patron`:** abre la página del patrón para la compu, con calibración por tarjeta y confirmación obligatoria.
- **Modo estación** (`Station`, `EST`): se elige en el paso «Distancia» y se guarda en `localStorage` (`visus.station`, `visus.stationRail`). Sin cámara: `currentCm()` devuelve 40 en agudeza y 30 en Amsler; el punto lejano se lee en la escala del riel (`readMark`). `pinholeOffer` repite la agudeza con estenopeico si dio 20/32 o peor (`PH_MIN`), y el resultado queda en `S.acuity[ojo].ph`.

**`soporte/`** contiene el soporte impreso en 3D para medir anteojos:
- `soporte.js`: modelo paramétrico en JSCAD. Las medidas están en `P` al principio. Genera `stl/*.stl` y el visor `index.html`, que tiene la geometría incrustada. Para correrlo: `npm install && node soporte.js`.
- `visor.template.html`: plantilla del visor 3D (three.js r128 desde cdnjs, con órbita propia).
- `patron.py`: genera `patron-soporte.pdf` (A4) con reportlab.
- **El patrón del soporte está definido en tres lugares que tienen que coincidir:** `P.pattern` en `soporte.js`, `PAT_RIG` en `index.html` y las constantes de `patron.py`.

**`estacion/`** contiene la estación de autoexamen (mentonera, apoyo de frente, visor con paleta y placa estenopeica, riel con escala y carro):
- `estacion.js`: modelo en JSCAD, con las medidas en `P`. Genera `stl/*.stl` y el visor `index.html` desde `visor.template.html`. Exporta las piezas para las pruebas. Para correrlo: `npm install && node estacion.js`.
- Las distancias del tope (`P.stops`, 30 y 40 cm) y el alcance del riel (`P.maxD`: 50,2 cm con 3 tramos y 66,2 con 4) tienen que coincidir con `EST` en `index.html`.

## Física y decisiones clave

- **Distancia con la cámara frontal:** el iris mide 11,7 mm y sirve para calibrar una "escala facial" con rasgos grandes en 3D. Después se sigue la distancia con esos rasgos, con filtro de mediana. La selfie es opcional: su EXIF da `FocalLengthIn35mmFilm`.
- **Agudeza:** E con barras de amontonamiento, escalera adaptativa, puntaje letra por letra (0,02 logMAR) y 2 figuras de control.
- **Graduación subjetiva:** punto lejano con test rojo-verde; astigmatismo con dial y rayas en dos orientaciones, combinados como matrices de potencia.
- **Medición de anteojos (lensómetro):** con la lente a una fracción `u` del camino, `1/M = 1 − P·D·u(1−u)`; a mitad de camino, `P = (4/D)(1 − 1/M)`.
  - `M` es un cociente medido en la imagen, así que no depende de la cámara ni de la pantalla. **La única medida absoluta es `D`**, y un error en `D` pasa igual a `P`.
  - Por eso hay tres modos de escala:
    - **Con el soporte:** `D` es fija, `RIG.D = 301` mm (300 de la pieza, +2 de la pupila de la cámara dentro del celular, −1 del cartón). Usa el patrón `PAT_RIG` y la lente está siempre a mitad de camino, así que se estima con `lensStatic` sobre 3 s quietos.
    - **Cinta métrica:** factor `c = D_cinta / D_estimada`, independiente de las calibraciones.
    - **Sin cinta:** focal calibrada con vistas inclinadas y quietas, en al menos dos direcciones.
  - Ejes en TABO: la cámara mira la lente desde el lado del usuario (patillas hacia el celular), así que `eje = 180° − φ`.
- **Punto lejano y plano de los anteojos:** la distancia se mide desde la córnea, pero la graduación se expresa a 12 mm por delante: `P = −100 / (cm − 1,2)` (`rxAt`, `VERTEX_CM`). A 40 cm da −2,58, que redondea a −2,50.
  - `lensRobust`: cada cuadro da un vector de potencia `k·P` con `k ≤ 1`. Se toma la dirección común de los cuadros fuertes, se descartan los que no la siguen y el valor es la envolvente superior (promedio del 10 % más alto, sin contar el máximo).
- **iPhone Pro:** Safari puede abrir el teleobjetivo, el gran angular o una cámara virtual. `openRear` busca la "Back Camera" principal.
- **Geometría del soporte** (en `soporte.js`, con X a lo ancho, Y a lo largo del riel y Z hacia arriba):
  - El tablero del patrón está en Y = 0, inclinado 4° hacia atrás; la tarjeta mide 110 × 150 y apoya en un labio a 5 mm.
  - El atril está en Y = 150. Sus apoyos quedan a 50 mm de altura y se suben con suplementos de 4 y 8 mm.
  - La pared del celular está en Y = 300, inclinada 3° hacia el patrón. El estante está a 40 mm, con suplementos de 5, 10 y 20 mm.
  - El eje óptico va a 80 mm de altura.
  - Los cuadrados del patrón quedan por arriba y por abajo del armazón para lentes de hasta unos 52 mm de alto, siempre que el anteojo esté centrado.
- **Geometría de la estación** (en `estacion.js`, con X a lo ancho (+X a la derecha de la persona), Y hacia adelante desde la córnea y Z hacia arriba):
  - Ojos y centro de la pantalla a 125 mm sobre la base; mentonera 115 mm por debajo de los ojos; apoyo de frente a 8 mm delante de la córnea, apenas cóncavo.
  - Visor entre Y = 28 y 38, por delante de los anteojos, con lugar para la nariz. Las placas (2,4 mm) se cuelgan: arriba entran en una ranura de 3,2 mm con un labio delantero corto y abajo apoyan en una repisa con un borde de 1 mm. Para sacarlas se levantan 1,5 mm, se inclinan unos 5° y se bajan. Así la ranura no atraviesa los postes, que si no tendrían un puente de más de 50 mm al imprimir.
  - Los postes dejan libre Y < 24 a la altura de los ojos, para las bisagras y patillas de los anteojos.
  - El carro tiene y = 0 en el plano de la pantalla a la altura de los ojos, suponiendo un celular de 10 mm con funda; su flecha marca esa posición sobre la escala. El tope (un perno en el riel) frena el carro por detrás, porque los toques en la pantalla lo empujan hacia adelante.
  - Hay que apoyar la estación entera sobre una superficie plana: las colas de milano no resisten corte vertical, así que no se puede apoyar solo en las puntas.

## Pruebas

Los scripts están en `tools/`. Corré los que correspondan antes de hacer commit de cambios en `VC` o en la medición:

```bash
node tools/test-lens.js --quick   # 3 barridos simulados (< 1 min); sin --quick, 24 barridos (~3 min). Esperado: todos exactos
node tools/test-focal.js          # calibración de focal con obturador rodante; esperado: error < 2 %
node tools/test-rig.js            # modo soporte: 7 lentes, armazones de distintas alturas y escala de impresión corrida; esperado: 7/7
node tools/mkvideo.js [--rig]     # genera tools/out/lens.y4m (barrido de −2,50 a 50 cm) o rig.y4m (soporte, −2,50 −0,75 × 160)
python3 tools/e2e-lens.py [--rig] # Chromium + cámara falsa, flujo completo; esperado: −2,50 esf, o −2,50 −0,75 × 160 con --rig
node tools/test-estacion.js       # geometría de la estación (necesita cd estacion && npm install); esperado: «Todo bien»
python3 tools/e2e-estacion.py     # chequeo completo con la estación (agudeza con estenopeico, Amsler, riel) y con la cámara simulada
```

- `tools/sim.js` es un simulador físico con trazado de rayos: cámara pinhole con obturador rodante, anteojo de dos lentes delgadas con aro, y pantalla con bisel y fondo. Sirve para reproducir errores antes de tocar el algoritmo.
- Para revisar el flujo de la cámara frontal sin cámara real, se puede reemplazar `vision_bundle.mjs` por un detector simulado con `page.route` de Playwright. MediaPipe no se descarga en entornos sin internet.
- Dentro de un artifact de claude.ai la cámara está bloqueada. Para probar en el celular hay que usar GitHub Pages (https).

## Estado y pendientes

1. **Validar con anteojos reales.** Con la versión anterior (sin cinta), un anteojo de −2,50 dio −3,00. Es un error de escala del 20 %, probablemente porque la pantalla de la compu no se calibró con la tarjeta. Falta repetir la medición con el modo cinta. Si vuelve a fallar, pedile a Matías los datos de «Copiar datos para revisar»: el JSON tiene cámara, escala y, por cuadro, `[t_ms, D_mm, M1, M2, phi1, puntos, cx_mm, cy_mm, mov]`.
2. Confirmar en el iPhone 13 Pro que `openRear` elige la cámara principal: la línea gris de diagnóstico muestra el nombre de la cámara.
3. **Soporte 3D:** está diseñado y probado en simulación, pero todavía no se imprimió. Falta confirmar en la práctica:
   - si el celular apoya firme con la inclinación de 3°;
   - qué suplemento necesita el iPhone 13 Pro para que la cámara quede a 80 mm;
   - si la pupila de la cámara está realmente a unos 2 mm dentro del celular (ajustar `RIG.D` si hace falta);
   - el ajuste de las colas de milano (`P.clear`).
4. **Estación de autoexamen:** diseñada y probada en simulación, sin imprimir. Falta confirmar en la práctica:
   - la comodidad: los ojos quedan a 12,5 cm de la base, así que hay que subir la estación entera sobre algo plano;
   - si la frente apoya a unos 8 mm delante de la córnea (corre todas las distancias por igual);
   - el ajuste de las placas en el visor (que no se caigan y que se saquen con facilidad) y del carro en el riel;
   - si los agujeritos de 1,4 mm salen limpios en la impresora y se encuentran fácil.
5. Ideas que quedaron pendientes: agudeza de lejos con un espejo, visor de graduación tipo NETRA, panel para el oftalmólogo (varios informes y comparación en el tiempo) y un estudio de validación clínica.

## Convenciones

- Textos claros y cortos, con voseo. Los errores dicen qué pasó y cómo seguir.
- No agregar dependencias ni pasos de build. Todo sigue en `index.html`.
- Mensajes de commit en español, explicando el porqué.
