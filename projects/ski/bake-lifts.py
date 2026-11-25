"""Retain mapped lifts and bake their routes, pylons and uphill unloading destinations."""
import argparse
import gzip
import json
import math
from pathlib import Path
import re
import xml.etree.ElementTree as ET

import numpy as np
from rasterio.warp import transform
from shapely.affinity import rotate, translate
from shapely.geometry import Point, box
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
    # Use the building boxes rendered by the viewer.
    boxes = json.loads((DATA / "mount-snow-buildings.json").read_text())
    rendered_buildings = unary_union([
        translate(rotate(box(-b["width"] / 2, -b["depth"] / 2, b["width"] / 2, b["depth"] / 2),
                         -b["yaw"], use_radians=True), b["x"], b["z"])
        for b in boxes
    ])
    pylon_coords = {tuple(f["geometry"]["coordinates"]) for f in structures["features"]
                    if f["properties"]["kind"] == "pylon"}
    groups = {area: [] for area in GROUPS}
    lifts = json.loads(SOURCE.read_text())["features"]
    for lift in lifts:
        tags = lift["properties"]
        name, number = re.fullmatch(r"(.+) #(\d+)", tags["name"]).groups()
        area = next(area for area, numbers in GROUPS.items() if int(number) in numbers)
        coordinates = lift["geometry"]["coordinates"]
        xs, ys = transform("EPSG:4326", crs, *zip(*coordinates))
        points = [(x - east, north - y) for x, y in zip(xs, ys)]
        if height(*points[0]) > height(*points[-1]):
            points.reverse()
            coordinates = coordinates[::-1]
        # Shared OSM nodes have identical coordinates in both retained extracts.
        pylon_indices = [i for i in range(1, len(coordinates) - 1)
                         if tuple(coordinates[i]) in pylon_coords]
        top_x, top_z = points[-1]
        prev_x, prev_z = points[pylon_indices[-1] if pylon_indices else -2]
        heading = math.atan2(top_z - prev_z, top_x - prev_x)
        # Try straight ahead at 10 m, then offset within the forward half-plane.
        # Increase distance only when the closer candidates lack clearance.
        candidates = (
            (top_x + distance * math.cos(heading + math.radians(angle)),
             top_z + distance * math.sin(heading + math.radians(angle)))
            for distance in range(10, 21)
            for angle in (0, 15, -15, 30, -30, 45, -45, 60, -60, 75, -75)
        )
        for x, z in candidates:
            x, z = round(x, 2), round(z, 2)
            if (0 <= x <= meta["columns"] - 1 and 0 <= z <= meta["rows"] - 1
                    and rendered_buildings.distance(Point(x, z)) >= 2):
                break
        else:
            raise ValueError(f"No clear arrival near {name}")
        groups[area].append({"name": name, "type": TYPES[tags["aerialway"]], "osmWay": lift["id"],
                             "x": round(x, 2), "z": round(z, 2), "elevationMeters": height(x, z),
                             "upper": {"x": round(top_x, 2), "z": round(top_z, 2),
                                       "elevationMeters": height(top_x, top_z)},
                             "lowerElevationMeters": height(*points[0]),
                             "pylonIndices": pylon_indices,
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
