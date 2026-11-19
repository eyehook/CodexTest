import * as T from '../../shared/vendor/three-r180/three.module.js';
// Matching cross-sections at shared endpoints prevent coplanar overlapping rail tops.
export function railSections(rails,width=.035){
 const endpoints=new Map(),key=(x,z)=>`${x.toFixed(8)},${z.toFixed(8)}`;
 for(const s of rails)for(const [x,z,ox,oz] of [[s.ax,s.az,s.bx,s.bz],[s.bx,s.bz,s.ax,s.az]]){
  const k=key(x,z);if(!endpoints.has(k))endpoints.set(k,[]);endpoints.get(k).push({s,dx:ox-x,dz:oz-z});
 }
 return rails.map(s=>{
  const length=Math.hypot(s.bx-s.ax,s.bz-s.az),nx=-(s.bz-s.az)/length,nz=(s.bx-s.ax)/length;
  function end(x,z,atStart){
   const neighbor=endpoints.get(key(x,z)).find(e=>e.s!==s);let mx=nx,mz=nz;
   if(neighbor){const d=Math.hypot(neighbor.dx,neighbor.dz);const sign=atStart?-1:1,ox=-neighbor.dz/d*sign,oz=neighbor.dx/d*sign;const scale=1/(1+nx*ox+nz*oz);mx=(nx+ox)*scale;mz=(nz+oz)*scale;}
   return {plus:[x+mx*width/2,z+mz*width/2],minus:[x-mx*width/2,z-mz*width/2],cap:!neighbor};
  }
  return {a:end(s.ax,s.az,true),b:end(s.bx,s.bz,false),color:Math.abs(s.az+s.bz)<.1?0:s.az+s.bz>0?1:2};
 });
}
export function createRails(rails,materials){
 const sections=railSections(rails),positions=[],geometry=new T.BufferGeometry();
 function quad(a,b,c,d){for(const p of [a,b,c,a,c,d])positions.push(...p);}
 for(let color=0;color<3;color++){
  const start=positions.length/3;
  for(const s of sections){if(s.color!==color)continue;
   const top=.0575,bottom=-.0075;
   const a=[s.a.plus[0],bottom,s.a.plus[1]],b=[s.b.plus[0],bottom,s.b.plus[1]],c=[s.b.minus[0],bottom,s.b.minus[1]],d=[s.a.minus[0],bottom,s.a.minus[1]];
   const A=[a[0],top,a[2]],B=[b[0],top,b[2]],C=[c[0],top,c[2]],D=[d[0],top,d[2]];
   quad(A,B,C,D);quad(d,c,b,a);quad(a,b,B,A);quad(c,d,D,C);
   if(s.a.cap)quad(d,a,A,D);if(s.b.cap)quad(b,c,C,B);
  }
  geometry.addGroup(start,positions.length/3-start,color);
 }
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();return new T.Mesh(geometry,materials);
}
