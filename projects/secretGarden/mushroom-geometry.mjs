import * as THREE from '../../shared/vendor/three-r180/three.module.js';
// Closed, faceted cap profiles; the funnel rim has a gentle repeated wave.
export function mushroomCapGeometry(form){
 const profiles=form==='chanterelle'?[[0,.08],[.25,.12],[.55,.30],[.8,.50],[1,.66],[1,.60],[.75,.43],[.4,.10],[0,-.05]]:form==='bolete'?[[0,.80],[.35,.76],[.7,.58],[.94,.27],[1,.06],[.85,-.04],[.35,-.07],[0,-.06]]:[[0,.65],[.35,.61],[.7,.46],[.94,.22],[1,.03],[.8,-.035],[.3,-.045],[0,-.04]];
 const positions=[],indices=[],sides=16;
 for(const [radius,height] of profiles)for(let i=0;i<sides;i++){
  const a=i/sides*Math.PI*2,wave=form==='chanterelle'?Math.sin(a*5)*.055*radius*radius:0;
  positions.push(Math.cos(a)*radius,height+wave,Math.sin(a)*radius);
 }
 for(let row=0;row<profiles.length-1;row++)for(let i=0;i<sides;i++){
  const a=row*sides+i,b=row*sides+(i+1)%sides,c=a+sides,d=b+sides;indices.push(a,b,c,b,d,c);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function mushroomSpotGeometry(){
 const positions=[],normals=[],normal=new THREE.Vector3(),spot=new THREE.IcosahedronGeometry(1,0),source=spot.attributes.position;
 for(let i=0;i<19;i++){
  const radius=Math.sqrt((i+.5)/19)*.9,angle=i*2.399963,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius,y=.65*Math.sqrt(1-radius*radius)+.012;
  for(let j=0;j<source.count;j++){positions.push(x+source.getX(j)*.047,y+source.getY(j)*.018,z+source.getZ(j)*.047);normal.set(source.getX(j)/.047,source.getY(j)/.018,source.getZ(j)/.047).normalize();normals.push(normal.x,normal.y,normal.z);}
 }
 spot.dispose();const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));return g;
}
