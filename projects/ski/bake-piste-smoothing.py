"""Bake a feathered smoothing adjustment for the mapped piste surface."""
import gzip
import json
from pathlib import Path

import numpy as np

DATA = Path(__file__).resolve().parent / "data"
SIGMA = 3
FILTER_RADIUS = 9
FEATHER_METERS = 5
MAX_OFFSET_CM = 75


def gaussian(elevation):
    weights = np.exp(-0.5 * (np.arange(-FILTER_RADIUS, FILTER_RADIUS + 1) / SIGMA) ** 2)
    weights = (weights / weights.sum()).astype(np.float32)
    result = elevation.astype(np.float32)
    for axis in (0, 1):
        padded = np.pad(result, [(FILTER_RADIUS, FILTER_RADIUS) if a == axis else (0, 0)
                                for a in (0, 1)], mode="edge")
        length = result.shape[axis]
        result.fill(0)
        for i, weight in enumerate(weights):
            samples = padded[i:i + length] if axis == 0 else padded[:, i:i + length]
            result += samples * weight
    return result


def feather(mask):
    # Erode inward one metre at a time. The outer row receives zero adjustment.
    interior = mask
    distance = np.zeros(mask.shape, dtype=np.uint8)
    for _ in range(FEATHER_METERS):
        remaining = np.zeros_like(mask)
        remaining[1:-1, 1:-1] = (
            interior[1:-1, 1:-1] & interior[:-2, 1:-1] & interior[2:, 1:-1]
            & interior[1:-1, :-2] & interior[1:-1, 2:]
            & interior[:-2, :-2] & interior[:-2, 2:] & interior[2:, :-2] & interior[2:, 2:]
        )
        interior = remaining
        distance += interior
    t = distance.astype(np.float32) / FEATHER_METERS
    return t * t * (3 - 2 * t)


def main():
    manifest = DATA / "mount-snow-1m.json"
    meta = json.loads(manifest.read_text())
    pistes = json.loads((DATA / "mount-snow-pistes.json").read_text())
    if meta["spacingMeters"] != 1 or meta["elevationScaleMeters"] != 0.01:
        raise ValueError("Piste smoothing requires metre cells and centimetre elevation codes")
    base = np.frombuffer(gzip.decompress((DATA / meta["asset"]).read_bytes()), dtype="<u2")
    base = base.reshape(meta["rows"], meta["columns"])
    source = np.frombuffer(gzip.decompress((DATA / pistes["asset"]).read_bytes()), dtype="uint8")
    source = source.reshape(pistes["rows"], pistes["columns"])
    spacing = pistes["spacingMeters"]
    col = np.minimum(((np.arange(meta["columns"]) + spacing / 2) / spacing).astype(int), pistes["columns"] - 1)
    row = np.minimum(((np.arange(meta["rows"]) + spacing / 2) / spacing).astype(int), pistes["rows"] - 1)
    mask = source[row[:, None], col] != 0
    offset = np.clip(gaussian(base) - base, -MAX_OFFSET_CM, MAX_OFFSET_CM)
    offset = np.rint(offset * feather(mask)).astype("int8").ravel()
    indices = np.flatnonzero(offset)
    patches = np.empty(len(indices), dtype=[("index", "<u4"), ("delta", "i1")])
    patches["index"] = indices
    patches["delta"] = offset[indices]
    asset = "mount-snow-piste-adjustments.bin.gz"
    (DATA / asset).write_bytes(gzip.compress(patches.tobytes(), mtime=0))
    meta["pisteAdjustmentAsset"] = asset
    manifest.write_text(json.dumps(meta, indent=2) + "\n")
    print(f"Smoothed {len(indices):,} grid samples, max adjustment {np.abs(offset).max()} cm")


if __name__ == "__main__":
    main()
