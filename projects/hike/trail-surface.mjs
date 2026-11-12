import {createSurfaceQuery} from './surface-query.mjs?v=numeric-1';
import {SCALE,rect,offsetRoute,boolean,triangulate,PointIndex} from './planar.mjs?v=trail-detail-3';
const SIZE=128,STEP_X=.5,STEP_Z=1;
export function createTrailSurface({route,width,height,project,destinationRadius=0}){
 const began=performance.now(),half=width/2,innerPaths=offsetRoute(route,half),tiles=new Map();
 const vertices=[],lookup=new Map(),walking=[],banks=[],cells=new Map(),near={};
 function vertex(p){const key=p.X+','+p.Y;let id=lookup.get(key);if(id===undefined){id=vertices.length;const x=p.X/SCALE,z=p.Y/SCALE;vertices.push({x,z,y:height(x,z),fixed:Math.hypot(x-route[0].x,z-route[0].z)<1.1||Math.hypot(x-route.at(-1).x,z-route.at(-1).z)<1.1});lookup.set(key,id);}return id;}
 function emit(record,kind,a,b,c,keys){
  const area=(b.X-a.X)*(c.Y-a.Y)-(b.Y-a.Y)*(c.X-a.X);if(Math.abs(area)<1e-10)return;
  const tri=[vertex(a),vertex(b),vertex(c)];if(area>0)[tri[1],tri[2]]=[tri[2],tri[1]];
  record.triangles.push({ids:tri,walking:kind==='walk',keys});(kind==='walk'?walking:banks).push(tri);
  for(const key of keys){if(!cells.has(key))cells.set(key,[]);cells.get(key).push(tri);}
 }
 const tileKeys=new Set();for(const p of route)for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)tileKeys.add((Math.floor(p.x/SIZE)+dx)*SIZE+','+(Math.floor(p.z/SIZE)+dz)*SIZE);
 for(const key of tileKeys){
  const [x,z]=key.split(',').map(Number),mask=boolean(innerPaths,[rect(x,z,x+SIZE,z+SIZE)],'ctIntersection');if(!mask.paths.length)continue;
  const record={triangles:[]};tiles.set(key,record);
  let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;for(const path of mask.paths)for(const p of path){minX=Math.min(minX,p.X/SCALE);maxX=Math.max(maxX,p.X/SCALE);minZ=Math.min(minZ,p.Y/SCALE);maxZ=Math.max(maxZ,p.Y/SCALE);}
  for(let gx=Math.max(x,Math.floor(minX/2)*2);gx<Math.min(x+SIZE,Math.ceil(maxX/2)*2);gx+=2)for(let gz=Math.max(z,Math.floor(minZ/2)*2);gz<Math.min(z+SIZE,Math.ceil(maxZ/2)*2);gz+=2){
   project(gx+1,gz+1,near);if(near.distance>half+Math.SQRT2+.3)continue;
   const coarse=rect(gx,gz,gx+2,gz+2),intersect=boolean(mask.paths,[coarse],'ctIntersection');if(!intersect.paths.length)continue;

   const corePieces=[],coreBoundary=new PointIndex(),allKeys=[];
   for(let xx=gx;xx<gx+2;xx+=STEP_X)for(let zz=gz;zz<gz+2;zz+=STEP_Z){
    const cell=rect(xx,zz,xx+STEP_X,zz+STEP_Z),cellKey=Math.round(xx/STEP_X)+','+Math.round(zz/STEP_Z);allKeys.push(cellKey);
    project(xx+STEP_X/2,zz+STEP_Z/2,near);
    if(near.distance<half-Math.hypot(STEP_X,STEP_Z)/2-.3){corePieces.push(cell);for(const p of cell)coreBoundary.add(p);emit(record,'walk',cell[0],cell[3],cell[1],[cellKey]);emit(record,'walk',cell[1],cell[3],cell[2],[cellKey]);continue;}
    const core=boolean(intersect.paths,[cell],'ctIntersection');corePieces.push(...core.paths);for(const path of core.paths)for(const p of path)coreBoundary.add(p);
    triangulate(core.polygons,(a,b,c)=>emit(record,'walk',a,b,c,[cellKey]));
   }
   // Reuse the exact clipped walking boundary for the narrow bank. Subtraction
   // happens inside the same 2 m cell, so neighboring unchanged terrain needs no
   // overlays, extra full-tile detail, or independently rounded hole boundaries.
   const union=boolean(corePieces,[],'ctUnion'),outside=boolean([coarse],union.paths,'ctDifference');
   triangulate(outside.polygons,(a,b,c)=>emit(record,'bank',a,b,c,allKeys),coreBoundary);
  }
 }
 // Make all cut-cell joins conforming, including collinear points Earcut may
 // omit on a neighboring triangle. One indexed edge must mean the same thing
 // on the walking surface, its bank, and both sides of a cell boundary.
 const allPoints=new PointIndex();for(const p of vertices)allPoints.add({X:p.x*SCALE,Y:p.z*SCALE});
 for(const record of tiles.values()){
  const triangles=[];
  for(const triangle of record.triangles){
   const ring=[];
   for(let e=0;e<3;e++){
    const ai=triangle.ids[e],bi=triangle.ids[(e+1)%3],a=vertices[ai],b=vertices[bi];ring.push(ai);
    for(const p of allPoints.along({X:a.x*SCALE,Y:a.z*SCALE},{X:b.x*SCALE,Y:b.z*SCALE},1e-7)){const id=lookup.get(p.X+','+p.Y);if(id!==undefined)ring.push(id);}
   }
   if(ring.length===3){triangles.push(triangle);continue;}
   const abc=triangle.ids.map(id=>vertices[id]),center=vertex({X:(abc[0].x+abc[1].x+abc[2].x)/3*SCALE,Y:(abc[0].z+abc[1].z+abc[2].z)/3*SCALE});
   for(let i=0;i<ring.length;i++)triangles.push({ids:[center,ring[i],ring[(i+1)%ring.length]],walking:triangle.walking,keys:triangle.keys});
  }
  record.triangles=triangles;
 }
 walking.length=banks.length=0;cells.clear();
 for(const record of tiles.values())for(const triangle of record.triangles){(triangle.walking?walking:banks).push(triangle.ids);for(const key of triangle.keys){if(!cells.has(key))cells.set(key,[]);cells.get(key).push(triangle.ids);}}
 // Pin every walking triangle touching the arrival disk. Pinning the full
 // triangle preserves a level rendered/collision surface up to its edge, rather
 // than letting interpolation tip the rim between grid samples.
 if(destinationRadius>0){
  const end=route.at(-1),radius2=destinationRadius**2;
  for(const ids of walking){
   let touches=false,positive=false,negative=false;
   for(let i=0;i<3;i++){
    const a=vertices[ids[i]],b=vertices[ids[(i+1)%3]],dx=b.x-a.x,dz=b.z-a.z;
    const cross=dx*(end.z-a.z)-dz*(end.x-a.x);positive ||= cross>0;negative ||= cross<0;
    const u=Math.max(0,Math.min(1,((end.x-a.x)*dx+(end.z-a.z)*dz)/(dx*dx+dz*dz)));
    if((a.x+u*dx-end.x)**2+(a.z+u*dz-end.z)**2<=radius2)touches=true;
   }
   if(touches||!positive||!negative)for(const id of ids){vertices[id].fixed=true;vertices[id].y=end.y;}
  }
 }
 // Limit the actual walking planes, including tight inside bends. Shared edge
 // vertices move with them, so banks join the corrected tread without a gap.
 for(const p of vertices){if(p.fixed)p.y=Math.hypot(p.x-route[0].x,p.z-route[0].z)<1.1?route[0].y:route.at(-1).y;}
 const limit=Math.tan(28*Math.PI/180),coefficients=new Float64Array(walking.length*6);let passes=0;
 for(let i=0;i<walking.length;i++){
  const [a,b,c]=walking[i].map(j=>vertices[j]),det=(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x),k=i*6;
  coefficients[k]=(b.z-c.z)/det;coefficients[k+1]=(c.z-a.z)/det;coefficients[k+2]=(a.z-b.z)/det;
  coefficients[k+3]=(c.x-b.x)/det;coefficients[k+4]=(a.x-c.x)/det;coefficients[k+5]=(b.x-a.x)/det;
 }
 const queryData={vertices,walking,cells,lookup};
 const {locate,sample,normal}=createSurfaceQuery(queryData);
 const adjacent=Array.from({length:vertices.length},()=>[]),centerConstraints=[];
 walking.forEach((ids,i)=>{for(const id of ids)adjacent[id].push(i);});
 const samples=route.map(p=>locate(p.x,p.z));
 for(let i=1;i<route.length;i++){
  const a=samples[i-1],b=samples[i];if(!a||!b)continue;const coefficients=new Map();
  a.ids.forEach((id,j)=>coefficients.set(id,(coefficients.get(id)??0)-a.weights[j]));b.ids.forEach((id,j)=>coefficients.set(id,(coefficients.get(id)??0)+b.weights[j]));
  const entries=Array.from(coefficients).filter(([,value])=>Math.abs(value)>1e-10),constraint={entries,limit:.30*Math.hypot(route[i].x-route[i-1].x,route[i].z-route[i-1].z)};
  const id=walking.length+centerConstraints.length;centerConstraints.push(constraint);for(const [vertex] of entries)adjacent[vertex].push(id);
 }
 const constraints=walking.length+centerConstraints.length;
 const queue=new Int32Array(constraints),queued=new Uint8Array(constraints);let head=0,tail=0,pending=0,corrections=0;
 function enqueue(i){if(queued[i])return;queued[i]=1;queue[tail]=i;tail=(tail+1)%queue.length;pending++;}
 for(let i=0;i<constraints;i++)enqueue(i);
 const checkInterval=constraints*10,acceptable=Math.tan(29*Math.PI/180);
 function acceptableSurface(){
  for(const c of centerConstraints){let value=0;for(const [id,weight] of c.entries)value+=vertices[id].y*weight;if(Math.abs(value)>c.limit*1.001)return false;}
  for(let i=0;i<walking.length;i++){const [a,b,c]=walking[i].map(id=>vertices[id]),k=i*6,gx=coefficients[k]*a.y+coefficients[k+1]*b.y+coefficients[k+2]*c.y,gz=coefficients[k+3]*a.y+coefficients[k+4]*b.y+coefficients[k+5]*c.y;if(gx*gx+gz*gz>acceptable*acceptable)return false;}
  return true;
 }
 while(pending&&corrections<constraints*500){
  if(corrections&&corrections%checkInterval===0&&acceptableSurface())break;
  const i=queue[head];head=(head+1)%queue.length;pending--;queued[i]=0;corrections++;
  if(i>=walking.length){
   const constraint=centerConstraints[i-walking.length];let value=0,den=0;
   for(const [id,c] of constraint.entries){value+=vertices[id].y*c;if(!vertices[id].fixed)den+=c*c;}
   if(Math.abs(value)>constraint.limit*1.00001&&den>1e-20){const correction=(value-Math.sign(value)*constraint.limit)*1.001/den;for(const [id,c] of constraint.entries)if(!vertices[id].fixed){vertices[id].y-=c*correction;for(const neighbor of adjacent[id])if(neighbor!==i)enqueue(neighbor);}}
   continue;
  }
  const ids=walking[i],a=vertices[ids[0]],b=vertices[ids[1]],c=vertices[ids[2]],k=i*6;let changed=false;
  for(let iteration=0;iteration<6;iteration++){
   const gx=coefficients[k]*a.y+coefficients[k+1]*b.y+coefficients[k+2]*c.y,gz=coefficients[k+3]*a.y+coefficients[k+4]*b.y+coefficients[k+5]*c.y,mag=Math.hypot(gx,gz);if(mag<=limit*1.00001)break;
   const ca=a.fixed?0:(coefficients[k]*gx+coefficients[k+3]*gz)/mag,cb=b.fixed?0:(coefficients[k+1]*gx+coefficients[k+4]*gz)/mag,cc=c.fixed?0:(coefficients[k+2]*gx+coefficients[k+5]*gz)/mag,den=ca*ca+cb*cb+cc*cc;if(den<1e-20)break;
   const correction=(mag-limit)*1.001/den;a.y-=ca*correction;b.y-=cb*correction;c.y-=cc*correction;changed=true;
  }
  if(changed)for(const id of ids)for(const neighbor of adjacent[id])if(neighbor!==i)enqueue(neighbor);
 }
 passes=corrections;
 const smoothedBankVertices=smoothBankPeaks(vertices,walking,banks);
 function slope(ids){const a=vertices[ids[0]],b=vertices[ids[1]],c=vertices[ids[2]],dx=b.x-a.x,dz=b.z-a.z,ex=c.x-a.x,ez=c.z-a.z,det=dx*ez-dz*ex;if(!det)return 0;return Math.atan(Math.hypot(((b.y-a.y)*ez-(c.y-a.y)*dz)/det,(dx*(c.y-a.y)-ex*(b.y-a.y))/det))*180/Math.PI;}
 return {queryData,normal,passes,smoothedBankVertices,vertices,walking,banks,sample,slope,generationMs:performance.now()-began};
}

// A tight inside bend can leave a bank-only vertex surrounded by lowered tread.
// Remove isolated peaks after tread correction, without relaxing the walking
// planes or the patch perimeter (which joins unchanged landscape triangles).
export function smoothBankPeaks(vertices,walking,banks){
 const protectedIds=new Set(walking.flat()),neighbors=new Map(),edgeCounts=new Map();
 for(const ids of [...walking,...banks])for(let i=0;i<3;i++){
  const a=ids[i],b=ids[(i+1)%3],key=a<b?a+','+b:b+','+a;
  edgeCounts.set(key,(edgeCounts.get(key)??0)+1);
 }
 for(const [key,count] of edgeCounts)if(count===1)for(const id of key.split(','))protectedIds.add(Number(id));
 for(const ids of banks)for(const a of ids){
  if(protectedIds.has(a)||vertices[a].fixed)continue;
  if(!neighbors.has(a))neighbors.set(a,new Set());
  for(const b of ids)if(a!==b)neighbors.get(a).add(b);
 }
 const edits=[];
 for(const [id,ring] of neighbors){
  const p=vertices[id];let maximum=-Infinity,total=0,weight=0;
  for(const other of ring){const q=vertices[other],w=1/Math.hypot(q.x-p.x,q.z-p.z);maximum=Math.max(maximum,q.y);total+=q.y*w;weight+=w;}
  // Ignore numerical noise and retain ordinary sloping banks. Read all original
  // heights before applying edits so triangle iteration order cannot affect it.
  if(p.y>maximum+.02)edits.push([id,total/weight]);
 }
 for(const [id,y] of edits)vertices[id].y=y;
 return edits.length;
}
