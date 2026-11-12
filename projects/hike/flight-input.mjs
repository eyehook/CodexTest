import {ButtonEdges} from '../../shared/xr/input.mjs';
// A/X are both xr-standard button 4. Keep sampling during flight/landing so held
// activation cannot retrigger. B/Y open settings or save and close it.
export class FlightButtons {
 constructor(){this.edges=new ButtonEdges();this.tracked=new Map();this.result={launch:false,settings:false};}
 reset(){this.edges.reset();this.tracked.clear();this.result.launch=this.result.settings=false;}
 update(sources,state){
  const out=this.result;out.launch=out.settings=false;this.edges.retain(sources);
  for(const source of this.tracked.keys()){let found=false;for(const connected of sources)if(connected===source){found=true;break;}if(!found)this.tracked.delete(source);}
  for(const source of sources){
   if(source.gamepad?.mapping!=='xr-standard')continue;
   const tracked=state.isTracked(source.targetRaySpace),seed=state.resumed||!tracked||!this.tracked.get(source);this.tracked.set(source,tracked);
   out.launch=this.edges.sample(source,4,seed).pressed||out.launch;const menu=this.edges.sample(source,5,seed).pressed;out.settings=menu||out.settings;
  }
  return out;
 }
}
