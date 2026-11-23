"""Bake fixed northwest sunlight across the runtime elevation grid."""
import gzip
import json
from pathlib import Path

import numpy as np

DATA = Path(__file__).resolve().parent / "data"
STEP = 4
SUN_ALTITUDE = 15

meta = json.loads((DATA / "mount-snow-1m.json").read_text())
grid = np.frombuffer(gzip.decompress((DATA / meta["asset"]).read_bytes()), dtype="<u2")
height = grid.reshape(meta["rows"], meta["columns"])[::STEP, ::STEP].astype(np.float32)
height *= meta["elevationScaleMeters"]

# Track the highest incoming ray along each NW-to-SE grid diagonal.
drop = np.sqrt(2) * STEP * np.tan(np.deg2rad(SUN_ALTITUDE))
horizon = height[0].copy()
light = np.full(height.shape, 255, dtype=np.uint8)
for row in range(1, height.shape[0]):
    incoming = horizon[:-1] - drop
    light[row, 1:] = np.where(incoming > height[row, 1:] + 0.2, 0, 255)
    horizon[1:] = np.maximum(height[row, 1:], incoming)
    horizon[0] = height[row, 0]

(DATA / "mount-snow-sun.u8.gz").write_bytes(gzip.compress(light.tobytes(), mtime=0))
