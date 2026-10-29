import { Vector3, CatmullRomCurve3, MathUtils } from '../../../shared/vendor/three-r180/three.module.js';

// A sliding four-point spline shares position AND tangent at every join.
// Arc-length traversal keeps speed independent of waypoint spacing.
export class Wasp {
  constructor(config, random = Math.random) {
    this.config = config;
    this.random = random;
    this.points = Array.from({ length: 4 }, () => this.waypoint());
    this.position = new Vector3();
    this.distance = 0;
    this.time = 0;
    this.rebuild();
    this.update(0);
  }
  waypoint() {
    const b = this.config.bounds, r = this.random;
    // Leave a margin for spline overshoot; uniform Catmull–Rom has C1 joins.
    return new Vector3((r() * 2 - 1) * b.x * 0.8,
      MathUtils.lerp(b.minY + 1, b.maxY - 1, r()), (r() * 2 - 1) * b.z * 0.8);
  }
  rebuild() {
    this.curve = new CatmullRomCurve3(this.points, false, 'catmullrom', 0.5);
    // Traverse only the middle segment, retaining control points on either side.
    const lengths = this.curve.getLengths(600);
    this.offset = lengths[200];
    this.length = lengths[400] - this.offset;
  }
  update(dt) {
    this.time += dt;
    this.distance += this.config.waspSpeed * (1 + 0.08 * Math.sin(this.time * 0.55)) * dt;
    while (this.distance >= this.length) {
      this.distance -= this.length;
      this.points.shift();
      this.points.push(this.waypoint());
      this.rebuild();
    }
    const t = this.curve.getUtoTmapping(0, this.offset + this.distance);
    this.curve.getPoint(t, this.position);
  }
}
