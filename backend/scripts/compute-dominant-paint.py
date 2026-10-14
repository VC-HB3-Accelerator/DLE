#!/usr/bin/env python3
"""Dominant vehicle paint from 1–8 photos. Prints JSON: {hex, rgb, label}."""
import json
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print(json.dumps({"error": "PIL missing"}))
    sys.exit(1)


def rgb_to_label(r, g, b):
    mx = max(r, g, b)
    mn = min(r, g, b)
    if mx - mn < 18:
        if mx > 200:
            return "white"
        if mx < 55:
            return "black"
        return "silver gray"
    # rough hue bucket
    if r >= g and r >= b:
        return "red"
    if g >= r and g >= b:
        return "green"
    if b >= r and b >= g:
        if mx > 160:
            return "light blue"
        return "blue"
    return "mixed"


def sample_pixels(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    x0, y0 = int(w * 0.15), int(h * 0.12)
    x1, y1 = int(w * 0.85), int(h * 0.88)
    im = im.crop((x0, y0, x1, y1)).resize((96, 72))
    px = list(im.getdata())
    out = []
    for r, g, b in px:
        mx, mn = max(r, g, b), min(r, g, b)
        sat = mx - mn
        if mx < 35 or mx > 248:
            continue
        if sat < 12 and mx > 210:
            continue
        if sat < 8 and mx < 80:
            continue
        out.append((r, g, b))
    return out


def median_color(samples):
    if not samples:
        return (128, 128, 128)
    rs = sorted(s[0] for s in samples)
    gs = sorted(s[1] for s in samples)
    bs = sorted(s[2] for s in samples)
    mid = len(samples) // 2
    return (rs[mid], gs[mid], bs[mid])


def main():
    paths = [p for p in sys.argv[1:] if Path(p).is_file()]
    if not paths:
        print(json.dumps({"error": "no images"}))
        sys.exit(1)
    buckets = []
    for p in paths:
        buckets.extend(sample_pixels(p))
    r, g, b = median_color(buckets)
    hexv = f"#{r:02x}{g:02x}{b:02x}"
    label = rgb_to_label(r, g, b)
    print(json.dumps({"hex": hexv, "rgb": [r, g, b], "label": label, "samples": len(buckets)}))


if __name__ == "__main__":
    main()
