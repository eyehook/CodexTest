"""Retain mapped lifts and bake their routes and uphill unloading destinations."""
import argparse
import gzip
import json
import math
from pathlib import Path
import re
import xml.etree.ElementTree as ET

import numpy as np
from rasterio.warp import transform, transform_geom
from shapely import make_valid
from shapely.geometry import Point, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "source" / "mount-snow-lifts.geojson"
DATA = ROOT / "data"
TYPES = {"chair_lift": "Chairlift", "magic_carpet": "Carpet", "rope_tow": "Rope tow"}
GROUPS = {
    "Main Face": {5, 7, 9, 11, 12, 16, 17},
    "North Face": {10, 18},
    "Sunbrook": {14, 19},
    "Carinthia": {1, 2, 3},
    "Main Face Learning Area": {24, 25, 27, 28},
    "Tubing Hill": {4},
}


def retain_lifts(path):
    root = ET.parse(path).getroot()
    nodes = {node.get("id"): [float(node.get("lon")), float(node.get("lat"))]
             for node in root.findall("node")}
    features = []
    for way in root.findall("way"):
        tags = {tag.get("k"): tag.get("v") for tag in way.findall("tag")}
        if tags.get("aerialway") not in TYPES:
            continue
        coords = [nodes[node.get("ref")] for node in way.findall("nd")]
        features.append({"type": "Feature", "id": int(way.get("id")), "properties": tags,
                         "geometry": {"type": "LineString", "coordinates": coords}})
    snapshot = {"type": "FeatureCollection", "attribution": "© OpenStreetMap contributors",
                "license": "https://opendatacommons.org/licenses/odbl/1-0/", "features": features}
    SOURCE.write_text(json.dumps(snapshot, separators=(",", ":"), ensure_ascii=False) + "\n")


def bake():
    meta = json.loads((DATA / "mount-snow-1m.json").read_text())
    dem = np.frombuffer(gzip.decompress((DATA / meta["asset"]).read_bytes()), "<u2")
    dem = dem.reshape(meta["rows"], meta["columns"])
    east, north = meta["firstSampleEasting"], meta["firstSampleNorthing"]
    crs = meta["horizontalCrs"]

    def height(x, z):
        i, j = round(x), round(z)
        if not (0 <= i < meta["columns"] and 0 <= j < meta["rows"]):
            raise ValueError(f"Lift point outside DEM: {x}, {z}")
        return float(dem[j, i]) * meta["elevationScaleMeters"] + meta["elevationOffsetMeters"]

    structures = json.loads((ROOT / "source" / "mount-snow-structures.geojson").read_text())
    buildings = unary_union([make_valid(shape(transform_geom("EPSG:4326", crs, f["geometry"])))
                             for f in structures["features"] if f["properties"]["kind"] == "building"])
    groups = {area: [] for area in GROUPS}
    lifts = json.loads(SOURCE.read_text())["features"]
    for lift in lifts:
        tags = lift["properties"]
        name, number = re.fullmatch(r"(.+) #(\d+)", tags["name"]).groups()
        area = next(area for area, numbers in GROUPS.items() if int(number) in numbers)
        xs, ys = transform("EPSG:4326", crs, *zip(*lift["geometry"]["coordinates"]))
        points = [(x - east, north - y) for x, y in zip(xs, ys)]
        if height(*points[0]) > height(*points[-1]):
            points.reverse()
        top_x, top_z = points[-1]
        prev_x, prev_z = points[-2]
        heading = math.atan2(top_z - prev_z, top_x - prev_x)
        # Prefer stepping forward from the end of the line. Try adjacent ground
        # when the projected exit would land in a mapped building.
        for angle in (0, 45, -45, 90, -90, 135, -135, 180):
            radians = heading + math.radians(angle)
            x, z = top_x + 8 * math.cos(radians), top_z + 8 * math.sin(radians)
            if buildings.distance(Point(east + x, north - z)) >= 2:
                break
        else:
            raise ValueError(f"No clear arrival near {name}")
        groups[area].append({"name": name, "type": TYPES[tags["aerialway"]], "osmWay": lift["id"],
                             "x": round(x, 2), "z": round(z, 2), "elevationMeters": height(x, z),
                             "upper": {"x": round(top_x, 2), "z": round(top_z, 2),
                                       "elevationMeters": height(top_x, top_z)},
                             "lowerElevationMeters": height(*points[0]),
                             "route": [[round(px, 2), round(pz, 2)] for px, pz in points]})
    if len(lifts) != 19 or len({lift["id"] for lift in lifts}) != 19:
        raise ValueError("Expected 19 distinct mapped lifts")
    for lifts in groups.values():
        lifts.sort(key=lambda lift: lift["name"])
    (DATA / "mount-snow-lifts.json").write_text(json.dumps(groups, indent=2) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--osm-map", type=Path, help="refresh all lift centerlines from OSM map XML")
    args = parser.parse_args()
    if args.osm_map:
        retain_lifts(args.osm_map)
    bake()
