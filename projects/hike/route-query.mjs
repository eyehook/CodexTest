// Projection is shared by gameplay and worker-side terrain sampling.
export function createRouteQuery(profile,half){
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),buckets=new Map(),cell=24;
 for(let i=1;i<profile.length;i++){
  const a=profile[i-1],p=profile[i],margin=half+12;
  for(let bx=Math.floor((Math.min(a.x,p.x)-margin)/cell);bx<=Math.floor((Math.max(a.x,p.x)+margin)/cell);bx++)
   for(let bz=Math.floor((Math.min(a.z,p.z)-margin)/cell);bz<=Math.floor((Math.max(a.z,p.z)+margin)/cell);bz++){
    const key=bx+','+bz;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i-1);
   }
 }
  function project(x,z,out,global=false) {
    const list=global?null:buckets.get(Math.floor(x/cell)+','+Math.floor(z/cell));
    let nearest=Infinity,index=0,u=0;
    for(let k=0;k<(global?profile.length-1:list?.length??0);k++) {
      const i=global?k:list[k],a=profile[i],b=profile[i+1],dx=b.x-a.x,dz=b.z-a.z;
      const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1),d=(x-a.x-t*dx)**2+(z-a.z-t*dz)**2;
      if(d<nearest){nearest=d;index=i;u=t;}
    }
    const a=profile[index],b=profile[index+1];
    out.distance=Math.sqrt(nearest);out.height=a.y+(b.y-a.y)*u;out.along=a.distance+(b.distance-a.distance)*u;
    return out;
  }
 return project;
}
