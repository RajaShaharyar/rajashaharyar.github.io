"""
Phase 19: Raja's portraits, cut out, black and white, exported for the site.

    python tools/portraits/process.py            # all five
    python tools/portraits/process.py --only 3,5 # some
    python tools/portraits/process.py --qa       # also the QA sheet (raja-qa\\p19\\)

Needs: pip install "rembg[cpu]" pymatting truststore. Models: birefnet-portrait (MIT, about 1 GB, about 6-8 GB
of RAM; birefnet-general-lite is the fallback if it runs out of memory) and sam (vit_b), both downloaded by
rembg into ~/.rembg/models on first use.

Reads  _source/1.jpeg … 5.jpeg (never committed). A hand-made transparent cutout in _source/portraits/N.png
       (from a dedicated tool) is used as it is for that number: no matting, straight to black and white.
Caches the raw mattes in %LOCALAPPDATA%\\raja-portraits\\ (derived from _source, so never in the repo).
Writes public/media/portraits/:
       portrait-N-<w>.webp     black and white cutout, every width in WIDTHS[N]
       portrait-N-outline.webp the silhouette dilated by 10 px at 1200w, smoothed, white on alpha (CSS colours it
                               through mask-image), on the portrait's own canvas (4 and 5, where it is used)
       portrait-3-colour-<w>.webp  the matching colour cutout for the "colour lens"
       portrait-3-avatar.webp  a 192 px square head-and-shoulders crop (shown at 96 px)
       and prints a JSON summary (canvas sizes, file sizes) for images.json.

Steps per image:
  1. Matte: rembg birefnet-portrait (only_mask). Other people: rembg sam with positive points on Raja and
     negative points on them, intersected with the BiRefNet matte; then only Raja's connected component is kept.
  2. Clean: islands removed (screen text, specks); see-through patches inside the silhouette filled (a hole
     whose matte is partly opaque is a hole in him, not background); 1 and 2 end in a straight line at the
     desk's top edge, so they sit flush on a horizontal edge.
  3. Edges: pymatting estimate_foreground_ml, so no grey or coloured halo shows on lime, violet or near-black.
  4. Black and white: channel mix R .40, G .45, B .15; a gentle S-curve that keeps 0 and 1 (rich blacks, no
     clipped highlights); unsharp mask radius 2 px at 1200w, amount 40%; then, per exported width, fine
     monochrome grain (sigma 4/255). Never upscaled, never mirrored, the face and shape never changed.
  5. Canvas: cropped to the subject plus a small margin, except where the subject meets the photo's own edge
     (3 and 4 sides and bottom, 5 bottom, 1 and 2 the desk line): those straight edges stay on the canvas edge.
"""
import argparse
import json
import os
import sys
import time

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "_source")
HAND = os.path.join(SRC, "portraits")
OUT = os.path.join(ROOT, "public", "media", "portraits")
CACHE = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "raja-portraits")
QA = os.path.join(os.environ.get("TEMP", "."), "raja-qa", "p19")

WIDTHS = {1: [1200, 800, 480], 2: [1600, 1200, 800, 480], 3: [960, 640, 400], 4: [960, 640, 400], 5: [800, 520, 360]}
# Other people, removed with SAM: points in source pixels (x, y). pos = Raja, neg = someone else. Each prompt
# gives one mask; several prompts (his body; his arm, microphone, hand and notes) are joined.
SAM_PROMPTS = {
    3: [
        {
            "pos": [(520, 450), (500, 220), (400, 1000), (700, 1000), (200, 900), (520, 760)],
            "neg": [(925, 880), (930, 1100), (900, 1250), (950, 760)],
        }
    ],
    5: [
        {  # head and body
            "pos": [(480, 540), (500, 380), (440, 650), (560, 900), (720, 800), (650, 1000)],
            "neg": [(110, 590), (40, 560), (845, 900), (280, 1200)],
        },
        {  # the arm with the microphone, the pointing hand, the notes and the hand holding them
            "pos": [(250, 760), (200, 745), (130, 690), (80, 655), (140, 760), (150, 840), (250, 800), (330, 870)],
            "neg": [(110, 590), (40, 760), (60, 900), (130, 960)],
        },
    ],
}
DESK = {1, 2}  # end in a straight line at the desk's top edge
# End in a straight line at this source row (5: just above another person's head at the bottom of the photo)
CUT_BOTTOM = {5: 1030}
# Failed the quality gate after one round of fixes (Phase 19): not exported until a hand-made cutout exists in
# _source/portraits/N.png. 5: the woman behind him overlaps his pointing hand and microphone, and SAM's masks
# either kept parts of her or cut holes through his face and shirt.
NEEDS_HAND_CUTOUT = {5}
OUTLINE = {4, 5}
QUALITY, ALPHA_QUALITY = 82, 90
GRAIN = 4 / 255


def log(*a):
    print(*a, flush=True)


# ------------------------------------------------------------------------------------------- 1. matte
_sessions = {}


def session(name):
    if name not in _sessions:
        try:
            import truststore  # verify TLS against the Windows certificate store (an antivirus may scan HTTPS)

            truststore.inject_into_ssl()
        except ImportError:
            pass
        from rembg import new_session

        _sessions[name] = new_session(name)
    return _sessions[name]


def birefnet(n, im):
    path = os.path.join(CACHE, f"{n}-birefnet.png")
    if os.path.exists(path):
        return np.asarray(Image.open(path), np.float32) / 255
    from rembg import remove

    t = time.time()
    try:
        mask = remove(im, session=session("birefnet-portrait"), only_mask=True)
        model = "birefnet-portrait"
    except MemoryError:
        log(f"  {n}: birefnet-portrait ran out of memory; falling back to birefnet-general-lite")
        mask = remove(im, session=session("birefnet-general-lite"), only_mask=True)
        model = "birefnet-general-lite"
    mask.save(path)
    log(f"  {n}: {model} matte in {time.time() - t:.0f} s")
    return np.asarray(mask, np.float32) / 255


def sam(n, im):
    path = os.path.join(CACHE, f"{n}-sam.png")
    if os.path.exists(path):
        return np.asarray(Image.open(path), np.float32) / 255
    from rembg import remove

    t = time.time()
    joined = None
    for pts in SAM_PROMPTS[n]:
        prompt = [{"type": "point", "label": 1, "data": list(p)} for p in pts["pos"]] + [
            {"type": "point", "label": 0, "data": list(p)} for p in pts["neg"]
        ]
        m = np.asarray(remove(im, session=session("sam"), only_mask=True, sam_prompt=prompt).convert("L"))
        joined = m if joined is None else np.maximum(joined, m)
    mask = Image.fromarray(joined)
    mask.save(path)
    log(f"  {n}: sam mask in {time.time() - t:.0f} s")
    return np.asarray(mask, np.float32) / 255


# ------------------------------------------------------------------------------------------- 2. clean
def disk(r):
    r = max(1, int(round(r)))
    y, x = np.ogrid[-r : r + 1, -r : r + 1]
    return x * x + y * y <= r * r


def desk_top(rgb):
    """The first row (from the top of the lower half) where most of the row is the desk's saturated blue."""
    f = rgb.astype(np.float32) / 255
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    blue = (b > 0.45) & (b - r > 0.25) & (b - g > 0.12)
    frac = blue.mean(axis=1)
    h = rgb.shape[0]
    rows = np.where(frac[h // 2 :] > 0.55)[0]
    if not len(rows):
        raise SystemExit("desk not found")
    return h // 2 + int(rows[0])


def clean(n, rgb, alpha, sam_mask=None):
    h, w = alpha.shape
    s = w / 1200  # pixel sizes below are given at 1200w
    if sam_mask is not None:
        # SAM's mask is coarse at the boundary: grow it a little and soften it, then intersect, so BiRefNet's
        # fine hair edge survives and the other people are gone.
        grown = ndi.binary_dilation(sam_mask > 0.5, structure=disk(2 * s))
        soft = ndi.gaussian_filter(grown.astype(np.float32), 1.2 * s)
        alpha = alpha * np.clip(soft * 1.2, 0, 1)
    desk = None
    if n in DESK:
        desk = desk_top(rgb)
    elif n in CUT_BOTTOM:
        desk = CUT_BOTTOM[n]
    if desk is not None:
        alpha[desk:] = 0
    # keep only Raja's connected component (and the soft edge next to it)
    solid = alpha > 0.5
    lab, k = ndi.label(solid)
    if k == 0:
        raise SystemExit(f"{n}: empty matte")
    sizes = ndi.sum(solid, lab, range(1, k + 1))
    main = lab == (1 + int(np.argmax(sizes)))
    near = ndi.binary_dilation(main, structure=disk(6 * s))
    alpha = np.where(near, alpha, 0)
    # holes: a hole whose matte is partly opaque (or a pinhole) is a see-through patch in him: fill it.
    filled = ndi.binary_fill_holes(main)
    holes, kh = ndi.label(filled & ~main)
    fixed = 0
    for i in range(1, kh + 1):
        m = holes == i
        if m.sum() < 400 * s * s or alpha[m].mean() > 0.08:
            alpha[m] = 1
            fixed += 1
    body = main | ((holes > 0) & (alpha > 0.99))
    # the interior is fully opaque; only a band at the edge stays soft (hair, fingers, glasses)
    core = ndi.binary_erosion(ndi.binary_fill_holes(body) if fixed else body, structure=disk(5 * s))
    alpha = np.maximum(alpha, core.astype(np.float32))
    return np.clip(alpha, 0, 1), desk, fixed


def canvas(alpha, desk, margin):
    """Crop box: the subject plus margin, except on sides where it meets the photo's edge (and the desk line)."""
    h, w = alpha.shape
    ys, xs = np.where(alpha > 0.02)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    edge = 3
    left = 0 if x0 <= edge else max(0, x0 - margin)
    right = w if x1 >= w - edge else min(w, x1 + margin)
    top = 0 if y0 <= edge else max(0, y0 - margin)
    bottom = desk if desk is not None else (h if y1 >= h - edge else min(h, y1 + margin))
    straight = {"left": x0 <= edge, "right": x1 >= w - edge, "top": y0 <= edge, "bottom": desk is not None or y1 >= h - edge}
    return (int(left), int(top), int(right), int(bottom)), straight


def solidify(alpha, straight, k):
    """A straight edge (the photo's own edge, the desk line, a cut) is fully opaque right up to the canvas edge:
    the last k rows or columns copy the row or column just inside, so no faint line shows along it."""
    k = max(2, int(round(k)))
    if straight["bottom"]:
        alpha[-k:, :] = alpha[-k - 1, :][None, :]
    if straight["left"]:
        alpha[:, :k] = alpha[:, k][:, None]
    if straight["right"]:
        alpha[:, -k:] = alpha[:, -k - 1][:, None]
    return alpha


# ------------------------------------------------------------------------------------------- 3-4. edges, B&W
def foreground(rgb, alpha):
    from pymatting import estimate_foreground_ml

    return np.clip(estimate_foreground_ml(rgb.astype(np.float64) / 255, alpha.astype(np.float64)), 0, 1)


def masked_blur(x, weight, sigma):
    """Gaussian blur that only averages pixels with weight (normalised convolution)."""
    num = ndi.gaussian_filter(x * weight, sigma)
    den = ndi.gaussian_filter(weight, sigma)
    return np.where(den > 1e-4, num / np.maximum(den, 1e-4), x)


def despeckle(lum, alpha, s):
    """Light specks along the hairline that are in the photo itself (2 has a dotted fringe left by whatever
    replaced its background): within a thin band inside the silhouette, a pixel that is much lighter than its
    dark neighbourhood takes the neighbourhood's tone. Faces, shirts and glasses are not dark, so they are untouched."""
    inner = alpha > 0.5
    dist = ndi.distance_transform_edt(inner)
    band = inner & (dist <= 12 * s)
    size = max(3, int(round(5 * s)) | 1)
    med = ndi.median_filter(lum, size=size)
    speck = band & (med < 0.35) & (lum > med + 0.07)
    out = lum.copy()
    out[speck] = med[speck]
    return out, int(speck.sum())


def black_and_white(fg, alpha, width):
    lum = 0.40 * fg[..., 0] + 0.45 * fg[..., 1] + 0.15 * fg[..., 2]
    s = width / 1200
    lum, specks = despeckle(lum, alpha, s)
    if specks:
        log(f"  despeckled {specks} px along the hairline")
    # Defringe: in the soft edge band the tone comes from the opaque subject just inside, never from what was
    # behind him (that is where a light halo of background showed through the hair).
    inside = masked_blur(lum, (alpha > 0.92).astype(np.float32), 3 * s)
    t = np.clip((alpha - 0.45) / 0.5, 0, 1)
    lum = t * lum + (1 - t) * inside
    lum = lum - 0.35 * np.sin(2 * np.pi * lum) / (2 * np.pi)  # S-curve with fixed ends: 0 stays 0, 1 stays 1
    # local contrast (unsharp radius 2 px at 1200w, 40%), blurred within the subject only, so no edge halo
    lum = lum + 0.4 * (lum - masked_blur(lum, alpha, 2 * s))
    return np.clip(lum, 0, 1)


# ------------------------------------------------------------------------------------------- 5. export
def save_webp(img, path):
    img.save(path, "WEBP", quality=QUALITY, alpha_quality=ALPHA_QUALITY, method=6, exact=False)
    return os.path.getsize(path)


def export(n, lum, alpha, rng, colour=None):
    h, w = alpha.shape
    out = []
    widths = sorted({min(width, w) for width in WIDTHS[n]}, reverse=True)
    if widths[0] < WIDTHS[n][0]:
        log(f"  {n}: the cutout is {w} px wide, so it ships at {w}w instead of {WIDTHS[n][0]}w (never upscaled)")
    for width in widths:
        height = round(h * width / w)
        a = Image.fromarray((alpha * 255).astype(np.uint8)).resize((width, height), Image.LANCZOS)
        l = np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).resize((width, height), Image.LANCZOS), np.float32) / 255
        l = np.clip(l + rng.normal(0, GRAIN, l.shape), 0, 1)  # fine monochrome grain, at the shipped size
        g = (l * 255 + 0.5).astype(np.uint8)
        img = Image.merge("RGBA", [Image.fromarray(g)] * 3 + [a])
        p = os.path.join(OUT, f"portrait-{n}-{width}.webp")
        out.append({"file": os.path.basename(p), "width": width, "height": height, "kb": round(save_webp(img, p) / 1024, 1)})
        if colour is not None:
            c = Image.fromarray((colour * 255 + 0.5).astype(np.uint8)).resize((width, height), Image.LANCZOS)
            p = os.path.join(OUT, f"portrait-{n}-colour-{width}.webp")
            out.append({"file": os.path.basename(p), "width": width, "height": height, "kb": round(save_webp(Image.merge("RGBA", [*c.split(), a]), p) / 1024, 1)})
    return out


def outline(n, alpha):
    h, w = alpha.shape
    s = w / 1200
    sil = ndi.binary_fill_holes(alpha > 0.5)
    grown = ndi.binary_dilation(sil, structure=disk(10 * s))
    smooth = ndi.gaussian_filter(grown.astype(np.float32), 3 * s) > 0.5  # smooth the contour
    soft = ndi.gaussian_filter(smooth.astype(np.float32), 0.8 * s)
    width = WIDTHS[n][0] if WIDTHS[n][0] <= w else w
    height = round(h * width / w)
    a = Image.fromarray((soft * 255).astype(np.uint8)).resize((width, height), Image.LANCZOS)
    white = Image.new("L", (width, height), 255)
    p = os.path.join(OUT, f"portrait-{n}-outline.webp")
    return {"file": os.path.basename(p), "width": width, "height": height, "kb": round(save_webp(Image.merge("RGBA", [white, white, white, a]), p) / 1024, 1)}


def avatar(n, lum, alpha, box):
    """A 192 px square head-and-shoulders crop (box in canvas pixels), black and white, transparent around."""
    x0, y0, x1, y1 = box
    h, w = alpha.shape
    side = min(x1 - x0, y1 - y0, w, h)
    x0 = max(0, min(w - side, x0))
    y0 = max(0, min(h - side, y0))
    x1, y1 = x0 + side, y0 + side
    l = Image.fromarray((lum[y0:y1, x0:x1] * 255).astype(np.uint8)).resize((192, 192), Image.LANCZOS)
    a = Image.fromarray((alpha[y0:y1, x0:x1] * 255).astype(np.uint8)).resize((192, 192), Image.LANCZOS)
    p = os.path.join(OUT, f"portrait-{n}-avatar.webp")
    return {"file": os.path.basename(p), "width": 192, "height": 192, "kb": round(save_webp(Image.merge("RGBA", [l, l, l, a]), p) / 1024, 1)}


# ------------------------------------------------------------------------------------------- QA sheet
QA_CROPS = {  # 200% crops, in source pixels: (label, x, y, w, h)
    1: [("hair", 1080, 860, 520, 340), ("glasses", 1150, 1260, 520, 320), ("hands", 1200, 3150, 700, 420), ("bottom edge", 300, 3380, 900, 220)],
    2: [("hair", 1080, 860, 520, 340), ("glasses", 1150, 1260, 520, 320), ("hands", 1200, 3150, 700, 420), ("bottom edge", 300, 3380, 900, 220)],
    3: [("hair", 330, 100, 330, 220), ("glasses", 340, 330, 360, 160), ("right edge", 700, 700, 260, 300), ("bottom edge", 300, 1080, 400, 200)],
    4: [("hair", 300, 120, 360, 220), ("glasses", 300, 360, 380, 160), ("jacket", 150, 850, 420, 320), ("bottom edge", 200, 1080, 400, 200)],
    5: [("hair", 380, 300, 260, 180), ("glasses", 380, 430, 260, 120), ("microphone", 40, 640, 240, 280), ("notes and hand", 130, 720, 300, 220), ("bottom edge", 300, 1080, 400, 200)],
}
BGS = {"lime": (190, 242, 100), "violet": (196, 181, 253), "near-black": (11, 12, 14), "white": (255, 255, 255)}


def qa_sheet(n, lum, alpha, box):
    from PIL import ImageDraw

    os.makedirs(QA, exist_ok=True)
    h, w = alpha.shape
    tw = 300
    th = round(h * tw / w)
    tiles = []
    for name, c in BGS.items():
        bg = np.array(c, np.float32) / 255
        comp = lum[..., None] * alpha[..., None] + bg * (1 - alpha[..., None])
        t = Image.fromarray((comp * 255 + 0.5).astype(np.uint8)).resize((tw, th), Image.LANCZOS)
        tiles.append((name, t))
    crops = []
    x0c, y0c = box[0], box[1]
    for label, x, y, cw, ch in QA_CROPS[n]:
        x, y = x - x0c, y - y0c
        if x >= w or y >= h or x + cw <= 0 or y + ch <= 0:
            continue
        xs, ys = max(0, x), max(0, y)
        xe, ye = min(w, x + cw), min(h, y + ch)
        for name in ("lime", "near-black", "white"):
            bg = np.array(BGS[name], np.float32) / 255
            a = alpha[ys:ye, xs:xe, None]
            comp = lum[ys:ye, xs:xe, None] * a + bg * (1 - a)
            img = Image.fromarray((comp * 255 + 0.5).astype(np.uint8))
            scale = 2 * min(1.0, 260 / max(img.width, 1))  # 200% of the 1200w-equivalent view, capped
            img = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.NEAREST)
            crops.append((f"{label} on {name}", img))
    W = max(4 * (tw + 10), 3 * 540)
    H = th + 30 + sum(max(c[1].height for c in crops[i : i + 3]) + 30 for i in range(0, len(crops), 3))
    sheet = Image.new("RGB", (W, H), (60, 60, 60))
    d = ImageDraw.Draw(sheet)
    for i, (name, t) in enumerate(tiles):
        sheet.paste(t, (i * (tw + 10), 20))
        d.text((i * (tw + 10) + 4, 4), f"{n} on {name}", fill=(255, 255, 255))
    y = th + 30
    for i in range(0, len(crops), 3):
        row = crops[i : i + 3]
        for j, (label, img) in enumerate(row):
            sheet.paste(img, (j * 540, y + 16))
            d.text((j * 540 + 4, y + 2), label, fill=(255, 255, 255))
        y += max(c[1].height for c in row) + 30
    p = os.path.join(QA, f"qa-{n}.png")
    sheet.save(p)
    return p


# ------------------------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="1,2,3,4,5")
    ap.add_argument("--qa", action="store_true")
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(CACHE, exist_ok=True)
    summary = {}
    for n in [int(x) for x in args.only.split(",")]:
        t0 = time.time()
        src = next(os.path.join(SRC, f) for f in os.listdir(SRC) if os.path.splitext(f)[0] == str(n) and f.lower().endswith((".jpg", ".jpeg", ".png", ".heic", ".webp")))
        im = Image.open(src).convert("RGB")  # the photos carry no EXIF rotation; nothing is mirrored
        rgb = np.asarray(im)
        hand = os.path.join(HAND, f"{n}.png")
        if n in NEEDS_HAND_CUTOUT and not os.path.exists(hand):
            log(f"{n}: skipped: needs a hand-made cutout in _source/portraits/{n}.png (it failed the quality gate)")
            continue
        if os.path.exists(hand):
            cut = np.asarray(Image.open(hand).convert("RGBA"), np.float32) / 255
            fg, alpha, desk, fixed, how = cut[..., :3], cut[..., 3], None, 0, "hand-made cutout"
            box, _ = canvas(alpha, None, 0)
        else:
            alpha = birefnet(n, im)
            sam_mask = sam(n, im) if n in SAM_PROMPTS else None
            alpha, desk, fixed = clean(n, rgb, alpha, sam_mask)
            how = "birefnet-portrait" + (" + sam" if sam_mask is not None else "")
            margin = round(16 * im.width / 1200)
            box, straight = canvas(alpha, desk, margin)
            x0, y0, x1, y1 = box
            alpha = solidify(alpha[y0:y1, x0:x1].copy(), straight, 6 * (x1 - x0) / 1200)
            fg = foreground(rgb[y0:y1, x0:x1], alpha)
        h, w = alpha.shape
        lum = black_and_white(fg, alpha, w)
        rng = np.random.default_rng(1900 + n)
        files = export(n, lum, alpha, rng, colour=fg if n == 3 else None)
        if n in OUTLINE:
            files.append(outline(n, alpha))
        if n == 3:
            # head and shoulders: from just above the hair to the top of the chest, centred on the face
            cx, cy = 520 - box[0], 430 - box[1]
            side = 700
            files.append(avatar(n, lum, alpha, (cx - side // 2, cy - 360, cx + side // 2, cy + 340)))
        summary[n] = {"how": how, "canvas": [w, h], "box": [int(v) for v in box], "desk": desk, "holesFilled": fixed, "files": files, "seconds": round(time.time() - t0)}
        log(f"{n}: {how}, canvas {w}x{h}, holes filled {fixed}, {round(time.time() - t0)} s: " + ", ".join(f"{f['file']} {f['kb']} KB" for f in files))
        if args.qa:
            log(f"  QA sheet: {qa_sheet(n, lum, alpha, box)}")
    with open(os.path.join(CACHE, "summary.json"), "w") as f:
        json.dump(summary, f, indent=1)


if __name__ == "__main__":
    main()
