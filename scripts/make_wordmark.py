"""
Generate LUNAR wordmark SVG with per-letter 3D gradient shading.
Uses the same color ramp as the moon logo.
Requires: fonttools, pip install fonttools
"""
import math
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

# Find a system font — try common paths
import os
FONT_CANDIDATES = [
    "/System/Library/Fonts/SFNSDisplay.ttf",
    "/System/Library/Fonts/SFNS.ttf",
    "/Library/Fonts/SF-Pro-Display-Bold.otf",
    "/System/Library/Fonts/SFNSRounded.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/Library/Fonts/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]

font_path = None
for p in FONT_CANDIDATES:
    if os.path.exists(p):
        font_path = p
        break

if not font_path:
    print("No suitable font found. Install a TTF font or update FONT_CANDIDATES.")
    exit(1)

print(f"Using font: {font_path}")

# Load font
font = TTFont(font_path, fontNumber=0)
is_variable = 'fvar' in font
glyph_location = {'wght': 700} if is_variable else None
if is_variable:
    print("Variable font detected, using wght=700")
glyf = font['glyf'] if 'glyf' in font else None
cmap = font.getBestCmap()
upem = font['head'].unitsPerEm

VARIANTS = [
    ("LUNAR", "lunar-wordmark.svg"),
    ("Lunar", "lunar-wordmark-title.svg"),
]
FONT_SIZE = 56  # target pixel height
SCALE = FONT_SIZE / upem
LETTER_SPACING = 4  # extra spacing between letters

ascender = font['OS/2'].sTypoAscender * SCALE
descender = font['OS/2'].sTypoDescender * SCALE
total_height = ascender - descender
hmtx = font['hmtx']

for letters, filename in VARIANTS:
    glyphs = []
    x_cursor = 0
    for ch in letters:
        glyph_name = cmap.get(ord(ch))
        if not glyph_name:
            print(f"Glyph not found for '{ch}'")
            continue

        gs = font.getGlyphSet(location=glyph_location)
        pen = SVGPathPen(gs)
        gs[glyph_name].draw(pen)
        path_data = pen.getCommands()
        advance = hmtx[glyph_name][0]

        glyphs.append({
            'char': ch,
            'path': path_data,
            'x': x_cursor,
            'advance': advance,
        })
        x_cursor += advance + LETTER_SPACING / SCALE

    total_width = x_cursor * SCALE

    svg_lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total_width:.1f} {total_height:.1f}">',
        '  <defs>',
        # Gradient reversed because font coords are Y-up, SVG is Y-down (scale flips)
        '    <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">',
        '      <stop offset="0%" stop-color="#008a7a"/>',
        '      <stop offset="20%" stop-color="#00a090"/>',
        '      <stop offset="65%" stop-color="#00d5be"/>',
        '      <stop offset="100%" stop-color="#5ef4de"/>',
        '    </linearGradient>',
        '  </defs>',
    ]

    for g in glyphs:
        tx = g['x'] * SCALE
        svg_lines.append(
            f'  <g transform="translate({tx:.2f},{ascender:.2f}) scale({SCALE:.6f},{-SCALE:.6f})">'
        )
        svg_lines.append(f'    <path d="{g["path"]}" fill="url(#lg)"/>')
        svg_lines.append('  </g>')

    svg_lines.append('</svg>')

    out_path = f'public/{filename}'
    with open(out_path, 'w') as f:
        f.write('\n'.join(svg_lines))

    print(f"Wrote {out_path} ({len(glyphs)} glyphs, {total_width:.0f}x{total_height:.0f})")
