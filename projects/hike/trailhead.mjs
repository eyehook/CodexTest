// Select existing low benches; never modify the geological heightfield.
export function selectTrailhead({height,summit,extent}){
 const candidates=[],directions=Array.from({length:16},(_,i)=>({x:Math.cos(i*Math.PI/8),z:Math.sin(i*Math.PI/8)}));
 // A bounded search around the summit avoids the artificial map-edge apron.
 for(let z=Math.ceil((summit.z-900)/15)*15;z<=summit.z+900;z+=15)for(let x=Math.ceil((summit.x-900)/15)*15;x<=summit.x+900;x+=15){
  const distance=Math.hypot(x-summit.x,z-summit.z);
  if(distance<500||distance>900||Math.max(Math.abs(x),Math.abs(z))>extent-180)continue;
  const y=height(x,z);if(y>summit.y*.35)continue;
  let relief=0,slope=0,enclosure=0;
  for(const d of directions){
   const near=height(x+d.x*15,z+d.z*15),far=height(x+d.x*30,z+d.z*30);
   relief+=(near-y)**2+(far-y)**2;slope=Math.max(slope,Math.abs(near-y)/15);
   enclosure+=Math.max(0,far-y);
  }
  const score=y*.45+Math.sqrt(relief/32)*4+Math.max(0,slope-.12)*100+enclosure/16*2;
  candidates.push({x,y,z,score});
 }
 if(!candidates.length)throw Error('No low trailhead candidates within hiking range');
 candidates.sort((a,b)=>a.score-b.score);
 let best=null,bestScore=Infinity;
 // Compare broad, 90 m approaches in the summit-facing half-plane. Sampling
 // three lanes prevents a narrow erosion groove from looking like an easy exit.
 for(const candidate of candidates.slice(0,32)){
  let exit=Infinity;
  for(const d of directions){
   if(d.x*(summit.x-candidate.x)+d.z*(summit.z-candidate.z)<0)continue;
   let cost=0;
   for(const lane of [-5,0,5]){
    let previous=height(candidate.x-d.z*lane,candidate.z+d.x*lane);
    for(let distance=10;distance<=90;distance+=10){
     const y=height(candidate.x+d.x*distance-d.z*lane,candidate.z+d.z*distance+d.x*lane),grade=Math.abs(y-previous)/10;
     cost+=grade*grade*10+Math.max(0,grade-.20)**2*400;previous=y;
    }
   }
   exit=Math.min(exit,cost/3);
  }
  const score=candidate.score+exit*3;
  if(score<bestScore){bestScore=score;best=candidate;}
 }
 return {x:best.x,y:best.y,z:best.z};
}
