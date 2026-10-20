export function createRodControls(){return {left:{shown:false,held:false},right:{shown:false,held:false}};}
export function updateRodControls(state,session,tracked){
 if(!session){for(const hand of ['left','right']){state[hand].shown=false;state[hand].held=false;}return;}
 // Preserve the latch while suspended to avoid toggling when tracking returns.
 if(!tracked||session.visibilityState!=='visible')return;
 for(const hand of ['left','right']){
  let pressed=false;
  for(const source of session.inputSources)if(source.handedness===hand&&source.gamepad?.mapping==='xr-standard'&&source.gripSpace){pressed=!!source.gamepad.buttons?.[5]?.pressed;break;}
  if(pressed&&!state[hand].held){state[hand].shown=!state[hand].shown;if(state[hand].shown)state[hand==='left'?'right':'left'].shown=false;}
  state[hand].held=pressed;
 }
}

export function rodTrigger(source,held=false){
 const button=source?.gamepad?.mapping==='xr-standard'?source.gamepad.buttons?.[0]:null;
 if(!button)return false;
 // Hysteresis keeps a partially squeezed trigger engaged without chatter.
 return Number.isFinite(button.value)?button.value>=(held?0.15:0.6):!!button.pressed;
}
