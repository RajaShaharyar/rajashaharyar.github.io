"""
AsaanBill scroll scene, step 1: derive every texture from the three portal screenshots.

    python tools/3d/asaanbill/prepare_textures.py

Reads   _source/animation-assets/asaanbill/asaanbill-ui-0{1,2,3}-*.png   (never committed)
Writes  %LOCALAPPDATA%\\raja-3d\\asaanbill\\textures\\   screen-*.png, crop-*.png, textures.json
        %LOCALAPPDATA%\\raja-3d\\renders\\asaanbill\\contact-sheet.png

The UI is used exactly as captured: crops and rounded-corner masks only. No upscaling, no colour or
text edits, no shadows baked in. Crop boxes are given at 1x and snapped to the element's real edges
(the outermost sharp colour step within a few pixels); corner radii are fitted to the element's own
anti-aliased corner. If the screens are recaptured at 2x with the same filenames, the boxes scale.
"""

import json
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parents[3]
SOURCES = [REPO / "_source/animation-assets/asaanbill", REPO / "_source/animation-assets/animation-assets/asaanbill"]
LOCAL = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "raja-3d"
OUT = LOCAL / "asaanbill" / "textures"
SHEET = LOCAL / "renders" / "asaanbill" / "contact-sheet.png"

SCREENS = {  # key: (file, width at 1x)
    "invoice": ("asaanbill-ui-01-create-invoice.png", 1116),
    "reports": ("asaanbill-ui-02-reports.png", 1632),
    "dashboard": ("asaanbill-ui-03-dashboard.png", 1662),
}

# Approximate boxes at 1x: (left, top, right, bottom), inclusive. radius=None means "fit it".
CROPS = {
    "tile-psid": ("invoice", (24, 171, 277, 237), None),
    "tile-dynamic-qr": ("invoice", (291, 171, 549, 237), None),
    "tile-static-qr": ("invoice", (559, 171, 816, 237), None),
    "tile-rtp": ("invoice", (826, 171, 1084, 237), None),
    "invoice-preview": ("invoice", (539, 323, 1084, 692), None),  # white card incl. its blue top bar
    "how-to-pay": ("invoice", (560, 568, 861, 662), None),
    "stepper": ("reports", (20, 255, 582, 304), "pill"),  # Receivable -> Settlement -> Payout
    "kpi-invoices": ("reports", (21, 327, 407, 430), None),
    "kpi-amount": ("reports", (422, 327, 808, 430), None),
    "kpi-settled": ("reports", (823, 327, 1209, 430), None),
    "kpi-pending": ("reports", (1224, 327, 1611, 430), None),
    "rows-settled": ("reports", (22, 728, 1611, 882), 0.0),  # table rows have square corners
    "card-revenue": ("dashboard", (573, 252, 1092, 510), None),
    "card-disbursement": ("dashboard", (1110, 252, 1630, 510), None),
    # The donut on its own in a rounded square (the panel's bottom is cut off in the screenshot).
    # Square centred on the ring, as large as the image's bottom edge allows; radius of the
    # dashboard's own cards.
    "donut": ("dashboard", "donut", "card-revenue"),
}

# Laptop screen (16:9): fit the height, crop equally from both sides (left, right_exclusive) at 1x.
LAPTOP_CROPS = {"reports": (5, 1627), "dashboard": (30, 1632)}


def find_source():
    for d in SOURCES:
        if all((d / f).exists() for f, _ in SCREENS.values()):
            return d
    raise SystemExit("AsaanBill screenshots not found in: " + ", ".join(map(str, SOURCES)))


def as_float(img):
    return np.asarray(img.convert("RGB")).astype(np.float32)


# ------------------------------------------------------------------ edge snapping
def _steps_x(a, ys, xs):
    return np.array([np.abs(a[ys, x] - a[ys, x - 1]).sum(axis=1).mean() for x in xs])


def _steps_y(a, xs, ys):
    return np.array([np.abs(a[y, xs] - a[y - 1, xs]).sum(axis=1).mean() for y in ys])


def snap(a, box, s):
    """Move each side to the outermost strong colour step within +-s px (shadows are soft, edges sharp)."""
    x0, y0, x1, y1 = box
    ys = np.arange(y0 + (y1 - y0) // 3, y1 - (y1 - y0) // 3)
    xs = np.arange(x0 + (x1 - x0) // 3, x1 - (x1 - x0) // 3)

    def outermost(steps, cand, first):
        strong = steps >= 0.5 * steps.max()
        return int(cand[np.argmax(strong)] if first else cand[len(strong) - 1 - np.argmax(strong[::-1])])

    left = outermost(_steps_x(a, ys, c := np.arange(x0 - s, x0 + s + 1)), c, True)
    right = outermost(_steps_x(a, ys, c := np.arange(x1 - s + 1, x1 + s + 2)), c, False) - 1
    top = outermost(_steps_y(a, xs, c := np.arange(y0 - s, y0 + s + 1)), c, True)
    bottom = outermost(_steps_y(a, xs, c := np.arange(y1 - s + 1, y1 + s + 2)), c, False) - 1
    return left, top, right, bottom


def fit_radius(a, box):
    """Fit the top-left corner radius: per row, the sub-pixel x where the element starts vs a circle."""
    L, T, R, B = box
    mid = (T + B) // 2
    bg, el = a[mid, L - 3], a[mid, L]
    contrast = np.abs(el - bg).sum() + 1e-6
    prof = []
    for k in range(min(30, (B - T) // 2)):
        cov = np.minimum(1.0, np.abs(a[T + k, L:L + 30] - bg).sum(axis=1) / contrast)
        i = int(np.argmax(cov >= 0.5))
        if cov[i] < 0.5:
            continue
        prof.append((k, 0.0 if i == 0 else i - 1 + (0.5 - cov[i - 1]) / max(1e-6, cov[i] - cov[i - 1])))
    best = (0.0, 1e9)
    for r in np.arange(0.0, 30.01, 0.25):
        err = np.mean([((r - np.sqrt(max(0.0, r * r - (r - k - 0.5) ** 2)) if r - k - 0.5 > 0 else 0.0) - x) ** 2 for k, x in prof])
        if err < best[1]:
            best = (float(r), err)
    return best[0]


# ------------------------------------------------------------------ masks
def rounded_alpha(w, h, r):
    """Rounded-rectangle alpha with a 1 px anti-aliased edge (signed distance at pixel centres)."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32) + 0.5
    if r <= 0:
        return np.ones((h, w), np.float32)
    qx = np.abs(xx - w / 2) - (w / 2 - r)
    qy = np.abs(yy - h / 2) - (h / 2 - r)
    outside = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r
    return np.clip(0.5 - outside, 0.0, 1.0)


def main():
    src = find_source()
    OUT.mkdir(parents=True, exist_ok=True)
    SHEET.parent.mkdir(parents=True, exist_ok=True)
    images = {k: Image.open(src / f).convert("RGB") for k, (f, _) in SCREENS.items()}
    scale = {k: images[k].width / w1 for k, (_, w1) in SCREENS.items()}
    manifest = {"source": str(src), "screens": {}, "crops": {}}

    # --- screens (native pixels, no scaling)
    img = images["invoice"]
    img.save(OUT / "screen-tablet-invoice.png", optimize=True)
    window_h = round(img.width * 3 / 4)
    manifest["screens"]["tablet-invoice"] = {
        "file": "screen-tablet-invoice.png", "size": [img.width, img.height], "aspect": "4:3",
        "window": [img.width, window_h], "scroll_px": img.height - window_h}
    for key, (l1, r1) in LAPTOP_CROPS.items():
        img = images[key]
        l, r = round(l1 * scale[key]), round(r1 * scale[key])
        crop = img.crop((l, 0, r, img.height))
        name = f"screen-laptop-{key}.png"
        crop.save(OUT / name, optimize=True)
        manifest["screens"][f"laptop-{key}"] = {
            "file": name, "size": list(crop.size), "aspect": "16:9", "crop_box": [l, 0, r, img.height],
            "aspect_error_pct": round((crop.width / crop.height / (16 / 9) - 1) * 100, 3)}

    # --- floating crops
    sheet_items = []
    for name, (key, box, rad) in CROPS.items():
        img, a, sc = images[key], as_float(images[key]), scale[key]
        if box == "donut":
            sat = a[int(630 * sc):, int(1200 * sc):int(1560 * sc)]
            sat = sat.max(axis=2) - sat.min(axis=2)
            ys, xs = np.where(sat > 100)
            cx = (xs.min() + xs.max()) / 2 + int(1200 * sc)
            cy = (ys.min() + ys.max()) / 2 + int(630 * sc)
            half = int(img.height - 1 - cy)  # as large as the image's bottom edge allows
            snapped = (int(cx - half), int(cy - half), int(cx + half), int(cy + half))
            radius = manifest["crops"][rad]["radius_px"]
        else:
            approx = tuple(round(v * sc) for v in box)
            snapped = snap(a, approx, s=max(4, round(8 * sc)))
            if rad == "pill":
                radius = (snapped[3] - snapped[1] + 1) / 2
            elif rad is None:
                radius = fit_radius(a, snapped)
            else:
                radius = float(rad)
        L, T, R, B = snapped
        crop = np.asarray(img.crop((L, T, R + 1, B + 1)).convert("RGBA")).copy()
        h, w = crop.shape[:2]
        crop[..., 3] = (rounded_alpha(w, h, radius) * 255 + 0.5).astype(np.uint8)
        out = Image.fromarray(crop, "RGBA")
        out.save(OUT / f"crop-{name}.png", optimize=True)
        manifest["crops"][name] = {
            "file": f"crop-{name}.png", "screen": key, "box": [L, T, R, B], "size": [w, h],
            "radius_px": round(radius, 2), "approx_1x": box if box != "donut" else "ring-centred square"}
        sheet_items.append((name, out))
        print(f"{name:18s} {key:9s} box {L:4d},{T:4d} - {R:4d},{B:4d}  {w:4d} x {h:3d}  r {radius:5.2f}")

    (OUT / "textures.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    for k, v in manifest["screens"].items():
        print(f"screen {k:18s} {v['size']}  {v.get('crop_box', '')}")
    contact_sheet(sheet_items, manifest)
    print("textures:", OUT)
    print("contact sheet:", SHEET)


def contact_sheet(items, manifest):
    """All crops on a checkerboard (so the alpha masks show), at native size, with labels."""
    pad, label_h, max_w = 24, 34, 1700
    rows, row, x, row_h = [], [], pad, 0
    for name, im in items:
        if x + im.width + pad > max_w and row:
            rows.append((row, row_h))
            row, x, row_h = [], pad, 0
        row.append((x, name, im))
        x += im.width + pad
        row_h = max(row_h, im.height)
    rows.append((row, row_h))
    height = pad + sum(h + label_h + pad for _, h in rows)
    sheet = Image.new("RGB", (max_w, height), (90, 92, 96))
    yy, xx = np.mgrid[0:height, 0:max_w]
    checker = (((xx // 12) + (yy // 12)) % 2).astype(bool)
    arr = np.asarray(sheet).copy()
    arr[checker] = (120, 122, 126)
    sheet = Image.fromarray(arr)
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("arial.ttf", 13)
    except OSError:
        font = ImageFont.load_default()
    y = pad
    for row, h in rows:
        for x, name, im in row:
            info = manifest["crops"][name]
            sheet.paste(im, (x, y), im)
            draw.text((x, y + im.height + 4), f"{name}  {info['size'][0]}x{info['size'][1]}  r{info['radius_px']:g}", fill=(255, 255, 255), font=font)
            draw.text((x, y + im.height + 18), f"{info['screen']} {tuple(info['box'])}", fill=(210, 212, 216), font=font)
        y += h + label_h + pad
    sheet.save(SHEET, optimize=True)


if __name__ == "__main__":
    main()
