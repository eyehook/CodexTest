const GROUPS = [
  [null, [
    ['Bee count', 'beeCount', 10, 1000, 1],
    ['Bee speed', 'maxSpeed', 0.5, 8, 0.01],
    ['Steering limit', 'maxForce', 0.5, 12, 0.01],
    ['Neighbor radius', 'neighborRadius', 0.2, 6, 0.01],
    ['Separation radius', 'separationRadius', 0.1, 2, 0.01],
    ['Wasp speed', 'waspSpeed', 0.2, 6, 0.01],
  ]],
  ['Steering weights', [
    ['Cohesion', 'cohesion', 0, 4, 0.05],
    ['Alignment', 'alignment', 0, 4, 0.05],
    ['Separation', 'separation', 0, 4, 0.05],
    ['Attraction', 'attraction', 0, 4, 0.05],
    ['Boundary', 'boundary', 0, 4, 0.05],
  ]],
  ['Wasp flight volume', [
    ['Flight width ±X', 'x', 4, 20, 0.1],
    ['Flight depth ±Z', 'z', 4, 20, 0.1],
    ['Minimum altitude', 'minY', 3, 6, 0.1],
    ['Maximum altitude', 'maxY', 8, 14, 0.1],
  ]],
];

export function createDesktopTuning(container, config, onChange, onOverview) {
  const inputs = [];
  for (const [title, definitions] of GROUPS) {
    let group = container;
    if (title) {
      group = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = title;
      group.append(summary);
      container.append(group);
    }
    for (const [label, key, min, max, step] of definitions) {
      const object = title === 'Wasp flight volume' ? config.bounds : config;
      const row = document.createElement('div'); row.className = 'control';
      const name = document.createElement('label'); name.textContent = label;
      const slider = document.createElement('input'); slider.type = 'range';
      const number = document.createElement('input'); number.type = 'number';
      slider.id = `swarm-${object === config.bounds ? 'bounds-' : ''}${key}`;
      name.htmlFor = slider.id;
      slider.setAttribute('aria-label', label);
      number.setAttribute('aria-label', `${label} value`);
      for (const input of [slider, number]) {
        input.min = min; input.max = max; input.step = step;
      }
      const sync = () => { slider.value = number.value = object[key]; };
      const apply = (input, commit) => {
        if (input.value === '' || !Number.isFinite(input.valueAsNumber)) {
          if (commit) sync();
          return;
        }
        const bounded = Math.max(min, Math.min(max, input.valueAsNumber));
        const value = Number((min + Math.round((bounded - min) / step) * step).toFixed(6));
        // Population changes rebuild the instance pool only when editing finishes.
        if (key !== 'beeCount' || commit) {
          if (object[key] !== value) { object[key] = value; onChange(key); }
        }
        if (input !== slider || commit) slider.value = value;
        if (input !== number || commit) number.value = value;
      };
      for (const input of [slider, number]) {
        input.addEventListener('input', () => apply(input, false));
        input.addEventListener('change', () => apply(input, true));
        input.addEventListener('blur', sync);
      }
      row.append(name, slider, number); group.append(row);
      inputs.push(sync); sync();
    }
  }
  const overview = document.createElement('button');
  overview.type = 'button'; overview.textContent = 'Frame full flight volume';
  overview.addEventListener('click', onOverview); container.append(overview);
  return {
    sync() { for (const sync of inputs) sync(); },
    setVisible(visible) { container.hidden = !visible; },
  };
}
