import { WeatherParameters } from './parameters.js?v=shared-r180-1';
// Register {id, label, create, particleLabel}; each effect supplies its own parameters/lifecycle.
export class WeatherModes {
  constructor(scene, definitions, context = {}) {
    this.context = context; this.scene = scene; this.definitions = definitions; this.savedValues = Object.create(null); this.states = new Map(); this.current = null;
    if (new Set(definitions.map(d => d.id)).size !== definitions.length) throw new Error('Duplicate weather mode');
  }
  select(id, position) {
    const definition = this.definitions.find(d => d.id === id);
    if (!definition) throw new Error(`Unknown weather: ${id}`);
    if (this.current?.definition.id === id) return this.current;
    let state = this.states.get(id);
    if (!state) {
      const parameters = new WeatherParameters(), effect = definition.create();
      effect.initialize(this.scene, parameters, this.context);
      const saved = this.savedValues[id];
      if (saved && typeof saved === 'object') for (const d of parameters.definitions) {
        if (Object.hasOwn(saved, d.id) && typeof saved[d.id] === 'number' && Number.isFinite(saved[d.id])) parameters.set(d.id, saved[d.id]);
      }
      state = { definition, parameters, effect, saveStatus: 'idle' };
      state.unsubscribeSaveStatus = parameters.subscribe(() => { state.saveStatus = 'idle'; });
      this.states.set(id, state);
    }
    this.current?.effect.deactivate(); state.effect.activate(position); this.current = state; return state;
  }
  restore(snapshot) {
    this.savedValues = snapshot?.modes ?? Object.create(null);
    return this.definitions.some(d => d.id === snapshot?.activeMode) ? snapshot.activeMode : this.definitions[0].id;
  }
  snapshot() {
    const modes = Object.create(null);
    for (const definition of this.definitions) {
      const state = this.states.get(definition.id);
      modes[definition.id] = state ? { ...state.parameters.values } : { ...this.savedValues[definition.id] };
    }
    return { version: 1, activeMode: this.current?.definition.id ?? this.definitions[0].id, modes };
  }
  dispose() { for (const state of this.states.values()) { state.unsubscribeSaveStatus(); state.effect.dispose(); } this.states.clear(); this.current = null; }
}
