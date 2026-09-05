"""
The slice of the Tripo v2 API the asset scripts use.

Two quirks are baked in here rather than rediscovered:

  * `face_limit` is ignored by the generation tasks but honoured by
    `convert_model`, which is also the only one that decimates without wrecking
    the UVs. So every model is generated at full density and then converted.
  * `convert_model` rejects `format: "GLB"`. It wants `"GLTF"` — and hands back
    a .glb regardless.

Imported by build-heads.py and build-gear.py; not meant to be run. Every call
in here spends credits except `await_task`.
"""

from __future__ import annotations

import json
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = "https://api.tripo3d.ai/v2/openapi"

# Tripo sits behind Cloudflare, which blocks urllib's default "Python-urllib/x.y"
# signature outright — every endpoint, including user/balance, comes back as
# HTTP 403 "error code: 1010". A normal browser User-Agent is all it wants.
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"


def api_key() -> str:
    for line in (ROOT / ".env").read_text().splitlines():
        if line.startswith("TRIPO_API_KEY="):
            # .env values are sometimes quoted and sometimes not. Sending the
            # quotes along produces a plain "Authentication failed" that looks
            # exactly like an expired key, so strip them here rather than
            # debugging it a second time.
            return line.split("=", 1)[1].strip().strip("\"'")
    raise SystemExit("TRIPO_API_KEY missing from .env")


def post(path: str, payload: dict, key: str) -> dict:
    req = urllib.request.Request(
        f"{API}/{path}",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                 "User-Agent": UA},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = json.load(r)
    except urllib.error.HTTPError as e:
        # Tripo puts the useful part in the response body, which urllib hides
        # behind a bare "HTTP Error 403: Forbidden" unless you go and read it.
        raise SystemExit(f"tripo {path} HTTP {e.code}: {e.read().decode()[:400]}") from None
    if body.get("code") != 0:
        raise SystemExit(f"tripo {path} failed: {body}")
    return body["data"]


def await_task(task_id: str, key: str, label: str) -> dict:
    while True:
        req = urllib.request.Request(
            f"{API}/task/{task_id}",
            headers={"Authorization": f"Bearer {key}", "User-Agent": UA},
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            d = json.load(r)["data"]
        if d["status"] == "success":
            return d["output"]
        if d["status"] in ("failed", "cancelled", "banned", "unknown"):
            raise SystemExit(f"{label} {d['status']}: {d}")
        print(f"    {label} {d['status']} {d.get('progress', '')}%")
        time.sleep(8)


def upload_image(path: Path, key: str) -> str:
    """Uploads a PNG and returns the token that image-to-3D wants."""
    boundary = "----ceoclash"
    body = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; "
        f"filename=\"{path.name}\"\r\nContent-Type: image/png\r\n\r\n".encode()
        + path.read_bytes()
        + f"\r\n--{boundary}--\r\n".encode()
    )
    req = urllib.request.Request(
        f"{API}/upload",
        data=body,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "User-Agent": UA,
        },
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)["data"]["image_token"]


def decimate(task_id: str, key: str, tri_target: int, texture_size: int, out: Path) -> Path:
    """Runs a generation task's result through convert_model and downloads it."""
    conv = post("task", {
        "type": "convert_model",
        "original_model_task_id": task_id,
        "format": "GLTF",
        "face_limit": tri_target,
        "texture_size": texture_size,
    }, key)["task_id"]
    result = await_task(conv, key, "decimate")
    download(result["model"], out)
    return out


def download(url: str, out: Path) -> Path:
    """urlretrieve would send the blocked default User-Agent here too."""
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=300) as r:
        out.write_bytes(r.read())
    return out
