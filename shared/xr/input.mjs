export function deadzone(value, threshold, rescale = true) {
  if (!Number.isFinite(value) || Math.abs(value) <= threshold) return 0;
  if (!rescale) return Math.max(-1, Math.min(1, value));
  return Math.sign(value) * Math.min(1, (Math.abs(value) - threshold) / (1 - threshold));
}

// Mutate a caller-owned buffer to avoid allocations in the animation loop.
export function readMovementAxes(sources, output) {
  output.x = output.z = output.turn = 0;
  for (const source of sources) {
    const pad = source.gamepad;
    if (!pad || pad.mapping !== 'xr-standard') continue;
    if (source.handedness === 'left') {
      output.x = pad.axes[2];
      output.z = pad.axes[3];
    } else if (source.handedness === 'right') output.turn = pad.axes[2];
  }
  return output;
}

// XR gamepad button values are analog even when `pressed` is false.
export function buttonValue(source, index = 0) {
  const button = source?.gamepad?.buttons?.[index];
  const value = button?.value ?? Number(!!button?.pressed);
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

// Sample each source/button once per frame. States are reused until reset.
export class ButtonEdges {
  constructor() { this.sources = new Map(); }
  sample(source, index, seed = false) {
    let buttons = this.sources.get(source);
    if (!buttons) { buttons = new Map(); this.sources.set(source, buttons); }
    let state = buttons.get(index);
    if (!state) {
      state = {down: false, pressed: false, released: false, value: 0};
      buttons.set(index, state);
    }
    const down = !!source?.gamepad?.buttons?.[index]?.pressed;
    state.pressed = !seed && down && !state.down;
    state.released = !seed && !down && state.down;
    state.down = down;
    state.value = buttonValue(source, index);
    return state;
  }
  reset(source) {
    if (arguments.length) this.sources.delete(source);
    else this.sources.clear();
  }
  retain(sources) {
    for (const source of this.sources.keys()) {
      let present = false;
      for (const connected of sources) if (source === connected) { present = true; break; }
      if (!present) this.sources.delete(source);
    }
  }
}
