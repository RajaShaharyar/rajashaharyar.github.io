"""
Encode a rendered scroll scene for the site (Python + Pillow).

    python tools/3d/encode_frames.py asaanbill --frames-dir "%LOCALAPPDATA%\\raja-3d\\renders\\asaanbill\\frames-eevee" --engine eevee

Reads   <frames-dir>/f001.png ... (RGBA, transparent film), the stage colour from src/styles/global.css
Writes  public/scenes/<scene>/desktop/f001.webp ...  1440x1080, quality ~78, method 6
        public/scenes/<scene>/phone/f001.webp ...    800x600,  quality ~75
        public/scenes/<scene>/poster-{desktop,phone}.{webp,jpg}   (the last frame)
        public/scenes/<scene>/manifest.json

Every frame is composited over the site's dark stage colour (--color-bg), so the scene sits on the
page seamlessly. Budgets: desktop set <= 6 MB, phone set <= 2.5 MB. If a set is over, its quality
drops in steps of 4 down to 70; if still over, the scene goes to 120 frames with the beats retimed
proportionally.
"""

import argparse
import hashlib
import io
import json
import re
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[2]
CSS = REPO / "src" / "styles" / "global.css"
SETS = {  # name: (size, start quality, budget in bytes)
    "desktop": ((1440, 1080), 78, 6_000_000),
    "phone": ((800, 600), 75, 2_500_000),
}
MIN_QUALITY, STEP = 70, 4
FALLBACK_FRAMES = 120


def stage_colour():
    m = re.search(r"--color-bg:\s*(#[0-9a-fA-F]{6})", CSS.read_text(encoding="utf-8"))
    if not m:
        raise SystemExit("--color-bg not found in " + str(CSS))
    return m.group(1).lower()


def composite(src, size, bg):
    im = Image.open(src).convert("RGBA")
    base = Image.new("RGBA", im.size, tuple(int(bg[i:i + 2], 16) for i in (1, 3, 5)) + (255,))
    out = Image.alpha_composite(base, im).convert("RGB")
    return out if out.size == size else out.resize(size, Image.LANCZOS)


def encode_one(job):
    src, size, bg, quality = job
    buf = io.BytesIO()
    composite(src, size, bg).save(buf, "WEBP", quality=quality, method=6)
    return buf.getvalue()


def encode_set(sources, size, bg, quality, pool):
    return list(pool.map(encode_one, [(s, size, bg, quality) for s in sources], chunksize=4))


def fit_sets(chosen, bg, pool):
    """Encode every set, lowering quality in steps of 4 (down to 70) until it fits its budget."""
    results, fits = {}, True
    for name, (size, quality, budget) in SETS.items():
        while True:
            data = encode_set(chosen, size, bg, quality, pool)
            used = sum(len(d) for d in data)
            print(f"{name}: {len(chosen)} frames at q{quality}: {used / 1e6:.2f} MB (budget {budget / 1e6:.1f} MB)")
            if used <= budget or quality <= MIN_QUALITY:
                break
            quality = max(MIN_QUALITY, quality - STEP)
        fits = fits and used <= budget
        results[name] = (data, quality, used, size)
    return results, fits


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("scene")
    ap.add_argument("--frames-dir", required=True)
    ap.add_argument("--engine", required=True)
    ap.add_argument("--beats", default="1,37,65,101", help="beat start frames (1-based)")
    a = ap.parse_args()

    src_dir = Path(a.frames_dir)
    sources = sorted(src_dir.glob("f[0-9][0-9][0-9].png"))
    total = len(sources)
    if total == 0:
        raise SystemExit(f"no frames in {src_dir}")
    beats = [int(b) for b in a.beats.split(",")]
    bg = stage_colour()
    out = REPO / "public" / "scenes" / a.scene
    out.mkdir(parents=True, exist_ok=True)

    with ProcessPoolExecutor() as pool:
        chosen = sources
        results, fits = fit_sets(chosen, bg, pool)
        if not fits:  # over budget even at the lowest quality: 120 frames, beats retimed proportionally
            n = FALLBACK_FRAMES
            chosen = [sources[round(i * (total - 1) / (n - 1))] for i in range(n)]
            beats = [round((b - 1) * (n - 1) / (total - 1)) + 1 for b in beats]
            print(f"over budget at q{MIN_QUALITY}: going to {n} frames, beats {beats}")
            results, fits = fit_sets(chosen, bg, pool)
            if not fits:
                print("WARNING: still over budget at 120 frames and the lowest quality")

    frames = len(chosen)
    digest = hashlib.sha1()
    for name, (data, quality, used, size) in results.items():
        folder = out / name
        folder.mkdir(exist_ok=True)
        for old in folder.glob("f*.webp"):
            old.unlink()
        for i, d in enumerate(data, 1):
            (folder / f"f{i:03d}.webp").write_bytes(d)
            digest.update(d)

    posters = {}
    last = chosen[-1]
    for name, (data, quality, used, size) in results.items():
        img = composite(last, size, bg)
        img.save(out / f"poster-{name}.webp", "WEBP", quality=82, method=6)
        img.save(out / f"poster-{name}.jpg", "JPEG", quality=82, optimize=True, progressive=True)
        posters[name] = {"webp": f"poster-{name}.webp", "jpg": f"poster-{name}.jpg",
                         "bytes": {"webp": (out / f"poster-{name}.webp").stat().st_size, "jpg": (out / f"poster-{name}.jpg").stat().st_size}}

    manifest = {
        "scene": a.scene,
        "version": digest.hexdigest()[:10],
        "engine": a.engine,
        "frames": frames,
        "beats": beats,
        "background": bg,
        "pattern": "{set}/f{frame}.webp",
        "framePad": 3,
        "sets": {name: {"width": size[0], "height": size[1], "quality": quality, "bytes": used}
                 for name, (data, quality, used, size) in results.items()},
        "posters": posters,
        "source": {"renderedFrames": total, "renderSize": list(Image.open(sources[0]).size)},
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    for name, s in manifest["sets"].items():
        print(f"{name}: {frames} x {s['width']}x{s['height']} q{s['quality']} = {s['bytes'] / 1e6:.2f} MB")
    print("posters:", {k: v["bytes"] for k, v in posters.items()})
    print("manifest:", out / "manifest.json")


if __name__ == "__main__":
    main()
