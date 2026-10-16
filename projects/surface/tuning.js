import {CONTROLS, setSetting} from './settings.mjs';

export function createDesktopTuning(settings, onChange) {
  const container = document.querySelector('#controls');
  const inputs = new Map();
  for (const [label, key, min, max, step] of CONTROLS) {
    const row = document.createElement('label'); row.className = 'control';
    const title = document.createElement('span'); title.textContent = label;
    const slider = document.createElement('input'); slider.type = 'range';
    const number = document.createElement('input'); number.type = 'number'; number.setAttribute('aria-label', label);
    for (const input of [slider, number]) {
      input.min = min; input.max = max; input.step = step; input.value = settings[key];
      input.addEventListener('input', () => {
        if (input.value === '' || !Number.isFinite(input.valueAsNumber)) return;
        setSetting(settings, key, input.valueAsNumber); onChange(key);
      });
    }
    slider.setAttribute('aria-label', label);
    row.append(title, slider, number); container.append(row); inputs.set(key, [slider, number]);
  }
  for (const action of ['pause', 'reset', 'defaults']) document.querySelector('#' + action).addEventListener('click', () => onChange(action));
  return () => {
    for (const [key, pair] of inputs) for (const input of pair) input.value = settings[key];
    document.querySelector('#pause').textContent = settings.paused ? 'Resume' : 'Pause';
    document.querySelector('#dimensions').textContent = `${(settings.spacing * 100).toFixed(1)} cm cells · ${(settings.spacing * settings.quadFill * 100).toFixed(1)} cm squares · ${(settings.spacing * (1 - settings.quadFill) * 100).toFixed(1)} cm gaps`;
  };
}
