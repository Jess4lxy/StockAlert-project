"""Genera los iconos PNG de la PWA a partir del logo de StockAlert (public/favicon.svg).

    npm run iconos        (requiere Python 3 y Pillow: pip install pillow)
"""
from pathlib import Path
from PIL import Image, ImageDraw

MARINO, NARANJA, BLANCO = (31, 58, 95), (232, 145, 45), (255, 255, 255)
SALIDA = Path(__file__).resolve().parent.parent / "public" / "icons"
SS = 4  # supersampling para bordes suaves


def logo(size: int, redondeado: bool, zona: float = 1.0) -> Image.Image:
    """zona: fracción del lienzo que ocupa el dibujo (0.62 para iconos 'maskable')."""
    n = size * SS
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, n - 1, n - 1), radius=int(n * 6 / 32) if redondeado else 0, fill=MARINO)
    u = n * zona / 32          # unidad: 1/32 del dibujo (el SVG original es de 32x32)
    o = n * (1 - zona) / 2     # margen para centrarlo
    for x, y, w, h, color in [(7, 17, 4, 8, BLANCO), (14, 12, 4, 13, BLANCO), (21, 7, 4, 18, NARANJA)]:
        d.rectangle((o + x * u, o + y * u, o + (x + w) * u, o + (y + h) * u), fill=color)
    return img.resize((size, size), Image.LANCZOS)


SALIDA.mkdir(parents=True, exist_ok=True)
logo(192, True).save(SALIDA / "icon-192.png")
logo(512, True).save(SALIDA / "icon-512.png")
logo(512, False, 0.62).save(SALIDA / "maskable-512.png")     # sin esquinas: el sistema recorta
logo(180, False).save(SALIDA / "apple-touch-icon.png")       # iOS aplica sus propias esquinas
print("Iconos generados en", SALIDA)
