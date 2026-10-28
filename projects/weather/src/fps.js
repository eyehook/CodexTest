// Average actual rendered-frame intervals; simulation dt may be capped separately.
export class FrameRateCounter {
  constructor(interval = 0.5) { this.interval = interval; this.reset(); }
  reset() { this.elapsed = 0; this.frames = 0; }
  sample(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return null;
    this.elapsed += dt; this.frames++;
    if (this.elapsed < this.interval) return null;
    const fps = this.frames / this.elapsed;
    this.reset(); return fps;
  }
}
