import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {CloudSky} from './cloud-sky.mjs?v=32';
import {mergeGeometries} from '../../shared/vendor/three-r180/addons/BufferGeometryUtils.js';
import {createGardenRoom} from './garden-room.mjs?v=49';
import {HALF_WIDTH,HALF_DEPTH,WALL_HEIGHT,DOOR_WIDTH,DOOR_HEIGHT,DOOR_WALL_ID,constrainPosition} from './garden-layout.mjs?v=46';
export {HALF_WIDTH,HALF_DEPTH,WALL_HEIGHT} from './garden-layout.mjs?v=46';
export function constrainViewer(rig,viewerPosition,doorOpen=false) {
  rig.updateMatrixWorld(true);
  const p=new THREE.Vector3().copy(viewerPosition).applyMatrix4(rig.matrixWorld),allowed=constrainPosition(p.x,p.z,doorOpen);
  rig.position.x+=allowed.x-p.x;rig.position.z+=allowed.z-p.z;rig.updateMatrixWorld(true);
}
export function createEnvironment(scene,renderer,{viewDistance=250}={}) {
  scene.background=new THREE.Color('#788f9c');
  scene.add(new THREE.HemisphereLight(0xe7f1ff,0x665039,2.1));
  const sun=new THREE.DirectionalLight(0xffefcf,3.1); sun.position.set(-6,12,7); sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024); Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:.5,far:35});
  sun.shadow.bias=-.0005; sun.shadow.normalBias=.025; scene.add(sun);
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(HALF_WIDTH*2,HALF_DEPTH*2),new THREE.MeshStandardMaterial({color:0x352015,roughness:1}));
  ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; ground.userData.surface='ground'; scene.add(ground);
  const walls=[];
  const material=new THREE.MeshStandardMaterial({color:0x899181,roughness:1});
  const sides=Array.from({length:4},(_,i)=>({
    angle:i*Math.PI/2,
    halfLength:i%2===0?HALF_WIDTH:HALF_DEPTH,
    distance:i%2===0?HALF_DEPTH:HALF_WIDTH,
  }));
  const wallGeometries=[HALF_WIDTH,HALF_DEPTH].map(half=>new THREE.BoxGeometry(half*2+.3,WALL_HEIGHT,.22));
  for(const [i,side] of sides.entries()) {
    let geometry=wallGeometries[i%2];
    if(i===DOOR_WALL_ID){
      const width=HALF_WIDTH*2+.3,wing=(width-DOOR_WIDTH)/2;
      const pieces=[new THREE.BoxGeometry(wing,WALL_HEIGHT,.22).translate(-(DOOR_WIDTH+wing)/2,0,0),
        new THREE.BoxGeometry(wing,WALL_HEIGHT,.22).translate((DOOR_WIDTH+wing)/2,0,0),
        new THREE.BoxGeometry(DOOR_WIDTH,WALL_HEIGHT-DOOR_HEIGHT,.22).translate(0,DOOR_HEIGHT/2,0)];
      geometry=mergeGeometries(pieces);pieces.forEach(piece=>piece.dispose());geometry.computeBoundingBox();
    }
    const wall=new THREE.Mesh(geometry,material);wall.rotation.y=side.angle;
    wall.position.set(Math.sin(side.angle)*(side.distance+.11),WALL_HEIGHT/2,Math.cos(side.angle)*(side.distance+.11));
    wall.castShadow=true;wall.receiveShadow=true;wall.userData.surface='wall';wall.userData.wallSurface={type:'wall',id:i,yaw:side.angle+Math.PI,halfLength:side.halfLength,adjacentHalfLength:i%2===0?HALF_DEPTH:HALF_WIDTH,height:WALL_HEIGHT,normal:new THREE.Vector3(-Math.sin(side.angle),0,-Math.cos(side.angle))};scene.add(wall);walls.push(wall);
  }
  // Running bond: alternate rows shift half a brick, clipped at wall ends.
  const columns=sides.map(side=>Math.ceil(side.halfLength*2/.9));
  const count=columns.reduce((sum,cols)=>sum+cols*9+4,0)+18;
  const blocks=new THREE.InstancedMesh(new THREE.BoxGeometry(1,.31,.025),new THREE.MeshStandardMaterial({color:0xa0a38f,roughness:1}),count);
  const dummy=new THREE.Object3D();let n=0;
  for(const [i,side] of sides.entries()) for(let row=0;row<9;row++) for(let col=0;col<columns[i]+row%2;col++) {
    const spacing=side.halfLength*2/columns[i];
    const left=Math.max(-side.halfLength,-side.halfLength+(col-(row%2)*.5)*spacing);
    const right=Math.min(side.halfLength,-side.halfLength+(col+1-(row%2)*.5)*spacing);
    const intervals=i===DOOR_WALL_ID&&row*.335<DOOR_HEIGHT?[[left,Math.min(right,-DOOR_WIDTH/2)],[Math.max(left,DOOR_WIDTH/2),right]]:[[left,right]];
    for(const [start,end] of intervals){
      if(end-start<.045)continue;
      const along=(start+end)/2;
      dummy.position.set(along,(row+.5)*.335,side.distance-.013);
      dummy.position.applyAxisAngle(new THREE.Vector3(0,1,0),side.angle);dummy.rotation.set(0,side.angle,0);
      dummy.scale.set(end-start-.04,.94,1);dummy.updateMatrix();blocks.setMatrixAt(n++,dummy.matrix);
      blocks.setColorAt(n-1,new THREE.Color().setHSL(.15,.075,.43+((row*7+col*3)%5)*.025));
    }
  }
  blocks.count=n;
  scene.add(blocks);
  const clouds=new CloudSky(scene,{halfWidth:HALF_WIDTH,halfDepth:HALF_DEPTH,viewDistance});
  const room=createGardenRoom(scene);
  return {ground,walls,clouds,room,targets:[ground,...walls,...room.targets]};
}
