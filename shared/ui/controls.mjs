const KINDS = new Set(['number', 'toggle', 'action', 'readout']);

// Bind definitions to project-owned state; neither renderer owns the values.
export class ControlModel {
  constructor(definitions, {onChange = () => {}} = {}) {
    this.definitions = definitions.map(definition => Object.freeze({...definition}));
    this.byId = new Map(); this.listeners = new Set(); this.onChange = onChange;
    for (const d of this.definitions) {
      if (!d.id || this.byId.has(d.id) || !KINDS.has(d.kind)) throw new TypeError('Invalid or duplicate control definition');
      if (d.kind === 'action') {
        if (typeof d.run !== 'function') throw new TypeError(`Missing action: ${d.id}`);
      } else {
        if (typeof d.get !== 'function') throw new TypeError(`Missing getter: ${d.id}`);
        if (d.kind !== 'readout' && typeof d.set !== 'function') throw new TypeError(`Missing setter: ${d.id}`);
      }
      if (d.kind === 'number' && (!Number.isFinite(d.min) || !Number.isFinite(d.max) || d.min >= d.max || !Number.isFinite(d.step) || d.step <= 0)) {
        throw new RangeError(`Invalid numeric bounds/step: ${d.id}`);
      }
      this.byId.set(d.id, d);
    }
  }
  definition(id) {
    const d = this.byId.get(id);
    if (!d) throw new RangeError(`Unknown control: ${id}`);
    return d;
  }
  label(d, surface = 'desktop') {
    const value = surface === 'vr' ? d.vrLabel ?? d.label : d.label;
    return String(typeof value === 'function' ? value() : value ?? d.id);
  }
  disabled(d) { return !!(typeof d.disabled === 'function' ? d.disabled() : d.disabled); }
  value(id) { return this.definition(id).get(); }
  format(d) {
    const value = d.get();
    if (d.format) return String(d.format(value));
    return typeof value === 'number' ? String(Number(value.toFixed(2))) : String(value);
  }
  normalize(d, input, {quantize = d.quantize !== false} = {}) {
    if (typeof input !== 'number' && (typeof input !== 'string' || input.trim() === '')) return undefined;
    const value = Number(input);
    if (!Number.isFinite(value)) return undefined;
    if (value <= d.min) return d.min;
    if (value >= d.max) return d.max;
    let next = value;
    // Quantize relative to the current value, just like a VR minus/plus press.
    // Defaults such as 0.65 with a 0.1 increment must not jump to a min-based grid.
    if (quantize) { const base = d.stepBase ?? d.get(); next = base + Math.round((next - base) / d.step) * d.step; }
    return Math.max(d.min, Math.min(d.max, Number(next.toPrecision(12))));
  }
  set(id, input, {commit = true, source = 'program', quantize} = {}) {
    const d = this.definition(id);
    if (this.disabled(d) || !['number', 'toggle'].includes(d.kind)) return false;
    const next = d.kind === 'toggle' ? !!input : this.normalize(d, input, {quantize});
    if (next === undefined || (!commit && d.commit) || Object.is(d.get(), next)) return false;
    const previous = d.get();
    d.set(next);
    if (Object.is(previous, d.get())) return false;
    try { this.onChange(id, {source, commit}); } finally { this.refresh(id); }
    return true;
  }
  adjust(id, sign) {
    const d = this.definition(id);
    if (d.kind !== 'number' || ![-1, 1].includes(sign)) return false;
    // Both renderers step from the current value, preserving existing defaults.
    const next = d.get() + sign * d.step;
    return this.set(id, next, {source: 'vr'});
  }
  activate(id, {source = 'program'} = {}) {
    const d = this.definition(id);
    if (this.disabled(d)) return false;
    if (d.kind === 'toggle') return this.set(id, !d.get(), {source});
    if (d.kind !== 'action') return false;
    try { d.run(); } finally { this.refresh(id); }
    return true;
  }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  refresh(id = null) { for (const listener of this.listeners) listener(id); }
  dispose() { this.listeners.clear(); }
}
