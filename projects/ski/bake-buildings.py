"""Fit visual building boxes to retained OpenStreetMap footprints."""
import json
import math

from rasterio.warp import transform_geom
from shapely import make_valid
from shapely.geometry import shape

from prepare_dem import DATA, ROOT

# Keep the carpet route and the immediate surroundings of the upper terminals open.
HIDDEN_BUILDINGS = {
    "way/1090255651",  # Over the Covered Bridge carpet route
    "way/1152587480", "way/1152822302",  # Bluebird Express
    "way/1152587481",  # Grand Summit Express
    "way/1574044522",  # Sunbrook Express
    "way/1227668850",  # Grommet
    "way/1227668845",  # Nitro Express
    "way/439399295",  # Covered Bridge upper terminal
}


def bake():
    meta = json.loads((DATA / "mount-snow-1m.json").read_text())
    east, north = meta["firstSampleEasting"], meta["firstSampleNorthing"]
    source = ROOT / "source" / "mount-snow-structures.geojson"
    structures = json.loads(source.read_text())
    buildings = []
    for feature in structures["features"]:
        if feature["properties"]["kind"] != "building" or feature["id"] in HIDDEN_BUILDINGS:
            continue
        footprint = make_valid(shape(transform_geom("EPSG:4326", meta["horizontalCrs"], feature["geometry"])))
        rectangle = footprint.minimum_rotated_rectangle
        if rectangle.geom_type != "Polygon":
            raise ValueError(f"Degenerate building footprint: {feature['id']}")
        a, b, c, *_ = rectangle.exterior.coords
        x, z = rectangle.centroid.x - east, north - rectangle.centroid.y
        width = math.dist(a, b)
        depth = math.dist(b, c)
        # Three.js yaw rotates local +X toward -Z, and local Z points south.
        yaw = math.atan2(b[1] - a[1], b[0] - a[0])
        buildings.append({"x": round(x, 2), "z": round(z, 2), "width": round(width, 2),
                          "depth": round(depth, 2), "yaw": round(yaw, 6)})
    (DATA / "mount-snow-buildings.json").write_text(json.dumps(buildings, indent=2) + "\n")


if __name__ == "__main__":
    bake()
