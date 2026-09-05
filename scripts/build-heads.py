#!/usr/bin/env python3
"""
Builds the fighters' 3D head models.

Each head is generated once by Tripo's image-to-3D from the same freely-licensed
press photo the face texture comes from (see scripts/build-faces.py and
public/faces/CREDITS.md), then processed here into something a browser game can
actually ship:

  raw Tripo GLB   ~3.3 MB, 100k triangles, includes shoulders, faces +X
  shipped GLB     ~150 kB, 5k triangles, cut at the neck, faces +Z, origin at
                  the neck so the rig can just drop it on the Head bone

Generation costs Tripo credits, so the decimated Tripo output is kept in
assets/source/heads/ alongside the project's other generated 3D sources — which
means it is git-ignored like they are, and a fresh clone has to spend credits
once to rebuild it. It is only re-fetched when missing or when --regenerate is
passed. Everything after that is free, local and deterministic, and re-runs
every time — which is what you want while tuning the neck cut.

    python3 scripts/build-heads.py              # process from cache
    python3 scripts/build-heads.py --preview    # + render a verification sheet
    python3 scripts/build-heads.py --regenerate # spend credits, rebuild from Tripo

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
from glb import compact, read_glb, write_glb, yaw_matrix  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "models"
# Everything intermediate lives under the repo's existing git-ignored bucket for
# generated 3D sources, so nothing here needs its own .gitignore entry.
SOURCE_DIR = ROOT / "assets" / "source" / "heads"
PREVIEW_DIR = SOURCE_DIR
FACE_CACHE = ROOT / "assets" / "source" / "faces"

# Tripo hands back a mesh normalised into a unit box with the face pointing +X.
# The rig's fighters face +Z, so every head gets yawed a quarter turn on the way
# through and the rotation is baked into the vertices — the asset is then
# correct on its own terms rather than relying on a magic number in the scene.
FACE_AXIS_YAW = -np.pi / 2

TRI_TARGET = 5000
TEXTURE_SIZE = 512


@dataclass(frozen=True)
class Head:
    id: str
    # Crop of the source photo sent to image-to-3D, as fractions of the source.
    # Wider than the face texture's crop: the generator needs the whole head,
    # hair included, or it invents a skull.
    crop: tuple[float, float, float, float]
    # Where to cut the neck, as a fraction of the raw model's height measured
    # from its lowest point. Tripo always returns some shoulder and collar;
    # everything below this goes, leaving a stub that hides inside the torso.
    neck_cut: float
    # How much higher to cut at the back of the head than at the front. A real
    # neckline is not horizontal — a flat cut that clears the collar behind the
    # ears has already taken the chin off in front — so the plane is tilted.
    neck_tilt: float
    # Exposure trim on the baked texture, matching build-faces.py, so the two
    # heads look like they were lit by the same room.
    exposure: float


HEADS = [
    Head(id="sam", crop=(0.26, 0.04, 0.72, 0.60), neck_cut=0.15, neck_tilt=0.22, exposure=1.06),
    Head(id="dario", crop=(0.19, 0.00, 0.78, 0.58), neck_cut=0.20, neck_tilt=0.30, exposure=0.92),
]


# --------------------------------------------------------------- generation


def head_photo(head: Head) -> Path:
    """The square, white-matted head crop that gets sent to the generator."""
    src = Image.open(FACE_CACHE / f"{head.id}-source.jpg").convert("RGB")
    l, t, r, b = head.crop
    im = src.crop((round(l * src.width), round(t * src.height),
                   round(r * src.width), round(b * src.height)))
    side = max(im.size)
    canvas = Image.new("RGB", (side, side), (255, 255, 255))
    canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    out = SOURCE_DIR / f"{head.id}-photo.png"
    canvas.resize((1024, 1024), Image.Resampling.LANCZOS).save(out)
    return out


def generate(head: Head) -> Path:
    """image-to-3D, then Tripo's own decimator. Costs credits."""
    raw = SOURCE_DIR / f"{head.id}-raw.glb"
    key = tripo.api_key()
    photo = head_photo(head)
    print(f"  uploading {photo.name}")
    token = tripo.upload_image(photo, key)

    task = tripo.post("task", {
        "type": "image_to_model",
        "file": {"type": "png", "file_token": token},
        "texture": True,
        "pbr": False,
    }, key)["task_id"]
    tripo.await_task(task, key, "generate")
    tripo.decimate(task, key, TRI_TARGET, 1024, raw)

    print(f"  saved  {raw.relative_to(ROOT)} ({raw.stat().st_size // 1024} kB)")
    return raw


# ------------------------------------------------------------------ process


def process(head: Head, raw: Path) -> tuple:
    pos, nrm, uv, idx, tex = read_glb(raw)
    tris_before = len(idx)

    # 1. Yaw so the face looks down +Z like the rest of the rig. Doing this
    #    first means the neck cut below can be described in the rig's own terms
    #    — "higher at the back" — instead of Tripo's.
    R = yaw_matrix(FACE_AXIS_YAW)
    pos, nrm = pos @ R.T, nrm @ R.T

    # 2. Lose the shoulders. A triangle goes if its centroid falls below the
    #    tilted neck plane, which leaves a clean-enough edge at this triangle
    #    size and avoids having to clip and re-triangulate anything. The stub
    #    that survives ends up inside the torso, so a ragged edge costs nothing.
    lo, hi = pos[:, 1].min(), pos[:, 1].max()
    cut = lo + (hi - lo) * head.neck_cut
    centroid = pos[idx].mean(1)
    idx = idx[centroid[:, 1] + head.neck_tilt * centroid[:, 2] > cut]

    # 3. Drop the vertices nothing references any more and renumber.
    pos, nrm, uv, idx = compact(pos, nrm, uv, idx)

    # 4. Normalise: one unit tall, sitting on the origin, centred over it. The
    #    rig then only has to know how tall it wants a head to be.
    lo, hi = pos.min(0), pos.max(0)
    pos = (pos - np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])) / (hi[1] - lo[1])

    # Same grade as the face textures: the arena washes everything blue, and a
    # head carrying the photo's own flat conference lighting disappears into it.
    tex = tex.resize((TEXTURE_SIZE, TEXTURE_SIZE), Image.Resampling.LANCZOS)
    tex = ImageEnhance.Brightness(tex).enhance(head.exposure)
    tex = ImageEnhance.Color(tex).enhance(1.22)
    tex = ImageEnhance.Contrast(tex).enhance(1.12)
    return pos.astype(np.float32), nrm.astype(np.float32), uv, idx, tex, tris_before


def build(head: Head, regenerate: bool, preview: bool) -> None:
    print(f"{head.id}:")
    raw = SOURCE_DIR / f"{head.id}-raw.glb"
    if regenerate or not raw.exists():
        raw = generate(head)

    pos, nrm, uv, idx, tex, tris_before = process(head, raw)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"{head.id}-head.glb"
    write_glb(out, pos, nrm, uv, idx, tex, f"{head.id}_head",
              generator="ceo-clash scripts/build-heads.py")
    print(f"  raw      {tris_before} tris, {raw.stat().st_size // 1024} kB")
    print(f"  shipped  {len(idx)} tris, {len(pos)} verts, "
          f"{out.stat().st_size // 1024} kB -> {out.relative_to(ROOT)}")
    print(f"  extent   {np.round(pos.max(0) - pos.min(0), 3).tolist()} (height normalised to 1)")

    if preview:
        from headpreview import sheet
        PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
        p = PREVIEW_DIR / f"{head.id}-preview.png"
        sheet(pos, uv, idx, np.asarray(tex)).save(p)
        print(f"  preview  {p}")


def credits() -> None:
    lines = [
        "# Head model credits",
        "",
        "`sam-head.glb` and `dario-head.glb` are 3D reconstructions produced by",
        "Tripo image-to-3D from the same CC BY 2.0 press photographs the face",
        "textures use, then cut at the neck and decimated by",
        "`scripts/build-heads.py`.",
        "",
        "Because they are derived from those photographs, the CC BY attribution",
        "carries over to them — see `public/faces/CREDITS.md` for the sources and",
        "authors, and keep the credit line on the main menu.",
        "",
        "## `glove.glb`, `shoe.glb`",
        "",
        "Generated from a text prompt by Tripo text-to-3D and processed by",
        "`scripts/build-gear.py`. These derive from no photograph and carry no",
        "attribution obligation — the CC BY notice above covers the heads only, so",
        "do not read it as applying to everything in this directory.",
        "",
        "CEO Clash is an unaffiliated parody. The people depicted have not",
        "endorsed it and are not associated with it.",
        "",
    ]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "CREDITS.md").write_text("\n".join(lines))


if __name__ == "__main__":
    args = sys.argv[1:]
    only = [a for a in args if not a.startswith("-")]
    for h in HEADS:
        if only and h.id not in only:
            continue
        build(h, "--regenerate" in args, "--preview" in args)
    credits()
