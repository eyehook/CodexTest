import {ControlModel} from '../../../shared/ui/controls.mjs?v=shared-ui-slider-1';

// Preserve WeatherParameters as the simulation/persistence authority.
export function createWeatherControls(parameters) {
  let writing = false;
  const model = new ControlModel(parameters.definitions.map(d => ({
    ...d, kind: d.kind === 'toggle' ? 'toggle' : 'number', group: d.section,
    stepBase: 0,
    get: () => d.kind === 'toggle' ? !!parameters.values[d.id] : parameters.values[d.id],
    set: value => { writing = true; try { parameters.set(d.id, Number(value)); } finally { writing = false; } },
  })));
  const unsubscribe = parameters.subscribe(id => { if (!writing) model.refresh(id); });
  const dispose = model.dispose.bind(model);
  model.dispose = () => { unsubscribe(); dispose(); };
  return model;
}
