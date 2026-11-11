// Continuous, overlapping earthwork shoulders. Shared by collision and workers.
export function createBankHeight(profile,half,rawHeight,project){
 const size=32,buckets=new Map(),segments=[],near={};
 for(let i=1;i<profile.length;i++){
  const a=profile[i-1],b=profile[i],dx=b.x-a.x,dz=b.z-a.z;
  const cut=Math.max(...[0,.5,1].map(t=>Math.abs(a.y+(b.y-a.y)*t-rawHeight(a.x+dx*t,a.z+dz*t))));
  // Deep cuts/fills need room to return to the mountain without a steep wall.
  const radius=Math.max(9,cut*5),reach=half+radius;
  const id=segments.length;segments.push({a,b,dx,dz,length2:dx*dx+dz*dz,radius});
  for(let x=Math.floor((Math.min(a.x,b.x)-reach)/size);x<=Math.floor((Math.max(a.x,b.x)+reach)/size);x++)
   for(let z=Math.floor((Math.min(a.z,b.z)-reach)/size);z<=Math.floor((Math.max(a.z,b.z)+reach)/size);z++){
    const key=x+','+z;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(id);
   }
 }
 return function height(x,z){
  project(x,z,near);if(near.distance<=half)return near.height;
  const raw=rawHeight(x,z);let correction=0,total=1;
  for(const id of buckets.get(Math.floor(x/size)+','+Math.floor(z/size))??[]){
   const {a,b,dx,dz,length2,radius}=segments[id];
   const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(length2||1)));
   const edge=Math.hypot(x-a.x-t*dx,z-a.z-t*dz)-half;
   if(edge>=radius)continue;
   // Infinite weight at the tread, zero value and derivative at the shoulder.
   // All nearby legs participate: no nearest-leg height jump between switchbacks.
   const weight=(radius/Math.max(edge,1e-6)-1)**2;
   correction+=(a.y+(b.y-a.y)*t-raw)*weight;total+=weight;
  }
  return raw+correction/total;
 };
}
