"""Bake the Mount Snow piste mask and locate the highest trailhead."""
import argparse
import gzip
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

import numpy as np
from rasterio.features import rasterize
from rasterio.transform import from_origin
from rasterio.warp import transform
from shapely import make_valid
from shapely.geometry import LineString, Polygon

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
SOURCE = ROOT / "source" / "mount-snow-pistes.osm"
SPACING = 2
DEFAULT_WIDTH = 24


def tags(element):
    return {tag.attrib["k"]: tag.attrib["v"] for tag in element.findall("tag")}


def select_features(root):
    ways = {way.attrib["id"]: way for way in root.findall("way")}
    downhill = {key: way for key, way in ways.items() if tags(way).get("piste:type") == "downhill"}
    routes = [relation for relation in root.findall("relation")
              if tags(relation).get("piste:type") == "downhill"]
    for route in routes:
        for member in route.findall("member"):
            if member.attrib["type"] == "way":
                key = member.attrib["ref"]
                downhill[key] = ways[key]
    return downhill, routes


def keep_pistes(path):
    root = ET.parse(path).getroot()
    ways, routes = select_features(root)
    refs = {node.attrib["ref"] for way in ways.values() for node in way.findall("nd")}
    snapshot = ET.Element("osm", {"version": "0.6", "attribution": "© OpenStreetMap contributors",
                                 "license": "https://opendatacommons.org/licenses/odbl/1-0/"})
    snapshot.extend(node for node in root.findall("node") if node.attrib["id"] in refs)
    snapshot.extend(ways.values())
    snapshot.extend(routes)
    ET.indent(snapshot)
    ET.ElementTree(snapshot).write(SOURCE, encoding="utf-8", xml_declaration=True)


def width_meters(way_tags):
    for key in ("piste:width", "width"):
        match = re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*(?:m)?\s*", way_tags.get(key, ""))
        if match and float(match[1]) > 0:
            return float(match[1])
    return DEFAULT_WIDTH


def bake():
    meta = json.loads((DATA / "mount-snow-1m.json").read_text())
    columns, rows = meta["columns"], meta["rows"]
    heights = np.frombuffer(gzip.decompress((DATA / meta["asset"]).read_bytes()), dtype="<u2")
    heights = heights.reshape(rows, columns)

    def elevation(point):
        x, z = point
        if not (0 <= x < columns - 1 and 0 <= z < rows - 1):
            raise ValueError(f"Piste point outside DEM: {point}")
        i, j = int(x), int(z)
        u, v = x - i, z - j
        a, b = heights[j, i:i + 2].astype(float)
        c, d = heights[j + 1, i:i + 2].astype(float)
        code = (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
        return meta["elevationOffsetMeters"] + code * meta["elevationScaleMeters"]

    root = ET.parse(SOURCE).getroot()
    nodes = {node.attrib["id"]: (float(node.attrib["lon"]), float(node.attrib["lat"]))
             for node in root.findall("node")}
    ways, routes = select_features(root)
    if any(tags(route).get("type") != "route" for route in routes):
        raise ValueError("A new piste relation type needs geometry handling")
    shapes, starts = [], []
    area_count = 0
    for way_id, way in ways.items():
        coords = [nodes[node.attrib["ref"]] for node in way.findall("nd")]
        east, north = transform("EPSG:4326", meta["horizontalCrs"], *zip(*coords))
        points = [(x - meta["firstSampleEasting"], meta["firstSampleNorthing"] - y)
                  for x, y in zip(east, north)]
        way_tags = tags(way)
        if points[0] == points[-1] and way_tags.get("area") != "no":
            shapes.append(make_valid(Polygon(points)))
            area_count += 1
            continue

        if elevation(points[-1]) > elevation(points[0]):
            points.reverse()
            coords.reverse()
        line = LineString(points)
        shapes.append(line.buffer(width_meters(way_tags) / 2))
        target = line.interpolate(min(55, line.length))
        name = way_tags.get("piste:name", way_tags.get("name", "Unnamed piste"))
        starts.append({
            "name": name, "osmWay": int(way_id), "longitude": coords[0][0], "latitude": coords[0][1],
            "x": points[0][0], "z": points[0][1], "elevationMeters": elevation(points[0]),
            "towardX": target.x, "towardZ": target.y,
        })

    starts.sort(key=lambda start: (-start["elevationMeters"], start["name"], start["osmWay"]))
    mask = rasterize(
        ((shape, 255) for shape in shapes),
        out_shape=((rows + SPACING - 1) // SPACING, (columns + SPACING - 1) // SPACING),
        transform=from_origin(-SPACING / 2, -SPACING / 2, SPACING, -SPACING),
        dtype="uint8",
    )
    (DATA / "mount-snow-pistes.u8.gz").write_bytes(gzip.compress(mask.tobytes(), mtime=0))
    summit = starts[0]
    tied = sorted({start["name"] for start in starts if (start["x"], start["z"]) == (summit["x"], summit["z"])})
    manifest = {
        "asset": "mount-snow-pistes.u8.gz", "spacingMeters": SPACING,
        "columns": mask.shape[1], "rows": mask.shape[0],
        "centerlineWays": len(starts), "areaWays": area_count, "routeRelations": len(routes),
        "defaultCenterlineWidthMeters": DEFAULT_WIDTH, "spawn": summit, "sharedStart": tied,
    }
    (DATA / "mount-snow-pistes.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--osm-map", type=Path, help="refresh the retained piste snapshot from an OSM map XML export")
    args = parser.parse_args()
    if args.osm_map:
        keep_pistes(args.osm_map)
    bake()
