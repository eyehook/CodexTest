// A smooth minimum removes material only. Outside the transition it is exactly
// the original height or the horizontal cap; both joins have continuous slope.
export function roundedCap(y,level,rounding){
 const t=Math.max(rounding-Math.abs(y-level),0)/rounding;
 return Math.min(y,level)-rounding*t*t*.25;
}
export function createSummitCut(landscape,center,radius=1.5){
 const {heights,gridSize:n,gridStep:step,extent}=landscape,m=n-1,rounding=.75;
 // Include a walking-cell diagonal: every triangle touching the standing disk
 // can be pinned without extending the cap above original ground. Bilinear
 // geology is bounded by its cell corners, so this is a conservative guarantee.
 const support=radius+Math.hypot(.5,1),gx=(center.x+extent)/step,gz=(center.z+extent)/step;
 let floor=Infinity;
 const x0=Math.max(0,Math.floor(gx-support/step)),x1=Math.min(m-1,Math.floor(gx+support/step));
 const z0=Math.max(0,Math.floor(gz-support/step)),z1=Math.min(m-1,Math.floor(gz+support/step));
 for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
  const dx=Math.max(x*step-extent-center.x,0,center.x-((x+1)*step-extent));
  const dz=Math.max(z*step-extent-center.z,0,center.z-((z+1)*step-extent));
  if(dx*dx+dz*dz>support*support)continue;
  const i=z*n+x;floor=Math.min(floor,heights[i],heights[i+1],heights[i+n],heights[i+n+1]);
 }
 const level=floor-rounding,threshold=level-rounding;
 // Only the connected peak is cut. Every unmarked boundary edge lies below
 // the rounding band, where the height function returns original geology.
 const visited=new Set(),cells=[],queue=[[Math.min(m-1,Math.max(0,Math.floor(gx))),Math.min(m-1,Math.max(0,Math.floor(gz)))]];
 let minX=m,minZ=m,maxX=0,maxZ=0;
 for(let q=0;q<queue.length;q++){
  const [x,z]=queue[q],id=z*m+x;if(x<0||z<0||x>=m||z>=m||visited.has(id))continue;visited.add(id);
  const i=z*n+x;if(Math.max(heights[i],heights[i+1],heights[i+n],heights[i+n+1])<=threshold)continue;
  cells.push([x,z]);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);
  queue.push([x-1,z],[x+1,z],[x,z-1],[x,z+1]);
 }
 const width=maxX-minX+1,depth=maxZ-minZ+1,mask=new Uint8Array(width*depth);
 for(const [x,z] of cells)mask[(z-minZ)*width+x-minX]=1;
 return {level,rounding,radius,minX,minZ,width,depth,mask,step,extent};
}
export function summitCutHeight(cut,x,z,y){
 if(!cut)return y;
 const ix=Math.floor((x+cut.extent)/cut.step)-cut.minX,iz=Math.floor((z+cut.extent)/cut.step)-cut.minZ;
 if(ix<0||iz<0||ix>=cut.width||iz>=cut.depth||!cut.mask[iz*cut.width+ix])return y;
 return roundedCap(y,cut.level,cut.rounding);
}

// Explicit custom destinations retain their existing landing semantics; only the
// generated summit is truncated. Keep worker reconstruction on the same path.
export function destinationHeight(cut,center,x,z,y){
 if(cut)return summitCutHeight(cut,x,z,y);
 const t=Math.max(0,Math.min(1,(Math.hypot(x-center.x,z-center.z)-1.5)/4)),blend=t*t*(3-2*t);
 return center.y+(y-center.y)*blend;
}
