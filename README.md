# Visus

Prototipo de chequeo visual guiado desde el celular. La persona hace los tests en el navegador y el resultado queda en un informe para su oftalmólogo.

**Probalo:** https://matias-gentile.github.io/visus/ (abrilo desde el celular, en Chrome o Safari).

## Qué incluye

1. **Preguntas de seguridad.** Si aparece un síntoma de alarma (pérdida brusca de visión, dolor, destellos, golpe o químico), el test se frena y se indica consulta urgente.
2. **Calibración de pantalla** con una tarjeta de tamaño estándar (DNI, SUBE, crédito). Se guarda en el dispositivo.
3. **Distancia automática con la cámara frontal.** Se mide el diámetro del iris (≈ 11,7 mm en adultos) con MediaPipe Face Landmarker y el tamaño de cada figura se ajusta en tiempo real.
4. **Agudeza de cerca** por ojo, con E giratoria, 2 de 3 aciertos por nivel y pasos de 0,1 logMAR.
5. **Rejilla de Amsler** central (10° × 10°) donde la persona marca zonas distorsionadas.
6. **Estimación de miopía** por punto lejano: graduación ≈ −1 / distancia en metros.
7. **Informe** con hallazgos priorizados, resultados por ojo y método, para copiar o descargar.

## Cómo funciona

- Es un solo archivo, `index.html`, sin servidor ni base de datos.
- La imagen de la cámara se procesa en el dispositivo y no se envía a ningún lado.
- La cámara solo funciona en páginas servidas con https.

## Limitaciones

- Es un prototipo para validar la idea: no es un dispositivo médico, no diagnostica y no reemplaza la consulta.
- Sin calibración de la cámara, la distancia puede tener un error del 10 al 15 %.
- La estimación de miopía solo cubre de −1,50 D en adelante y no detecta hipermetropía.
