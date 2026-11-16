import {destinationHeight} from './summit-cut.mjs?v=1';
import {createBankHeight} from './bank-height.mjs';
import {createSurfaceQuery} from './surface-query.mjs?v=numeric-1';
import {createRouteQuery} from './route-query.mjs';
// Reconstruct only read-only queries from the existing world's data. No erosion,
// routing, clipping, slope solving, mesh generation or random work in the worker.
export function createTerrainSampler(data){
 const {config,landscape,destination,profile}=data,{heights,gridSize:n,gridStep:step,extent,boundaryHeight}=landscape;
 const surface=createSurfaceQuery(data.surface),half=config.trailWidth/2,project=createRouteQuery(profile,half);
 function rawHeight(x,z){
  const gx=(x+extent)/step,gz=(z+extent)/step;if(gx<0||gz<0||gx>=n-1||gz>=n-1)return boundaryHeight;
  const ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz,i=iz*n+ix,a=heights[i],b=heights[i+1],c=heights[i+n],d=heights[i+n+1];
  return (a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v;
 }
 const bankHeight=createBankHeight(profile,half,(x,z)=>destinationHeight(data.summitCut,destination,x,z,rawHeight(x,z)),project);
 function height(x,z){
  return surface.sample(x,z)??bankHeight(x,z);
 }
 function normal(x,z,out){
  if(surface.normal(x,z,out))return out;
  const e=.35,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e),s=Math.hypot(dx,1,dz);
  out.x=-dx/s;out.y=1/s;out.z=-dz/s;out.slope=Math.atan(Math.hypot(dx,dz))*180/Math.PI;return out;
 }
 return {height,normal,trail:project,config,landscape};
}
