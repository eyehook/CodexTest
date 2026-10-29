let nextInstance = 0;

export class DesktopControls {
  constructor(container, model, {idPrefix = `controls-${++nextInstance}`, filter = () => true, numberSuffix = ' value', theme = {}, numbers = true, showValues = false, groupMode = 'details'} = {}) {
    this.container = container; this.model = model; this.rows = new Map();
    this.nodes = []; this.handlers = []; this.editing = null;
    this.hadClass = container.classList.contains('shared-controls'); container.classList.add('shared-controls');
    this.previousTheme = Object.entries(theme).map(([key, value]) => {
      const property = `--controls-${key}`, previous = container.style.getPropertyValue(property);
      container.style.setProperty(property, value); return [property, previous];
    });
    const groups = new Map();
    for (const d of model.definitions.filter(d => d.desktop !== false && filter(d))) {
      let parent = container;
      if (d.group) {
        if (!groups.has(d.group)) {
          const group = document.createElement(groupMode === 'headings' ? 'section' : 'details'), summary = document.createElement(groupMode === 'headings' ? 'h2' : 'summary');
          summary.textContent = d.group; group.append(summary); container.append(group);
          this.nodes.push(group); groups.set(d.group, group);
        }
        parent = groups.get(d.group);
      }
      let row, label, slider, input, output;
      if (d.kind === 'action') {
        row = input = document.createElement('button'); input.type = 'button';
        this.listen(input, 'click', () => model.activate(d.id, {source: 'desktop'}));
      } else {
        row = document.createElement('div'); row.className = 'control';
        label = document.createElement('label'); row.append(label);
        if (d.kind === 'readout') {
          output = document.createElement('output'); output.id = `${idPrefix}-${d.id}`; label.htmlFor = output.id; row.append(output);
        } else {
          input = document.createElement('input');
          input.type = d.kind === 'toggle' ? 'checkbox' : 'number';
          if (d.kind === 'number') {
            slider = document.createElement('input'); slider.type = 'range';
            if (!numbers) input = null;
            for (const element of [slider, input].filter(Boolean)) {
              element.min = d.min; element.max = d.max; element.step = 'any';
              this.listen(element, 'input', () => this.apply(d, element, false));
              this.listen(element, 'change', () => this.apply(d, element, true));
              this.listen(element, 'blur', () => this.apply(d, element, true));
              this.listen(element, 'keydown', event => {
                const sign = {ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1}[event.key];
                if (!sign || (element === input && ['ArrowLeft', 'ArrowRight'].includes(event.key))) return;
                event.preventDefault();
                const current = Number.isFinite(element.valueAsNumber) ? element.valueAsNumber : d.get();
                element.value = model.normalize(d, current + sign * d.step);
                this.apply(d, element, false);
              });
            }
            row.append(slider);
          } else this.listen(input, 'change', () => model.set(d.id, input.checked, {source: 'desktop'}));
          if (input) row.append(input);
          if (showValues) { output = document.createElement('output'); row.classList.add('control-with-output'); row.append(output); }
          if (slider && !numbers) row.classList.add('control-slider-only');
          const primary = slider ?? input; primary.id = `${idPrefix}-${d.id}`; label.htmlFor = primary.id;
        }
      }
      parent.append(row); this.nodes.push(row);
      this.rows.set(d.id, {d, row, label, slider, input, output, numberSuffix});
    }
    this.unsubscribe = model.subscribe(() => this.sync());
    this.sync();
  }
  listen(element, event, handler) {
    element.addEventListener(event, handler); this.handlers.push([element, event, handler]);
  }
  apply(d, input, commit) {
    if (this.model.disabled(d)) { this.sync(); return; }
    if (input.value === '' || !Number.isFinite(input.valueAsNumber)) { if (commit) this.sync(); return; }
    const next = this.model.normalize(d, input.valueAsNumber);
    this.editing = commit ? null : input;
    try {
      this.model.set(d.id, next, {commit, source: 'desktop'});
      const row = this.rows.get(d.id);
      if (!row) return;
      for (const element of [row.slider, row.input].filter(Boolean)) if (element !== this.editing) element.value = next;
    } finally { this.editing = null; }
  }
  sync() {
    for (const {d, label, slider, input, output, numberSuffix} of this.rows.values()) {
      const text = this.model.label(d), disabled = this.model.disabled(d);
      if (label) label.textContent = text;
      if (d.kind === 'action') { input.textContent = text; input.disabled = disabled; }
      else if (d.kind === 'readout') output.textContent = this.model.format(d);
      else {
        if (output) output.textContent = this.model.format(d);
        for (const element of [slider, input].filter(Boolean)) {
          element.disabled = disabled;
          element.setAttribute('aria-label', text + (element === input && slider ? numberSuffix : ''));
          if (d.kind === 'toggle') element.checked = !!d.get();
          else if (element !== this.editing) element.value = d.get();
        }
      }
    }
  }
  setVisible(visible) { this.container.hidden = !visible; }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    for (const [element, event, handler] of this.handlers) element.removeEventListener(event, handler);
    for (const node of this.nodes) node.remove();
    this.handlers.length = 0; this.nodes.length = 0; this.rows.clear();
    if (!this.hadClass) this.container.classList.remove('shared-controls');
    for (const [property, previous] of this.previousTheme) {
      if (previous) this.container.style.setProperty(property, previous); else this.container.style.removeProperty(property);
    }
  }
}
