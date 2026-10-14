import {steeringAxis} from './simulation.mjs';
export function controllerSteering(sources){
 for(const source of sources){
  if(source.handedness!=='left'||!source.gamepad)continue;
  const gamepad=source.gamepad;
  const axis=gamepad.mapping==='xr-standard'?gamepad.axes?.[2]:gamepad.axes?.[gamepad.axes.length>=4?2:0];
  return steeringAxis(axis);
 }
 return 0;
}
export function createKeyboardInput(target=window){
 const keys=new Set(),allowed=new Set(['KeyA','KeyD','ArrowLeft','ArrowRight']);
 const down=event=>{if(allowed.has(event.code)){event.preventDefault();keys.add(event.code);}};
 const up=event=>keys.delete(event.code),clear=()=>keys.clear();
 target.addEventListener('keydown',down);target.addEventListener('keyup',up);target.addEventListener('blur',clear);
 document.addEventListener('visibilitychange',clear);
 return {read:()=>Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),clear};
}
