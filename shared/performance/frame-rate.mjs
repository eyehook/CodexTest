// Application frame cadence, sampled once per frame with uncapped elapsed seconds.
// This does not measure GPU time, compositor frames or per-eye rendering.
export class FrameRateCounter {
  constructor(interval = 0.5) {
    if (!Number.isFinite(interval) || interval <= 0) throw new RangeError('FPS interval must be positive');
    this.interval = interval; this.reset();
  }
  reset() { this.elapsed = 0; this.frames = 0; this.value = null; }
  sample(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    this.elapsed += seconds; this.frames++;
    if (this.elapsed < this.interval) return null;
    this.value = this.frames / this.elapsed;
    this.elapsed = 0; this.frames = 0;
    return this.value;
  }
}
export {FrameRateCounter as FrameRate};
