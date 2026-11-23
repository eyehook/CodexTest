"""Prepare the Mount Snow elevation crop and browser height grid."""
from concurrent.futures import ThreadPoolExecutor
import gzip
import json
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.warp import reproject, transform_bounds
from rasterio.windows import Window

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "source" / "mount-snow-35cm.tif"
DATA = ROOT / "data"
BASE = "https://vtopendata-prd.s3.us-east-2.amazonaws.com/Elevation/_Tiles/LIDAR/0_35M/2023/DEMHF/"
CRS = "EPSG:6589"
WGS84_BOUNDS = (-72.940, 42.945, -72.875, 42.980)
NODATA = -999999
NATIVE_STEP = 0.35


def tile_windows(bounds):
    west, south, east, north = bounds
    # The statewide 1,400 m tile grid has edges at (0, 0) plus tile multiples.
    for bottom in range(int(np.floor(south / 1400)) * 1400, int(np.ceil(north)), 1400):
        for left in range(int(np.floor(west / 1400)) * 1400, int(np.ceil(east)), 1400):
            center_n = (bottom + 700) // 100
            center_e = (left + 700) // 100
            name = f"Elevation_DEMHF0p35M2023_N{center_n}E{center_e}.tif"
            top = bottom + 1400
            col = max(0, round((west - left) / NATIVE_STEP))
            row = max(0, round((top - north) / NATIVE_STEP))
            end_col = min(4000, round((east - left) / NATIVE_STEP))
            end_row = min(4000, round((top - south) / NATIVE_STEP))
            yield name, left, top, Window(col, row, end_col - col, end_row - row)


def read_tile(task):
    name, left, top, window = task
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_MAX_RETRY="3"):
        with rasterio.open(BASE + name) as tile:
            expected = from_origin(left, top, NATIVE_STEP, NATIVE_STEP)
            if tile.crs.to_epsg() != 6589 or not tile.transform.almost_equals(expected):
                raise ValueError(f"Unexpected source georeferencing in {name}")
            return tile.read(1, window=window), tile.window_transform(window)


def acquire(bounds):
    west, south, east, north = bounds
    # Round outward to the native grid, leaving room for runtime interpolation.
    left = np.floor(west / NATIVE_STEP) * NATIVE_STEP
    top = np.ceil(north / NATIVE_STEP) * NATIVE_STEP
    width = int(np.ceil((east - left) / NATIVE_STEP))
    height = int(np.ceil((top - south) / NATIVE_STEP))
    tasks = list(tile_windows((left, top - height * NATIVE_STEP, left + width * NATIVE_STEP, top)))
    temporary = SOURCE.with_suffix(".tmp")
    try:
        with rasterio.open(
            temporary, "w", driver="GTiff", width=width, height=height,
            count=1, dtype="float32", crs=CRS, nodata=NODATA,
            transform=from_origin(left, top, NATIVE_STEP, NATIVE_STEP),
            tiled=True, compress="deflate", predictor=3,
        ) as output, ThreadPoolExecutor(max_workers=6) as pool:
            for pixels, transform in pool.map(read_tile, tasks):
                col = round((transform.c - left) / NATIVE_STEP)
                row = round((top - transform.f) / NATIVE_STEP)
                output.write(pixels, 1, window=Window(col, row, pixels.shape[1], pixels.shape[0]))
        temporary.replace(SOURCE)
    finally:
        temporary.unlink(missing_ok=True)


def build_grid(bounds, names):
    west, south, east, north = bounds
    columns, rows = east - west + 1, north - south + 1
    heights = np.empty((rows, columns), dtype=np.float32)
    with rasterio.open(SOURCE) as source:
        reproject(
            rasterio.band(source, 1), heights,
            dst_transform=from_origin(west - 0.5, north + 0.5, 1, 1),
            dst_crs=CRS, dst_nodata=NODATA, resampling=Resampling.bilinear,
        )
    if not np.isfinite(heights).all() or (heights == NODATA).any():
        raise ValueError("The runtime grid contains missing elevations")
    minimum, maximum = float(heights.min()), float(heights.max())
    offset = int(np.floor(minimum))
    scale = 0.01
    codes = np.rint((heights.astype(np.float64) - offset) / scale)
    if codes.max() > 65535:
        raise ValueError("The elevation range exceeds the uint16 encoding")
    encoded = codes.astype("<u2")
    payload = gzip.compress(encoded.tobytes(), compresslevel=6, mtime=0)
    (DATA / "mount-snow-1m.u16.gz").write_bytes(payload)
    metadata = {
        "asset": "mount-snow-1m.u16.gz",
        "encoding": "gzip-compressed row-major uint16 little-endian",
        "columns": columns, "rows": rows, "spacingMeters": 1,
        "firstSampleEasting": west, "firstSampleNorthing": north,
        "horizontalCrs": CRS, "verticalDatum": "NAVD88 (GEOID18)",
        "elevationOffsetMeters": offset, "elevationScaleMeters": scale,
        "minimumElevationMeters": minimum, "maximumElevationMeters": maximum,
        "provisionalBoundsWgs84": WGS84_BOUNDS,
        "sourceDataset": "VCGI/USGS 3DEP 2023 QL1 Hydro-Flattened Bare-Earth DEM",
        "sourceSpacingMeters": NATIVE_STEP,
        "sourceTileBaseUrl": BASE, "sourceTiles": names,
    }
    (DATA / "mount-snow-1m.json").write_text(json.dumps(metadata, indent=2) + "\n")


def main():
    west, south, east, north = transform_bounds("EPSG:4326", CRS, *WGS84_BOUNDS)
    bounds = (int(np.floor(west)), int(np.floor(south)), int(np.ceil(east)), int(np.ceil(north)))
    padded = tuple(value + pad for value, pad in zip(bounds, (-2, -2, 2, 2)))
    tasks = list(tile_windows(padded))
    SOURCE.parent.mkdir(exist_ok=True)
    DATA.mkdir(exist_ok=True)
    if not SOURCE.exists():
        acquire(padded)
    build_grid(bounds, [task[0] for task in tasks])


if __name__ == "__main__":
    main()
