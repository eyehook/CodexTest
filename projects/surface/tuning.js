import {DesktopControls} from '../../shared/ui/desktop.mjs?v=shared-ui-slider-1';
import {createSurfaceControls} from './controls.mjs?v=shared-ui-slider-1';

export function createDesktopTuning(settings, onChange, model = createSurfaceControls(settings, onChange)) {
  const desktop = new DesktopControls(document.querySelector('#controls'), model, {
    idPrefix: 'surface', filter: d => d.kind !== 'action', numberSuffix: '',
  });
  const handlers = [];
  for (const id of ['pause', 'reset', 'defaults']) {
    const button = document.querySelector('#' + id), click = () => model.activate(id, {source: 'desktop'});
    button.addEventListener('click', click); handlers.push([button, click]);
  }
  const details = () => {
    document.querySelector('#pause').textContent = settings.paused ? 'Resume' : 'Pause';
    document.querySelector('#dimensions').textContent = `${(settings.spacing * 100).toFixed(1)} cm cells · ${(settings.spacing * settings.quadFill * 100).toFixed(1)} cm squares · ${(settings.spacing * (1 - settings.quadFill) * 100).toFixed(1)} cm gaps`;
  };
  const unsubscribe = model.subscribe(details);
  const sync = () => { desktop.sync(); details(); };
  sync.dispose = () => {
    unsubscribe(); desktop.dispose();
    for (const [button, click] of handlers) button.removeEventListener('click', click);
  };
  sync(); return sync;
}
