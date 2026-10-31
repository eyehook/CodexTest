// Pure array math matching renderer Euler XYZ rotation (tilt, yaw, tilt*.6).
export function canopyRotation(vector,canopy,inverse=false){
 let [x,y,z]=vector;
 const rotations=inverse?[[0,-canopy.tilt],[1,-canopy.yaw],[2,-canopy.tilt*.6]]:[[2,canopy.tilt*.6],[1,canopy.yaw],[0,canopy.tilt]];
 for(const [axis,angle] of rotations){const c=Math.cos(angle),s=Math.sin(angle);if(axis===0)[y,z]=[y*c-z*s,y*s+z*c];else if(axis===1)[x,z]=[x*c+z*s,-x*s+z*c];else [x,y]=[x*c-y*s,x*s+y*c];}
 return [x,y,z];
}
const dot=(a,b)=>a.reduce((sum,value,i)=>sum+value*b[i],0);
export function placeCanopyFlowers(parts,random){
 const canopies=parts.filter(p=>p.kind==='foliage'&&p.shape==='crown');
 for(const flower of parts.filter(p=>p.canopy!==undefined)){
  const canopy=parts[flower.canopy],origin=parts[canopy.parent].end;
  const heading=Math.atan2(origin[2],origin[0])+(random()-.5)*2.2,y=-.2+random()*.95,r=Math.sqrt(1-y*y),direction=[Math.cos(heading)*r,y,Math.sin(heading)*r];
  let distance=-Infinity,surface=null;
  // Outermost exit along this ray prevents hiding blooms inside neighboring crowns.
  for(const candidate of canopies){
   const center=parts[candidate.parent].end;
   const o=canopyRotation(origin.map((v,i)=>v-center[i]),candidate,true).map((v,i)=>v/candidate.scale[i]);
   const d=canopyRotation(direction,candidate,true).map((v,i)=>v/candidate.scale[i]);
   const a=dot(d,d),b=dot(o,d),c=dot(o,o)-1,discriminant=b*b-a*c;
   if(discriminant<0)continue;const exit=(-b+Math.sqrt(discriminant))/a;
   if(exit>distance){distance=exit;surface=candidate;}
  }
  if(!surface)continue;
  const position=origin.map((v,i)=>v+direction[i]*distance),center=parts[surface.parent].end;
  const local=canopyRotation(position.map((v,i)=>v-center[i]),surface,true);
  const normal=canopyRotation(local.map((v,i)=>v/(surface.scale[i]**2)),surface),length=Math.hypot(...normal);
  flower.normal=normal.map(v=>v/length);flower.position=position.map((v,i)=>v+flower.normal[i]*.006);flower.canopy=surface.id;
  // Keep the existing stem attachment graph and growth/picking representation.
  parts[flower.parent].end=flower.position;
  flower.begin=Math.min(flower.begin,1-flower.duration);
 }
}
