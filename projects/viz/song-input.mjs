import {deadzone} from '../../shared/xr/input.mjs';

// One action per gesture, across both axes. Absorb entry/recovery holds and
// require both axes near neutral before rearming. This avoids diagonal skips.
export function musicStickInput() {
  const held=new Map(),result={skip:false,tempo:0};
  return (sources=[],absorb=false)=>{
    result.skip=false;result.tempo=0;
    const current=new Set(sources);
    for(const source of held.keys())if(!current.has(source))held.delete(source);
    for(const source of sources){
      const axes=source.gamepad?.axes,offset=axes?.length>=4?2:0;
      const rawX=axes?.[offset],rawY=axes?.[offset+1];
      const x=Number.isFinite(rawX)?rawX:0,y=Number.isFinite(rawY)?rawY:0;
      const neutral=Math.max(Math.abs(x),Math.abs(y))<.25;
      if(absorb || !held.has(source)){held.set(source,!neutral);continue;}
      if(neutral){held.set(source,false);continue;}
      if(held.get(source))continue;
      if(deadzone(x,.65,false)>0 && Math.abs(x)>Math.abs(y)){
        result.skip=true;held.set(source,true);
      }else if(deadzone(y,.65,false)!==0 && Math.abs(y)>Math.abs(x)){
        result.tempo-=Math.sign(y);held.set(source,true);
      }
    }
    // Two simultaneous upward pushes are still one 5 BPM adjustment.
    result.tempo=Math.sign(result.tempo);
    return result;
  };
}

// Existing project callers/tests can still request only the skip action.
export function songSkipInput() {
  const sample=musicStickInput();
  return (sources,absorb)=>sample(sources,absorb).skip;
}
