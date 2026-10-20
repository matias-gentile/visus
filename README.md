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

En una compu se abre `…/visus/#patron`, se calibra la pantalla con una tarjeta (hay que confirmarlo para avanzar) y se muestra un patrón: cuatro cuadrados de referencia y un anillo de 12 puntos, más un recuadro de control del tamaño de una tarjeta. El celular, con la cámara trasera a unos 50 cm, detecta los cuadrados, corrige la perspectiva con una homografía y ajusta una elipse a los puntos vistos a través de la lente.

**Física.** Con la lente a una fracción `u` del camino entre la cámara y la pantalla, el aumento cumple `1/M = 1 − P · D · u(1 − u)`. Es máximo a mitad de camino, donde `P = (4 / D) · (1 − 1/M)`. El aumento `M` es un cociente medido en la imagen, así que no depende de la cámara ni del tamaño de la pantalla. La única medida absoluta es `D`, la distancia del celular a la pantalla, y un error en `D` pasa igual a la graduación: si `D` está 20 % corto, −2,50 se lee −3,00.

**Distancia.** Hay dos formas de obtenerla:
- *Cinta métrica (recomendada):* con el celular apoyado, se mide la distancia a mano. La app compara con su propia estimación y corrige todas las distancias del barrido, así que no depende de la calibración de la pantalla ni de la focal de la cámara.
- *Sin cinta:* la focal se calibra con vistas inclinadas del patrón, usando solo vistas quietas (sin deformación del obturador rodante), en al menos dos direcciones, con mínimos cuadrados conjuntos. La focal se normaliza por el lado largo del cuadro, así que no cambia si se gira el celular. En este caso la precisión depende de la calibración de la pantalla de la compu.

**Estimación robusta.** Cada cuadro da un vector de potencia (equivalente esférico y las dos componentes del cilindro) igual a `k · P`, con `k = 4u(1 − u) ≤ 1`. Se estima la dirección común con los cuadros fuertes, se descartan los que no la siguen (la lente tapa solo parte del círculo, reflejos o movimiento lateral rápido) y el valor final es la envolvente superior. Una curva en vivo muestra el barrido, y el resultado sale con un nivel de confianza; con confianza baja, la app pide repetir.

**Cámara trasera en iPhone Pro.** Safari puede abrir el teleobjetivo, el gran angular o una cámara virtual que cambia de lente sola. La app pasa a la cámara principal cuando el navegador la ofrece.

**Pruebas.** Usé un simulador físico con trazado de rayos: cámara pinhole con obturador rodante, anteojo de dos lentes delgadas con aro, y pantalla con bisel y fondo. En 24 barridos simulados con mano firme o inquieta, y lentes de −7,00 a +3,50 con cilindros de hasta −2,00, el método actual acierta la graduación exacta en los 24 casos (el anterior, en 18). El error medio del equivalente esférico es de 0,01 D. Una prueba de punta a punta en el navegador, con una cámara falsa que reproduce un barrido de −2,50, da −2,50 con confianza alta. Falta validarlo con anteojos reales.

**Datos para revisar.** Después de cada medición, «Copiar datos para revisar» copia un JSON con la cámara, la escala y cada cuadro (distancia, aumentos, eje, puntos, posición del círculo).

## Soporte impreso en 3D

En `soporte/` está un accesorio para medir anteojos sin compu y sin calibrar nada. Es una base de 33 cm en tres piezas que encastran, con el patrón impreso en una punta, el celular apoyado en la otra y un atril en la mitad del camino donde se apoya el anteojo.

- **Distancia fija:** el soporte fija la distancia en 30 cm, que es la única medida absoluta del método. Con el anteojo en la mitad, `P = (4/D)(1 − 1/M)`; además, ahí el resultado casi no cambia si el anteojo queda unos milímetros corrido.
- **Sin calibración:** no importa la escala de impresión del patrón ni qué cámara use el celular, porque el aumento se mide como una proporción dentro de la imagen.
- **Patrón propio:** tiene un círculo más chico y cuadrados más separados, para que se vean por arriba y por abajo del armazón. Está en `patron-soporte.pdf`, para A4.
- **Archivos:** el modelo es paramétrico, en JavaScript con JSCAD (`soporte/soporte.js`). Genera los STL en `soporte/stl/` y un visor 3D en `soporte/index.html`. Todas las piezas entran en una cama de 180 × 180 mm y se imprimen sin soportes.
- **En la app:** «Medir mis anteojos» → «Con el soporte». Mide con 3 segundos de imagen quieta.

Para regenerar las piezas: `cd soporte && npm install && node soporte.js`. Para el patrón: `python3 soporte/patron.py`.

## Cómo funciona

- Es un solo archivo, `index.html`, sin servidor ni base de datos.
- La imagen de la cámara se procesa en el dispositivo y no se envía a ningún lado.
- La cámara solo funciona en páginas servidas con https.

## Limitaciones

- Es un prototipo para validar la idea: no es un dispositivo médico, no diagnostica y no reemplaza la consulta.
- La estimación de miopía cubre de −1,50 D en adelante y no detecta hipermetropía.
- La medición de anteojos no sirve para lentes progresivas o bifocales.
