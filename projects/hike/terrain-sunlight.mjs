// Shared fixed sun vector (toward the sun), also used to place the scene light.
// 30° elevation testing sun; original afternoon height was y=650 (~54°).
export const SUN_POSITION=Object.freeze({x:-450,y:Math.hypot(450,150)*Math.tan(Math.PI/6),z:-150});
export function sampleSunlight(map,x,z){
 if(!map||Math.abs(x)>map.extent||Math.abs(z)>map.extent)return 1;
 const n=map.size,gx=(x+map.extent)/map.step,gz=(z+map.extent)/map.step;
 const ix=Math.min(n-2,Math.floor(gx)),iz=Math.min(n-2,Math.floor(gz)),u=gx-ix,v=gz-iz,i=iz*n+ix,a=map.visibility;
 return ((a[i]*(1-u)+a[i+1]*u)*(1-v)+(a[i+n]*(1-u)+a[i+n+1]*u)*v)/255;
}
// Sweep away from the sun. An upstream horizon advances one dominant-axis
// cell at a time, interpolating the minor axis. O(size²), independent of ray
// length; heights are authoritative ground, never the moving rendered mesh.
export function generateTerrainSunlight(world,{size=2048,direction=SUN_POSITION}={}){
 const began=performance.now(),extent=world.extent,step=2*extent/(size-1);
 if(size<2||!Number.isInteger(size)||direction.y<=0)throw Error('Invalid sunlight grid');
 const xMajor=Math.abs(direction.x)>=Math.abs(direction.z),major=xMajor?direction.x:direction.z,minor=xMajor?direction.z:direction.x;
 const horizon=new Float32Array(size*size),visibility=new Uint8Array(size*size);
 const sign=major>=0?1:-1,ratio=major?minor/Math.abs(major):0,drop=major?direction.y/Math.abs(major)*step:Infinity;
 const index=(a,b)=>xMajor?b*size+a:a*size+b;
 for(let row=0;row<size;row++){
  const a=sign>0?size-1-row:row,up=a+sign;
  for(let b=0;b<size;b++){
   const i=index(a,b),x=(xMajor?a:b)*step-extent,z=(xMajor?b:a)*step-extent,y=world.height(x,z);
   let incoming=-Infinity;
   const t=b+ratio;
   if(up>=0&&up<size&&t>=0&&t<=size-1){const lo=Math.min(size-2,Math.floor(t)),f=t-lo;incoming=horizon[index(up,lo)]*(1-f)+horizon[index(up,lo+1)]*f-drop;}
   // Half-metre bias suppresses sampling acne; a 1 m height transition softens edges.
   const light=Math.max(0,Math.min(1,1+y+.5-incoming));
   visibility[i]=Math.round(light*255);horizon[i]=Math.max(y,incoming);
  }
 }
 return {size,extent,step,visibility,generationMs:performance.now()-began,bytes:visibility.byteLength};
}
