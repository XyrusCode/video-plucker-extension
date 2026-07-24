"""Generate PNG icons for the Xyrus' Youtube Plucker extension."""
from PIL import Image, ImageDraw, ImageFont
import os

ICON_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'extension', 'icons')
os.makedirs(ICON_DIR, exist_ok=True)

BG_COLOR = (26, 26, 46)
ACCENT_COLOR = (233, 69, 96)


def create_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    margin = size * 0.08
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=size * 0.2,
        fill=(0, 0, 0, 0),
        outline=ACCENT_COLOR,
        width=max(2, size // 20),
    )
    draw.rounded_rectangle(
        [margin + 3, margin + 3, size - margin - 3, size - margin - 3],
        radius=size * 0.2,
        fill=BG_COLOR,
    )

    cx = size / 2
    cy = size / 2
    r = size * 0.32

    # Draw stylized "P" / pluck shape
    # Feather/quill shape
    # Shaft
    shaft_x = cx + r * 0.15
    draw.line(
        [(shaft_x, cy - r * 0.75), (shaft_x, cy + r * 0.75)],
        fill=ACCENT_COLOR,
        width=max(2, size // 14),
    )

    # Feather body (left side curve)
    points = []
    for t in range(0, 101):
        frac = t / 100
        angle = -0.9 + frac * 1.8
        x = cx - r * 0.4 * (1 - frac * 0.3)
        y = cy - r * 0.75 + frac * r * 1.5
        points.append((x, y))
    draw.line(points, fill=ACCENT_COLOR, width=max(1, size // 20))

    # Feather body (right side curve)
    points2 = []
    for t in range(0, 101):
        frac = t / 100
        angle = -0.9 + frac * 1.8
        x = cx + r * 0.4 * (1 - frac * 0.3)
        y = cy - r * 0.75 + frac * r * 1.5
        points2.append((x, y))
    draw.line(points2, fill=ACCENT_COLOR, width=max(1, size // 20))

    # Cross-hatch lines (feather texture)
    for i in range(3):
        frac = 0.25 + i * 0.2
        y = cy - r * 0.75 + frac * r * 1.5
        w = r * 0.5 * (1 - frac * 0.4)
        draw.line(
            [(cx - w, y), (cx + w, y)],
            fill=ACCENT_COLOR,
            width=max(1, size // 28),
        )

    return img


for size in [16, 48, 128]:
    img = create_icon(size)
    path = os.path.join(ICON_DIR, f'icon{size}.png')
    img.save(path, 'PNG')
    print(f"Created {path}")
