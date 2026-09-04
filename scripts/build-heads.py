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

import io
import json
import struct
import sys
import time
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "models"
# Everything intermediate lives under the repo's existing git-ignored bucket for
# generated 3D sources, so nothing here needs its own .gitignore entry.
SOURCE_DIR = ROOT / "assets" / "source" / "heads"
PREVIEW_DIR = SOURCE_DIR
FACE_CACHE = ROOT / "assets" / "source" / "faces"
API = "https://api.tripo3d.ai/v2/openapi"

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


def _key() -> str:
    for line in (ROOT / ".env").read_text().splitlines():
        if line.startswith("TRIPO_API_KEY="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("TRIPO_API_KEY missing from .env")


def _post(path: str, payload: dict, key: str) -> dict:
    req = urllib.request.Request(
        f"{API}/{path}",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        body = json.load(r)
    if body.get("code") != 0:
        raise SystemExit(f"tripo {path} failed: {body}")
    return body["data"]


def _await(task_id: str, key: str, label: str) -> dict:
    while True:
        req = urllib.request.Request(
            f"{API}/task/{task_id}", headers={"Authorization": f"Bearer {key}"}
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            d = json.load(r)["data"]
        if d["status"] == "success":
            return d["output"]
        if d["status"] in ("failed", "cancelled", "banned", "unknown"):
            raise SystemExit(f"{label} {d['status']}: {d}")
        print(f"    {label} {d['status']} {d.get('progress', '')}%")
        time.sleep(8)


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
    key = _key()
    photo = head_photo(head)
    print(f"  uploading {photo.name}")

    boundary = "----ceoclash"
    body = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; "
        f"filename=\"{photo.name}\"\r\nContent-Type: image/png\r\n\r\n".encode()
        + photo.read_bytes()
        + f"\r\n--{boundary}--\r\n".encode()
    )
    req = urllib.request.Request(
        f"{API}/upload",
        data=body,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        token = json.load(r)["data"]["image_token"]

    task = _post("task", {
        "type": "image_to_model",
        "file": {"type": "png", "file_token": token},
        "texture": True,
        "pbr": False,
    }, key)["task_id"]
    _await(task, key, "generate")

    # face_limit is ignored by image_to_model but honoured by the conversion
    # task, which is also the only one that decimates without wrecking the UVs.
    # Note "GLTF" — "GLB" is rejected, though a .glb is what comes back.
    conv = _post("task", {
        "type": "convert_model",
        "original_model_task_id": task,
        "format": "GLTF",
        "face_limit": TRI_TARGET,
        "texture_size": 1024,
    }, key)["task_id"]
    out = _await(conv, key, "decimate")

    urllib.request.urlretrieve(out["model"], raw)
    print(f"  saved  {raw.relative_to(ROOT)} ({raw.stat().st_size // 1024} kB)")
    return raw


# ------------------------------------------------------------------- gltf io

_COMP = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}
_N = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def read_glb(path: Path):
    b = path.read_bytes()
    assert b[:4] == b"glTF", f"{path} is not a GLB"
    off, chunks = 12, []
    while off < len(b):
        clen, ctype = struct.unpack_from("<II", b, off)
        chunks.append((ctype, off + 8, clen))
        off += 8 + clen
    j = json.loads(b[chunks[0][1]: chunks[0][1] + chunks[0][2]])
    bin_start = chunks[1][1]

    def view(i):
        v = j["bufferViews"][i]
        s = bin_start + v.get("byteOffset", 0)
        return b[s: s + v["byteLength"]], v.get("byteStride")

    def acc(i):
        a = j["accessors"][i]
        raw, stride = view(a["bufferView"])
        n, fmt = _N[a["type"]], _COMP[a["componentType"]]
        item = np.dtype(fmt).itemsize * n
        start = a.get("byteOffset", 0)
        if stride and stride != item:
            out = np.zeros((a["count"], n), np.dtype(fmt))
            for k in range(a["count"]):
                out[k] = np.frombuffer(raw, fmt, n, start + k * stride)
        else:
            out = np.frombuffer(raw, fmt, a["count"] * n, start).reshape(a["count"], n)
        return np.array(out)

    prim = j["meshes"][0]["primitives"][0]
    pos = acc(prim["attributes"]["POSITION"]).astype(np.float32)
    nrm = acc(prim["attributes"]["NORMAL"]).astype(np.float32)
    uv = acc(prim["attributes"]["TEXCOORD_0"]).astype(np.float32)
    idx = acc(prim["indices"]).reshape(-1, 3).astype(np.uint32)
    img_raw, _ = view(j["images"][0]["bufferView"])
    return pos, nrm, uv, idx, Image.open(io.BytesIO(img_raw)).convert("RGB")


def write_glb(path: Path, pos, nrm, uv, idx, texture: Image.Image, name: str):
    """One mesh, one material, one texture — everything else Tripo shipped is
    dropped, which is most of why the file gets so much smaller."""
    jpeg = io.BytesIO()
    texture.save(jpeg, format="JPEG", quality=90, optimize=True, progressive=True)
    jpeg = jpeg.getvalue()

    small = len(pos) <= 65535
    idx_data = (idx.astype(np.uint16) if small else idx.astype(np.uint32)).tobytes()
    blobs = [pos.astype("<f4").tobytes(), nrm.astype("<f4").tobytes(),
             uv.astype("<f4").tobytes(), idx_data, jpeg]

    bin_chunk, views, offset = bytearray(), [], 0
    for i, blob in enumerate(blobs):
        bin_chunk += blob
        views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(blob)})
        if i < 3:
            views[-1]["target"] = 34962  # ARRAY_BUFFER
        elif i == 3:
            views[-1]["target"] = 34963  # ELEMENT_ARRAY_BUFFER
        offset += len(blob)
        pad = (-len(blob)) % 4
        bin_chunk += b"\0" * pad
        offset += pad

    def bounds(a):
        return a.min(0).tolist(), a.max(0).tolist()

    pos_min, pos_max = bounds(pos)
    gltf = {
        "asset": {"version": "2.0", "generator": "ceo-clash scripts/build-heads.py"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": name}],
        "meshes": [{"name": name, "primitives": [{
            "attributes": {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2},
            "indices": 3, "material": 0,
        }]}],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": len(pos), "type": "VEC3",
             "min": pos_min, "max": pos_max},
            {"bufferView": 1, "componentType": 5126, "count": len(nrm), "type": "VEC3"},
            {"bufferView": 2, "componentType": 5126, "count": len(uv), "type": "VEC2"},
            {"bufferView": 3, "componentType": 5123 if small else 5125,
             "count": idx.size, "type": "SCALAR"},
        ],
        "bufferViews": views,
        "buffers": [{"byteLength": len(bin_chunk)}],
        "materials": [{
            "name": name,
            "pbrMetallicRoughness": {
                "baseColorTexture": {"index": 0},
                "metallicFactor": 0.0,
                "roughnessFactor": 0.85,
            },
            "doubleSided": False,
        }],
        "textures": [{"source": 0, "sampler": 0}],
        "images": [{"bufferView": 4, "mimeType": "image/jpeg"}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
    }

    json_chunk = json.dumps(gltf, separators=(",", ":")).encode()
    json_chunk += b" " * ((-len(json_chunk)) % 4)
    total = 12 + 8 + len(json_chunk) + 8 + len(bin_chunk)
    with open(path, "wb") as f:
        f.write(b"glTF" + struct.pack("<II", 2, total))
        f.write(struct.pack("<II", len(json_chunk), 0x4E4F534A) + json_chunk)
        f.write(struct.pack("<II", len(bin_chunk), 0x004E4942) + bytes(bin_chunk))


# ------------------------------------------------------------------ process


def process(head: Head, raw: Path) -> tuple:
    pos, nrm, uv, idx, tex = read_glb(raw)
    tris_before = len(idx)

    # 1. Yaw so the face looks down +Z like the rest of the rig. Doing this
    #    first means the neck cut below can be described in the rig's own terms
    #    — "higher at the back" — instead of Tripo's.
    c, s = np.cos(FACE_AXIS_YAW), np.sin(FACE_AXIS_YAW)
    R = np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]], np.float32)
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
    used = np.unique(idx)
    remap = np.full(len(pos), -1, np.int64)
    remap[used] = np.arange(len(used))
    pos, nrm, uv, idx = pos[used], nrm[used], uv[used], remap[idx].astype(np.uint32)

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
    write_glb(out, pos, nrm, uv, idx, tex, f"{head.id}_head")
    print(f"  raw      {tris_before} tris, {raw.stat().st_size // 1024} kB")
    print(f"  shipped  {len(idx)} tris, {len(pos)} verts, "
          f"{out.stat().st_size // 1024} kB -> {out.relative_to(ROOT)}")
    print(f"  extent   {np.round(pos.max(0) - pos.min(0), 3).tolist()} (height normalised to 1)")

    if preview:
        # No __pycache__ litter in scripts/ for a one-shot debug helper.
        sys.dont_write_bytecode = True
        sys.path.insert(0, str(ROOT / "scripts"))
        from headpreview import sheet  # noqa: E402
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
