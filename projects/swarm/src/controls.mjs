import {ControlModel} from '../../../shared/ui/controls.mjs?v=shared-ui-slider-1';
const GROUPS = [
  [null, [
    ['Bee count', 'beeCount', 10, 1000, 10, 0],
    ['Bee speed', 'maxSpeed', 0.5, 8, 0.25, 1],
    ['Steering limit', 'maxForce', 0.5, 12, 0.5, 2],
    ['Neighbor radius', 'neighborRadius', 0.2, 6, 0.2, 3],
    ['Separation radius', 'separationRadius', 0.1, 2, 0.1, 4],
    ['Wasp speed', 'waspSpeed', 0.2, 6, 0.2, 10],
  ]],
  ['Steering weights', [
    ['Cohesion', 'cohesion', 0, 4, 0.1, 5],
    ['Alignment', 'alignment', 0, 4, 0.1, 6],
    ['Separation', 'separation', 0, 4, 0.1, 7],
    ['Attraction', 'attraction', 0, 4, 0.1, 8],
    ['Boundary', 'boundary', 0, 4, 0.1, 9],
  ]],
  ['Wasp flight volume', [
    ['Flight width ±X', 'x', 4, 20, 1, 11],
    ['Flight depth ±Z', 'z', 4, 20, 1, 12],
    ['Minimum altitude', 'minY', 3, 6, 0.5, 13],
    ['Maximum altitude', 'maxY', 8, 14, 0.5, 14],
  ]],
];
export function createSwarmControls(config, onChange, onOverview = () => {}) {
  const definitions = GROUPS.flatMap(([group, rows]) => rows.map(([label, id, min, max, step, vrOrder]) => {
    const object = group === 'Wasp flight volume' ? config.bounds : config;
    return {
      id, kind: 'number', label, vrLabel: id === 'beeCount' ? 'Bees' : label,
      group, min, max, step, vrOrder, commit: id === 'beeCount',
      get: () => object[id], set: value => { object[id] = value; },
    };
  }));
  definitions.push({id: 'overview', kind: 'action', label: 'Frame full flight volume', vr: false, run: onOverview});
  return new ControlModel(definitions, {onChange});
}
