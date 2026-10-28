export class WeatherParameters {
  constructor() { this.definitions = []; this.values = {}; this.listeners = new Set(); }
  register(definitions) {
    for (const d of definitions) {
      if (this.definitions.some(item => item.id === d.id)) throw new Error(`Duplicate parameter: ${d.id}`);
      this.definitions.push(Object.freeze({ ...d })); this.values[d.id] = d.default;
    }
  }
  set(id, value) {
    const d = this.definitions.find(item => item.id === id);
    if (!d || !Number.isFinite(Number(value))) return;
    const next = Math.max(d.min, Math.min(d.max, Math.round(Number(value) / d.step) * d.step));
    if (next === this.values[id]) return;
    this.values[id] = next; for (const listener of this.listeners) listener(id, next);
  }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
}
export const snowParameters = [
  { id: 'count', label: 'Snowflake count', min: 0, max: 50000, step: 1, default: 5000, format: v => Math.round(v).toLocaleString('en-US') },
  { id: 'wind', label: 'Wind speed', min: -6, max: 6, step: 0.1, default: 0, format: v => `${v.toFixed(1)} m/s` },
  { id: 'turbulence', label: 'Turbulence', min: 0, max: 100, step: 1, default: 20, format: v => `${Math.round(v)}%` },
  { id: 'size', label: 'Snowflake size', min: 0.1, max: 10, step: 0.1, default: 1, format: v => `${v.toFixed(1)}×` },
];
