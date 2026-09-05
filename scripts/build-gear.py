#!/usr/bin/env python3
"""
Builds the fighters' 3D gloves and shoes.

The head models are photogrammetry of a specific person. These are not — there
is no press photo of anyone's forearm, and the parts of a fighter that read as
"fighter" are not their likeness anyway. So these come from Tripo's *text*-to-3D
instead, which has two consequences worth stating plainly:

  * Nothing here is derived from a copyrighted photograph, so unlike the heads
    there is no attribution obligation attached to them.
  * A clenched boxing glove is a sealed blob with no fingers. Generative 3D is
    notoriously bad at bare hands and reliably fine at gloves, so the prompt is
    doing real work for us rather than fighting the model.

Only rigid parts belong in here. A glove barely rotates against the wrist and a
shoe barely rotates against the ankle, so both can be a solid mesh bolted to one
bone — the same deal the head gets. Forearms and shins cannot: they meet at a
joint that bends, and two rigid meshes meeting at a bent elbow tear open. Those
stay capsules, whose round caps *are* ball joints, until there is a properly
skinned body to replace the whole rig.

One glove and one shoe are generated, not four: the left is mirrored from the
right at load time (see src/characters/rig/gear.ts) and both fighters tint the
same desaturated asset with their own accent colour.

The credits for public/models/ are written by build-heads.py, which documents
these two files as well — regenerate them there, not here.

    python3 scripts/build-gear.py              # process from cache
    python3 scripts/build-gear.py --preview    # + render a verification sheet
    python3 scripts/build-gear.py --regenerate # spend credits, rebuild from Tripo

Needs Pillow and numpy. TRIPO_API_KEY is read from .env, and only for
--regenerate.
"""

from __future__ import annotations

import sys

# The shared helpers below live beside this script; keep scripts/ clean of the
# __pycache__ that importing them would otherwise leave behind.
sys.dont_write_bytecode = True

from dataclasses import dataclass  # noqa: E402
from pathlib import Path  # noqa: E402

import numpy as np  # noqa: E402
from PIL import Image, ImageEnhance  # noqa: E402

import tripo  # noqa: E402
from glb import compact, read_glb, write_glb  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "models"
# Same git-ignored bucket as the heads: generating costs credits, so the raw
# result is cached and everything after it is free, local and deterministic.
SOURCE_DIR = ROOT / "assets" / "source" / "gear"

TRI_TARGET = 2500
TEXTURE_SIZE = 256


@dataclass(frozen=True)
class Gear:
    id: str
    prompt: str
    # Baked into the vertices, so the shipped asset is correct on its own terms
    # rather than relying on a magic rotation somewhere in the scene. Read off
    # the --preview sheet, which renders the raw model from four sides.
    rotate: tuple[float, float, float]
    # Which axis of the rotated model becomes exactly 1 unit long. The rig then
    # only has to know how big it wants the part to be, in one number.
    axis: str
    # Where the origin sits, as a fraction along each axis of the bounding box.
    # 1.0 in Y puts it at the very top, so the part hangs *below* its bone the
    # way a glove hangs off a wrist.
    anchor: tuple[float, float, float]
    exposure: float
    # Pulled towards greyscale before shipping, so the rig can multiply the
    # result by each fighter's accent colour and get two different gloves out of
    # one asset. Seams, laces and the black cuff trim are luminance detail, so
    # they survive the tint; the generator's own red would fight it.
    saturation: float = 1.0


GEAR = [
    Gear(
        id="glove",
        # Short and concrete. The first attempt here spelled out "clenched fist
        # shape... no hand, no arm, no person" and came back as a faceted shard
        # with 90% of its vertices in one lump — text-to-3D follows a plain noun
        # phrase far better than it follows a list of things not to do.
        prompt="a red boxing glove, product render",
        # Tripo stands the glove cuff-down with the knuckles facing -X. Half a
        # turn about X stands it on its cuff so it hangs off the wrist the way
        # it hangs off an arm, and the quarter turn then points the knuckles
        # down +Z — forward, the way the fighter punches.
        rotate=(np.pi, np.pi / 2, 0.0),
        axis="y",
        anchor=(0.5, 1.0, 0.5),
        # Brightened to make up for what the desaturation takes out, so the
        # tinted result lands at roughly the accent colour rather than under it.
        exposure=1.45,
        saturation=0.16,
    ),
    Gear(
        id="shoe",
        prompt=(
            "a single white leather high-top basketball sneaker, side view, "
            "clean studio product photo on a plain background, "
            "no foot, no leg, no person"
        ),
        # Tripo builds the sneaker sole-down already, but pointing backwards:
        # the tall high-top collar comes out at +Z and the toe at -Z. Half a
        # turn puts the toe forward, the way the fighter faces.
        rotate=(0.0, np.pi, 0.0),
        axis="z",
        # The origin goes at the *sole*, 31% forward of the heel: roughly where
        # a real ankle sits over a real shoe. Anchoring at the top of the box
        # instead would hang the whole high-top below the Foot bone and bury the
        # fighter to the shins — the collar is meant to rise past the ankle, so
        # the one fixed point the rig can reason about is where the shoe meets
        # the floor.
        anchor=(0.5, 0.0, 0.3125),
        exposure=1.0,
    ),
]


def euler_matrix(rot: tuple[float, float, float]) -> np.ndarray:
    """Rotation matrix for an XYZ euler triple, applied X then Y then Z."""
    rx, ry, rz = rot
    cx, sx = np.cos(rx), np.sin(rx)
    cy, sy = np.cos(ry), np.sin(ry)
    cz, sz = np.cos(rz), np.sin(rz)
    mx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]], np.float32)
    my = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]], np.float32)
    mz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]], np.float32)
    return mz @ my @ mx


def generate(gear: Gear) -> Path:
    """text-to-3D, then Tripo's own decimator. Costs credits."""
    raw = SOURCE_DIR / f"{gear.id}-raw.glb"
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    key = tripo.api_key()
    print(f"  prompting: {gear.prompt[:60]}...")

    task = tripo.post("task", {
        "type": "text_to_model",
        "prompt": gear.prompt,
        "texture": True,
        "pbr": False,
    }, key)["task_id"]
    tripo.await_task(task, key, "generate")
    tripo.decimate(task, key, TRI_TARGET, 512, raw)

    print(f"  saved  {raw.relative_to(ROOT)} ({raw.stat().st_size // 1024} kB)")
    return raw


def process(gear: Gear, raw: Path) -> tuple:
    pos, nrm, uv, idx, tex = read_glb(raw)
    tris_before = len(idx)

    R = euler_matrix(gear.rotate)
    pos, nrm = pos @ R.T, nrm @ R.T

    # Nothing is cut away here the way the heads' shoulders are — a glove and a
    # shoe arrive as closed objects — but a decimated mesh can still carry
    # vertices no triangle uses, and they would bloat the buffers for nothing.
    pos, nrm, uv, idx = compact(pos, nrm, uv, idx)

    lo, hi = pos.min(0), pos.max(0)
    extent = hi - lo
    scale = extent["xyz".index(gear.axis)]
    origin = lo + np.array(gear.anchor, np.float32) * extent
    pos = (pos - origin) / scale

    # The same grade the heads and faces get: the arena's ambient is a strong
    # blue, and a white product-shot texture goes grey and muddy under it.
    tex = tex.resize((TEXTURE_SIZE, TEXTURE_SIZE), Image.Resampling.LANCZOS)
    tex = ImageEnhance.Brightness(tex).enhance(gear.exposure)
    tex = ImageEnhance.Color(tex).enhance(1.15 * gear.saturation)
    tex = ImageEnhance.Contrast(tex).enhance(1.10)
    return pos.astype(np.float32), nrm.astype(np.float32), uv, idx, tex, tris_before


def build(gear: Gear, regenerate: bool, preview: bool) -> None:
    print(f"{gear.id}:")
    raw = SOURCE_DIR / f"{gear.id}-raw.glb"
    if regenerate or not raw.exists():
        raw = generate(gear)

    pos, nrm, uv, idx, tex, tris_before = process(gear, raw)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"{gear.id}.glb"
    write_glb(out, pos, nrm, uv, idx, tex, gear.id,
              generator="ceo-clash scripts/build-gear.py")
    print(f"  raw      {tris_before} tris, {raw.stat().st_size // 1024} kB")
    print(f"  shipped  {len(idx)} tris, {len(pos)} verts, "
          f"{out.stat().st_size // 1024} kB -> {out.relative_to(ROOT)}")
    print(f"  extent   {np.round(pos.max(0) - pos.min(0), 3).tolist()} "
          f"({gear.axis} normalised to 1)")
    print(f"  origin   at {np.round(-pos.min(0) / (pos.max(0) - pos.min(0)), 3).tolist()}"
          f" of the box")

    if preview:
        from headpreview import sheet
        p = SOURCE_DIR / f"{gear.id}-preview.png"
        sheet(pos, uv, idx, np.asarray(tex)).save(p)
        print(f"  preview  {p}")


if __name__ == "__main__":
    args = sys.argv[1:]
    only = [a for a in args if not a.startswith("-")]
    for g in GEAR:
        if only and g.id not in only:
            continue
        build(g, "--regenerate" in args, "--preview" in args)
