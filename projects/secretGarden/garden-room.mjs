import {createDoorModel} from './door-model.mjs?v=182';
import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {mergeGeometries} from '../../shared/vendor/three-r180/addons/BufferGeometryUtils.js';
import {ROOM_SIZE,ROOM_HEIGHT,DOOR_WIDTH,DOOR_HEIGHT,HALL_WIDTH,HALL_HEIGHT,HALL_ENTRY_INSET,GARDEN_FRONT,DOOR_Z,ROOM_FRONT,ROOM_BACK} from './garden-layout.mjs?v=182';
export function createGardenRoom(scene){
 const targets=[],staticBoxes=[],staticMeshes=[],wallWood=new THREE.MeshStandardMaterial({color:0x816850,roughness:.9}),ceiling=new THREE.MeshStandardMaterial({color:0xb29879,roughness:.9}),floor=new THREE.MeshStandardMaterial({color:0x503827,roughness:.95}),wood=new THREE.MeshStandardMaterial({color:0x6b4c33,roughness:.9});
 function box(width,height,depth,x,y,z,material=wallWood){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),material);mesh.position.set(x,y,z);
  mesh.castShadow=mesh.receiveShadow=true;mesh.userData.surface='environment';scene.add(mesh);targets.push(mesh);staticBoxes.push(mesh);return mesh;
 }
 const roomCenter=(ROOM_FRONT+ROOM_BACK)/2,passageDepth=ROOM_FRONT-GARDEN_FRONT;
 box(ROOM_SIZE,.1,ROOM_SIZE,0,-.05,roomCenter,floor);
 box(HALL_WIDTH,.1,passageDepth,0,-.05,(GARDEN_FRONT+ROOM_FRONT)/2,floor);
 box(ROOM_SIZE+.24,.12,ROOM_SIZE+.24,0,ROOM_HEIGHT+.06,roomCenter,ceiling);
 // Continuous light ceiling through the room entry; omit its buried end cap.
 const hallCeilingStart=GARDEN_FRONT+HALL_ENTRY_INSET,hallCeilingEnd=ROOM_FRONT;
 const hallCeiling=box(HALL_WIDTH+.24,.12,hallCeilingEnd-hallCeilingStart,0,HALL_HEIGHT+.06,(hallCeilingStart+hallCeilingEnd)/2,ceiling);hallCeiling.userData.omitFace='front';
 for(const sign of [-1,1]){
  box(.12,ROOM_HEIGHT,ROOM_SIZE+.12,sign*(ROOM_SIZE/2+.06),ROOM_HEIGHT/2,roomCenter);
  box(.12,HALL_HEIGHT,passageDepth-HALL_ENTRY_INSET,sign*(HALL_WIDTH/2+.06),HALL_HEIGHT/2,(GARDEN_FRONT+HALL_ENTRY_INSET+ROOM_FRONT)/2);
  const roomEntryWidth=HALL_WIDTH+.03,wing=(ROOM_SIZE-roomEntryWidth)/2;
  box(wing,ROOM_HEIGHT,.12,sign*((HALL_WIDTH+.03)/2+wing/2),ROOM_HEIGHT/2,ROOM_FRONT-.06);
 }
 box(ROOM_SIZE+.24,ROOM_HEIGHT,.12,0,ROOM_HEIGHT/2,ROOM_BACK+.06);
 const entryHeader=box(HALL_WIDTH+.03,ROOM_HEIGHT-HALL_HEIGHT,.12,0,(ROOM_HEIGHT+HALL_HEIGHT)/2,ROOM_FRONT-.06);entryHeader.userData.omitFace='bottom';
 // A 6 mm inner lip offsets trim faces from hallway faces to avoid z-fighting.
 const frameFront=GARDEN_FRONT-.0625,frameBack=GARDEN_FRONT+HALL_ENTRY_INSET+.002;
 const frameZ=(frameFront+frameBack)/2,frameDepth=frameBack-frameFront,frameWidth=.14,frameLip=.006;
 for(const sign of [-1,1])box(frameWidth+frameLip,HALL_HEIGHT+.12,frameDepth,sign*(HALL_WIDTH/2+frameWidth/2-frameLip/2),(HALL_HEIGHT-.12)/2,frameZ,wood);
 box(HALL_WIDTH+frameWidth*2,frameWidth+frameLip,frameDepth,0,HALL_HEIGHT+frameWidth/2-frameLip/2,frameZ,wood);
 // A low sill covers the floor join without coplanar floor/front-face overlap.
 box(HALL_WIDTH+frameWidth*2,.04,.12,0,-.008,GARDEN_FRONT-.0385,wood);
 // One visual mesh/material; detached source boxes retain exact interaction surfaces.
 const pieces=[];
 for(const mesh of staticBoxes){
  mesh.updateWorldMatrix(true,false);const geometry=mesh.geometry.clone();
  if(mesh.userData.omitFace){
   const normals=geometry.attributes.normal,indices=[];
   for(let i=0;i<geometry.index.count;i+=3){const a=geometry.index.getX(i),omit=mesh.userData.omitFace==='front'?normals.getZ(a)>.9:normals.getY(a)<-.9;if(!omit)indices.push(a,geometry.index.getX(i+1),geometry.index.getX(i+2));}
   geometry.setIndex(indices);geometry.clearGroups();
  }
  geometry.applyMatrix4(mesh.matrixWorld);
  const color=mesh.material.color,colors=new Float32Array(geometry.attributes.position.count*3);
  for(let i=0;i<colors.length;i+=3){colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;}
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));pieces.push(geometry);scene.remove(mesh);mesh.matrixAutoUpdate=false;
 }
 const combined=new THREE.Mesh(mergeGeometries(pieces),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95}));pieces.forEach(piece=>piece.dispose());
 combined.name='hallway-control-room';combined.castShadow=combined.receiveShadow=true;combined.userData.surface='environment';combined.updateMatrix();combined.matrixAutoUpdate=false;scene.add(combined);staticMeshes.push(combined);
 const {hinge,hingeStile,leaf,heart,handles,targets:doorTargets}=createDoorModel(scene);targets.push(...doorTargets);
 // Soft room illumination; no extra shadow-casting light.
 const lamp=new THREE.PointLight(0xffe8bd,3,4,2);lamp.position.set(0,ROOM_HEIGHT-.2,roomCenter);scene.add(lamp);
 let fraction=0,wanted=false,swing=1,reversing=false;
 return {targets,staticMeshes,hinge,hingeStile,leaf,heart,handles,get fraction(){return fraction;},get passable(){return fraction>.9;},
  openFully(viewer){
   swing=viewer.z>=DOOR_Z?1:-1;wanted=true;reversing=false;fraction=1;hinge.rotation.y=swing*Math.PI/2;hinge.updateWorldMatrix(true,true);
  },
  update(dt,viewer){
   const distance=Math.hypot(viewer.x,viewer.z-DOOR_Z);
   const approachSide=viewer.z>=DOOR_Z?1:-1;
   if(distance<1.35){
    // Crossing an open doorway must not flip the leaf across the user.
    if(!wanted&&fraction>0&&approachSide!==swing)reversing=true;
    wanted=true;
   }else if(distance>1.75)wanted=false;
   if(fraction===0&&wanted){swing=approachSide;reversing=false;}
   const previous=fraction,step=Math.max(0,Math.min(dt,.1))/ .65;
   fraction=THREE.MathUtils.clamp(fraction+(wanted&&!reversing?step:-step),0,1);
   hinge.rotation.y=swing*fraction*Math.PI/2;
   return fraction!==previous;
  },
 };
}
