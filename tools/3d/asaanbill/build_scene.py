"""
AsaanBill scroll scene, step 2: build the whole scene from scratch and save it.

    blender -b --factory-startup -P tools/3d/asaanbill/build_scene.py            # -> tools/3d/asaanbill/asaanbill.blend
    blender -b --factory-startup -P tools/3d/asaanbill/build_scene.py -- --no-save

Needs the textures from prepare_textures.py (%LOCALAPPDATA%\\raja-3d\\asaanbill\\textures) and the
Poly Haven HDRI "Studio Small 09" (CC0, Sergej Majboroda) in %LOCALAPPDATA%\\raja-3d\\hdri.

Everything is metric (metres). The devices are generic: no logos, no copied brand features.
144 frames in four beats [1, 37, 65, 101]; every move eases in and out (Bezier, auto-clamped
handles: no overshoot), every beat ends on a hold. No motion blur. Colour management is
Standard, so the UI colours stay as captured.
"""

import json
import math
import os
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Euler, Matrix, Quaternion, Vector

HERE = Path(globals().get("__file__", "tools/3d/asaanbill/build_scene.py")).resolve().parent
LOCAL = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "raja-3d"
TEX = LOCAL / "asaanbill" / "textures"
HDRI = LOCAL / "hdri" / "studio_small_09_1k.hdr"
BLEND = HERE / "asaanbill.blend"
MM = 0.001

# ======================================================================= configuration
BEATS = [1, 37, 65, 101]
END = 144
RES = (1600, 1200)
LENS_MM, SENSOR_MM = 50.0, 36.0  # 50 mm full-frame equivalent across the frame width
FSTOP = 4.0

# Devices (metres / degrees)
TABLET = dict(display=(1116 * 0.2 * MM, 837 * 0.2 * MM), bezel=8 * MM, thick=6 * MM, radius=15 * MM,
              display_radius=2.5 * MM, centre=(-0.17, 0.0, 0.165), yaw=10.0, tilt_back=15.0)
LAPTOP = dict(display=(310 * MM, 310 * 9 / 16 * MM), bezel=5 * MM, lid_thick=5 * MM, lid_radius=8 * MM,
              base=(320 * MM, 222 * MM), base_back=12 * MM, base_front=8.5 * MM, base_radius=9 * MM,
              open_deg=110.0, position=(0.17, 0.30, 0.0), yaw=-20.0)

# Screen and card shading. Whites should land at ~0.93 (display) after the glass.
SCREEN_STRENGTH = 0.894  # emission of the UI textures (linear multiplier)
GLASS_K = 1.0  # scales the glass reflection weight (Fresnel at IOR 1.5)
GLASS_SOFTBOX = 0.2  # radiance of the key softbox as the glass sees it (soft sheen, never a wash)
KEY_LIGHT = dict(loc=(-0.85, -0.55, 1.05), aim=(-0.02, 0.12, 0.10), size=(0.9, 0.6), energy=95.0)
CARD_EMISSION = 0.90  # card face: mostly emission (calibrated: whites ~0.93) ...
CARD_DIFFUSE = 0.06  # ... with a little diffuse (no specular veil). Light linking keeps the key and
#                      fill off the cards, so that diffuse catches only the rim light (and stays put).
CARD_THICK = 1.5 * MM
CARD_EDGE = (0.72, 0.73, 0.75)  # light grey card edges (linear)

# Camera shots: (camera location, look-at target). Tuned in the viewport with the projection helper.
SHOTS = {
    "A": ((-0.311, -0.525, 0.321), (-0.135, 0.030, 0.155)),  # f1: close 3/4 of the tablet (~55% of the width)
    "B": ((-0.222, -0.592, 0.324), (-0.120, 0.040, 0.155)),  # f24: dollied back, arced ~10 deg right
    "C": ((-0.129, -0.775, 0.359), (-0.007, 0.180, 0.138)),  # f58: tablet left, laptop right, invoice centred
    "Cpan": ((-0.129, -0.775, 0.359), (0.205, 0.429, 0.070)),  # f87: pan right in place (the cluster slides out left)
    "D": ((0.060, -0.420, 0.300), (0.205, 0.429, 0.070)),  # f95: then in to the laptop (Reports)
    "E": ((0.030, -0.896, 0.608), (0.030, 0.200, 0.220)),  # f132-144: wide hero, devices in the lower 60%
}
MAX_TURN = 10.0  # no card turns more than this from its rest orientation (no spins, no flips)

# Floating elements, placed in camera space: (fx, fy, depth_m, yaw_deg, pitch_deg)
#   fx, fy: frame position relative to the frame WIDTH (centre 0, +x right, +y up; |fy| <= 0.375).
INVOICE_C = (0.02, 0.0, 0.350, 0.0, 0.0)  # f58: centre of the frame, ~1.14x native
TILE_FAN_C = {  # f84, a loose arc round the invoice's left side; PSID nearest how-to-pay
    "tile-psid": (-0.200, -0.120, 0.340, 0.0, 0.0),
    "tile-dynamic-qr": (-0.270, -0.020, 0.355, 0.0, 0.0),
    "tile-static-qr": (-0.250, 0.080, 0.370, 0.0, 0.0),
    "tile-rtp": (-0.150, 0.165, 0.385, 0.0, 0.0),
}
DRIFT_D = (-0.12, 0.20, -0.01)  # f78-100: invoice and tiles drift left and recede (world), clear of the camera
ROWS_LIFT = 30 * MM  # f82-96: rows-settled off the laptop screen
STEPPER_LAPTOP = (0.0, -40 * MM, 45 * MM)  # f101-112: stepper position in laptop-screen space (x, y, z)
HERO_E = {  # f132-144 hero composition, in camera E space: the UI floats above the devices.
    # Depths are 1/1.15 of the look-dev pass, so the cards read ~15% bigger (~0.54x native).
    "invoice-preview": (-0.220, 0.195, 0.740, 0.0, 0.0),  # clear of the tiles' right edges
    "tile-psid": (-0.350, 0.090, 0.727, 0.0, 0.0),
    "tile-dynamic-qr": (-0.395, 0.150, 0.731, 0.0, 0.0),
    "tile-static-qr": (-0.390, 0.214, 0.735, 0.0, 0.0),
    "tile-rtp": (-0.325, 0.285, 0.740, 0.0, 0.0),
    "donut": (-0.025, 0.165, 0.731, 0.0, 0.0),
    "card-revenue": (0.130, 0.218, 0.744, 0.0, 0.0),
    "card-disbursement": (0.335, 0.180, 0.731, 0.0, 0.0),
    "stepper": (0.200, 0.308, 0.752, 0.0, 0.0),
}
STEPPER_WAYPOINT = (0.0, 32 * MM, 0.0)  # f121: the stepper rises above its hero spot first (never crosses the cards)

# ======================================================================= helpers
TEXJ = json.loads((TEX / "textures.json").read_text(encoding="utf-8"))
HFOV = 2 * math.atan(SENSOR_MM / 2 / LENS_MM)


def reset_scene():
    """Clear all data without reloading preferences (keeps add-ons such as the MCP server alive)."""
    for coll in (bpy.data.objects, bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.lights,
                 bpy.data.cameras, bpy.data.worlds, bpy.data.actions, bpy.data.node_groups, bpy.data.curves):
        for item in list(coll):
            coll.remove(item)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)
    scene = bpy.context.scene
    scene.name = "AsaanBill"
    return scene


def link(obj, parent=None, matrix=None):
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    if matrix is not None:
        obj.matrix_basis = matrix
    return obj


def empty(name, parent=None, matrix=None, size=0.02):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = size
    return link(e, parent, matrix)


def rr_outline(w, h, r, seg=10):
    """Rounded-rectangle outline, counter-clockwise, centred on the origin."""
    r = max(0.0, min(r, w / 2, h / 2))
    if r <= 1e-7:
        return [(w / 2, h / 2), (-w / 2, h / 2), (-w / 2, -h / 2), (w / 2, -h / 2)]
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def ccw(pts):
    area = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))
    return pts if area > 0 else pts[::-1]


def slab(name, pts, z0, z1, mats, parent=None, matrix=None, uv_size=None, top_mat=0, side_mat=1, bottom_mat=1, smooth=35):
    """Extrude a 2D outline between z0 and z1. UVs (0-1 over uv_size) on the top face."""
    pts = ccw(pts)
    bm = bmesh.new()
    bot = [bm.verts.new((x, y, z0)) for x, y in pts]
    top = [bm.verts.new((x, y, z1)) for x, y in pts]
    ftop = bm.faces.new(top)
    fbot = bm.faces.new(bot[::-1])
    ftop.material_index, fbot.material_index = top_mat, bottom_mat
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        f = bm.faces.new((bot[i], bot[j], top[j], top[i]))
        f.material_index = side_mat
    if uv_size:
        uv = bm.loops.layers.uv.new("UVMap")
        w, h = uv_size
        for f in bm.faces:
            for loop in f.loops:
                loop[uv].uv = (loop.vert.co.x / w + 0.5, loop.vert.co.y / h + 0.5)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    if smooth:
        me.shade_smooth()
        me.set_sharp_from_angle(angle=math.radians(smooth))
    return link(bpy.data.objects.new(name, me), parent, matrix)


def ring(name, outer, inner, z0, z1, mat, parent=None, matrix=None):
    """A flat ring between two outlines with the same point count."""
    outer, inner = ccw(outer), ccw(inner)
    bm = bmesh.new()
    ob = [bm.verts.new((x, y, z0)) for x, y in outer]
    ot = [bm.verts.new((x, y, z1)) for x, y in outer]
    ib = [bm.verts.new((x, y, z0)) for x, y in inner]
    it = [bm.verts.new((x, y, z1)) for x, y in inner]
    n = len(outer)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((ot[i], ot[j], it[j], it[i]))
        bm.faces.new((ob[j], ob[i], ib[i], ib[j]))
        bm.faces.new((ob[i], ob[j], ot[j], ot[i]))
        bm.faces.new((ib[j], ib[i], it[i], it[j]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    return link(bpy.data.objects.new(name, me), parent, matrix)


def plane(name, w, h, mat, parent=None, matrix=None, radius=0.0):
    """A single flat face (normal +Z) with 0-1 UVs: displays, cover glass, the floor."""
    bm = bmesh.new()
    face = bm.faces.new([bm.verts.new((x, y, 0.0)) for x, y in ccw(rr_outline(w, h, radius, 8))])
    uv = bm.loops.layers.uv.new("UVMap")
    for loop in face.loops:
        loop[uv].uv = (loop.vert.co.x / w + 0.5, loop.vert.co.y / h + 0.5)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    return link(bpy.data.objects.new(name, me), parent, matrix)


def chamfer(obj, width, mat_index):
    mod = obj.modifiers.new("Chamfer", "BEVEL")
    mod.width, mod.segments, mod.limit_method = width, 1, "ANGLE"
    mod.angle_limit = math.radians(55)
    mod.material = mat_index
    mod.harden_normals = True
    return mod


# ----------------------------------------------------------------------- materials
def new_material(name):
    mat = bpy.data.materials.new(name)
    if mat.node_tree is None:
        mat.use_nodes = True
    return mat, mat.node_tree.nodes, mat.node_tree.links


def principled(name, colour, metallic=0.0, roughness=0.5, **inputs):
    mat, nodes, _ = new_material(name)
    bsdf = nodes.get("Principled BSDF") or nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*colour, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    for key, value in inputs.items():
        bsdf.inputs[key].default_value = value
    return mat


def load_image(path, colorspace="sRGB"):
    img = bpy.data.images.load(str(path), check_existing=True)
    img.colorspace_settings.name = colorspace
    img.alpha_mode = "STRAIGHT"
    return img


def screen_material(name, images, window=None):
    """Emission from the UI texture(s). images: one image, or two for a crossfade (returns the fade socket).
    window: (visible height, image height) in px; the page shows 1:1 and scrolls by the Mapping location."""
    mat, nodes, links = new_material(name)
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    emit = nodes.new("ShaderNodeEmission")
    emit.inputs["Strength"].default_value = SCREEN_STRENGTH
    links.new(emit.outputs[0], out.inputs["Surface"])
    coord = nodes.new("ShaderNodeTexCoord")
    texs = []
    mapping = None
    if window:  # tablet: show a window of the page, scrolled by the Mapping location
        mapping = nodes.new("ShaderNodeMapping")
        frac = window[0] / window[1]  # visible rows / image rows (837 / 913): no stretch
        mapping.inputs["Scale"].default_value = (1.0, frac, 1.0)
        mapping.inputs["Location"].default_value = (0.0, 1.0 - frac, 0.0)
        links.new(coord.outputs["UV"], mapping.inputs["Vector"])
    for img in images:
        tex = nodes.new("ShaderNodeTexImage")
        tex.image, tex.interpolation, tex.extension = img, "Linear", "EXTEND"
        links.new((mapping.outputs[0] if mapping else coord.outputs["UV"]), tex.inputs["Vector"])
        texs.append(tex)
    fade = None
    if len(texs) == 2:
        mix = nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        fade = mix.inputs["Factor"]
        fade.default_value = 0.0
        links.new(texs[0].outputs["Color"], mix.inputs["A"])
        links.new(texs[1].outputs["Color"], mix.inputs["B"])
        links.new(mix.outputs["Result"], emit.inputs["Color"])
    else:
        links.new(texs[0].outputs["Color"], emit.inputs["Color"])
    return mat, mapping, fade


def glass_material():
    """Thin cover glass over a display (IOR 1.5, near-mirror). It passes the screen through by
    1 - Fresnel and reflects ONLY the key softbox: a soft-edged patch where the mirror direction
    points at the softbox (~12 x 18 deg as seen from the set). No HDRI and no other lights in the
    glass, so it can never wash the UI out; identical in EEVEE and Cycles, and noise-free."""
    mat, nodes, links = new_material("Cover glass")
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    fres = nodes.new("ShaderNodeFresnel")
    fres.inputs["IOR"].default_value = 1.5
    k = nodes.new("ShaderNodeMath")
    k.operation, k.inputs[1].default_value = "MULTIPLY", GLASS_K
    links.new(fres.outputs[0], k.inputs[0])
    key_dir = (Vector(KEY_LIGHT["loc"]) - Vector((0.0, 0.15, 0.12))).normalized()
    coord = nodes.new("ShaderNodeTexCoord")
    dot = nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = key_dir
    links.new(coord.outputs["Reflection"], dot.inputs[0])
    soft = nodes.new("ShaderNodeMapRange")
    soft.interpolation_type = "SMOOTHERSTEP"
    soft.inputs["From Min"].default_value = math.cos(math.radians(26))  # soft edge
    soft.inputs["From Max"].default_value = math.cos(math.radians(11))  # full softbox
    soft.inputs["To Max"].default_value = GLASS_SOFTBOX
    links.new(dot.outputs["Value"], soft.inputs["Value"])
    emit = nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = (1.0, 0.985, 0.96, 1)
    links.new(soft.outputs["Result"], emit.inputs["Strength"])
    trans = nodes.new("ShaderNodeBsdfTransparent")
    mix = nodes.new("ShaderNodeMixShader")
    links.new(k.outputs[0], mix.inputs["Fac"])
    links.new(trans.outputs[0], mix.inputs[1])
    links.new(emit.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], out.inputs["Surface"])
    if hasattr(mat, "surface_render_method"):
        mat.surface_render_method = "BLENDED"  # EEVEE: sorted transparency, no dither noise
    return mat


def card_material(name, img):
    """Floating UI card face: mostly emission (true colours) plus a little diffuse; light-grey at the AA edge."""
    mat, nodes, links = new_material(name)
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    tex = nodes.new("ShaderNodeTexImage")
    tex.image, tex.interpolation, tex.extension = img, "Linear", "CLIP"
    edge_mix = nodes.new("ShaderNodeMix")
    edge_mix.data_type = "RGBA"
    edge_mix.inputs["A"].default_value = (*CARD_EDGE, 1)
    links.new(tex.outputs["Alpha"], edge_mix.inputs["Factor"])
    links.new(tex.outputs["Color"], edge_mix.inputs["B"])
    emit = nodes.new("ShaderNodeEmission")
    emit.inputs["Strength"].default_value = CARD_EMISSION
    links.new(edge_mix.outputs["Result"], emit.inputs["Color"])
    diff = nodes.new("ShaderNodeBsdfPrincipled")
    diff.inputs["Roughness"].default_value = 0.45
    diff.inputs["Specular IOR Level"].default_value = 0.0
    links.new(edge_mix.outputs["Result"], diff.inputs["Base Color"])
    add = nodes.new("ShaderNodeMixShader")
    add.inputs["Fac"].default_value = CARD_DIFFUSE
    links.new(emit.outputs[0], add.inputs[1])
    links.new(diff.outputs[0], add.inputs[2])
    links.new(add.outputs[0], out.inputs["Surface"])
    return mat


def floor_materials():
    """Cycles: the floor is a shadow catcher (its own colour only feeds bounce light, kept stage-dark).
    EEVEE (look-dev only): a shadow matte, black with alpha from how much light reaches the floor."""
    cyc = principled("Floor (Cycles)", (0.004, 0.0042, 0.0045), roughness=0.8)
    mat, nodes, links = new_material("Floor (EEVEE shadow matte)")
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    diff = nodes.new("ShaderNodeBsdfDiffuse")
    to_rgb = nodes.new("ShaderNodeShaderToRGB")
    bw = nodes.new("ShaderNodeRGBToBW")
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[0].color = 0.0, (0.6, 0.6, 0.6, 1)
    ramp.color_ramp.elements[1].position, ramp.color_ramp.elements[1].color = 0.35, (0, 0, 0, 1)
    trans = nodes.new("ShaderNodeBsdfTransparent")
    black = nodes.new("ShaderNodeEmission")
    black.inputs["Color"].default_value = (0, 0, 0, 1)
    mix = nodes.new("ShaderNodeMixShader")
    links.new(diff.outputs[0], to_rgb.inputs[0])
    links.new(to_rgb.outputs["Color"], bw.inputs[0])
    links.new(bw.outputs[0], ramp.inputs[0])
    links.new(ramp.outputs["Color"], mix.inputs["Fac"])
    links.new(trans.outputs[0], mix.inputs[1])
    links.new(black.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], out.inputs["Surface"])
    return cyc, mat


# ----------------------------------------------------------------------- animation helpers
def key_pose(obj, frame, loc, rot):
    obj.location = loc
    prev = obj.rotation_euler.copy()
    obj.rotation_euler = rot.to_euler("XYZ", prev) if isinstance(rot, Quaternion) else rot
    obj.keyframe_insert("location", frame=frame)
    obj.keyframe_insert("rotation_euler", frame=frame)


def key_visible(obj, frame, visible):
    obj.hide_render = obj.hide_viewport = not visible
    obj.keyframe_insert("hide_render", frame=frame)
    obj.keyframe_insert("hide_viewport", frame=frame)


def look_at(loc, target, up=Vector((0, 0, 1))):
    """Rotation matrix of a camera at loc looking at target (-Z forward, +Y up), like Track To."""
    fwd = (Vector(target) - Vector(loc)).normalized()
    right = fwd.cross(up).normalized()
    upv = right.cross(fwd)
    return Matrix((right, upv, -fwd)).transposed()


def cam_space(shot, fx, fy, depth, yaw=0.0, pitch=0.0):
    """World matrix of a card at frame position (fx, fy) and depth, facing the camera of `shot`."""
    loc, target = SHOTS[shot]
    rot = look_at(loc, target)
    half = depth * math.tan(HFOV / 2)
    p = Vector(loc) + rot @ Vector((fx * 2 * half, fy * 2 * half, -depth))
    tilt = Euler((math.radians(pitch), math.radians(yaw), 0), "XYZ").to_matrix()
    return Matrix.Translation(p) @ (rot @ tilt).to_4x4()


def in_parent(parent, world, max_turn=MAX_TURN):
    """Express a world matrix in the parent's space (parents are static at the frames used), with the
    rotation clamped to max_turn degrees from the rest orientation (parallel to the screen)."""
    m = parent.matrix_world.inverted() @ world
    loc, rot, _ = m.decompose()
    if math.degrees(rot.angle) > max_turn:
        rot = Quaternion(rot.axis, math.radians(max_turn))
    return Matrix.Translation(loc) @ rot.to_matrix().to_4x4()


def set_matrix_keys(obj, frame, matrix):
    loc, rot, _ = matrix.decompose()
    key_pose(obj, frame, loc, rot)


# ======================================================================= build
def build():
    scene = reset_scene()
    prefs = bpy.context.preferences.edit
    prefs.keyframe_new_interpolation_type, prefs.keyframe_new_handle_type = "BEZIER", "AUTO_CLAMPED"
    scene.frame_start, scene.frame_end, scene.frame_current = 1, END, 1
    scene.render.fps = 24
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = *RES, 100
    scene.render.film_transparent = True
    scene.render.use_motion_blur = False
    scene.unit_settings.system, scene.unit_settings.length_unit = "METRIC", "MILLIMETERS"
    vs = scene.view_settings
    vs.view_transform, vs.look, vs.exposure, vs.gamma = "Standard", "None", 0.0, 1.0
    scene.display_settings.display_device = "sRGB"
    scene.sequencer_colorspace_settings.name = "sRGB"

    # ------------------------------------------------------------- materials
    graphite = principled("Graphite anodised", (0.040, 0.042, 0.046), metallic=1.0, roughness=0.35, Anisotropic=0.25)
    chamf = principled("Graphite chamfer", (0.085, 0.088, 0.094), metallic=1.0, roughness=0.16)
    keys_mat = principled("Keys", (0.060, 0.063, 0.068), metallic=0.0, roughness=0.55)
    pad_mat = principled("Trackpad", (0.050, 0.052, 0.057), metallic=0.0, roughness=0.22, **{"Coat Weight": 0.4, "Coat Roughness": 0.15})
    bezel = principled("Bezel black", (0.006, 0.006, 0.007), roughness=0.18)
    rubber = principled("Gasket rubber", (0.010, 0.010, 0.011), roughness=0.85)
    lens = principled("Camera lens", (0.002, 0.002, 0.003), roughness=0.05, **{"Coat Weight": 1.0})
    edge = principled("Card edge", CARD_EDGE, roughness=0.42)
    glass = glass_material()
    floor_cycles, floor_eevee = floor_materials()

    img_tab = load_image(TEX / "screen-tablet-invoice.png")
    img_rep = load_image(TEX / "screen-laptop-reports.png")
    img_dash = load_image(TEX / "screen-laptop-dashboard.png")
    win = TEXJ["screens"]["tablet-invoice"]["window"]
    tab_screen, scroll_map, _ = screen_material("Screen tablet", [img_tab], window=(win[1], TEXJ["screens"]["tablet-invoice"]["size"][1]))
    lap_screen, _, fade = screen_material("Screen laptop", [img_rep, img_dash])
    # Guard: the screens show their pixels square, 1:1 (no stretch). Tablet: visible rows == 837 of 913.
    img_rows = TEXJ["screens"]["tablet-invoice"]["size"][1]
    shown_rows = scroll_map.inputs["Scale"].default_value[1] * img_rows
    assert abs(shown_rows - win[1]) < 0.5, f"tablet screen shows {shown_rows:.1f} rows, expected {win[1]}"
    for key in ("laptop-reports", "laptop-dashboard"):
        w, h = TEXJ["screens"][key]["size"]
        assert abs((w / LAPTOP["display"][0]) / (h / LAPTOP["display"][1]) - 1) < 0.002, f"{key} texels not square"

    # ------------------------------------------------------------- floor, world, lights
    # Only as big as the shadows reach: the catcher is invisible except for shadows, and every
    # floor pixel costs extra shadow rays in Cycles.
    floor = plane("Floor", 1.4, 1.1, floor_cycles, matrix=Matrix.Translation((0.02, 0.22, 0.0)))
    floor.data.materials.append(floor_eevee)
    floor.is_shadow_catcher = True

    world = bpy.data.worlds.new("Studio HDRI")
    scene.world = world
    if world.node_tree is None:
        world.use_nodes = True
    wn, wl = world.node_tree.nodes, world.node_tree.links
    wn.clear()
    env = wn.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(str(HDRI), check_existing=True)
    mapping = wn.new("ShaderNodeMapping")
    coords = wn.new("ShaderNodeTexCoord")
    mapping.inputs["Rotation"].default_value[2] = math.radians(150)
    wl.new(coords.outputs["Generated"], mapping.inputs["Vector"])
    wl.new(mapping.outputs[0], env.inputs["Vector"])
    bg = wn.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = 0.22  # low: reflections only
    wl.new(env.outputs["Color"], bg.inputs["Color"])
    wout = wn.new("ShaderNodeOutputWorld")
    wl.new(bg.outputs[0], wout.inputs["Surface"])

    def area_light(name, loc, aim, size, energy, colour=(1, 1, 1), spread=180):
        data = bpy.data.lights.new(name, "AREA")
        data.shape, data.size, data.size_y = "RECTANGLE", size[0], size[1]
        data.energy, data.color = energy, colour
        data.spread = math.radians(spread)
        obj = link(bpy.data.objects.new(name, data))
        obj.matrix_world = Matrix.Translation(loc) @ look_at(loc, aim).to_4x4()
        return obj

    key_light = area_light("Key softbox", KEY_LIGHT["loc"], KEY_LIGHT["aim"], KEY_LIGHT["size"], KEY_LIGHT["energy"], (1.0, 0.985, 0.96))
    area_light("Rim cool", (0.75, 0.95, 0.42), (0.02, 0.12, 0.12), (0.6, 0.22), 38.0, (0.70, 0.82, 1.0))
    fill_light = area_light("Fill", (0.85, -0.80, 0.22), (0.0, 0.10, 0.10), (1.0, 0.7), 9.0, (1.0, 0.97, 0.94))

    # ------------------------------------------------------------- tablet
    t = TABLET
    tw, th = t["display"][0] + 2 * t["bezel"], t["display"][1] + 2 * t["bezel"]
    tab = empty("Tablet", matrix=Matrix.Translation(t["centre"]) @ Euler(
        (math.radians(90 - t["tilt_back"]), 0, math.radians(t["yaw"])), "XYZ").to_matrix().to_4x4(), size=0.05)
    body = slab("Tablet body", rr_outline(tw, th, t["radius"], 14), -t["thick"], 0.0, [bezel, graphite, chamf], tab,
                top_mat=0, side_mat=1, bottom_mat=1)
    chamfer(body, 0.55 * MM, 2)
    plane("Tablet display", *t["display"], tab_screen, tab, Matrix.Translation((0, 0, 0.10 * MM)), radius=t["display_radius"])
    g = plane("Tablet glass", *t["display"], glass, tab, Matrix.Translation((0, 0, 0.45 * MM)), radius=t["display_radius"])
    g.visible_shadow = False
    cam_dot = slab("Tablet front camera", rr_outline(2.4 * MM, 2.4 * MM, 1.2 * MM, 6), 0.0, 0.12 * MM, [lens], tab,
                   Matrix.Translation((0, t["display"][1] / 2 + t["bezel"] / 2, 0)), top_mat=0, side_mat=0, bottom_mat=0)
    cam_dot.visible_shadow = False
    tab_content = empty("Tablet content (scroll)", tab, Matrix.Identity(4))

    # ------------------------------------------------------------- laptop
    lp = LAPTOP
    bw_, bd = lp["base"]
    lap = empty("Laptop", matrix=Matrix.Translation(lp["position"]) @ Matrix.Rotation(math.radians(lp["yaw"]), 4, "Z"), size=0.05)
    base = slab("Laptop base", rr_outline(bw_, bd, lp["base_radius"], 12), 0.0, lp["base_back"], [graphite, graphite, chamf], lap,
                top_mat=0, side_mat=1, bottom_mat=1)
    for v in base.data.vertices:  # taper toward the front (-Y)
        if v.co.z > 0.5 * lp["base_back"]:
            k = (v.co.y + bd / 2) / bd
            v.co.z = lp["base_front"] + (lp["base_back"] - lp["base_front"]) * k
    chamfer(base, 0.6 * MM, 2)

    def deck_z(y):
        return lp["base_front"] + (lp["base_back"] - lp["base_front"]) * ((y + bd / 2) / bd)

    slope = math.atan((lp["base_back"] - lp["base_front"]) / bd)
    # keyboard: slightly dished keys, a shade lighter than the body
    pitch, gap = 18.2 * MM, 2.8 * MM
    key_rows = [
        (0.62, [1.0] * 14),
        (1.0, [1.0] * 13 + [1.7]),
        (1.0, [1.4] + [1.0] * 12 + [1.3]),
        (1.0, [1.75] + [1.0] * 11 + [1.95]),
        (1.0, [2.3] + [1.0] * 10 + [2.4]),
        (1.0, [1.0, 1.0, 1.0, 1.2, 5.3, 1.2, 1.0, "arrows"]),
    ]
    bm = bmesh.new()
    total_w = 14.7 * pitch
    y_cursor = bd / 2 - 17 * MM
    for depth_u, widths in key_rows:
        row_h = depth_u * pitch
        x = -total_w / 2
        yc = y_cursor - row_h / 2
        for wu in widths:
            if wu == "arrows":  # left, up/down (half height), right
                cells = [(x, 1.0, yc, row_h - gap), (x + pitch, 1.0, yc + row_h / 4, row_h / 2 - gap * 0.6),
                         (x + pitch, 1.0, yc - row_h / 4, row_h / 2 - gap * 0.6), (x + 2 * pitch, 1.0, yc, row_h - gap)]
                wu = 3.0
            else:
                cells = [(x, wu, yc, row_h - gap)]
            for cx0, cw, cy, kh in cells:
                kw = cw * pitch - gap
                pts = ccw(rr_outline(kw, kh, 1.6 * MM, 3))
                cxk = cx0 + cw * pitch / 2
                z0 = deck_z(cy) - 0.2 * MM
                z1 = deck_z(cy) + 0.9 * MM
                bot = [bm.verts.new((cxk + px, cy + py, z0)) for px, py in pts]
                top = [bm.verts.new((cxk + px, cy + py, z1)) for px, py in pts]
                ftop = bm.faces.new(top)
                bm.faces.new(bot[::-1])
                for i in range(len(pts)):
                    j = (i + 1) % len(pts)
                    bm.faces.new((bot[i], bot[j], top[j], top[i]))
                bmesh.ops.inset_individual(bm, faces=[ftop], thickness=1.1 * MM, depth=-0.14 * MM)  # the dish
            x += wu * pitch
        y_cursor -= row_h
    keys_me = bpy.data.meshes.new("Keys")
    bm.to_mesh(keys_me)
    bm.free()
    keys_me.materials.append(keys_mat)
    keys_me.shade_smooth()
    keys_me.set_sharp_from_angle(angle=math.radians(40))
    keys = link(bpy.data.objects.new("Keys", keys_me), lap)
    kb = keys.modifiers.new("Soft edges", "BEVEL")
    kb.width, kb.segments, kb.limit_method, kb.angle_limit = 0.25 * MM, 2, "ANGLE", math.radians(50)
    # trackpad: large, flush, slightly glossier than the deck
    tp_w, tp_h, tp_y = 124 * MM, 78 * MM, -bd / 2 + 14 * MM + 39 * MM
    slab("Trackpad", rr_outline(tp_w, tp_h, 5 * MM, 8), -0.4 * MM, 0.08 * MM, [pad_mat, rubber], lap,
                    Matrix.Translation((0, tp_y, deck_z(tp_y))) @ Matrix.Rotation(-slope, 4, "X"), top_mat=0, side_mat=1, bottom_mat=1)
    # hinge
    hinge_y, hinge_z = bd / 2 - 6 * MM, lp["base_back"] + 1.0 * MM
    hb = bmesh.new()
    bmesh.ops.create_cone(hb, cap_ends=True, segments=32, radius1=4.6 * MM, radius2=4.6 * MM, depth=250 * MM,
                          matrix=Matrix.Translation((0, hinge_y, hinge_z - 1.6 * MM)) @ Matrix.Rotation(math.radians(90), 4, "Y"))
    hme = bpy.data.meshes.new("Hinge")
    hb.to_mesh(hme)
    hb.free()
    hme.materials.append(graphite)
    hme.shade_smooth()
    hme.set_sharp_from_angle(angle=math.radians(40))
    link(bpy.data.objects.new("Hinge", hme), lap)
    # lid: built standing in its own XY plane (front face +Z), rotated open about the hinge
    dw, dh = lp["display"]
    lw, lh = dw + 2 * lp["bezel"], dh + 2 * lp["bezel"]
    lid = empty("Laptop lid", lap, Matrix.Translation((0, hinge_y, hinge_z)) @ Matrix.Rotation(math.radians(180 - lp["open_deg"]), 4, "X"))
    lid_body = slab("Lid body", rr_outline(lw, lh, lp["lid_radius"], 12), -lp["lid_thick"], 0.0, [bezel, graphite, chamf], lid,
                    Matrix.Translation((0, lh / 2 + 1.5 * MM, 0)), top_mat=0, side_mat=1, bottom_mat=1)
    chamfer(lid_body, 0.5 * MM, 2)
    lap_frame = empty("Laptop screen", lid, Matrix.Translation((0, lh / 2 + 1.5 * MM, 0)))
    plane("Laptop display", dw, dh, lap_screen, lap_frame, Matrix.Translation((0, 0, 0.10 * MM)))
    g = plane("Laptop glass", dw, dh, glass, lap_frame, Matrix.Translation((0, 0, 0.40 * MM)))
    g.visible_shadow = False
    ring("Screen gasket", rr_outline(lw - 1.0 * MM, lh - 1.0 * MM, lp["lid_radius"] - 0.5 * MM, 12),
         rr_outline(lw - 3.0 * MM, lh - 3.0 * MM, lp["lid_radius"] - 1.5 * MM, 12), 0.0, 0.45 * MM, rubber, lap_frame)

    # ------------------------------------------------------------- floating UI cards
    def tex_scale(screen):
        if screen == "invoice":
            return 0.2 * MM, 0.2 * MM
        size = TEXJ["screens"][f"laptop-{screen}"]["size"]
        return dw / size[0], dh / size[1]

    def rest_matrix(name):
        """Where the crop sits on its screen (card front face just above the cover glass)."""
        c = TEXJ["crops"][name]
        L, T, R, B = c["box"]
        sx, sy = tex_scale(c["screen"])
        cx, cy = (L + R + 1) / 2, (T + B + 1) / 2
        if c["screen"] == "invoice":
            x = (cx - TEXJ["screens"]["tablet-invoice"]["size"][0] / 2) * sx
            y = (win[1] / 2 - cy) * sy  # in the scrolled content space
            return Matrix.Translation((x, y, 0.75 * MM))
        crop = TEXJ["screens"][f"laptop-{c['screen']}"]
        x = (cx - crop["crop_box"][0] - crop["size"][0] / 2) * sx
        y = (crop["size"][1] / 2 - cy) * sy
        return Matrix.Translation((x, y, 0.75 * MM))

    cards = {}
    for name, c in TEXJ["crops"].items():
        sx, sy = tex_scale(c["screen"])
        w, h = c["size"][0] * sx, c["size"][1] * sy
        r = c["radius_px"] * sx
        mat = card_material(f"Card {name}", load_image(TEX / c["file"]))
        parent = tab_content if c["screen"] == "invoice" else lap_frame
        obj = slab(f"Card {name}", rr_outline(w, h, r, 10), -CARD_THICK, 0.0, [mat, edge], parent, rest_matrix(name),
                   uv_size=(w, h), top_mat=0, side_mat=1, bottom_mat=1)
        obj["native_px"] = c["size"]
        obj["screen"] = c["screen"]
        cards[name] = obj
        obj.hide_render = obj.hide_viewport = True
    # how-to-pay rides on the invoice card
    htp, inv = cards["how-to-pay"], cards["invoice-preview"]
    htp.parent = inv
    offset = (rest_matrix("invoice-preview").inverted() @ rest_matrix("how-to-pay")).translation
    htp.matrix_basis = Matrix.Translation((offset.x, offset.y, 0.15 * MM))
    # Light linking: the key and fill skip the cards (they still cast the cards' shadows).
    skip = bpy.data.collections.new("Light linking: cards skip key and fill")
    for o in cards.values():
        skip.objects.link(o)
    for item in skip.collection_objects:
        item.light_linking.link_state = "EXCLUDE"
    for light in (key_light, fill_light):
        light.light_linking.receiver_collection = skip
    for unused in ("kpi-invoices", "kpi-amount", "kpi-settled", "kpi-pending"):
        cards[unused]["unused"] = True  # prepared for later scenes; not in this choreography

    # ------------------------------------------------------------- camera
    cam_data = bpy.data.cameras.new("Camera")
    cam_data.lens, cam_data.sensor_width, cam_data.sensor_fit = LENS_MM, SENSOR_MM, "HORIZONTAL"
    cam_data.clip_start, cam_data.clip_end = 0.01, 20
    cam_data.dof.use_dof, cam_data.dof.aperture_fstop, cam_data.dof.aperture_blades = True, FSTOP, 0
    cam = link(bpy.data.objects.new("Camera", cam_data))
    aim = empty("Camera aim")
    tc = cam.constraints.new("TRACK_TO")
    tc.target, tc.track_axis, tc.up_axis = aim, "TRACK_NEGATIVE_Z", "UP_Y"
    scene.camera = cam

    def shot(frame, name):
        loc, target = SHOTS[name]
        cam.location, aim.location = loc, target
        cam.keyframe_insert("location", frame=frame)
        aim.keyframe_insert("location", frame=frame)

    for f, s in ((1, "A"), (24, "B"), (36, "B"), (58, "C"), (78, "C"), (87, "Cpan"), (95, "D"), (114, "D"), (132, "E"), (144, "E")):
        shot(f, s)
    bpy.context.view_layer.update()

    # ------------------------------------------------------------- choreography
    # Beat 1: page scroll 0 -> 76 px (f1-24): content moves up; the texture window follows.
    img_h = TEXJ["screens"]["tablet-invoice"]["size"][1]
    loc_sock = scroll_map.inputs["Location"]
    frac = win[1] / img_h
    for f, s_px in ((1, 0), (24, TEXJ["screens"]["tablet-invoice"]["scroll_px"])):
        tab_content.location = (0, s_px * 0.2 * MM, 0)
        tab_content.keyframe_insert("location", frame=f)
        loc_sock.default_value = (0.0, 1.0 - frac - s_px / img_h, 0.0)
        loc_sock.keyframe_insert("default_value", frame=f)
    scene.frame_set(40)  # page fully scrolled: tablet content is static from here on

    tiles = ["tile-psid", "tile-dynamic-qr", "tile-static-qr", "tile-rtp"]
    cam_b = Vector(SHOTS["B"][0])

    def lifted_local(name, lift, tilt_deg):
        """Rest pose + lift along the screen normal, tilted a few degrees toward camera B."""
        rest = rest_matrix(name)
        to_cam = (tab_content.matrix_world.inverted() @ cam_b - (rest.translation + Vector((0, 0, lift)))).normalized()
        axis = Vector((0, 0, 1)).cross(to_cam)
        rot = Quaternion(axis.normalized(), math.radians(tilt_deg)) if axis.length > 1e-6 else Quaternion()
        return Matrix.Translation(rest.translation + Vector((0, 0, lift))) @ rot.to_matrix().to_4x4()

    lifts = [18 * MM, 17 * MM, 16 * MM, 15 * MM]
    for i, name in enumerate(tiles):
        o = cards[name]
        s0 = 10 + 3 * i
        key_visible(o, 1, False)
        key_visible(o, s0, True)
        set_matrix_keys(o, s0, rest_matrix(name))
        set_matrix_keys(o, s0 + 9, lifted_local(name, lifts[i], 5.0))
        # Beat 2: settle back (f37-44, 1-frame stagger), then hide until beat 3
        set_matrix_keys(o, 37 + i, lifted_local(name, lifts[i], 5.0))
        set_matrix_keys(o, 41 + i, rest_matrix(name))
        key_visible(o, 45, False)

    # Beat 2: the invoice lifts off and arcs to the centre of the frame, turning to face the camera.
    key_visible(inv, 1, False)
    key_visible(inv, 40, True)
    set_matrix_keys(inv, 40, rest_matrix("invoice-preview"))
    inv_c = in_parent(tab_content, cam_space("C", *INVOICE_C))
    rest_t = rest_matrix("invoice-preview").translation
    mid = rest_t.lerp(inv_c.translation, 0.5) + Vector((0, 0.022, 0.02))  # gentle arc (up and out)
    key_pose(inv, 49, mid, rest_matrix("invoice-preview").to_quaternion().slerp(inv_c.to_quaternion(), 0.5))
    set_matrix_keys(inv, 58, inv_c)
    set_matrix_keys(inv, 78, inv_c)
    # how-to-pay rises a further 6 mm off the invoice card (f50-58)
    key_visible(htp, 1, False)
    key_visible(htp, 50, True)
    base_htp = htp.matrix_basis.translation.copy()
    key_pose(htp, 50, base_htp, Quaternion())
    key_pose(htp, 58, base_htp + Vector((0, 0, 6 * MM)), Quaternion())

    # Beat 3: tiles rise again and fan around the floating invoice; then everything drifts left.
    for i, name in enumerate(tiles):
        o = cards[name]
        s0 = 65 + 2 * i
        key_visible(o, s0, True)
        set_matrix_keys(o, s0, rest_matrix(name))
        fan = in_parent(tab_content, cam_space("C", *TILE_FAN_C[name]))
        set_matrix_keys(o, s0 + 13, fan)  # f78-84; then the drift runs to f100
        drifted = fan.copy()
        drifted.translation += tab_content.matrix_world.inverted().to_3x3() @ Vector(DRIFT_D)
        set_matrix_keys(o, max(92, s0 + 16), drifted)
        set_matrix_keys(o, 100, drifted)
    drifted = inv_c.copy()
    drifted.translation += tab_content.matrix_world.inverted().to_3x3() @ Vector(DRIFT_D)
    set_matrix_keys(inv, 92, drifted)
    set_matrix_keys(inv, 100, drifted)

    rows = cards["rows-settled"]
    key_visible(rows, 1, False)
    key_visible(rows, 82, True)
    set_matrix_keys(rows, 82, rest_matrix("rows-settled"))
    up_rows = rest_matrix("rows-settled") @ Matrix.Translation((0, 0, ROWS_LIFT))
    set_matrix_keys(rows, 96, up_rows)
    # Beat 4: the stepper lifts above the rows; the rows settle back.
    set_matrix_keys(rows, 101, up_rows)
    set_matrix_keys(rows, 112, rest_matrix("rows-settled"))
    key_visible(rows, 113, False)
    step = cards["stepper"]
    key_visible(step, 1, False)
    key_visible(step, 101, True)
    set_matrix_keys(step, 101, rest_matrix("stepper"))
    step_up = Matrix.Translation(STEPPER_LAPTOP)
    set_matrix_keys(step, 110, step_up)
    set_matrix_keys(step, 112, step_up)
    # Then it leads the dashboard cards upward, clear of them: up to a point above its hero spot
    # by f121, settling into the hero composition at f132 (the Revenue card rises below it).
    step_hero = in_parent(lap_frame, cam_space("E", *HERO_E["stepper"]))
    set_matrix_keys(step, 121, Matrix.Translation(step_hero.translation + Vector(STEPPER_WAYPOINT)) @ step_hero.to_quaternion().to_matrix().to_4x4())

    # Laptop screen: Reports -> Dashboard, 6-frame crossfade (the nav pill changes with it).
    fade.default_value = 0.0
    fade.keyframe_insert("default_value", frame=111)
    fade.default_value = 1.0
    fade.keyframe_insert("default_value", frame=117)

    # Dashboard cards lift off (revenue, disbursement, then the donut) into the hero composition.
    for name, s0 in (("card-revenue", 117), ("card-disbursement", 120), ("donut", 123)):  # after the crossfade
        o = cards[name]
        key_visible(o, 1, False)
        key_visible(o, s0, True)
        set_matrix_keys(o, s0, rest_matrix(name))
        set_matrix_keys(o, 132, in_parent(lap_frame, cam_space("E", *HERO_E[name])))
    # Hero positions for the invoice, tiles and stepper (f132), held to the end.
    for name in ["invoice-preview", "stepper"] + tiles:
        o = cards[name]
        parent = tab_content if TEXJ["crops"][name]["screen"] == "invoice" else lap_frame
        set_matrix_keys(o, 132, in_parent(parent, cam_space("E", *HERO_E[name])))
    scene.frame_set(132)
    for o in cards.values():  # hold the final pose to the end
        if o.animation_data and o.animation_data.action:
            key_pose(o, END, o.location.copy(), o.rotation_euler.copy())

    # ------------------------------------------------------------- focus follows the active element
    focus = empty("Focus")
    cam_data.dof.focus_object = focus
    anchors = {
        "tablet": empty("Focus: tablet", tab, Matrix.Translation((0.02, -0.01, 0.012))),
        "invoice": inv,
        "laptop": empty("Focus: laptop", lap_frame, Matrix.Translation((0, -0.03, 0.01))),
        "hero": empty("Focus: hero", None, cam_space("E", 0.0, 0.20, 0.740)),
    }
    plan = [("tablet", None), ("invoice", (42, 52)), ("laptop", (80, 94)), ("hero", (114, 132))]
    for i, (key, span) in enumerate(plan):
        con = focus.constraints.new("COPY_LOCATION")
        con.target = anchors[key]
        if span is None:
            con.influence = 1.0
            continue
        con.influence = 0.0
        con.keyframe_insert("influence", frame=span[0])
        con.influence = 1.0
        con.keyframe_insert("influence", frame=span[1])

    # ------------------------------------------------------------- render defaults (render.py sets the rest)
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = 64
    scene.cycles.samples = 96
    scene.frame_set(1)
    return scene


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    build()
    if "--no-save" not in args:
        # Image paths are stored relative to the .blend (render.py and checks.py fall back to
        # %LOCALAPPDATA%/raja-3d on another machine), so no local user name ends up in the repo.
        # Saved uncompressed so a plain text search of the file is meaningful.
        for img in bpy.data.images:
            if img.filepath:
                img.filepath = bpy.path.relpath(bpy.path.abspath(img.filepath), start=str(BLEND.parent))
        for screen in bpy.data.screens:  # the UI's file browsers remember a local folder; reset them
            for area in screen.areas:
                for space in area.spaces:
                    if space.type == "FILE_BROWSER" and space.params:
                        space.params.directory = b"/" * 1000  # overwrite the whole buffer, not just its start
                        space.params.directory = b"//"
        bpy.ops.wm.save_as_mainfile(filepath=str(BLEND), compress=False, relative_remap=False)
        print("saved", BLEND)
