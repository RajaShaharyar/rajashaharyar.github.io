"""
AsaanBill scroll scene: checks that run inside Blender on the built scene.

    blender -b tools/3d/asaanbill/asaanbill.blend -P tools/3d/asaanbill/checks.py -- [--colour <render.png> --frame N]

1. Scale: for every frame and every visible UI element (the two displays and each floating card),
   the projected size in the final 1440x1080 frame divided by its native pixel size. Nothing may
   exceed 1.25x while it is in the frame.
2. Turns: the largest rotation of each floating card away from its rest pose (tilts stay small).
3. Colour (optional): sample a rendered frame at five UI points (projected from texture pixels,
   checked for occlusion by ray cast) and compare with the screenshot pixels.
"""

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

FINAL_W, FINAL_H = 1440, 1080
LIMIT = 1.25


def project(scene, cam, p):
    """World point -> final-frame pixel coords (x right, y down) and depth; None if behind."""
    m = cam.matrix_world.inverted() @ p
    if m.z >= -1e-6:
        return None
    data = cam.data
    half = math.tan(2 * math.atan(data.sensor_width / 2 / data.lens) / 2)
    x = 0.5 + 0.5 * m.x / (-m.z) / half
    y = 0.5 + 0.5 * m.y / (-m.z) / (half * scene.render.resolution_y / scene.render.resolution_x)
    return Vector((x * FINAL_W, (1 - y) * FINAL_H, -m.z))


def element_quads():
    """(name, object, native (w, h), local corners on the visible face)."""
    out = []
    tab_disp = bpy.data.objects["Tablet display"]
    lap_disp = bpy.data.objects["Laptop display"]
    for obj, native in ((tab_disp, (1116, 837)), (lap_disp, (1602, 901))):
        xs = [v.co.x for v in obj.data.vertices]
        ys = [v.co.y for v in obj.data.vertices]
        out.append((obj.name, obj, native, [Vector((min(xs), max(ys), 0)), Vector((max(xs), max(ys), 0)),
                                             Vector((max(xs), min(ys), 0)), Vector((min(xs), min(ys), 0))]))
    for obj in bpy.data.objects:
        if obj.name.startswith("Card ") and "native_px" in obj and not obj.get("unused"):
            bb = [Vector(c) for c in obj.bound_box]
            x0, x1 = min(c.x for c in bb), max(c.x for c in bb)
            y0, y1 = min(c.y for c in bb), max(c.y for c in bb)
            out.append((obj.name, obj, tuple(obj["native_px"]),
                        [Vector((x0, y1, 0)), Vector((x1, y1, 0)), Vector((x1, y0, 0)), Vector((x0, y0, 0))]))
    return out


def scale_check(frames=None):
    scene = bpy.context.scene
    cam = scene.camera
    frames = frames or range(scene.frame_start, scene.frame_end + 1)
    worst = {}
    over = []
    boxes = {}
    for f in frames:
        scene.frame_set(f)
        for name, obj, (nw, nh), quad in element_quads():
            if obj.hide_render:
                continue
            pts = [project(scene, cam, obj.matrix_world @ c) for c in quad]
            if any(p is None for p in pts):
                continue
            xs, ys = [p.x for p in pts], [p.y for p in pts]
            in_frame = max(xs) > 0 and min(xs) < FINAL_W and max(ys) > 0 and min(ys) < FINAL_H
            if not in_frame:
                continue
            top, bottom = (pts[1] - pts[0]).to_2d().length, (pts[2] - pts[3]).to_2d().length
            left, right = (pts[3] - pts[0]).to_2d().length, (pts[2] - pts[1]).to_2d().length
            mag = max(max(top, bottom) / nw, max(left, right) / nh)
            if mag > worst.get(name, (0, 0))[0]:
                worst[name] = (round(mag, 3), f)
            if mag > LIMIT:
                over.append((f, name, round(mag, 3)))
            boxes.setdefault(f, {})[name] = [round(min(xs)), round(min(ys)), round(max(xs)), round(max(ys)), round(mag, 3)]
    return worst, over, boxes


def relink_images():
    """Images are stored relative to the .blend; if that path does not resolve (another machine or
    checkout location), find the file by name in %LOCALAPPDATA%/raja-3d (textures, hdri)."""
    import os as _os
    local = Path(_os.environ.get("LOCALAPPDATA", Path.home())) / "raja-3d"
    for img in bpy.data.images:
        if not img.filepath or _os.path.exists(bpy.path.abspath(img.filepath)):
            continue
        name = Path(bpy.path.abspath(img.filepath)).name
        for folder in (local / "asaanbill" / "textures", local / "hdri"):
            if (folder / name).exists():
                img.filepath = str(folder / name)
                img.reload()
                break
        else:
            print(f"[relink] missing image: {name}")


def overlap_check(name, frames, others=None):
    """Frames where card `name` overlaps another visible card on screen (projected bounding boxes)."""
    hits = []
    for f, elems in sorted(scale_check(frames)[2].items()):
        if name not in elems:
            continue
        a = elems[name]
        for other, b in elems.items():
            if other == name or not other.startswith("Card ") or (others and other not in others):
                continue
            if a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]:
                hits.append((f, other))
    return hits


def turn_check():
    """Largest rotation of each floating card away from its rest orientation (degrees)."""
    scene = bpy.context.scene
    out = {}
    for obj in bpy.data.objects:
        if not obj.name.startswith("Card ") or obj.get("unused"):
            continue
        ad = obj.animation_data
        if not ad or not ad.action:
            continue
        scene.frame_set(1)
        rest = obj.matrix_basis.to_quaternion()
        best = (0.0, 1)
        for f in range(scene.frame_start, scene.frame_end + 1):
            scene.frame_set(f)
            if obj.hide_render:
                continue
            ang = math.degrees(rest.rotation_difference(obj.matrix_basis.to_quaternion()).angle)
            if ang > best[0]:
                best = (round(ang, 1), f)
        out[obj.name] = best
    return out


# ----------------------------------------------------------------------- colour check
TEXJ_PATH = Path(__import__("os").environ.get("LOCALAPPDATA", Path.home())) / "raja-3d" / "asaanbill" / "textures" / "textures.json"
COLOUR_POINTS = [  # (label, object, source image, x, y): uniform patches in the screenshots
    ("white background (tablet screen)", "Tablet display", "invoice", 450, 335),
    ("white (invoice card)", "Card invoice-preview", "invoice", 950, 660),
    ("dark nav pill (laptop screen)", "Laptop display", "auto", None, None),
    ("PSID blue (PSID tile icon)", "Card tile-psid", "invoice", 45, 195),
    ("Revenue green (revenue card)", "Card card-revenue", "dashboard", 950, 440),
    ("Pending orange (laptop screen)", "Laptop display", "reports", 1540, 400),
]
NAV_PILL = {"reports": (600, 22), "dashboard": (780, 20)}


def _srgb_to_lab(rgb):
    def lin(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(c) for c in rgb)
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116  # noqa: E731
    return 116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))


def delta_e2000(c1, c2):
    L1, a1, b1 = _srgb_to_lab(c1)
    L2, a2, b2 = _srgb_to_lab(c2)
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    Cm = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360
    h2p = math.degrees(math.atan2(b2, a2p)) % 360
    dLp, dCp = L2 - L1, C2p - C1p
    dhp = 0 if C1p * C2p == 0 else (h2p - h1p if abs(h2p - h1p) <= 180 else h2p - h1p - 360 * math.copysign(1, h2p - h1p))
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp / 2))
    Lpm, Cpm = (L1 + L2) / 2, (C1p + C2p) / 2
    hpm = h1p + h2p if C1p * C2p == 0 else ((h1p + h2p) / 2 if abs(h1p - h2p) <= 180 else (h1p + h2p + 360) / 2 % 360)
    T = 1 - 0.17 * math.cos(math.radians(hpm - 30)) + 0.24 * math.cos(math.radians(2 * hpm)) + 0.32 * math.cos(math.radians(3 * hpm + 6)) - 0.20 * math.cos(math.radians(4 * hpm - 63))
    Sl = 1 + 0.015 * (Lpm - 50) ** 2 / math.sqrt(20 + (Lpm - 50) ** 2)
    Sc, Sh = 1 + 0.045 * Cpm, 1 + 0.015 * Cpm * T
    Rt = -2 * math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7)) * math.sin(math.radians(60 * math.exp(-(((hpm - 275) / 25) ** 2))))
    return math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh))


def _pixels(path):
    import numpy as np
    img = bpy.data.images.load(str(path), check_existing=False)
    w, h = img.size
    arr = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(arr)
    bpy.data.images.remove(img)
    return arr.reshape(h, w, 4)[::-1] * 255.0  # top row first


def colour_check(render_png, frame):
    """Sample the rendered frame at the five UI points that are visible in it."""
    scene = bpy.context.scene
    scene.frame_set(frame)
    cam = scene.camera
    texj = json.loads(TEXJ_PATH.read_text(encoding="utf-8"))
    src = {k: _pixels(Path(texj["source"]) / f) for k, f in (("invoice", "asaanbill-ui-01-create-invoice.png"),
                                                              ("reports", "asaanbill-ui-02-reports.png"),
                                                              ("dashboard", "asaanbill-ui-03-dashboard.png"))}
    rend = _pixels(render_png)
    rh, rw = rend.shape[:2]
    fade = bpy.data.materials["Screen laptop"].node_tree.nodes["Mix"].inputs["Factor"].default_value
    laptop_src = "dashboard" if fade > 0.5 else "reports"
    scroll_px = bpy.data.objects["Tablet content (scroll)"].location.y / 0.0002
    depsgraph = bpy.context.evaluated_depsgraph_get()
    rows = []
    for label, obj_name, img_key, tx, ty in COLOUR_POINTS:
        obj = bpy.data.objects[obj_name]
        if obj.hide_render:
            continue
        if img_key == "auto":
            img_key = laptop_src
            tx, ty = NAV_PILL[img_key]
        if obj_name == "Laptop display" and img_key != laptop_src:
            continue
        if obj_name == "Tablet display":
            local = Vector(((tx + 0.5 - 558) * 0.0002, (418.5 - (ty + 0.5 - scroll_px)) * 0.0002, 0))
        elif obj_name == "Laptop display":
            sc = texj["screens"][f"laptop-{img_key}"]
            sx, sy = 0.310 / sc["size"][0], 0.310 * 9 / 16 / sc["size"][1]
            local = Vector(((tx + 0.5 - sc["crop_box"][0] - sc["size"][0] / 2) * sx, (sc["size"][1] / 2 - (ty + 0.5)) * sy, 0))
        else:
            c = texj["crops"][obj_name[5:]]
            L, T, R, B = c["box"]
            bb = [Vector(v) for v in obj.bound_box]
            w_m, h_m = max(v.x for v in bb) - min(v.x for v in bb), max(v.y for v in bb) - min(v.y for v in bb)
            sx, sy = w_m / c["size"][0], h_m / c["size"][1]
            local = Vector(((tx + 0.5 - L - c["size"][0] / 2) * sx, (T + c["size"][1] / 2 - (ty + 0.5)) * sy, 0))
        world = obj.matrix_world @ local
        # occlusion: first non-glass surface along the camera ray must be this object
        origin = cam.matrix_world.translation.copy()
        direction = (world - origin).normalized()
        hit_name, o = None, origin
        for _ in range(6):
            ok, loc, _n, _i, hit, _m = scene.ray_cast(depsgraph, o, direction)
            if not ok:
                break
            if "glass" in hit.name.lower():
                o = loc + direction * 1e-5
                continue
            hit_name = hit.name
            break
        p = project(scene, cam, world)
        px, py = p.x / FINAL_W * rw, p.y / FINAL_H * rh
        xi, yi = int(px), int(py)
        if hit_name != obj_name or not (1 <= xi < rw - 1 and 1 <= yi < rh - 1):
            rows.append({"sample": label, "frame": frame, "visible": False, "hit": hit_name})
            continue
        got = rend[yi - 1:yi + 2, xi - 1:xi + 2, :3].reshape(-1, 3).mean(0)
        ref = src[img_key][ty - 2:ty + 3, tx - 2:tx + 3, :3].reshape(-1, 3).mean(0)
        rows.append({"sample": label, "frame": frame, "visible": True, "render_px": [xi, yi],
                     "screenshot_rgb": [round(v) for v in ref], "render_rgb": [round(v) for v in got],
                     "delta_rgb": [round(g - r) for g, r in zip(got, ref)], "delta_e2000": round(delta_e2000(ref, got), 2)})
    return rows


if __name__ == "__main__":
    relink_images()
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if "--colour" in args:
        png, frame = args[args.index("--colour") + 1], int(args[args.index("--frame") + 1])
        print(json.dumps(colour_check(png, frame), indent=1))
    else:
        worst, over, boxes = scale_check()
        print(json.dumps({"worst_magnification": worst, "over_limit": over[:40], "turns": turn_check(),
                          "stepper_overlaps": overlap_check("Card stepper", range(101, 145)),
                          "hero_overlaps": sorted({o for n in ("Card invoice-preview", "Card card-revenue", "Card card-disbursement", "Card donut")
                                                   for f, o in overlap_check(n, range(133, 145)) if o != "Card how-to-pay"}),
                          "f144": boxes.get(144)}, indent=1))
