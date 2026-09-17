# Head model credits

Each `<id>-head.glb` is a 3D reconstruction produced by Tripo image-to-3D
from the same photograph its face texture uses, then cut at the neck and
decimated by `scripts/build-heads.py`. Because a head is derived from that
photograph, the photo's licence carries over to it: CC BY attribution is
owed, a CC BY-SA photo makes the head CC BY-SA too, and a public domain
photo owes nothing (it is credited anyway). Keep the credit line on the
main menu. See `public/faces/CREDITS.md` for the full source of each.

## `sam-head.glb`

- Source photo: [Sam Altman speaking at TED (cropped).jpg](https://commons.wikimedia.org/wiki/File:Sam_Altman_speaking_at_TED_(cropped).jpg)
- Author: Steve Jurvetson
- License: [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/)
- Changes: reconstructed in 3D by Tripo, cut at the neck, decimated,
  texture re-graded.

## `dario-head.glb`

- Source photo: [Dario Amodei at TechCrunch Disrupt 2023 01 (cropped 2).jpg](https://commons.wikimedia.org/wiki/File:Dario_Amodei_at_TechCrunch_Disrupt_2023_01_(cropped_2).jpg)
- Author: TechCrunch
- License: [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/)
- Changes: reconstructed in 3D by Tripo, cut at the neck, decimated,
  texture re-graded.

Fighters with no head model yet (`trump`, `elon`, `zuck`, `cook`) wear the blocky fallback head, textured with their face photo.

## `glove.glb`, `shoe.glb`

Generated from a text prompt by Tripo text-to-3D and processed by
`scripts/build-gear.py`. These derive from no photograph and carry no
attribution obligation. The notices above cover the heads only, so do
not read them as applying to everything in this directory.

CEO Clash is an unaffiliated parody. The people depicted have not
endorsed it and are not associated with it.
