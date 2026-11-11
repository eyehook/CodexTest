// Authoritative cached geology and trail definition; independent of render LOD.
import {createTrailSurface} from './trail-surface.mjs?v=trail-detail-3';
import {generateLandscape} from './geology.mjs?v=unified-2';
import {generateTrail} from './trail.mjs?v=trail-detail-3';
export const DEFAULTS = Object.freeze({seed: 41729, elevation: 220, trailWidth: 5, targetLength: 1600});
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = x => { x = clamp(x, 0, 1); return x*x*(3-2*x); };
export function createWorld(options = {}) {
  const began=performance.now(),config = {...DEFAULTS, ...options};
  if (![config.seed,config.elevation,config.trailWidth,config.targetLength].every(Number.isFinite) || config.elevation < 40 || config.elevation > 280 || config.trailWidth < 3 || config.trailWidth > 10 || config.targetLength < 200 || config.targetLength > 5000) throw Error('Invalid world configuration');
  for(const p of [config.start,config.end])if(p&&(!Number.isFinite(p.x)||!Number.isFinite(p.z)||Math.abs(p.x)>=1920||Math.abs(p.z)>=1920))throw Error('Endpoints must lie within the terrain map');
  const landscape=generateLandscape(config),rawHeight=landscape.height,ascent=generateTrail(landscape,config);
  const route=ascent.route, buckets=new Map(), cell=24, half=config.trailWidth/2;
  let totalLength=0,maxGrade=0,maxEarthwork=0;
  for(let i=0;i<route.length;i++) {
    const p=route[i]; p.distance=totalLength;
    maxEarthwork=Math.max(maxEarthwork,Math.abs(p.y-rawHeight(p.x,p.z)));
    if(!i)continue;
    const a=route[i-1],d=Math.hypot(p.x-a.x,p.z-a.z),len=Math.hypot(d,p.y-a.y);
    totalLength+=len;p.distance=totalLength;maxGrade=Math.max(maxGrade,Math.abs(p.y-a.y)/d);
    const margin=half+12;
    for(let bx=Math.floor((Math.min(a.x,p.x)-margin)/cell);bx<=Math.floor((Math.max(a.x,p.x)+margin)/cell);bx++)
      for(let bz=Math.floor((Math.min(a.z,p.z)-margin)/cell);bz<=Math.floor((Math.max(a.z,p.z)+margin)/cell);bz++) {
        const key=bx+','+bz; if(!buckets.has(key))buckets.set(key,[]); buckets.get(key).push(i-1);
      }
  }
  if(maxGrade>.301 || totalLength<100) throw Error('Route validation failed; revise world parameters');
  const profile=route.map(p=>({...p}));
  function project(x,z,out,global=false) {
    const list=global?null:buckets.get(Math.floor(x/cell)+','+Math.floor(z/cell));
    let nearest=Infinity,index=0,u=0;
    for(let k=0;k<(global?route.length-1:list?.length??0);k++) {
      const i=global?k:list[k],a=profile[i],b=profile[i+1],dx=b.x-a.x,dz=b.z-a.z;
      const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1),d=(x-a.x-t*dx)**2+(z-a.z-t*dz)**2;
      if(d<nearest){nearest=d;index=i;u=t;}
    }
    const a=profile[index],b=profile[index+1];
    out.distance=Math.sqrt(nearest);out.height=a.y+(b.y-a.y)*u;out.along=a.distance+(b.distance-a.distance)*u;
    return out;
  }
  const scratch={};
  function coarseHeight(x,z) { const raw=rawHeight(x,z);project(x,z,scratch); const weight=1-smooth((scratch.distance-half)/9); return raw+(scratch.height-raw)*weight; }
  let surface=null;
  function height(x,z){return surface?.sample(x,z)??coarseHeight(x,z);}
  function normal(x,z,out={}) { if(surface?.normal(x,z,out))return out;const e=.35,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e),s=Math.hypot(dx,1,dz);out.x=-dx/s;out.y=1/s;out.z=-dz/s;out.slope=Math.atan(Math.hypot(dx,dz))*180/Math.PI;return out; }
  surface=createTrailSurface({route,width:config.trailWidth,height:coarseHeight,project});
  totalLength=0;maxGrade=0;maxEarthwork=0;
  for(let i=0;i<route.length;i++){const p=route[i];p.y=height(p.x,p.z);maxEarthwork=Math.max(maxEarthwork,Math.abs(p.y-rawHeight(p.x,p.z)));if(i){const a=route[i-1],d=Math.hypot(a.x-p.x,a.z-p.z);totalLength+=Math.hypot(d,p.y-a.y);maxGrade=Math.max(maxGrade,Math.abs(p.y-a.y)/(d||1));}p.distance=totalLength;profile[i].distance=totalLength;}
  surface.maxWalkingSlope=surface.walking.reduce((max,ids)=>Math.max(max,surface.slope(ids)),0);
  if(surface.maxWalkingSlope>30||maxGrade>.301)throw Error('The trail surface could not meet its walking slope limits');
  return {surface,config,landscape,mountain:landscape,extent:landscape.extent,boundaryHeight:landscape.boundaryHeight,landmarks:[ascent.route[0],ascent.route.at(-1)],sections:[{kind:'ground',start:0,end:route.length-1}],generationMs:performance.now()-began,rawHeight,height,normal,trail:(x,z,out={},global=false)=>{project(x,z,out,global);if(out.distance<=half){const value=surface.sample(x,z);if(value!==null)out.height=value;}return out;},route,totalLength,maxGrade,maxEarthwork,start:route[0],summit:route.at(-1)};
}
