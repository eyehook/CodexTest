"""Build a tree candidate coverage and height map from aligned Vermont lidar."""
import argparse
import gzip
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import xml.etree.ElementTree as ET

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.features import rasterize
from rasterio.transform import from_origin
from rasterio.warp import reproject, transform, transform_geom
from shapely import make_valid
from shapely.geometry import Point, shape

from prepare_dem import DATA, ROOT, SOURCE, acquire_grid

SURFACE = SOURCE.with_name("mount-snow-dsm-35cm.tif")
STRUCTURES = ROOT / "source" / "mount-snow-structures.geojson"
SPACING = 2
THRESHOLD = 5
PYLON_RADIUS = 3


def retain_structures(osm):
    root = ET.parse(osm).getroot()
    nodes = {node.get("id"): [float(node.get("lon")), float(node.get("lat"))]
             for node in root.findall("node")}
    features = []
    for element in root:
        tags = {tag.get("k"): tag.get("v") for tag in element.findall("tag")}
        if element.tag == "way" and tags.get("building") not in (None, "no"):
            refs = [node.get("ref") for node in element.findall("nd")]
            if len(refs) < 4 or refs[0] != refs[-1] or any(ref not in nodes for ref in refs):
                continue
            kind = "building"
            geometry = {"type": "Polygon", "coordinates": [[nodes[ref] for ref in refs]]}
        elif element.tag == "node" and tags.get("aerialway") == "pylon":
            kind = "pylon"
            geometry = {"type": "Point", "coordinates": nodes[element.get("id")]}
        else:
            continue
        features.append({"type": "Feature", "id": f"{element.tag}/{element.get('id')}",
                         "properties": {"kind": kind}, "geometry": geometry})
    snapshot = {"type": "FeatureCollection", "attribution": "© OpenStreetMap contributors",
                "license": "https://opendatacommons.org/licenses/odbl/1-0/", "features": features}
    STRUCTURES.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + "\n")


def structure_mask(crs, grid, dimensions):
    snapshot = json.loads(STRUCTURES.read_text())
    shapes = []
    for feature in snapshot["features"]:
        geometry = feature["geometry"]
        if feature["properties"]["kind"] == "pylon":
            lon, lat = geometry["coordinates"]
            x, y = transform("EPSG:4326", crs, [lon], [lat])
            shapes.append(Point(x[0], y[0]).buffer(PYLON_RADIUS))
        else:
            shapes.append(make_valid(shape(transform_geom("EPSG:4326", crs, geometry))))
    return rasterize(shapes, out_shape=dimensions, transform=grid, all_touched=True, dtype="uint8") != 0


def aggregate(ground, surface, grid, dimensions):
    if (ground.crs, ground.transform, ground.shape) != (surface.crs, surface.transform, surface.shape):
        raise ValueError("Native DSM grid does not match bare-earth crop")
    # Average the binary occupancy and positive candidate heights separately.
    # Dividing the second average by occupancy gives canopy height over covered pixels.
    with TemporaryDirectory() as directory:
        with rasterio.open(Path(directory) / "candidates.tif", "w+", driver="GTiff",
                           width=ground.width, height=ground.height, count=2, dtype="float32",
                           transform=ground.transform, crs=ground.crs, tiled=True) as candidates:
            for _, window in ground.block_windows():
                base = ground.read(1, window=window, masked=True)
                top = surface.read(1, window=window, masked=True)
                delta = top - base
                if np.ma.getmaskarray(delta).any() or not np.isfinite(delta.data).all():
                    raise ValueError(f"Missing native elevation samples in {window}")
                occupied = delta.data > THRESHOLD
                candidates.write(occupied.astype(np.float32), 1, window=window)
                candidates.write(np.where(occupied, delta.data, 0), 2, window=window)
            outputs = np.empty((2, *dimensions), dtype=np.float32)
            for band, output in enumerate(outputs, start=1):
                reproject(rasterio.band(candidates, band), output, dst_transform=grid,
                          dst_crs=ground.crs, resampling=Resampling.average)
    return outputs


def bake():
    metadata = json.loads((DATA / "mount-snow-1m.json").read_text())
    dimensions = tuple((metadata[key] + SPACING - 1) // SPACING for key in ("rows", "columns"))
    east, north = metadata["firstSampleEasting"], metadata["firstSampleNorthing"]
    grid = from_origin(east - SPACING / 2, north + SPACING / 2, SPACING, SPACING)
    with rasterio.open(SOURCE) as ground:
        if not SURFACE.exists():
            acquire_grid(SURFACE, ground.transform, ground.width, ground.height, "DSMFR")
        with rasterio.open(SURFACE) as surface:
            coverage, mean_all = aggregate(ground, surface, grid, dimensions)
        excluded = structure_mask(ground.crs, grid, dimensions)

    coverage[excluded] = 0
    canopy_height = np.divide(mean_all, coverage, out=np.zeros_like(mean_all), where=coverage > 0)
    cover_codes = np.rint(coverage * 255).astype("uint8")
    height_codes = np.rint(canopy_height * 100)
    if height_codes.max() > 65535:
        raise ValueError("Canopy height exceeds uint16 encoding")
    height_codes[cover_codes == 0] = 0
    coverage_asset = "mount-snow-canopy-coverage.u8.gz"
    height_asset = "mount-snow-canopy-height.u16.gz"
    for asset, values in ((coverage_asset, cover_codes), (height_asset, height_codes.astype("<u2"))):
        (DATA / asset).write_bytes(gzip.compress(values.tobytes(), mtime=0))
    manifest = {
        "asset": coverage_asset, "heightAsset": height_asset,
        "columns": dimensions[1], "rows": dimensions[0], "spacingMeters": SPACING,
        "firstSampleEasting": east, "firstSampleNorthing": north,
        "horizontalCrs": metadata["horizontalCrs"], "thresholdMeters": THRESHOLD,
        "coverageScale": 1 / 255, "heightScaleMeters": 0.01,
        "sourceDataset": "VCGI/USGS 3DEP Spring 2023 QL1 DSMFR minus DEMHF at 0.35 m",
        "structureExclusions": "OpenStreetMap building footprints and 3 m mapped lift pylon buffers",
    }
    (DATA / "mount-snow-canopy.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--osm-map", type=Path, help="refresh the retained structures from an OSM map XML export")
    args = parser.parse_args()
    if args.osm_map:
        retain_structures(args.osm_map)
    bake()
