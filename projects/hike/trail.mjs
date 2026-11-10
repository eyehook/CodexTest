// Contour-following ascent around the generated mountain, not a fixed world-space ribbon.
export function generateTrail(mountain,config){
 const {height,summit}=mountain,steps=800,randomPhase=(config.seed>>>0)/4294967296*Math.PI*2;
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function point(level,angle,out){
  let lo=0,hi=720;const dx=Math.cos(angle),dz=Math.sin(angle);
  for(let j=0;j<23;j++){const r=(lo+hi)/2;if(height(summit.x+dx*r,summit.z+dz*r)>level)lo=r;else hi=r;}
  const r=(lo+hi)/2;out.x=summit.x+dx*r;out.z=summit.z+dz*r;out.y=height(out.x,out.z);return out;
 }
 const starts=[];
 for(let i=0;i<24;i++){
  const angle=-Math.PI/2+randomPhase+i*Math.PI*2/24,p=point(summit.y*.008,angle,{});let clearance=Infinity;
  for(let j=1;j<100;j++){const t=j/100,y=p.y+1.7+(summit.y+17-p.y-1.7)*t;clearance=Math.min(clearance,y-height(p.x+(summit.x-p.x)*t,p.z+(summit.z-p.z)*t));}
  if(clearance>0)starts.push({angle,clearance});
 }
 if(!starts.length)throw Error('No visible trailhead for this mountain');
 starts.sort((a,b)=>b.clearance-a.clearance);
 function candidate(angle,k,direction){
  const route=[];
  for(let i=0;i<=steps;i++){
   if(i===steps){route.push({...summit});continue;}
   const t=i/steps,a=angle+direction*k*(Math.log(1.008/(1-t+.008))+.025*Math.sin(t*Math.PI*8));
   route.push(point(summit.y*(.008+.992*t),a,{}));
  }
  // Remove pixel-scale contour wiggles before engineering the walking tread.
  const x=new Float64Array(steps+1),z=new Float64Array(steps+1);
  for(let pass=0;pass<5;pass++){
   for(let i=1;i<steps;i++){x[i]=(route[i-1].x+route[i+1].x+route[i].x*2)/4;z[i]=(route[i-1].z+route[i+1].z+route[i].z*2)/4;}
   for(let i=1;i<steps;i++){route[i].x=x[i];route[i].z=z[i];}
  }
  for(const p of route)p.y=height(p.x,p.z);
  for(let pass=0;pass<100;pass++){
   for(let i=1;i<steps;i++)route[i].y=route[i].y*.5+(route[i-1].y+route[i+1].y)*.25;
   for(let i=1;i<steps;i++){const a=route[i-1],b=route[i],d=Math.hypot(a.x-b.x,a.z-b.z)*.30;b.y=clamp(b.y,a.y-d,a.y+d);}
   for(let i=steps-1;i>0;i--){const a=route[i+1],b=route[i],d=Math.hypot(a.x-b.x,a.z-b.z)*.30;b.y=clamp(b.y,a.y-d,a.y+d);}
  }
  let length=0,score=0,maxEarthwork=0,maxGrade=0;
  for(let i=0;i<=steps;i++){
   const p=route[i],cut=Math.abs(p.y-height(p.x,p.z));score+=cut*cut;maxEarthwork=Math.max(maxEarthwork,cut);
   if(i){const a=route[i-1],d=Math.hypot(a.x-p.x,a.z-p.z);length+=Math.hypot(d,a.y-p.y);maxGrade=Math.max(maxGrade,Math.abs(p.y-a.y)/(d||1));}p.distance=length;
  }
  return {route,length,score,maxEarthwork,maxGrade};
 }
 let best=null,bestCost=Infinity;
 function consider(c){
  if(c.maxGrade>.301||c.length<1500||c.length>1700)return;
  const cost=c.score+c.maxEarthwork*c.maxEarthwork*50+((c.length-config.targetLength)*.6)**2;
  if(cost<bestCost){best=c;bestCost=cost;}
 }
 function search(aspects,direction){
  for(const {angle} of aspects){
   let lo=.05,hi=5;
   let upper=candidate(angle,hi,direction);consider(upper);
   // Compact/steep mountains can need more winding than the normal bracket.
   while(upper.length<config.targetLength&&hi<20){hi*=2;upper=candidate(angle,hi,direction);consider(upper);}
   for(let j=0;j<15;j++){
    const k=(lo+hi)/2,c=candidate(angle,k,direction);
    // Contours may change branches around gullies: route length is not strictly
    // monotonic in winding. Keep every valid trial, not just the last bisection.
    consider(c);
    if(c.length<config.targetLength)lo=k;else hi=k;
   }
  }
 }
 const preferred=(config.seed&1)?1:-1;
 search(starts.slice(0,8),preferred);
 if(!best)search(starts,-preferred);
 if(!best)search(starts.slice(8),preferred);
 if(!best)throw Error('No validated mountain ascent for this seed');
 return best;
}
