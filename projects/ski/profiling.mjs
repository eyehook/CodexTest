const WINDOW_MS = 2000;
const WARMUP_MS = 5000;
const CAPACITY = 1024;

export const METRICS = [
  {id: 'frame', label: 'Frame interval', unit: 'ms'},
  {id: 'cpu', label: 'CPU frame', unit: 'ms'},
  {id: 'render', label: 'Main render CPU', unit: 'ms'},
  {id: 'shadow', label: 'Pine shadow CPU', unit: 'ms'},
  {id: 'trees', label: 'Tree streaming CPU', unit: 'ms'},
  {id: 'terrain', label: 'Terrain LOD CPU', unit: 'ms'},
  {id: 'calls', label: 'Main draw calls', unit: ''},
  {id: 'triangles', label: 'Main triangles', unit: ''},
  {id: 'tree-builds', label: 'Tree chunks built', unit: ''},
  {id: 'tile-builds', label: 'Terrain tiles rebuilt', unit: ''},
];

const STRIDE = METRICS.length;
export const [FRAME, CPU, RENDER, SHADOW, TREES, TERRAIN, CALLS, TRIANGLES, TREE_BUILDS, TILE_BUILDS] =
  METRICS.map((_, index) => index);

export class SkiProfiler {
  times = new Float64Array(CAPACITY);
  samples = new Float64Array(CAPACITY * STRIDE);
  values = new Float64Array(STRIDE);
  sums = new Float64Array(STRIDE);
  counts = new Uint16Array(STRIDE);
  peaks = new Float64Array(STRIDE).fill(-Infinity);
  next = 0;
  oldest = 0;
  size = 0;
  elapsed = 0;
  warmupRemaining = WARMUP_MS;
  timestamp = null;
  worstFps = Infinity;

  get ready() { return this.warmupRemaining === 0; }

  pause() {
    this.timestamp = null;
  }

  reset({restartWarmup = true} = {}) {
    this.pause();
    this.next = this.oldest = this.size = this.elapsed = 0;
    this.sums.fill(0);
    this.counts.fill(0);
    this.peaks.fill(-Infinity);
    this.worstFps = Infinity;
    if (restartWarmup) this.warmupRemaining = WARMUP_MS;
  }

  beginFrame() {
    this.values.fill(NaN);
  }

  evict() {
    const offset = this.oldest * STRIDE;
    for (let i = 0; i < STRIDE; i++) {
      const value = this.samples[offset + i];
      if (!Number.isFinite(value)) continue;
      this.sums[i] -= value;
      if (--this.counts[i] === 0) this.sums[i] = 0;
    }
    this.oldest = (this.oldest + 1) % CAPACITY;
    this.size--;
  }

  finishFrame(timestamp) {
    const previous = this.timestamp;
    this.timestamp = timestamp;
    const interval = previous === null ? 0 : Math.max(0, timestamp - previous);
    if (!this.ready) {
      this.warmupRemaining = Math.max(0, this.warmupRemaining - interval);
      return;
    }
    if (interval > 0) {
      this.values[FRAME] = interval;
      this.elapsed += interval;
    }
    const cutoff = this.elapsed - WINDOW_MS;
    while (this.size && (this.size === CAPACITY || this.times[this.oldest] <= cutoff)) this.evict();

    const offset = this.next * STRIDE;
    this.times[this.next] = this.elapsed;
    for (let i = 0; i < STRIDE; i++) {
      const value = this.samples[offset + i] = this.values[i];
      if (!Number.isFinite(value)) continue;
      this.sums[i] += value;
      this.counts[i]++;
      if (value > this.peaks[i]) this.peaks[i] = value;
    }
    this.next = (this.next + 1) % CAPACITY;
    this.size++;

    if (this.elapsed >= WINDOW_MS) this.worstFps = Math.min(this.worstFps, this.fps());
  }

  fps() {
    return 1000 / (this.sums[FRAME] / this.counts[FRAME]);
  }

  formatFps() {
    return `${this.counts[FRAME] ? this.fps().toFixed(1) : '—'} / ${Number.isFinite(this.worstFps) ? this.worstFps.toFixed(1) : '—'}`;
  }

  format(index) {
    const {unit} = METRICS[index];
    const format = value => unit ? value.toFixed(2) : Math.round(value).toLocaleString('en-US');
    const average = this.counts[index] ? format(this.sums[index] / this.counts[index]) : '—';
    const worst = Number.isFinite(this.peaks[index]) ? format(this.peaks[index]) : '—';
    return `${average} / ${worst}${unit ? ` ${unit}` : ''}`;
  }
}
