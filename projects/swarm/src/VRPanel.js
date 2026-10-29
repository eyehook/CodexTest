import {VRControlPanel} from '../../../shared/ui/vr-panel.mjs?v=shared-ui-slider-1';
import {createSwarmControls} from './controls.mjs?v=shared-ui-slider-1';

export class VRPanel extends VRControlPanel {
  constructor(scene, rig, renderer, config, onChange, model = createSwarmControls(config, onChange)) {
    super(scene, rig, renderer, model, {
      title: 'SWARM / TUNING',
      footer: 'Bees respawn on count change. Bounds shape new path segments.',
    });
  }
}
