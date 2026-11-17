// Critically damped pitch attraction in musical beats. The exact constant-target
// solution is stable at low frame rates and preserves velocity across new notes.
export function particleMotion() {
  const state={pitch:.5,velocity:0,pull:0};
  let previous;
  return (beat,pitch=.5,melody=0)=>{
    if(previous!==undefined && beat<previous) {
      state.pitch=.5;state.velocity=0;state.pull=0;previous=undefined;
    }
    const dt=previous===undefined?0:beat-previous;
    previous=beat;
    const target=Math.max(0,Math.min(1,pitch));
    const omega=3, offset=state.pitch-target;
    const c=state.velocity+omega*offset, decay=Math.exp(-omega*dt);
    state.pitch=target+(offset+c*dt)*decay;
    state.velocity=(state.velocity-omega*c*dt)*decay;
    state.pull+=(Math.sqrt(Math.max(0,Math.min(1,melody)))-state.pull)*(1-Math.exp(-dt*2.5));
    return state;
  };
}
