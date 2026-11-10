"""Renders the board pieces as 3D sprites with Blender (the `bpy` module).

    pip install bpy pillow
    python3 tools/render-pieces.py            # every piece -> art/pieces/*.png
    python3 tools/render-pieces.py r g        # only some pieces
    python3 tools/render-pieces.py --draft    # quick, noisy test renders

Every piece shares one camera and one light rig (key light upper left), so
the set stays consistent. Each PNG is cropped to the piece and padded to a
square with a transparent background.
"""
import math
import os
import random
import sys

import bpy
import bmesh  # must come after bpy
from mathutils import Vector
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'art', 'pieces')
SIZE = 256          # final sprite size in px
RENDER = 512        # render size before the crop
TAU = math.tau


# ---- scene ---------------------------------------------------------------

def reset(samples):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = RENDER
    sc.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('world')
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs[0].default_value = (1, 1, 1, 1)
    bg.inputs[1].default_value = 0.14

    cam = bpy.data.cameras.new('cam')
    cam.type = 'ORTHO'
    cam.ortho_scale = 3.4
    co = bpy.data.objects.new('cam', cam)
    sc.collection.objects.link(co)
    sc.camera = co
    co.location = (0, -8, 1.7)          # front view, a little from above
    aim(co, (0, 0, 0))

    light((-3.2, -4.5, 4.5), 540, 2.4)                      # key, upper left
    light((-1.2, -3.0, 5.5), 160, 0.7)                      # small hot spot
    light((4.5, -3.0, 0.5), 260, 5, (1.0, 0.93, 0.96))      # fill
    light((3.0, 4.0, 2.5), 420, 2.2, (1.0, 0.96, 0.9))      # rim, back right
    light((-3.5, 3.5, -1.0), 90, 3, (0.9, 0.95, 1.0))       # rim, back left low
    return sc


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def light(loc, energy, size, color=(1, 1, 1)):
    data = bpy.data.lights.new('light', 'AREA')
    data.energy, data.size, data.color = energy, size, color
    obj = bpy.data.objects.new('light', data)
    obj.location = loc
    bpy.context.scene.collection.objects.link(obj)
    aim(obj, (0, 0, 0.1))


# ---- materials -----------------------------------------------------------

def material(name, color, edge=None, rough=0.16, coat=1.0, sss=0.18, bump=0.0, bump_scale=60):
    """Glossy candy-like surface. `edge` is the darker color the surface
    turns toward where it faces away from the camera, which gives the form
    a clear, readable border on any background."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    edge = edge or tuple(c * 0.35 for c in color)
    lw = nt.nodes.new('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.42
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[1].position = 0.95
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.inputs[6].default_value = (*color, 1)
    mix.inputs[7].default_value = (*edge, 1)
    nt.links.new(lw.outputs['Facing'], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], mix.inputs[0])
    nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = rough
    for key, value in (('Coat Weight', coat), ('Coat Roughness', 0.04), ('Subsurface Weight', sss),
                       ('Subsurface Scale', 0.25)):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = value
    if 'Subsurface Radius' in bsdf.inputs:
        bsdf.inputs['Subsurface Radius'].default_value = tuple(0.3 + 0.7 * c for c in color)
    if bump:
        noise = nt.nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = bump_scale
        b = nt.nodes.new('ShaderNodeBump')
        b.inputs['Strength'].default_value = bump
        nt.links.new(noise.outputs[0], b.inputs['Height'])
        nt.links.new(b.outputs[0], bsdf.inputs['Normal'])
    return m


LEAF = dict(color=(0.16, 0.66, 0.10), edge=(0.02, 0.22, 0.03), rough=0.28, coat=0.7, sss=0.1)
STEM = dict(color=(0.36, 0.20, 0.08), edge=(0.12, 0.06, 0.02), rough=0.5, coat=0.2, sss=0)


# ---- shapes --------------------------------------------------------------

def smooth(obj, mat):
    for p in obj.data.polygons:
        p.use_smooth = True
    obj.data.materials.append(mat)
    return obj


def sphere(radius=1.0, loc=(0, 0, 0), scale=(1, 1, 1), segs=96, rings=64):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings, radius=radius, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    return obj


def lathe(profile, loc=(0, 0, 0), depth=1.0):
    """A unit sphere whose radius at each height is multiplied by
    profile(t), t = 0 at the bottom and 1 at the top."""
    obj = sphere(loc=loc)
    for v in obj.data.vertices:
        w = profile((v.co.z + 1) / 2)
        v.co.x *= w
        v.co.y *= w * depth
    return obj


def leaf(length, loc, tilt=0.0, turn=0.0, roll=0.0, width=0.42, droop=0.25, mat=None):
    """A leaf that starts at `loc` and points along +X before rotation."""
    obj = sphere(segs=32, rings=24)
    for v in obj.data.vertices:
        x = (v.co.x + 1) / 2                      # 0 at the base, 1 at the tip
        taper = math.sin(math.pi * min(1, x * 0.95 + 0.05)) ** 0.75
        v.co.y = v.co.y * width * length * (0.25 + taper) / 1.1
        v.co.z = v.co.z * 0.05 * length + abs(v.co.y) * 0.35 - droop * length * x * x
        v.co.x = x * length
    obj.location = loc
    obj.rotation_euler = (roll, tilt, turn)
    return smooth(obj, mat)


def stem(base, top, radius, mat):
    base, top = Vector(base), Vector(top)
    d = top - base
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=radius, depth=d.length, location=(base + top) / 2)
    obj = bpy.context.object
    obj.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    sphere(radius=radius * 1.25, loc=top, segs=16, rings=12).data.materials.append(mat)
    return smooth(obj, mat)


def star(outer, inner, depth, points=5, levels=3):
    """A puffy star in the XZ plane, one point up, facing the camera."""
    mesh = bpy.data.meshes.new('star')
    bm = bmesh.new()
    corners = []
    for i in range(points * 2):
        r = outer if i % 2 == 0 else inner
        a = TAU * i / (points * 2) + math.pi / 2
        corners.append(Vector((r * math.cos(a), -depth / 2, r * math.sin(a))))
    ring = []
    for i, c in enumerate(corners):                # extra points hold the shape
        nxt = corners[(i + 1) % len(corners)]
        for f in (0.0, 0.18, 0.5, 0.82):
            ring.append(bm.verts.new(c.lerp(nxt, f)))
    face = bm.faces.new(ring)
    out = bmesh.ops.extrude_face_region(bm, geom=[face])
    bmesh.ops.translate(bm, vec=(0, depth, 0), verts=[e for e in out['geom'] if isinstance(e, bmesh.types.BMVert)])
    caps = [f for f in bm.faces if len(f.verts) > 4]
    bmesh.ops.poke(bm, faces=caps)                 # fans subdivide cleanly
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new('star', mesh)
    bpy.context.scene.collection.objects.link(obj)
    mod = obj.modifiers.new('subsurf', 'SUBSURF')
    mod.levels = mod.render_levels = levels
    return obj


# ---- the pieces ----------------------------------------------------------

def strawberry():
    red = material('strawberry', (0.93, 0.02, 0.06), edge=(0.35, 0.0, 0.03))
    def profile(t):
        w = 0.36 + 0.82 * t ** 0.62
        return w * (1 - 1.1 * (t - 0.8)) if t > 0.8 else w
    body = smooth(lathe(profile, depth=0.86), red)
    body.scale = (1, 1, 1.08)
    seed = material('seed', (1.0, 0.82, 0.30), rough=0.3, coat=0.4, sss=0)
    for ring, z in enumerate([0.52, 0.2, -0.14, -0.48, -0.78]):
        n = [8, 9, 8, 6, 4][ring]
        for i in range(n):
            a = (i + 0.5 * (ring % 2)) / n * TAU
            w = profile((z + 1) / 2) * math.sqrt(1 - z * z)
            p = Vector((math.cos(a) * w, math.sin(a) * w * 0.86, z * 1.08)) * 0.975
            s = smooth(sphere(radius=0.052, loc=p, scale=(1, 1, 1.5), segs=16, rings=12), seed)
    green = material('leaf', **LEAF)
    for i in range(7):
        a = i / 7 * TAU + 0.2
        leaf(0.8, (0, 0, 1.12), tilt=math.radians(10), turn=a, width=0.55, droop=0.34, mat=green)
    stem((0, 0, 1.05), (0.06, -0.05, 1.42), 0.07, green)


def orange():
    peel = material('orange', (1.0, 0.36, 0.0), edge=(0.55, 0.12, 0.0), bump=0.12, bump_scale=55)
    smooth(sphere(radius=1.05, scale=(1, 0.95, 0.94)), peel)
    green = material('leaf', **LEAF)
    brown = material('stem', **STEM)
    stem((0, -0.05, 0.93), (0.02, -0.08, 1.2), 0.065, brown)
    leaf(0.95, (0.03, -0.12, 1.08), tilt=math.radians(-12), turn=math.radians(8), roll=math.radians(-25),
         width=0.55, droop=0.3, mat=green)


def starfruit():
    yellow = material('starfruit', (1.0, 0.74, 0.0), edge=(0.62, 0.30, 0.0), sss=0.3)
    body = star(1.6, 0.95, 1.0)
    smooth(body, yellow)
    inner = material('starfruit-core', (1.0, 0.88, 0.25), edge=(0.85, 0.5, 0.0), sss=0.3)
    core = star(0.62, 0.36, 0.3)
    core.location = (0, -0.42, 0)
    smooth(core, inner)


def pear():
    skin = material('pear', (0.36, 0.78, 0.04), edge=(0.05, 0.30, 0.02), bump=0.04, bump_scale=90)
    def profile(t):
        s = min(1, max(0, (0.92 - t) / 0.55))
        return 0.5 + 0.5 * s * s * (3 - 2 * s)
    body = smooth(lathe(profile, depth=0.92), skin)
    body.scale = (1.0, 1.0, 1.22)
    body.rotation_euler = (0, math.radians(-5), 0)
    brown = material('stem', **STEM)
    green = material('leaf', **LEAF)
    stem((0.09, 0, 1.14), (0.2, -0.04, 1.5), 0.06, brown)
    leaf(0.8, (0.14, -0.06, 1.3), tilt=math.radians(-18), turn=math.radians(5), roll=math.radians(-20),
         width=0.55, mat=green)


def blueberry():
    blue = material('blueberry', (0.02, 0.22, 0.95), edge=(0.0, 0.04, 0.38), rough=0.22)
    smooth(sphere(radius=1.08, scale=(1, 0.96, 0.9)), blue)
    dark = material('crown', (0.0, 0.07, 0.42), edge=(0.0, 0.01, 0.15), rough=0.3, sss=0)
    crown = star(0.5, 0.2, 0.14, levels=2)
    tilt = math.radians(42)
    crown.rotation_euler = (tilt - math.pi / 2, 0, 0)
    crown.location = (0, -math.sin(tilt) * 1.0, math.cos(tilt) * 0.96)
    smooth(crown, dark)


def grapes():
    purple = material('grape', (0.42, 0.05, 0.95), edge=(0.12, 0.0, 0.36))
    random.seed(4)
    r = 0.36
    spots = []
    for row, n in enumerate([4, 3, 2, 1]):
        for i in range(n):
            spots.append(((i - (n - 1) / 2) * 0.6, -0.12, 0.62 - row * 0.52))
    for row, n in enumerate([3, 2, 1]):
        for i in range(n):
            spots.append(((i - (n - 1) / 2) * 0.6, 0.3, 0.36 - row * 0.52))
    for x, y, z in spots:
        j = lambda: random.uniform(-0.03, 0.03)
        smooth(sphere(radius=r * random.uniform(0.95, 1.05), loc=(x + j(), y + j(), z + j()), segs=48, rings=32), purple)
    brown = material('stem', **STEM)
    green = material('leaf', **LEAF)
    stem((0, 0.05, 0.85), (0.05, 0, 1.4), 0.06, brown)
    leaf(0.9, (0.05, -0.1, 1.12), tilt=math.radians(-5), turn=math.radians(10), roll=math.radians(-30),
         width=0.6, droop=0.35, mat=green)


PIECES = {'r': strawberry, 'o': orange, 'y': starfruit, 'g': pear, 'b': blueberry, 'p': grapes}


# ---- render --------------------------------------------------------------

def finish(path):
    """Crops to the piece and pads to a centered square."""
    img = Image.open(path).convert('RGBA')
    box = img.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    img = img.crop(box)
    side = max(img.size)
    pad = round(side * 0.03)
    canvas = Image.new('RGBA', (side + pad * 2, side + pad * 2), (0, 0, 0, 0))
    canvas.paste(img, ((canvas.width - img.width) // 2, (canvas.height - img.height) // 2))
    canvas.resize((SIZE, SIZE), Image.LANCZOS).save(path, optimize=True)


def main():
    args = [a for a in sys.argv[1:] if a != '--']
    draft = '--draft' in args
    keys = [a for a in args if a in PIECES] or list(PIECES)
    os.makedirs(OUT, exist_ok=True)
    for key in keys:
        sc = reset(32 if draft else 192)
        PIECES[key]()
        sc.render.filepath = os.path.join(OUT, f'{key}.png')
        bpy.ops.render.render(write_still=True)
        finish(sc.render.filepath)
        print('rendered', key)


main()
