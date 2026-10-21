import {MIN_LINE_LENGTH} from './LinePhysics.mjs';
// Central tuning seam for future location, bait and species rules.
export const FISHING_RULES=Object.freeze({waitMin:3,waitMax:6,nibbleMin:2,nibbleMax:7,gapMin:.5,gapMax:2,biteWindow:1,sizeMin:.5,sizeMax:2.5,baseWeightKg:.35,holdTime:2,fadeTime:1,settleTime:.4});
export class FishEncounter {
 constructor({random=Math.random,rules=FISHING_RULES}={}){this.random=random;this.rules=rules;this.reset();}
 reset(){this.phase='idle';this.time=0;this.settled=0;this.remainingNibbles=0;this.opacity=1;this.hue=0;this.size=1;this.weightKg=0;}
 range(min,max){return min+(max-min)*Math.min(1-Number.EPSILON,Math.max(0,this.random()));}
 update(dt,resting,reeling,length,minimum=MIN_LINE_LENGTH){
  dt=Math.min(.05,Math.max(0,dt));if(!dt)return null;
  const r=this.rules;
  if(this.phase==='caught'){
   this.time+=dt;this.opacity=this.time<=r.holdTime+1e-9?1:Math.max(0,1-(this.time-r.holdTime)/r.fadeTime);
   if(this.time>=r.holdTime+r.fadeTime-1e-9)this.reset();return null;
  }
  if(this.phase==='hooked'){
   if(length<=minimum+1e-9){this.phase='caught';this.time=0;this.opacity=1;}
   return null;
  }
  if(this.phase==='bite'){
   this.time-=dt;
   if(reeling&&this.time>=-1e-9){this.phase='hooked';this.hue=this.range(0,1);this.size=this.range(r.sizeMin,r.sizeMax);this.weightKg=r.baseWeightKg*this.size**3;return 'hooked';}
   if(this.time<=0){this.reset();return 'lost';}return null;
  }
  // Any retrieval before the bite cancels the encounter, with a fresh delay
  // once the player stops retrieving and the bobber settles again.
  // Waiting is only a delay before another fish arrives, not a new fish to lose.
  if(reeling){const lost=this.phase==='nibbling';this.reset();return lost?'lost':null;}
  if(this.phase==='idle'){
   this.settled=resting?this.settled+dt:0;
   if(this.settled>=r.settleTime-1e-9){this.phase='waiting';this.time=this.range(r.waitMin,r.waitMax);}
   return null;
  }
  if(!resting){this.reset();return null;}
  this.time-=dt;if(this.time>1e-9)return null;
  if(this.phase==='waiting'){
   this.phase='nibbling';this.remainingNibbles=Math.floor(this.range(r.nibbleMin,r.nibbleMax+1));
  }
  if(this.remainingNibbles>0){
   this.remainingNibbles--;this.time=this.range(r.gapMin,r.gapMax);return 'nibble';
  }
  this.phase='bite';this.time=r.biteWindow;return 'bite';
 }
}
