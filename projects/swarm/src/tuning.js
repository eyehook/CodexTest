import {DesktopControls} from '../../../shared/ui/desktop.mjs?v=shared-ui-slider-1';
import {createSwarmControls} from './controls.mjs?v=shared-ui-slider-1';

export function createDesktopTuning(container, config, onChange, onOverview, model = createSwarmControls(config, onChange, onOverview)) {
  return new DesktopControls(container, model, {idPrefix: 'swarm'});
}
