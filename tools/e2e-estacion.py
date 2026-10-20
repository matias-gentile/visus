"""Prueba de punta a punta del chequeo visual en Chromium:
  1) con la estación de autoexamen: agudeza con y sin estenopeico, Amsler y punto lejano leído en la escala del riel;
  2) con la cámara frontal (detector de rostro simulado), para revisar que ese camino siga andando.

Un observador simulado responde la E según su tamaño angular a la distancia de prueba: acierta si la letra es
más grande que su agudeza y, si no, se equivoca.

Uso: python3 tools/e2e-estacion.py     (necesita: pip install playwright && playwright install chromium)
"""
import asyncio, math, os, socket, subprocess, sys, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tools', 'out')
# Detector de rostro falso: una cara con iris de 11,7 mm a window.__fakeDist mm de la cámara.
FAKE_MP = r"""
export const FilesetResolver = { forVisionTasks: async () => ({}) };
export const FaceLandmarker = { createFromOptions: async () => ({
  detectForVideo(video) {
    const W = video.videoWidth, H = video.videoHeight, d = window.__fakeDist || 400;
    const k = ((Math.hypot(W, H) / 2) / Math.tan(37 * Math.PI / 180)) / d;
    const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    const n = () => (Math.random() - 0.5) * 0.3, r = 11.7 / 2;
    const set = (i, xm, ym) => { lm[i] = { x: 0.5 + xm * k / W, y: 0.5 + ym * k / H, z: 0 }; };
    [[468, -32, 0], [469, -32 + r, 0], [471, -32 - r, 0], [470, -32, -r], [472, -32, r]].forEach(([i, x, y]) => set(i, x + n(), y + n()));
    [[473, 32, 0], [474, 32 + r, 0], [476, 32 - r, 0], [475, 32, -r], [477, 32, r]].forEach(([i, x, y]) => set(i, x + n(), y + n()));
    set(234, -70 + n(), 5); set(454, 70 + n(), 5); set(127, -65 + n(), -20); set(356, 65 + n(), -20); set(168, 0, -10 + n()); set(2, 0, 40 + n());
    return { faceLandmarks: [lm] };
  }, close() {} }) };
"""
ROT = {'rotate(0 2.5 2.5)': 'right', 'rotate(90 2.5 2.5)': 'down', 'rotate(180 2.5 2.5)': 'left', 'rotate(270 2.5 2.5)': 'up'}
WRONG = {'right': 'left', 'left': 'right', 'up': 'down', 'down': 'up'}
fails = []


def check(name, ok, detail=''):
    print(('ok    ' if ok else 'FALLA ') + name + (f' · {detail}' if detail else ''))
    if not ok: fails.append(name)


def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p


async def answer_eye(pg, va, dist_mm):
    """Responde figuras hasta que termina el ojo; devuelve cuántas respondió."""
    px_mm = float(await pg.evaluate("JSON.parse(localStorage.getItem('visus.pxPerMm'))"))
    n = 0
    while await pg.locator('#acTest').is_visible() and n < 90:
        await pg.wait_for_function("document.querySelector('#eSvg').style.visibility !== 'hidden'")
        w = await pg.evaluate("parseFloat(document.querySelector('#eSvg').style.width)")
        arcmin = 2 * math.degrees(math.atan(w * 5 / 9 / px_mm / 2 / dist_mm)) * 60
        logmar = math.log10(arcmin / 5)
        d = ROT[await pg.evaluate("document.querySelector('#eGroup').getAttribute('transform')")]
        await pg.click(f'#acPad button[data-dir="{d if logmar >= va else WRONG[d]}"]')
        n += 1
        await pg.wait_for_timeout(240)
    return n


async def start_check(pg, port):
    await pg.goto(f'http://127.0.0.1:{port}/index.html'); await pg.wait_for_timeout(300)
    await pg.click('#startBtn')
    for k in ['sudden', 'pain', 'flashes', 'trauma']: await pg.click(f'.yn[data-key="{k}"] button[data-v="0"]')
    await pg.fill('#age', '34'); await pg.click('.yn[data-key="wears"] button[data-v="0"]')
    await pg.click('#triageNext'); await pg.click('#cardOk')


async def station(b, port):
    print('— Con la estación')
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await start_check(pg, port)
    await pg.click('#distMode button[data-m="est"]')
    check('con la estación se puede seguir sin cámara', not await pg.locator('#distanceNext').is_disabled())
    check('el panel de la cámara se oculta', await pg.locator('#camPanel').is_hidden())
    await pg.screenshot(path=os.path.join(OUT, 'est-distancia.png'), full_page=True)
    await pg.click('#distanceNext')

    how = await pg.text_content('#acEyeHow')
    check('agudeza OD: pide paleta y tope de 40', 'paleta' in how and 'agujero 40' in how, how)
    check('la píldora muestra la distancia de la estación', '40 cm · estación' in await pg.text_content('#distpillText'))
    await pg.click('#acStart')
    n1 = await answer_eye(pg, 0.4, 400)
    check('con 20/50 ofrece el estenopeico', await pg.locator('#acPh').is_visible(), f'{n1} figuras')
    await pg.screenshot(path=os.path.join(OUT, 'est-estenopeico.png'), full_page=True)
    await pg.click('#phStart')
    check('la prueba con estenopeico lo indica en la lámina', 'estenopeico' in await pg.text_content('#acEye'))
    n2 = await answer_eye(pg, 0.1, 400)
    how = await pg.text_content('#acEyeHow')
    check('al pasar al OI pide sacar la placa', 'Sacá la placa estenopeica' in how, how)
    await pg.click('#acStart')
    n3 = await answer_eye(pg, 0.1, 400)
    check('con buena visión no ofrece el estenopeico', await pg.locator('section[data-screen="amsler"]').is_visible(), f'{n2} y {n3} figuras')

    how = await pg.text_content('#amEyeHow')
    check('Amsler: tope de 30', 'agujero 30' in how, how)
    await pg.click('#amStart'); await pg.wait_for_timeout(150)
    check('Amsler a 30 cm sin pedir acercar el celular', await pg.locator('#amTarget').is_hidden())
    await pg.click('#amDone'); await pg.click('#amStart')
    bx = await pg.locator('#amWrap svg').bounding_box()
    await pg.mouse.click(bx['x'] + bx['width'] * 0.55, bx['y'] + bx['height'] * 0.35)
    await pg.click('#amDone')

    check('graduación: alcance según el riel', '−2,00 D' in await pg.text_content('#farRange'))
    await pg.click('#farDo')
    check('punto lejano: pide sacar el tope del medio', 'tope del medio' in await pg.text_content('#faEyeHow'))
    await pg.click('#faStart')
    check('rojo-verde: se anota la marca (sin cámara)', await pg.locator('#duoMarkBox').is_visible() and await pg.locator('#duoEqual').is_hidden())
    await pg.fill('#duoMark', '200'); await pg.click('#duoMarkOk'); await pg.wait_for_timeout(100)
    check('rechaza una marca fuera del riel', await pg.locator('#farDuo').is_visible())
    await pg.fill('#duoMark', '40'); await pg.click('#duoMarkOk')
    dial = await pg.text_content('#dialHow')
    check('dial: indica la marca donde poner el carro', 'marca 50' in dial, dial)
    await pg.click('#dialBtns button[data-line="0"]')
    await pg.fill('#gratMark', '44'); await pg.click('#gratMarkOk')
    await pg.fill('#gratMark', '38,5'); await pg.click('#gratMarkOk')
    await pg.click('#faStart'); await pg.click('#duoSharp')

    await pg.wait_for_selector('section[data-screen="report"]:not([hidden])')
    await pg.screenshot(path=os.path.join(OUT, 'est-informe.png'), full_page=True)
    rep = await pg.evaluate("document.querySelector('section[data-screen=\"report\"]').innerText")
    check('informe: fila del estenopeico', 'Con estenopeico' in rep)
    check('informe: mejora con el estenopeico', 'mejora con el estenopeico' in rep)
    check('informe: distancia de la estación', 'estación' in rep and 'Estación de autoexamen' in rep)
    # Rayas a 44 y 38,5 cm desde la córnea → −2,34 y −2,68 D en el plano de los anteojos.
    check('informe: OD con el astigmatismo de las rayas (corregido al plano de los anteojos)', '−2,25 −0,25 × 90°' in rep)
    check('informe: OI más allá del riel, menor a −2,00 D', 'Más allá del riel' in rep and 'menor a −2,00 D' in rep)
    check('sin errores de la página', not errs, '; '.join(errs))
    await ctx.close()


async def camera(b, port):
    print('— Con la cámara (detector simulado)')
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True, permissions=['camera'])
    async def fake(route): await route.fulfill(status=200, body=FAKE_MP, headers={'content-type': 'text/javascript', 'access-control-allow-origin': '*'})
    await ctx.route('**/vision_bundle.mjs', fake)
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(f'http://127.0.0.1:{port}/index.html')
    await pg.evaluate("localStorage.setItem('visus.station', 'false')")
    await start_check(pg, port)
    check('el modo cámara sigue siendo el inicial', await pg.locator('#camPanel').is_visible())
    await pg.click('#camStart'); await pg.wait_for_timeout(2000)
    await pg.click('#calStart'); await pg.wait_for_function("!document.querySelector('#distanceNext').disabled", timeout=20000)
    await pg.click('#distanceNext')
    check('agudeza: pide tapar con la mano', 'palma' in await pg.text_content('#acEyeHow'))
    await pg.click('#acStart'); await answer_eye(pg, 0.4, 400)
    check('sin estación no ofrece el estenopeico', await pg.locator('#acCover').is_visible())
    await pg.click('#acStart'); await answer_eye(pg, 0.1, 400)
    await pg.click('#amStart'); await pg.click('#amDone'); await pg.click('#amStart'); await pg.click('#amDone')
    await pg.click('#farDo'); await pg.click('#faStart')
    check('rojo-verde con la cámara: botón y lectura en vivo', await pg.locator('#duoEqual').is_visible() and await pg.locator('#duoMarkBox').is_hidden())
    await pg.click('#duoEqual'); await pg.click('#dialNone')
    await pg.click('#faStart'); await pg.click('#duoSharp')
    await pg.wait_for_selector('section[data-screen="report"]:not([hidden])')
    rep = await pg.evaluate("document.querySelector('section[data-screen=\"report\"]').innerText")
    check('informe con cámara: −2,50 a 40 cm', '−2,50 esf.' in rep, rep[rep.find('Punto lejano'):][:120].replace('\n', ' '))
    check('informe con cámara: más allá del brazo, menor a −1,50 D', 'Más allá del brazo' in rep and 'menor a −1,50 D' in rep)
    check('informe con cámara: sin fila de estenopeico', 'Con estenopeico' not in rep)
    check('sin errores de la página', not errs, '; '.join(errs))
    await ctx.close()


async def main(port):
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
        await station(b, port)
        await camera(b, port)
        await b.close()


if __name__ == '__main__':
    port = free_port()
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'], cwd=ROOT,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(0.8)
        asyncio.run(main(port))
    finally:
        srv.terminate()
    print(f'\n{len(fails)} fallas' if fails else '\nTodo bien')
    sys.exit(1 if fails else 0)
