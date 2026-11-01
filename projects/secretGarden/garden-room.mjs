import {createDoorModel} from './door-model.mjs?v=115';
import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {mergeGeometries} from '../../shared/vendor/three-r180/addons/BufferGeometryUtils.js';
import {ROOM_SIZE,ROOM_HEIGHT,DOOR_WIDTH,DOOR_HEIGHT,HALL_WIDTH,HALL_HEIGHT,HALL_ENTRY_INSET,GARDEN_FRONT,DOOR_Z,ROOM_FRONT,ROOM_BACK} from './garden-layout.mjs?v=46';
export function createGardenRoom(scene){
 const targets=[],staticBoxes=[],staticMeshes=[],stone=new THREE.MeshStandardMaterial({color:0x737b70,roughness:1}),floor=new THREE.MeshStandardMaterial({color:0x777469,roughness:1});
 function box(width,height,depth,x,y,z,material=stone){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),material);mesh.position.set(x,y,z);
  mesh.castShadow=mesh.receiveShadow=true;mesh.userData.surface='environment';scene.add(mesh);targets.push(mesh);staticBoxes.push(mesh);return mesh;
 }
 const roomCenter=(ROOM_FRONT+ROOM_BACK)/2,passageDepth=ROOM_FRONT-GARDEN_FRONT;
 box(ROOM_SIZE,.1,ROOM_SIZE,0,-.05,roomCenter,floor);
 box(HALL_WIDTH,.1,passageDepth,0,-.05,(GARDEN_FRONT+ROOM_FRONT)/2,floor);
 box(ROOM_SIZE+.24,.12,ROOM_SIZE+.24,0,ROOM_HEIGHT+.06,roomCenter);
 box(HALL_WIDTH+.24,.12,passageDepth-HALL_ENTRY_INSET,0,HALL_HEIGHT+.06,(GARDEN_FRONT+HALL_ENTRY_INSET+ROOM_FRONT)/2);
 for(const sign of [-1,1]){
  box(.12,ROOM_HEIGHT,ROOM_SIZE+.12,sign*(ROOM_SIZE/2+.06),ROOM_HEIGHT/2,roomCenter);
  box(.12,HALL_HEIGHT,passageDepth-HALL_ENTRY_INSET,sign*(HALL_WIDTH/2+.06),HALL_HEIGHT/2,(GARDEN_FRONT+HALL_ENTRY_INSET+ROOM_FRONT)/2);
  const roomEntryWidth=HALL_WIDTH+.03,wing=(ROOM_SIZE-roomEntryWidth)/2;
  box(wing,ROOM_HEIGHT,.12,sign*((HALL_WIDTH+.03)/2+wing/2),ROOM_HEIGHT/2,ROOM_FRONT-.06);
 }
 box(ROOM_SIZE+.24,ROOM_HEIGHT,.12,0,ROOM_HEIGHT/2,ROOM_BACK+.06);
 box(HALL_WIDTH+.03,ROOM_HEIGHT-HALL_HEIGHT-.015,.12,0,(ROOM_HEIGHT+HALL_HEIGHT+.015)/2,ROOM_FRONT-.06);
 // Wider legs extend below the floor; shallower trim sits halfway closer to the facade.
 const frameZ=GARDEN_FRONT-.0325,frameDepth=.06,frameWidth=.14;
 for(const sign of [-1,1])box(frameWidth,DOOR_HEIGHT+.12,frameDepth,sign*(DOOR_WIDTH/2+frameWidth/2),(DOOR_HEIGHT-.12)/2,frameZ);
 box(DOOR_WIDTH+frameWidth*2,frameWidth,frameDepth,0,DOOR_HEIGHT+frameWidth/2,frameZ);
 // A low sill covers the floor join without coplanar floor/front-face overlap.
 box(DOOR_WIDTH+frameWidth*2,.04,frameDepth*2,0,-.008,frameZ-.006,floor);
 // Merge static room surfaces by material; keep frozen CPU boxes for targeting.
 for(const material of [stone,floor]){
  const objects=staticBoxes.filter(mesh=>mesh.material===material),pieces=[];
  for(const mesh of objects){mesh.updateWorldMatrix(true,false);pieces.push(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));scene.remove(mesh);}
  const combined=new THREE.Mesh(mergeGeometries(pieces),material);pieces.forEach(piece=>piece.dispose());
  combined.castShadow=combined.receiveShadow=true;combined.userData.surface='environment';scene.add(combined);staticMeshes.push(combined);
 }
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
