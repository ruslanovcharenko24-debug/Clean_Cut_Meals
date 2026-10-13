"""A4 PDF with three labelled QR codes, one per meal page, then a decode check of the rendered page.

Usage: python3 -I scripts/qr-sheet.py https://<user>.github.io/<repo> qr/CCM_QR_codes_A4.pdf
Uses OpenCV (encode/decode) and Pillow, already present on this Mac; no installs.
"""
import sys
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

DPI = 300
MM = DPI / 25.4
A4 = (round(210 * MM), round(297 * MM))
QR_MM = 45          # printed code size without quiet zone (brief: at least 35 mm)
QUIET_MODULES = 4   # standard quiet zone

MEALS = [
    ('Butter Chicken', 'butter-chicken'),
    ('Beef Stroganoff', 'beef-stroganoff'),
    ('Spaghetti Bolognese', 'spaghetti-bolognese'),
]
FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'
FONT_BOLD = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'


def qr_image(text: str) -> Image.Image:
    params = cv2.QRCodeEncoder_Params()
    params.correction_level = cv2.QRCodeEncoder_CORRECT_LEVEL_M
    m = cv2.QRCodeEncoder.create(params).encode(text)
    # Crop the encoder's own border to the code, then add an exact quiet zone.
    ys, xs = np.where(m == 0)
    m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    modules = m.shape[0]
    m = np.pad(m, QUIET_MODULES, constant_values=255)
    px_per_module = max(1, round(QR_MM * MM / modules))
    big = np.kron(m, np.ones((px_per_module, px_per_module), dtype=np.uint8))
    return Image.fromarray(big).convert('L'), modules, px_per_module


def main(base: str, out: str) -> None:
    base = base.rstrip('/')
    urls = [(name, f'{base}/meals/{slug}/') for name, slug in MEALS]
    page = Image.new('L', A4, 255)
    d = ImageDraw.Draw(page)
    f_title = ImageFont.truetype(FONT_BOLD, round(5 * MM))
    f_name = ImageFont.truetype(FONT_BOLD, round(5.5 * MM))
    f_url = ImageFont.truetype(FONT, round(3.2 * MM))
    f_note = ImageFont.truetype(FONT, round(3 * MM))

    margin = round(15 * MM)
    d.text((margin, margin), 'Clean Cut Meals QR prototype', font=f_title, fill=0)
    d.text((margin, margin + round(7 * MM)),
           'Student concept for MTU Brand Challenge — not an official Clean Cut Meals service.', font=f_note, fill=0)

    y = margin + round(20 * MM)
    slot = (A4[1] - y - margin) // 3
    report = []
    for name, url in urls:
        img, modules, ppm = qr_image(url)
        x = (A4[0] - img.width) // 2
        page.paste(img, (x, y))
        ty = y + img.height + round(2 * MM)
        for text, font, gap in ((name, f_name, 7.5), (url, f_url, 0)):
            w = d.textlength(text, font=font)
            d.text(((A4[0] - w) / 2, ty), text, font=font, fill=0)
            ty += round(gap * MM)
        report.append((name, url, modules, round(modules * ppm / MM, 1)))
        y += slot

    page.save(out, 'PDF', resolution=DPI)

    # Decode check on the raster that went into the PDF.
    det = cv2.QRCodeDetector()
    arr = np.array(page)
    found = []
    for i in range(3):
        part = arr[margin + round(20 * MM) + i * slot: margin + round(20 * MM) + (i + 1) * slot]
        text, _, _ = det.detectAndDecode(part)
        found.append(text)
    ok = True
    for (name, url, modules, size_mm), got in zip(report, found):
        match = got == url
        ok &= match
        print(f'{name}: {size_mm} mm, {modules} modules, decoded={got!r}, match={match}')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
