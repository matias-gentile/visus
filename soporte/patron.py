"""Genera soporte/patron-soporte.pdf: el patrón del soporte en una hoja A4, en tamaño real.

Uso: python3 soporte/patron.py   (necesita reportlab: pip install reportlab)
Las medidas tienen que coincidir con P.pattern en soporte.js y con PAT_RIG en index.html.
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import black, HexColor
from reportlab.pdfgen import canvas

CARD = (110, 150)                      # tarjeta (ancho × alto, mm)
MK = [(-42, -66), (42, -66), (42, 66), (-42, 66)]
MK_SIZE = 12
R, N_DOTS, DOT_D = 11, 12, 4.4

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'patron-soporte.pdf')
W, H = A4
c = canvas.Canvas(out, pagesize=A4)
c.setTitle('Visus · patrón para el soporte')
c.setAuthor('Visus')
gray, ink2 = HexColor('#8A949A'), HexColor('#46545E')

cx, cy = W / 2, H / 2 - 12 * mm      # centro de la tarjeta

# Encabezado e instrucciones, fuera de la tarjeta.
c.setFillColor(black)
c.setFont('Helvetica-Bold', 16)
c.drawString(20 * mm, H - 22 * mm, 'Visus · patrón para el soporte de anteojos')
c.setFont('Helvetica', 10.5)
c.setFillColor(ink2)
lines = [
    'Imprimí esta hoja en tamaño real (100 %, sin «ajustar a la página»). Si la impresora la achica un poco,',
    'no afecta la medición: solo tiene que entrar en el tablero del soporte.',
    'Recortá por la línea punteada, pegala sobre un cartón fino y apoyala en el tablero, sobre el labio de abajo.',
    'Mejor papel mate: el brillo genera reflejos. Que no queden arrugas ni burbujas.',
]
for i, t in enumerate(lines):
    c.drawString(20 * mm, H - 31 * mm - i * 5.2 * mm, t)

# Línea de corte.
c.setStrokeColor(gray)
c.setDash(3, 3)
c.setLineWidth(0.6)
c.rect(cx - CARD[0] / 2 * mm, cy - CARD[1] / 2 * mm, CARD[0] * mm, CARD[1] * mm, stroke=1, fill=0)
c.setDash()

# Patrón: en el PDF el eje Y va hacia arriba; el patrón es simétrico, así que da igual.
c.setFillColor(black)
for (x, y) in MK:
    c.rect(cx + (x - MK_SIZE / 2) * mm, cy + (y - MK_SIZE / 2) * mm, MK_SIZE * mm, MK_SIZE * mm, stroke=0, fill=1)
import math
for i in range(N_DOTS):
    a = i * 2 * math.pi / N_DOTS
    c.circle(cx + R * math.cos(a) * mm, cy + R * math.sin(a) * mm, DOT_D / 2 * mm, stroke=0, fill=1)

# Pie, fuera de la tarjeta.
c.setFillColor(gray)
c.setFont('Helvetica', 9)
c.drawCentredString(W / 2, cy - CARD[1] / 2 * mm - 8 * mm, f'Tarjeta de {CARD[0] / 10:.0f} × {CARD[1] / 10:.0f} cm · cuadrados de {MK_SIZE / 10:.1f} cm'.replace('.', ','))
c.showPage()
c.save()
print('Listo:', out)
