import {ControlModel} from '../../shared/ui/controls.mjs?v=shared-ui-slider-1';
import {CONTROLS} from './settings.mjs';

export function createSurfaceControls(settings, onChange) {
  const definitions = CONTROLS.map(([label, id, min, max, step]) => ({
    id, kind: 'number', label, min, max, step,
    get: () => settings[id], set: value => { settings[id] = value; },
  }));
  definitions.push(
    {id: 'pause', kind: 'action', label: () => settings.paused ? 'Resume simulation' : 'Pause simulation', run: () => onChange('pause')},
    {id: 'reset', kind: 'action', label: 'Reset surface', run: () => onChange('reset')},
    {id: 'defaults', kind: 'action', label: 'Restore defaults', run: () => onChange('defaults')},
  );
  return new ControlModel(definitions, {onChange});
}
