// Fixed square-cell topology. Coordinates are integer quarter-metres so every
// shared point, including transition corners, receives exactly one index.
export const CELL_SIZE=16,TERRAIN_RADIUS=1000,FINE_SPACING=.25;
// Spend the 300k budget on the near/mid field. Radii select whole cells by
// center distance; the 0.25 m core remains exactly 3×3 cells.
export const RESOLUTION_BANDS=Object.freeze([
 {radius:64,subdivisions:32},
 {radius:120,subdivisions:16},
 {radius:200,subdivisions:8},
 {radius:272,subdivisions:4},
 {radius:336,subdivisions:2}
].map(band=>Object.freeze(band)));
export function cellSubdivisions(x,z){
 if(Math.abs(x)<=1&&Math.abs(z)<=1)return 64;
 const distance=Math.hypot(x,z)*CELL_SIZE;
 for(const band of RESOLUTION_BANDS)if(distance<band.radius)return band.subdivisions;
 return 1;
}
const KEY_STRIDE=8193,KEY_OFFSET=4096;
export const vertexKey=(x,z)=>(x+KEY_OFFSET)*KEY_STRIDE+z+KEY_OFFSET;
export function createTerrainGrid(){
 const cells=[],byCell=new Map(),limit=Math.ceil(TERRAIN_RADIUS/CELL_SIZE);
 for(let z=-limit;z<=limit;z++)for(let x=-limit;x<=limit;x++){
  if(Math.hypot(x*CELL_SIZE,z*CELL_SIZE)>TERRAIN_RADIUS)continue;
  const cell={x,z,subdivisions:cellSubdivisions(x,z),firstIndex:0,indexCount:0};cells.push(cell);byCell.set(x+','+z,cell);
 }
 const coordinates=[],indices=[],lookup=new Map();let baseTriangles=0;
 function vertex(x,z){const key=vertexKey(x,z);let id=lookup.get(key);if(id===undefined){id=coordinates.length/2;lookup.set(key,id);coordinates.push(x,z);}return id;}
 function triangle(a,b,c){indices.push(a,b,c);}
 for(const cell of cells){
  const {x,z,subdivisions:n}=cell,step=64/n,x0=x*64,z0=z*64;
  const left=64/(byCell.get((x-1)+','+z)?.subdivisions??n),right=64/(byCell.get((x+1)+','+z)?.subdivisions??n);
  const top=64/(byCell.get(x+','+(z-1))?.subdivisions??n),bottom=64/(byCell.get(x+','+(z+1))?.subdivisions??n);
  cell.firstIndex=indices.length;baseTriangles+=n*n*2;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
   const xx=x0+i*step,zz=z0+j*step;
   const a=vertex(xx,zz),b=vertex(xx+step,zz),c=vertex(xx,zz+step),d=vertex(xx+step,zz+step);
   const l=i===0?Math.min(step,left):step,r=i===n-1?Math.min(step,right):step,t=j===0?Math.min(step,top):step,s=j===n-1?Math.min(step,bottom):step;
   if(Math.min(l,r,t,s)===step){triangle(a,c,b);triangle(b,c,d);continue;}
   // A fan only in boundary quads: split each affected side independently.
   // Corners with two finer neighbors use the same ring, without overlapping fans.
   const center=vertex(xx+step/2,zz+step/2);
   function edge(ax,az,bx,bz,spacing){const count=step/spacing;for(let k=0;k<count;k++)triangle(center,vertex(ax+(bx-ax)*k/count,az+(bz-az)*k/count),vertex(ax+(bx-ax)*(k+1)/count,az+(bz-az)*(k+1)/count));}
   edge(xx,zz,xx,zz+step,l);edge(xx,zz+step,xx+step,zz+step,s);edge(xx+step,zz+step,xx+step,zz,r);edge(xx+step,zz,xx,zz,t);
  }
  cell.indexCount=indices.length-cell.firstIndex;
 }
 return {coordinates:new Int16Array(coordinates),indices:new Uint32Array(indices),cells,baseTriangles,vertexCount:coordinates.length/2};
}
