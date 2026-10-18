"""Prueba de punta a punta de «Medir mis anteojos» en Chromium, con una cámara falsa que reproduce
tools/out/lens.y4m (generalo antes con: node tools/mkvideo.js).

Uso: python3 tools/e2e-lens.py      (necesita: pip install playwright && playwright install chromium)
Espera −2,50 esf con la distancia ingresada como cinta (50 cm).
"""
import asyncio, json, os, socket, subprocess, sys, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIDEO = os.path.join(ROOT, 'tools', 'out', 'lens.y4m')


def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p


async def main(port):
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
                                          f'--use-file-for-fake-video-capture={VIDEO}'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                                  is_mobile=True, has_touch=True, permissions=['camera'])
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(f'http://127.0.0.1:{port}/index.html'); await pg.wait_for_timeout(300)
        await pg.click('#lensBtn'); await pg.click('#lensStart')
        await pg.wait_for_function("document.querySelector('#lensStatus').textContent.includes('Patrón encontrado')", timeout=20000)
        await pg.fill('#tapeCm', '50'); await pg.click('#tapeSet')
        await pg.wait_for_function("!document.querySelector('#lensRec').disabled", timeout=10000)
        await pg.click('#lensRec')
        await pg.wait_for_function("document.querySelector('#lensRec').textContent.includes('Medir esta lente')", timeout=30000)
        res = await pg.text_content('#lensRes')
        await pg.click('#lensDiagCopy'); await pg.wait_for_timeout(300)
        diag = json.loads(await pg.evaluate("document.querySelector('#lensDiagTa').value"))
        await pg.screenshot(path=os.path.join(ROOT, 'tools', 'out', 'e2e-lens.png'), full_page=True)
        await b.close()
        print('Resultado:', res)
        print('Diagnóstico:', json.dumps(diag['resultado'], ensure_ascii=False))
        if errs: print('Errores de la página:', errs)
        return '−2,50 esf' in res and not errs


if __name__ == '__main__':
    if not os.path.exists(VIDEO):
        sys.exit('Falta el video: corré primero  node tools/mkvideo.js')
    port = free_port()
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'], cwd=ROOT,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(0.8)
        ok = asyncio.run(main(port))
    finally:
        srv.terminate()
    print('OK' if ok else 'FALLA')
    sys.exit(0 if ok else 1)
