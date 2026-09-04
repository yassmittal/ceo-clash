#!/usr/bin/env python3
"""
Builds the fighters' face textures from freely-licensed press photos.

Both source photos are CC BY 2.0 from Wikimedia Commons, so this is a legitimate
derivative as long as the attribution in public/faces/CREDITS.md ships with the
game. Nothing here is checked against a face detector — the crop boxes below were
eyeballed once against the source images and are stored as fractions of the
source, so they survive a re-download at any resolution.

    python3 scripts/build-faces.py

Writes public/faces/{sam,dario}.webp and prints the skin/hair colours it sampled,
which are the numbers that live in src/characters/{Sam,Dario}.ts.
"""

from __future__ import annotations

import io
import sys
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageStat

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "faces"
CACHE_DIR = ROOT / ".cache" / "faces"
SIZE = 512
UA = "ceo-clash/0.1 (personal parody game; contact via repo)"


@dataclass(frozen=True)
class Face:
    id: str
    # Commons file name, without the "File:" prefix.
    commons_file: str
    author: str
    license: str
    license_url: str
    source_url: str
    # Crop box as fractions of the source image (left, top, right, bottom).
    # Framed a little above the brow so a sliver of hair meets the rig's hair
    # block, down to just under the chin.
    crop: tuple[float, float, float, float]
    # Per-photo exposure trim, applied before the shared grade. The two sources
    # are from different rooms under different lights; this is what makes them
    # look like they were shot for the same game.
    exposure: float
    # Where to sample the skin (the jaw, the most neutrally lit patch) and the
    # hair, as fractions of the graded texture — so the colours match what the
    # head actually wears, not the raw photo.
    skin_at: tuple[float, float]
    hair_at: tuple[float, float]


FACES = [
    Face(
        id="sam",
        commons_file="Sam Altman speaking at TED (cropped).jpg",
        author="Steve Jurvetson",
        license="CC BY 2.0",
        license_url="https://creativecommons.org/licenses/by/2.0/",
        source_url="https://commons.wikimedia.org/wiki/File:Sam_Altman_speaking_at_TED_(cropped).jpg",
        crop=(0.338, 0.210, 0.643, 0.535),
        exposure=1.04,
        skin_at=(0.50, 0.82),
        hair_at=(0.14, 0.10),
    ),
    Face(
        id="dario",
        commons_file="Dario Amodei at TechCrunch Disrupt 2023 01 (cropped 2).jpg",
        author="TechCrunch",
        license="CC BY 2.0",
        license_url="https://creativecommons.org/licenses/by/2.0/",
        source_url="https://commons.wikimedia.org/wiki/File:Dario_Amodei_at_TechCrunch_Disrupt_2023_01_(cropped_2).jpg",
        crop=(0.224, 0.170, 0.696, 0.535),
        exposure=0.90,
        skin_at=(0.50, 0.86),
        hair_at=(0.16, 0.14),
    ),
]


def fetch(face: Face) -> Image.Image:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cached = CACHE_DIR / f"{face.id}-source.jpg"
    if not cached.exists():
        name = urllib.parse.quote(face.commons_file.replace(" ", "_"))
        url = f"https://commons.wikimedia.org/wiki/Special:FilePath/{name}"
        print(f"  downloading {face.commons_file}")
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=60) as resp:
            cached.write_bytes(resp.read())
    return Image.open(io.BytesIO(cached.read_bytes())).convert("RGB")


def sample(img: Image.Image, at: tuple[float, float], radius: int = 30) -> str:
    """Median colour of a patch. Median, not mean, so a specular highlight on a
    cheek cannot drag the whole tone towards white."""
    x, y = int(at[0] * img.width), int(at[1] * img.height)
    patch = img.crop((x - radius, y - radius, x + radius, y + radius))
    r, g, b = (round(v) for v in ImageStat.Stat(patch).median[:3])
    return f"#{r:02x}{g:02x}{b:02x}"


def vignette(img: Image.Image, floor: float = 0.52, start: int = 162) -> Image.Image:
    """Darken the outer edge of the crop.

    The two photos were taken against completely different backdrops — a green
    stage wash and a black one — and whatever survives the crop at the ears and
    the temples ends up as a bright halo running down the edge of the head
    block. Rolling the corners off hides both backdrops in the same shadow and,
    as a bonus, gives the flat cube face a bit of shading.
    """
    ramp = Image.radial_gradient("L").resize(img.size, Image.Resampling.BILINEAR)
    mask = ramp.point(
        lambda v: 255
        if v <= start
        else round(255 * (1 - (1 - floor) * (v - start) / (255 - start)))
    )
    return ImageChops.multiply(img, Image.merge("RGB", (mask, mask, mask)))


def square(box: tuple[int, int, int, int], w: int, h: int) -> tuple[int, int, int, int]:
    """Grow the shorter side of the crop so the texture is never stretched."""
    left, top, right, bottom = box
    cx, cy = (left + right) / 2, (top + bottom) / 2
    side = max(right - left, bottom - top)
    half = side / 2
    # Keep the box inside the image, shrinking rather than letting it hang off.
    half = min(half, cx, cy, w - cx, h - cy)
    return (round(cx - half), round(cy - half), round(cx + half), round(cy + half))


def build(face: Face) -> None:
    print(f"{face.id}:")
    src = fetch(face)
    l, t, r, b = face.crop
    box = square(
        (round(l * src.width), round(t * src.height), round(r * src.width), round(b * src.height)),
        src.width,
        src.height,
    )
    img = src.crop(box).resize((SIZE, SIZE), Image.Resampling.LANCZOS)

    # The arena is lit blue and the head is ~60px on screen, so the texture
    # needs more saturation and bite than the photo has if it is to survive
    # being washed with ambient light at that size.
    img = ImageEnhance.Brightness(img).enhance(face.exposure)
    img = ImageEnhance.Color(img).enhance(1.30)
    img = ImageEnhance.Contrast(img).enhance(1.16)
    img = img.filter(ImageFilter.UnsharpMask(radius=3, percent=120, threshold=3))

    # Sampled off the graded face but *before* the vignette, so the neck and
    # forearms match the middle of the face rather than its shaded rim.
    skin, hair = sample(img, face.skin_at), sample(img, face.hair_at)
    img = vignette(img)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    # WebP, not PNG: these are photographs, and lossless costs ~340kB each for
    # detail that is invisible on a head roughly 60px tall. Every browser that
    # can run WebGL2 can decode WebP, and three's TextureLoader goes through an
    # <img> so it never has to know the difference.
    out = OUT_DIR / f"{face.id}.webp"
    img.save(out, quality=88, method=6)
    print(f"  crop     {box} of {src.width}x{src.height}")
    print(f"  wrote    {out.relative_to(ROOT)} ({out.stat().st_size // 1024} kB)")
    print(f"  skin     {skin}   <- colors.skin")
    print(f"  hair     {hair}   <- colors.hair")


def credits() -> None:
    lines = [
        "# Face texture credits",
        "",
        "The fighters' faces are cropped from freely-licensed press photographs.",
        "Both are used under CC BY 2.0, which permits derivative and commercial use",
        "**provided the attribution below is kept**. Regenerate with",
        "`python3 scripts/build-faces.py`.",
        "",
    ]
    for f in FACES:
        lines += [
            f"## `{f.id}.webp`",
            "",
            f"- Source: [{f.commons_file}]({f.source_url})",
            f"- Author: {f.author}",
            f"- License: [{f.license}]({f.license_url})",
            "- Changes: cropped to the face, resized, exposure/contrast/saturation",
            "  adjusted, edges darkened.",
            "",
        ]
    lines += [
        "---",
        "",
        "CEO Clash is an unaffiliated parody. The people depicted have not endorsed",
        "it and are not associated with it.",
        "",
    ]
    path = OUT_DIR / "CREDITS.md"
    path.write_text("\n".join(lines))
    print(f"wrote {path.relative_to(ROOT)}")


if __name__ == "__main__":
    for f in FACES:
        if len(sys.argv) > 1 and f.id not in sys.argv[1:]:
            continue
        build(f)
    credits()
