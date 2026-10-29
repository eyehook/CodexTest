import {VRControlPanel} from '../../shared/ui/vr-panel.mjs?v=shared-ui-slider-1';
import {createSurfaceControls} from './controls.mjs?v=shared-ui-slider-1';

export class VRPanel extends VRControlPanel {
  constructor(scene, rig, renderer, settings, onChange, model = createSurfaceControls(settings, onChange)) {
    super(scene, rig, renderer, model, {
      title: 'SURFACE / TUNING', enabled: false,
      footer: 'A / X: show or hide · Changes apply immediately',
    });
  }
}
