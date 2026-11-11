// A* over the common heightfield. No radial/spiral assumption and no terrain generation.
export function generateTrail(landscape,config,navigationStep=8){
 const step=navigationStep,extent=landscape.extent,n=Math.round(extent*2/step)+1,count=n*n;
 const {height}=landscape,start=config.start?{...config.start,y:height(config.start.x,config.start.z)}:landscape.start,end=config.end?{...config.end,y:height(config.end.x,config.end.z)}:landscape.summit;
 const heights=new Float32Array(count);for(let z=0;z<n;z++)for(let x=0;x<n;x++)heights[z*n+x]=height(-extent+x*step,-extent+z*step);
 const index=p=>Math.max(1,Math.min(n-2,Math.round((p.z+extent)/step)))*n+Math.max(1,Math.min(n-2,Math.round((p.x+extent)/step)));
 const startIndex=index(start),endIndex=index(end),cost=new Float64Array(count),parent=new Int32Array(count),closed=new Uint8Array(count);
 const heapIds=[],heapCosts=[];
 function push(id,value){let i=heapIds.length;heapIds.push(id);heapCosts.push(value);while(i){const p=(i-1)>>1;if(heapCosts[p]<=value)break;heapIds[i]=heapIds[p];heapCosts[i]=heapCosts[p];i=p;}heapIds[i]=id;heapCosts[i]=value;}
 function pop(){const first=heapIds[0],id=heapIds.pop(),value=heapCosts.pop();if(heapIds.length){let i=0;while(i*2+1<heapIds.length){let child=i*2+1;if(child+1<heapIds.length&&heapCosts[child+1]<heapCosts[child])child++;if(heapCosts[child]>=value)break;heapIds[i]=heapIds[child];heapCosts[i]=heapCosts[child];i=child;}heapIds[i]=id;heapCosts[i]=value;}return first;}
 function path(from,to,penalty,avoid=null){
  cost.fill(Infinity);parent.fill(-1);closed.fill(0);heapIds.length=heapCosts.length=0;cost[from]=0;
  const tx=to%n,tz=Math.floor(to/n);push(from,0);
  let visits=0;
  while(heapIds.length&&visits<count){const i=pop();if(closed[i])continue;closed[i]=1;visits++;if(i===to)break;const x=i%n,z=Math.floor(i/n);
   for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
    if(!dx&&!dz||x+dx<1||x+dx>=n-1||z+dz<1||z+dz>=n-1)continue;
    const j=i+dx+dz*n;if(closed[j]||(avoid?.has(j)&&j!==to))continue;
    const d=step*Math.hypot(dx,dz),rise=heights[j]-heights[i],grade=Math.abs(rise)/d;
    const next=cost[i]+d*(1+grade*grade*penalty+Math.max(0,grade-.32)**2*500)+Math.max(0,-rise)*2;
    if(next>=cost[j])continue;cost[j]=next;parent[j]=i;push(j,next+step*Math.hypot(tx-x-dx,tz-z-dz));
   }
  }
  if(!Number.isFinite(cost[to]))return null;
  const result=[];for(let i=to;i!==-1;i=parent[i]){result.push(i);if(i===from)break;}return result.reverse();
 }
 function eraseCrossings(points){
  for(let pass=0;pass<100;pass++){
   let changed=false;
   outer:for(let i=0;i<points.length-3;i++)for(let j=i+2;j<points.length-1;j++){
    const a=points[i],b=points[i+1],c=points[j],d=points[j+1],rx=b.x-a.x,rz=b.z-a.z,sx=d.x-c.x,sz=d.z-c.z,den=rx*sz-rz*sx;
    if(Math.abs(den)<1e-8)continue;
    const t=((c.x-a.x)*sz-(c.z-a.z)*sx)/den,u=((c.x-a.x)*rz-(c.z-a.z)*rx)/den;
    if(t>1e-6&&t<1-1e-6&&u>1e-6&&u<1-1e-6){points.splice(i+1,j-i,{x:a.x+t*rx,z:a.z+t*rz});changed=true;break outer;}
   }
   if(!changed)break;
  }
  // Width-aware loop erasure uses a spatial hash, avoiding repeated all-pairs
  // scans after corner rounding creates many closely spaced route samples.
  const radius=config.trailWidth+3,bins=new Map(),result=[],distances=[];
  for(const point of points){
   let along=result.length?distances.at(-1)+Math.hypot(point.x-result.at(-1).x,point.z-result.at(-1).z):0;
   const bx=Math.floor(point.x/radius),bz=Math.floor(point.z/radius);let earliest=Infinity;
   for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const entry of bins.get((bx+dx)+','+(bz+dz))??[]){
    if(result[entry.index]!==entry.point||along-distances[entry.index]<=12)continue;
    if(Math.hypot(point.x-entry.point.x,point.z-entry.point.z)<radius)earliest=Math.min(earliest,entry.index);
   }
   if(Number.isFinite(earliest)){result.length=distances.length=earliest+1;along=distances.at(-1)+Math.hypot(point.x-result.at(-1).x,point.z-result.at(-1).z);}
   const key=bx+','+bz;if(!bins.has(key))bins.set(key,[]);bins.get(key).push({index:result.length,point});result.push(point);distances.push(along);
  }
  points=result;
  return points;
 }
 function engineer(ids){
  if(!ids)return null;
  let points=ids.map(i=>({x:-extent+(i%n)*step,z:-extent+Math.floor(i/n)*step}));points[0]={...start};points[points.length-1]={...end};
  points=eraseCrossings(points);
  // Chaikin rounding retains terrain-aware routing and removes grid corners.
  for(let pass=0;pass<2;pass++){const rounded=[points[0]];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];rounded.push({x:a.x*.75+b.x*.25,z:a.z*.75+b.z*.25},{x:a.x*.25+b.x*.75,z:a.z*.25+b.z*.75});}rounded.push(points.at(-1));points=rounded;}
  points=eraseCrossings(points);
  const distances=[0];for(let i=1;i<points.length;i++)distances.push(distances.at(-1)+Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z));
  const route=[];let segment=1;
  for(let i=0;i<=800;i++){const d=distances.at(-1)*i/800;while(segment<points.length-1&&distances[segment]<d)segment++;const a=points[segment-1],b=points[segment],u=(d-distances[segment-1])/(distances[segment]-distances[segment-1]||1),x=a.x+(b.x-a.x)*u,z=a.z+(b.z-a.z)*u;route.push({x,z,y:height(x,z)});}
  route[0]={...start};route[800]={...end};
  for(let pass=0;pass<160;pass++){
   for(let i=1;i<800;i++)route[i].y=route[i].y*.5+(route[i-1].y+route[i+1].y)*.25;
   for(let i=1;i<800;i++){const a=route[i-1],b=route[i],d=Math.hypot(a.x-b.x,a.z-b.z)*.30;b.y=Math.max(a.y-d,Math.min(a.y+d,b.y));}
   for(let i=799;i>0;i--){const a=route[i+1],b=route[i],d=Math.hypot(a.x-b.x,a.z-b.z)*.30;b.y=Math.max(a.y-d,Math.min(a.y+d,b.y));}
  }
  let length=0,maxGrade=0,maxEarthwork=0,earthworks=0;
  for(let i=0;i<route.length;i++){const p=route[i],cut=Math.abs(p.y-height(p.x,p.z));maxEarthwork=Math.max(maxEarthwork,cut);earthworks+=cut*cut;if(i){const a=route[i-1],d=Math.hypot(a.x-p.x,a.z-p.z);length+=Math.hypot(d,a.y-p.y);maxGrade=Math.max(maxGrade,Math.abs(a.y-p.y)/(d||1));}p.distance=length;}
  return {route,length,maxGrade,maxEarthwork,score:earthworks/801};
 }
 let best=null,bestCost=Infinity;
 function consider(ids){const c=engineer(ids);if(!c||c.maxGrade>.301)return;const cost=Math.abs(c.length-config.targetLength)+c.maxEarthwork*8+c.score*2;if(cost<bestCost){best=c;bestCost=cost;}return c;}
 for(const penalty of [1,6,18,55,180])consider(path(startIndex,endIndex,penalty));
 // Scenic intermediate passes lengthen a direct ascent without imposing a
 // mountain-shaped route. Both legs still use the same terrain-cost search.
 const dx=end.x-start.x,dz=end.z-start.z,d=Math.hypot(dx,dz)||1,mx=(start.x+end.x)/2,mz=(start.z+end.z)/2;
 if(!best||Math.abs(best.length-config.targetLength)>75){
  for(const penalty of [6,55])for(const offset of [240,-240,400,-400,560,-560]){
   const waypoint=index({x:mx-dz/d*offset,z:mz+dx/d*offset}),first=path(startIndex,waypoint,penalty);if(!first)continue;
   const avoid=new Set();
   for(const id of first)for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){const j=id+dx+dz*n;if(Math.hypot(j%n-waypoint%n,Math.floor(j/n)-Math.floor(waypoint/n))>3)avoid.add(j);}
   const second=path(waypoint,endIndex,penalty);if(!second)continue;consider(first.concat(second.slice(1)));
  }
 }
 if(!best)throw Error('No validated terrain route between these endpoints');
 // Refine difficult approaches rather than accepting a coarse navigation shortcut.
 if(best.maxEarthwork>14&&navigationStep===8){
  const fine=generateTrail(landscape,config,4);
  if(fine.maxEarthwork<best.maxEarthwork&&Math.abs(fine.length-config.targetLength)<200)best=fine;
 }
 return best;
}
