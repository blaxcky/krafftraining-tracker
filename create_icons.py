#!/usr/bin/env python3
import os
import struct
import zlib

PALETTE = {
    "bg_top": (249, 228, 183, 255),      # #F9E4B7
    "bg_bottom": (242, 169, 0, 255),     # #F2A900
    "bg_accent": (242, 201, 76, 255),    # #F2C94C
    "ink": (42, 26, 0, 255),             # #2a1a00
    "ink_soft": (42, 26, 0, 150),
    "highlight": (255, 255, 255, 90),
}

def lerp(a, b, t):
    return int(round(a + (b - a) * t))

def lerp_rgba(c1, c2, t):
    return (
        lerp(c1[0], c2[0], t),
        lerp(c1[1], c2[1], t),
        lerp(c1[2], c2[2], t),
        lerp(c1[3], c2[3], t),
    )

def clamp(v, lo, hi):
    return lo if v < lo else hi if v > hi else v

def blend_over(dst, src):
    sr, sg, sb, sa = src
    if sa <= 0:
        return dst
    dr, dg, db, da = dst
    inv = 255 - sa
    r = (sr * sa + dr * inv) // 255
    g = (sg * sa + dg * inv) // 255
    b = (sb * sa + db * inv) // 255
    a = min(255, sa + (da * inv) // 255)
    return (r, g, b, a)

def point_in_rounded_rect(x, y, x0, y0, w, h, r):
    if x < x0 or x >= x0 + w or y < y0 or y >= y0 + h:
        return False
    if r <= 0:
        return True

    left = x0 + r
    right = x0 + w - r - 1
    top = y0 + r
    bottom = y0 + h - r - 1

    in_center = (left <= x <= right) or (top <= y <= bottom)
    if in_center:
        return True

    cx = left if x < left else right
    cy = top if y < top else bottom
    dx = x - cx
    dy = y - cy
    return (dx * dx + dy * dy) <= (r * r)

def fill_rounded_rect(pixels, w, h, x0, y0, rw, rh, r, color):
    x0 = int(round(x0))
    y0 = int(round(y0))
    rw = int(round(rw))
    rh = int(round(rh))
    r = int(round(r))
    if rw <= 0 or rh <= 0:
        return
    x1 = min(w, x0 + rw)
    y1 = min(h, y0 + rh)
    x0 = max(0, x0)
    y0 = max(0, y0)
    if x0 >= x1 or y0 >= y1:
        return
    for y in range(y0, y1):
        row = y * w * 4
        for x in range(x0, x1):
            if not point_in_rounded_rect(x, y, x0, y0, x1 - x0, y1 - y0, r):
                continue
            idx = row + x * 4
            dst = (pixels[idx], pixels[idx + 1], pixels[idx + 2], pixels[idx + 3])
            out = blend_over(dst, color)
            pixels[idx] = out[0]
            pixels[idx + 1] = out[1]
            pixels[idx + 2] = out[2]
            pixels[idx + 3] = out[3]

def write_png(path, width, height, rgba_pixels):
    def chunk(tag, data):
        return (
            struct.pack(">I", len(data)) +
            tag +
            data +
            struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)
        )

    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)  # filter type 0
        start = y * stride
        raw.extend(rgba_pixels[start:start + stride])

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), level=9)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)

def create_fitness_icon(size):
    scale = 2
    w = size * scale
    h = size * scale
    pixels = bytearray(w * h * 4)

    # Background gradient (full bleed)
    for y in range(h):
        t = y / max(1, h - 1)
        base = lerp_rgba(PALETTE["bg_top"], PALETTE["bg_bottom"], t)
        for x in range(w):
            tx = x / max(1, w - 1)
            diag = (t * 0.65 + tx * 0.35)
            blend_t = clamp(diag * 0.18, 0.0, 1.0)
            color = lerp_rgba(base, PALETTE["bg_accent"], blend_t)
            idx = (y * w + x) * 4
            pixels[idx] = color[0]
            pixels[idx + 1] = color[1]
            pixels[idx + 2] = color[2]
            pixels[idx + 3] = 255

    # Dumbbell mark
    center = w // 2
    ink = PALETTE["ink"]

    pad = int(w * 0.18)
    max_w = w - (pad * 2)

    bar_h = int(w * 0.09)
    bar_w = int(max_w * 0.58)
    bar_y0 = center - bar_h // 2
    bar_x0 = center - bar_w // 2
    bar_x1 = bar_x0 + bar_w

    plate_gap = int(w * 0.03)
    outer_w = int(w * 0.12)
    outer_h = int(w * 0.34)
    inner_w = int(w * 0.085)
    inner_h = int(w * 0.27)
    collar_w = int(w * 0.04)
    collar_h = int(w * 0.22)

    # Left plates
    lx1 = bar_x0 - plate_gap
    fill_rounded_rect(pixels, w, h, lx1 - outer_w, center - outer_h // 2, outer_w, outer_h, outer_w // 2, ink)
    fill_rounded_rect(pixels, w, h, lx1 - outer_w - inner_w - int(w * 0.012), center - inner_h // 2, inner_w, inner_h, inner_w // 2, ink)
    fill_rounded_rect(pixels, w, h, bar_x0 - int(w * 0.005) - collar_w, center - collar_h // 2, collar_w, collar_h, collar_w // 2, ink)

    # Right plates
    rx0 = bar_x1 + plate_gap
    fill_rounded_rect(pixels, w, h, rx0, center - outer_h // 2, outer_w, outer_h, outer_w // 2, ink)
    fill_rounded_rect(pixels, w, h, rx0 + outer_w + int(w * 0.012), center - inner_h // 2, inner_w, inner_h, inner_w // 2, ink)
    fill_rounded_rect(pixels, w, h, bar_x1 + int(w * 0.005), center - collar_h // 2, collar_w, collar_h, collar_w // 2, ink)

    # Bar + highlight
    fill_rounded_rect(pixels, w, h, bar_x0, bar_y0, bar_w, bar_h, bar_h // 2, ink)
    highlight_h = max(1, int(bar_h * 0.32))
    fill_rounded_rect(
        pixels, w, h,
        bar_x0 + int(bar_h * 0.35),
        bar_y0 + int(bar_h * 0.18),
        bar_w - int(bar_h * 0.7),
        highlight_h,
        highlight_h // 2,
        PALETTE["highlight"],
    )

    # Downsample (2x2 box filter) to target size
    out = bytearray(size * size * 4)
    for y in range(size):
        for x in range(size):
            r = g = b = a = 0
            for oy in range(scale):
                for ox in range(scale):
                    sx = x * scale + ox
                    sy = y * scale + oy
                    idx = (sy * w + sx) * 4
                    r += pixels[idx]
                    g += pixels[idx + 1]
                    b += pixels[idx + 2]
                    a += pixels[idx + 3]
            di = (y * size + x) * 4
            out[di] = r // (scale * scale)
            out[di + 1] = g // (scale * scale)
            out[di + 2] = b // (scale * scale)
            out[di + 3] = a // (scale * scale)

    return out

# Create icons directory if it doesn't exist
os.makedirs('icons', exist_ok=True)

# Generate all required icon sizes
sizes = [72, 96, 128, 144, 152, 192, 384, 512]

for size in sizes:
    rgba = create_fitness_icon(size)
    write_png(f'icons/icon-{size}x{size}.png', size, size, rgba)
    print(f"Created icon-{size}x{size}.png")

print("All icons created successfully!")
