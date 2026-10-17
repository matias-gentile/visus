# Visus

Prototipo de chequeo visual guiado desde el celular. La persona hace los tests en el navegador y el resultado queda en un informe para su oftalmólogo.

**Probalo:** https://matias-gentile.github.io/visus/ (abrilo desde el celular, en Chrome o Safari).

## Chequeo de la vista

1. **Preguntas de seguridad.** Si aparece un síntoma de alarma (pérdida brusca de visión, dolor, destellos, golpe o químico), el test se frena y se indica consulta urgente.
2. **Calibración de pantalla** con una tarjeta de tamaño estándar (DNI, SUBE, crédito). Se guarda en el dispositivo.
3. **Distancia con la cámara frontal**, en tres capas:
   - *Escala facial:* durante unos segundos, sin anteojos, se mide el iris (≈ 11,7 mm en adultos) y con eso se calcula cuántos milímetros tienen rasgos grandes de la cara (ancho de cara, sienes, nariz). Después la distancia se sigue con esos rasgos, que son unas 25 veces más grandes que el iris, se miden en 3D y no quedan detrás de las lentes ni de la mano que tapa un ojo.
   - *Cámara calibrada con una selfie (opcional):* se lee del EXIF de la foto la distancia focal equivalente a 35 mm, que da el ángulo real de la cámara. Baja el error estimado de alrededor del ±13 % a alrededor del ±5 %.
   - *Filtro robusto:* mediana móvil más suavizado, pausa si la cabeza está girada o la distancia sale de rango.
4. **Agudeza de cerca** por ojo: E con barras alrededor (amontonamiento, como en los tests clínicos), búsqueda adaptativa, fase fina con puntaje letra por letra (0,02 logMAR) y 2 figuras de control para detectar respuestas al azar.
5. **Rejilla de Amsler** central de 10° × 10° a unos 30 cm.
6. **Graduación estimada (opcional, solo miopía):**
   - punto lejano con letras sobre rojo y verde (test bicromático): la distancia a la que se ven igual de nítidas da el equivalente esférico;
   - astigmatismo: dial de líneas para elegir el eje y rayas en dos orientaciones para medir cada meridiano; se combinan como matrices de potencia en esfera, cilindro y eje.
7. **Informe** con hallazgos priorizados, resultados por ojo y método, para copiar o descargar.

## Medición de anteojos

En una compu se abre `…/visus/#patron`, se calibra la pantalla con una tarjeta y se muestra un patrón: cuatro cuadrados de referencia y un anillo de 12 puntos. El celular, con la cámara trasera a unos 50 cm, detecta los cuadrados, corrige la perspectiva con una homografía y ajusta una elipse a los puntos vistos a través de la lente. El aumento en cada eje da la potencia por meridiano con `P = (4 / D) · (1 − 1 / M)`, tomando los cuadros de máximo aumento, que corresponden a la lente a mitad de camino. Devuelve esfera, cilindro y eje.

En pruebas con imágenes sintéticas recupera la graduación exacta (por ejemplo −4,25 −1,25 × 20) con el celular girado o apaisado. Falta validarlo con anteojos reales.

## Cómo funciona

- Es un solo archivo, `index.html`, sin servidor ni base de datos.
- La imagen de la cámara se procesa en el dispositivo y no se envía a ningún lado.
- La cámara solo funciona en páginas servidas con https.

## Limitaciones

- Es un prototipo para validar la idea: no es un dispositivo médico, no diagnostica y no reemplaza la consulta.
- La estimación de miopía cubre de −1,50 D en adelante y no detecta hipermetropía.
- La medición de anteojos no sirve para lentes progresivas o bifocales.
