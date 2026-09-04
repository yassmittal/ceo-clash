"""Throwaway software rasteriser used only by `build-heads.py --preview`, so a
processed head can be checked from four sides without opening the game."""
import numpy as np
from PIL import Image


def render(P, UV, F, tex, yaw=0.0, pitch=0.0, size=460):
    cy, sy = np.cos(yaw), np.sin(yaw)
    cp, sp = np.cos(pitch), np.sin(pitch)
    R = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]) @ np.array([[1, 0, 0], [0, cp, -sp], [0, sp, cp]])
    V = P @ R.T
    lo, hi = V.min(0), V.max(0)
    c, s = (lo + hi) / 2, (hi - lo).max()
    V = (V - c) / s
    x = (V[:, 0] * size * 0.86 + size / 2)
    y = (-V[:, 1] * size * 0.86 + size / 2)
    z = V[:, 2]

    img = np.full((size, size, 3), 250, np.uint8)
    zb = np.full((size, size), -1e9)
    order = np.argsort(z[F].mean(1))
    for f in F[order]:
        px, py, pz = x[f], y[f], z[f]
        x0, x1 = int(max(0, np.floor(px.min()))), int(min(size - 1, np.ceil(px.max())))
        y0, y1 = int(max(0, np.floor(py.min()))), int(min(size - 1, np.ceil(py.max())))
        if x1 < x0 or y1 < y0:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        d = (py[1] - py[2]) * (px[0] - px[2]) + (px[2] - px[1]) * (py[0] - py[2])
        if abs(d) < 1e-9:
            continue
        w0 = ((py[1] - py[2]) * (gx - px[2]) + (px[2] - px[1]) * (gy - py[2])) / d
        w1 = ((py[2] - py[0]) * (gx - px[2]) + (px[0] - px[2]) * (gy - py[2])) / d
        w2 = 1 - w0 - w1
        m = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        if not m.any():
            continue
        zz = w0 * pz[0] + w1 * pz[1] + w2 * pz[2]
        sub = zb[y0:y1 + 1, x0:x1 + 1]
        vis = m & (zz > sub)
        if not vis.any():
            continue
        if tex is not None and UV is not None:
            u = w0 * UV[f[0], 0] + w1 * UV[f[1], 0] + w2 * UV[f[2], 0]
            v = w0 * UV[f[0], 1] + w1 * UV[f[1], 1] + w2 * UV[f[2], 1]
            tu = np.clip((u * tex.shape[1]).astype(int), 0, tex.shape[1] - 1)
            tv = np.clip((v * tex.shape[0]).astype(int), 0, tex.shape[0] - 1)
            col = tex[tv, tu]
        else:
            col = np.full(m.shape + (3,), 170, np.uint8)
        sub[vis] = zz[vis]
        img[y0:y1 + 1, x0:x1 + 1][vis] = col[vis]
    return Image.fromarray(img)




def sheet(P, UV, F, tex, size=460):
    views = [0.0, np.pi / 2, np.pi, -np.pi / 2]   # front, right, back, left
    out = Image.new("RGB", (size * len(views), size), (250, 250, 250))
    for i, yaw in enumerate(views):
        out.paste(render(P.astype(np.float64), UV.astype(np.float64),
                         F.astype(np.int64), tex, yaw=yaw, size=size), (size * i, 0))
    return out
