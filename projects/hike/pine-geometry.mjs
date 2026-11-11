import * as T from '../../shared/vendor/three-r180/three.module.js';
export const PINE_VARIANTS=4;
export function createPineVariants(){
 const variants=[];
 for(let v=0;v<PINE_VARIANTS;v++){
  const height=10.5+v*.8,sections=3+v%3,parts=[],green=new T.Color([0x738168,0x687c60,0x7b866a,0x687f6d][v]),brown=new T.Color(0x7a6248);
  function part(geometry,y,color){const indexed=geometry;geometry=indexed.toNonIndexed();indexed.dispose();geometry.translate(0,y,0);geometry.computeVertexNormals();const positions=geometry.attributes.position.array,normals=geometry.attributes.normal.array,colors=new Float32Array(positions.length);for(let i=0;i<colors.length;i+=3){colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;}parts.push({positions:positions.slice(),normals:normals.slice(),colors});geometry.dispose();}
  const exposure=1.3+v*.2;part(new T.CylinderGeometry(.15,.25,height-exposure,5,1,false),(height-exposure)/2-.65,brown);
  for(let j=0;j<sections;j++){
   const t=j/(sections-1),bottom=exposure+t*(height-exposure)*.62,top=j===sections-1?height:Math.min(height-.3,bottom+(height-exposure)*(.62-.12*t)),radius=(2.3+v*.08)*(1-t*.61);
   part(new T.ConeGeometry(radius,top-bottom,6,1,false),(bottom+top)/2,green.clone().multiplyScalar(.90+j*.045));
  }
  const length=parts.reduce((n,p)=>n+p.positions.length,0),geometry=new T.BufferGeometry(),positions=new Float32Array(length),normals=new Float32Array(length),colors=new Float32Array(length);let offset=0;
  for(const part of parts){positions.set(part.positions,offset);normals.set(part.normals,offset);colors.set(part.colors,offset);offset+=part.positions.length;}
  geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('normal',new T.BufferAttribute(normals,3));geometry.setAttribute('color',new T.BufferAttribute(colors,3));geometry.computeBoundingSphere();
  variants.push({geometry,height,sections});
 }
 return variants;
}
