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

## Física y decisiones clave

- **Distancia con la cámara frontal:** el iris mide 11,7 mm y sirve para calibrar una "escala facial" con rasgos grandes en 3D. Después se sigue la distancia con esos rasgos, con filtro de mediana. La selfie es opcional: su EXIF da `FocalLengthIn35mmFilm`.
- **Agudeza:** E con barras de amontonamiento, escalera adaptativa, puntaje letra por letra (0,02 logMAR) y 2 figuras de control.
- **Graduación subjetiva:** punto lejano con test rojo-verde; astigmatismo con dial y rayas en dos orientaciones, combinados como matrices de potencia.
- **Medición de anteojos (lensómetro):** con la lente a una fracción `u` del camino, `1/M = 1 − P·D·u(1−u)`; a mitad de camino, `P = (4/D)(1 − 1/M)`.
  - `M` es un cociente medido en la imagen, así que no depende de la cámara ni de la pantalla. **La única medida absoluta es `D`**, y un error en `D` pasa igual a `P`.
  - Por eso hay dos modos de escala: **cinta métrica** (factor `c = D_cinta / D_estimada`, independiente de las calibraciones) y **sin cinta** (focal calibrada con vistas inclinadas y quietas, en al menos dos direcciones).
  - Ejes en TABO: la cámara mira la lente desde el lado del usuario (patillas hacia el celular), así que `eje = 180° − φ`.
  - `lensRobust`: cada cuadro da un vector de potencia `k·P` con `k ≤ 1`. Se toma la dirección común de los cuadros fuertes, se descartan los que no la siguen y el valor es la envolvente superior (promedio del 10 % más alto, sin contar el máximo).
- **iPhone Pro:** Safari puede abrir el teleobjetivo, el gran angular o una cámara virtual. `openRear` busca la "Back Camera" principal.

## Pruebas

Los scripts están en `tools/`. Corré los que correspondan antes de hacer commit de cambios en `VC` o en la medición:

```bash
node tools/test-lens.js --quick   # 3 barridos simulados (< 1 min); sin --quick, 24 barridos (~3 min). Esperado: todos exactos
node tools/test-focal.js          # calibración de focal con obturador rodante; esperado: error < 2 %
node tools/mkvideo.js             # genera tools/out/lens.y4m (cámara falsa: barrido de −2,50 a 50 cm)
python3 tools/e2e-lens.py         # Chromium + cámara falsa, flujo completo; esperado: −2,50 esf
```

- `tools/sim.js` es un simulador físico con trazado de rayos: cámara pinhole con obturador rodante, anteojo de dos lentes delgadas con aro, y pantalla con bisel y fondo. Sirve para reproducir errores antes de tocar el algoritmo.
- Para revisar el flujo de la cámara frontal sin cámara real, se puede reemplazar `vision_bundle.mjs` por un detector simulado con `page.route` de Playwright. MediaPipe no se descarga en entornos sin internet.
- Dentro de un artifact de claude.ai la cámara está bloqueada. Para probar en el celular hay que usar GitHub Pages (https).

## Estado y pendientes

1. **Validar con anteojos reales.** Con la versión anterior (sin cinta), un anteojo de −2,50 dio −3,00. Es un error de escala del 20 %, probablemente porque la pantalla de la compu no se calibró con la tarjeta. Falta repetir la medición con el modo cinta. Si vuelve a fallar, pedile a Matías los datos de «Copiar datos para revisar»: el JSON tiene cámara, escala y, por cuadro, `[t_ms, D_mm, M1, M2, phi1, puntos, cx_mm, cy_mm, mov]`.
2. Confirmar en el iPhone 13 Pro que `openRear` elige la cámara principal: la línea gris de diagnóstico muestra el nombre de la cámara.
3. Ideas que quedaron pendientes: panel para el oftalmólogo (varios informes y comparación en el tiempo) y un estudio de validación clínica.

## Convenciones

- Textos claros y cortos, con voseo. Los errores dicen qué pasó y cómo seguir.
- No agregar dependencias ni pasos de build. Todo sigue en `index.html`.
- Mensajes de commit en español, explicando el porqué.
