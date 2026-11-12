"""
AsaanBill scroll scene, step 3: render frames (transparent film, RGBA PNG).

    blender -b tools/3d/asaanbill/asaanbill.blend -P tools/3d/asaanbill/render.py -- --engine cycles --frames 1-144
    blender -b tools/3d/asaanbill/asaanbill.blend -P tools/3d/asaanbill/render.py -- --engine eevee --frames 1,30,60 --out <dir>

Resumable: frames that already exist in --out are skipped (delete a frame to redo it).
Progress, with seconds per frame and an estimate for the rest, goes to stdout and <out>/render.log.
Cycles: CPU, ~96 adaptive samples, OpenImageDenoise, persistent data, floor as shadow catcher.
EEVEE (look-dev only): the floor becomes a shadow matte, since EEVEE has no shadow catcher.
"""

import argparse
import os
import sys
import time
from pathlib import Path

import bpy

LOCAL = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "raja-3d"
DEFAULT_OUT = LOCAL / "renders" / "asaanbill" / "frames"


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


def parse_frames(spec, end):
    frames = []
    for part in str(spec).split(","):
        if "-" in part:
            a, b = part.split("-")
            frames += list(range(int(a), int(b) + 1))
        elif part:
            frames.append(int(part))
    return [f for f in frames if 1 <= f <= end]


def setup(engine, samples=None, scale=100):
    relink_images()
    scene = bpy.context.scene
    scene.render.resolution_percentage = scale
    scene.render.film_transparent = True
    scene.render.use_motion_blur = False
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 15
    floor = bpy.data.objects["Floor"]
    if engine == "cycles":
        scene.render.engine = "CYCLES"
        c = scene.cycles
        c.device = "CPU"
        c.samples = samples or 96
        c.use_adaptive_sampling, c.adaptive_threshold = True, 0.01
        c.use_denoising, c.denoiser = True, "OPENIMAGEDENOISE"
        # FAST prefilter + BALANCED: ~15 s per 1600x1200 frame on this laptop CPU, against ~60 s for
        # ACCURATE + HIGH, with no visible difference at these sample counts.
        c.denoising_input_passes, c.denoising_prefilter, c.denoising_quality = "RGB_ALBEDO_NORMAL", "FAST", "BALANCED"
        c.max_bounces, c.diffuse_bounces, c.glossy_bounces = 8, 3, 4
        c.transmission_bounces, c.transparent_max_bounces = 4, 12
        c.sample_clamp_indirect = 10.0
        c.use_light_tree = True
        scene.render.use_persistent_data = True
        floor.material_slots[0].material = bpy.data.materials["Floor (Cycles)"]
        floor.is_shadow_catcher = True
    else:
        scene.render.engine = "BLENDER_EEVEE"
        e = scene.eevee
        e.taa_render_samples = samples or 64
        for attr, val in (("use_raytracing", True), ("use_shadows", True)):
            if hasattr(e, attr):
                setattr(e, attr, val)
        floor.material_slots[0].material = bpy.data.materials["Floor (EEVEE shadow matte)"]
    return scene


def render(frames, out, engine, log_name="render.log"):
    scene = bpy.context.scene
    out.mkdir(parents=True, exist_ok=True)
    log = open(out / log_name, "a", encoding="utf-8")
    todo = [f for f in frames if not (out / f"f{f:03d}.png").exists()]
    say = lambda msg: (print(msg, flush=True), log.write(msg + "\n"), log.flush())  # noqa: E731
    say(f"[render] {time.strftime('%Y-%m-%d %H:%M:%S')} {engine} {scene.render.resolution_x}x{scene.render.resolution_y}"
        f" @{scene.render.resolution_percentage}%  {len(todo)} to do, {len(frames) - len(todo)} already done")
    times = []
    for f in todo:
        scene.frame_set(f)
        scene.render.filepath = str(out / f"f{f:03d}.png")
        t = time.perf_counter()
        bpy.ops.render.render(write_still=True)
        dt = time.perf_counter() - t
        times.append(dt)
        left = len(todo) - len(times)
        avg = sum(times) / len(times)
        say(f"[render] f{f:03d} {dt:6.1f} s  (avg {avg:5.1f} s, {left} left, ~{left * avg / 60:5.1f} min)")
    say(f"[render] done: {len(times)} frames, {sum(times) / 60:.1f} min")
    log.close()
    return times


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--engine", choices=["cycles", "eevee"], default="cycles")
    ap.add_argument("--frames", default="1-144")
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--samples", type=int, default=None)
    ap.add_argument("--scale", type=int, default=100)
    a = ap.parse_args(args)
    setup(a.engine, a.samples, a.scale)
    render(parse_frames(a.frames, bpy.context.scene.frame_end), Path(a.out), a.engine)
