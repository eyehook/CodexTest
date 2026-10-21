export function createRodControls(){return {left:{shown:false,held:false},right:{shown:false,held:false}};}
export function updateRodControls(state,session,tracked){
 if(!session){for(const hand of ['left','right']){state[hand].shown=false;state[hand].held=false;}return;}
 // Preserve the latch while suspended to avoid toggling when tracking returns.
 if(!tracked||session.visibilityState!=='visible')return;
 for(const hand of ['left','right']){
  let source=null;
  for(const candidate of session.inputSources)if(candidate.handedness===hand&&candidate.gamepad?.mapping==='xr-standard'&&candidate.gripSpace){source=candidate;break;}
  // Input-source replacement is not a physical release of B/Y.
  if(!source)continue;
  const pressed=!!source.gamepad.buttons?.[5]?.pressed;
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
