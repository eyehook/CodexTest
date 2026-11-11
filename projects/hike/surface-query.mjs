// Shared CPU walking-surface queries, used by collision and the sampling worker.
export function createSurfaceQuery({vertices,walking,cells,lookup}){
 const STEP_X=.5,STEP_Z=1,SCALE=4,walkingSet=new Set(walking);
 function locate(x,z){
  const cx=Math.floor(x/STEP_X),cz=Math.floor(z/STEP_Z),xs=Math.abs(x/STEP_X-cx)<1e-8?[cx,cx-1]:[cx],zs=Math.abs(z/STEP_Z-cz)<1e-8?[cz,cz-1]:[cz];let bank=null;
  for(const xx of xs)for(const zz of zs)for(const ids of cells.get(xx+','+zz)??[]){
   const a=vertices[ids[0]],b=vertices[ids[1]],c=vertices[ids[2]],det=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(det)<1e-12)continue;
   const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/det,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/det;
   if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7){const hit={ids,weights:[u,v,1-u-v]};if(walkingSet.has(ids))return hit;bank??=hit;}
  }
  return bank;
 }
 function sample(x,z){const id=lookup.get(x*SCALE+','+z*SCALE);if(id!==undefined)return vertices[id].y;const hit=locate(x,z);return hit?hit.ids.reduce((sum,id,i)=>sum+vertices[id].y*hit.weights[i],0):null;}
 function normal(x,z,out){const hit=locate(x,z);if(!hit)return null;const [a,b,c]=hit.ids.map(id=>vertices[id]),dx=b.x-a.x,dz=b.z-a.z,ex=c.x-a.x,ez=c.z-a.z,det=dx*ez-dz*ex,gx=((b.y-a.y)*ez-(c.y-a.y)*dz)/det,gz=(dx*(c.y-a.y)-ex*(b.y-a.y))/det,length=Math.hypot(gx,1,gz);out.x=-gx/length;out.y=1/length;out.z=-gz/length;out.slope=Math.atan(Math.hypot(gx,gz))*180/Math.PI;return out;}
 return {locate,sample,normal};
}
