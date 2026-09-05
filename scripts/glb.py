"""
Minimal glTF-binary reader and writer, with no dependency on a 3D library.

Just enough of the format to do the one thing the asset scripts need: pull the
single textured mesh out of whatever a generator hands back, and write a much
smaller one back out. Everything the reader ignores — scene graphs, cameras,
animations, extra materials, PBR maps we do not light with — is exactly what
makes the shipped files a tenth of the size of the raw ones.

Imported by build-heads.py and build-gear.py; not meant to be run.
"""

from __future__ import annotations

import io
import json
import struct
from pathlib import Path

import numpy as np
from PIL import Image

# glTF component type -> struct format character, and element type -> width.
_COMP = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}
_N = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def read_glb(path: Path):
    """Returns (positions, normals, uvs, triangles, texture) for the first mesh.

    Assumes one primitive with an embedded base-colour image, which is what
    every generator in this project produces.
    """
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
        # Interleaved attributes have to be walked element by element; tightly
        # packed ones are a single reinterpret of the buffer.
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


def write_glb(path: Path, pos, nrm, uv, idx, texture: Image.Image, name: str,
              generator: str = "ceo-clash") -> None:
    """One mesh, one material, one texture — everything else the generator
    shipped is dropped, which is most of why the file gets so much smaller."""
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
        # Every bufferView has to start on a 4-byte boundary.
        pad = (-len(blob)) % 4
        bin_chunk += b"\0" * pad
        offset += pad

    def bounds(a):
        return a.min(0).tolist(), a.max(0).tolist()

    pos_min, pos_max = bounds(pos)
    gltf = {
        "asset": {"version": "2.0", "generator": generator},
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


def compact(pos, nrm, uv, idx):
    """Drop the vertices no triangle references any more, and renumber."""
    used = np.unique(idx)
    remap = np.full(len(pos), -1, np.int64)
    remap[used] = np.arange(len(used))
    return pos[used], nrm[used], uv[used], remap[idx].astype(np.uint32)


def yaw_matrix(radians: float) -> np.ndarray:
    """Rotation about +Y, for baking a generator's arbitrary facing into the
    vertices so the shipped asset is correct on its own terms rather than
    relying on a magic number somewhere in the scene."""
    c, s = np.cos(radians), np.sin(radians)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]], np.float32)
