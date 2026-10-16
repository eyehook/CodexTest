export const DEFAULTS = Object.freeze({
  damping: 0.1, springStrength: 10, restoringStrength: 0.1,
  rainStrength: 8, rainInterval: 3, colorRange: 0.03,
  spacing: 0.1, quadFill: 0.9, paused: false
});
// Shared bounds for desktop inputs and Quest minus/plus buttons.
export const CONTROLS = [
  ['Damping', 'damping', 0, 4, 0.05],
  ['Spring strength', 'springStrength', 0, 150, 2],
  ['Restoring strength', 'restoringStrength', 0, 10, 0.05],
  ['Raindrop strength', 'rainStrength', 0, 40, 1],
  ['Raindrop interval (s)', 'rainInterval', 0.5, 20, 0.5],
  ['Height color range (m)', 'colorRange', 0.01, 2, 0.01],
  ['Cell size (m)', 'spacing', 0.1, 1, 0.05],
  ['Square fill fraction', 'quadFill', 0.5, 0.98, 0.02]
];
export function setSetting(settings, key, value) {
  const control = CONTROLS.find(row => row[1] === key);
  if (!control || !Number.isFinite(Number(value))) return;
  settings[key] = Math.max(control[2], Math.min(control[3], Number(value)));
}
