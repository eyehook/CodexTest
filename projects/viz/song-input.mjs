import {deadzone} from '../../shared/xr/input.mjs';

// Each source must return toward neutral before another rightward skip.
export function songSkipInput() {
  const held=new Map();
  return (sources=[],absorb=false)=>{
    const current=new Set(sources);
    for(const source of held.keys()) if(!current.has(source)) held.delete(source);
    let skip=false;
    for(const source of sources) {
      const axes=source.gamepad?.axes;
      const x=axes?.[axes.length>=4?2:0] ?? 0;
      const right=deadzone(x,.65,false)>0;
      if(right && held.get(source)===false && !absorb) skip=true;
      if(!held.has(source) || absorb || right || Math.abs(x)<.25) held.set(source,right);
    }
    return skip;
  };
}
