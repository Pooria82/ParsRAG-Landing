"""Renders the share cards (assets/img/og-card-en.png and og-card-fa.png).

Run after `npm run build` while dist/ is being served:
    python -m http.server 8765 --bind 127.0.0.1 --directory dist
    python scripts/og.py
Requires Playwright for Python (pip install playwright && python -m playwright install chromium).
"""
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
BASE = 'http://127.0.0.1:8765'
shutil.copy(ROOT / 'src' / 'og' / 'card.html', ROOT / 'dist' / 'og-card.html')
try:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 1280, 'height': 640})
        for lang in ('en', 'fa'):
            page.goto(f'{BASE}/og-card.html?lang={lang}', wait_until='networkidle')
            page.evaluate('document.fonts.ready')
            page.wait_for_timeout(600)
            page.screenshot(path=str(ROOT / 'src' / 'static' / 'assets' / 'img' / f'og-card-{lang}.png'))
        browser.close()
finally:
    (ROOT / 'dist' / 'og-card.html').unlink(missing_ok=True)
print('Rendered og-card-en.png and og-card-fa.png')
