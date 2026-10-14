import {createForestSky} from './forest-sky.js';
import {createButterflies} from './forest-butterflies.js?v=forward2';
import {createAnimatedTrees} from './forest-trees.js';
import * as THREE from './vendor/three.module.js';
import {SIZE, wrap, dead, generateForest} from './forest-world.mjs';
const button=document.querySelector('#enter'), status=document.querySelector('#status');
const scene=new THREE.Scene();scene.background=new THREE.Color('#a6b7a1');scene.fog=new THREE.Fog('#a6b7a1',10,26);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;document.body.prepend(renderer.domElement);
const camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.05,160);
const rig=new THREE.Group();scene.add(rig);rig.add(camera);
function reset(){rig.position.set(0,0,0);rig.rotation.set(0,0,0);camera.position.set(0,1.65,0);camera.rotation.set(0,0,0);}reset();
const sky=createForestSky(scene);let skyStart=null;
const ground=new THREE.Mesh(new THREE.PlaneGeometry(SIZE*3,SIZE*3),new THREE.MeshStandardMaterial({color:0x66754a,roughness:1}));ground.rotation.x=-Math.PI/2;scene.add(ground);
// Shared low-poly geometry and instanced draws keep the nine repeated tiles inexpensive.
const parts={trunk:[],birch:[],canopy:[],leaves:[],pine:[],grass:[]};
const matrix=new THREE.Object3D();
function part(type,x,y,z,sx,sy,sz,color,rotation=0){parts[type].push({x,y,z,sx,sy,sz,color,rotation});}
const plants=generateForest();
const fallbackTrees=[];
let animateTrees=()=>{}, animateButterflies=()=>{};
createButterflies().then(b=>{scene.add(b.group);animateButterflies=b.update;}).catch(error=>{console.error(error);document.querySelector('#tree-status').textContent='Butterflies could not load. Reload to retry.';});
for(const plant of plants){
 const {x,z,size:s,kind,tint,rotation}=plant;
 const green=new THREE.Color().setHSL(.23+tint*.08,.26+tint*.18,.22+tint*.1);
 if(kind<3){
  const h=(kind===0?6.4:kind===1?5.4:4.3)*s;
  part(kind===1?'birch':'trunk',x,h/2,z,.16*s,h,.16*s,kind===1?0xcacbb3:0x64503a);
  if(kind===0){for(let j=0;j<3;j++)part('pine',x,h*(.5+j*.19),z,(1.5-j*.33)*s,2.8*s,(1.5-j*.33)*s,green,rotation);}
  else {for(let j=0;j<4;j++){const angle=rotation+j*2.4;part('canopy',x+Math.cos(angle)*.7*s,h*(.76+j*.06),z+Math.sin(angle)*.7*s,(kind===1?.85:1.4)*s,1.25*s,(kind===1?.85:1.4)*s,green,angle);}}
 }else{
  for(let j=0;j<3;j++){const angle=rotation+j*2.1;part('leaves',x+Math.cos(angle)*.35*s,.4*s,z+Math.sin(angle)*.35*s,.6*s,(kind===3?.7:.4)*s,.55*s,green,angle);}
 }
 part('grass',x,.012,z,1.25*s,1,1.25*s,0x53613a);
}
const geometries={trunk:new THREE.CylinderGeometry(.7,1,1,7),birch:new THREE.CylinderGeometry(.7,1,1,7),canopy:new THREE.IcosahedronGeometry(1,1),leaves:new THREE.IcosahedronGeometry(1,1),pine:new THREE.ConeGeometry(1,1,8),grass:new THREE.CircleGeometry(1,12)};
geometries.grass.rotateX(-Math.PI/2);
for(let tx=-1;tx<=1;tx++)for(let tz=-1;tz<=1;tz++){
 const tile=new THREE.Group();tile.position.set(tx*SIZE,0,tz*SIZE);scene.add(tile);
 for(const [type,items] of Object.entries(parts)){
  const mesh=new THREE.InstancedMesh(geometries[type],new THREE.MeshStandardMaterial({roughness:1,flatShading:true}),items.length);
  items.forEach((p,i)=>{matrix.position.set(p.x,p.y,p.z);matrix.rotation.set(0,p.rotation,0);matrix.scale.set(p.sx,p.sy,p.sz);matrix.updateMatrix();mesh.setMatrixAt(i,matrix.matrix);mesh.setColorAt(i,new THREE.Color(p.color));});
  mesh.computeBoundingSphere();tile.add(mesh);
  if(type==='trunk'||type==='birch'||type==='pine'||type==='canopy')fallbackTrees.push(mesh);
 }
}
createAnimatedTrees(plants).then(trees=>{
 scene.add(trees.group);animateTrees=trees.update;
 for(const mesh of fallbackTrees)mesh.visible=false;
}).catch(error=>{console.error('Animated trees could not load:',error);document.querySelector('#tree-status').textContent='Tree models could not load; showing procedural trees. Reload to retry.';});
// Controller markers follow the tracked grip poses inside the locomotion rig.
for(let i=0;i<2;i++){const grip=renderer.xr.getControllerGrip(i);const marker=new THREE.Mesh(new THREE.CapsuleGeometry(.025,.08,4,8),new THREE.MeshStandardMaterial({color:i===0?0xe6a059:0x51c5ba}));marker.rotation.x=Math.PI/2;grip.add(marker);rig.add(grip);}
let session=null,last=0;const keys=new Set();
addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','KeyR'].includes(e.code)){e.preventDefault();keys.add(e.code);if(e.code==='KeyR'&&!session)reset();}});addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());
const position=new THREE.Vector3(),forward=new THREE.Vector3(),right=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),offset=new THREE.Vector3();
function head(){rig.updateMatrixWorld(true);camera.getWorldPosition(position);return position;}
function turn(angle){const before=head().clone();rig.rotation.y+=angle;rig.updateMatrixWorld(true);camera.getWorldPosition(position);rig.position.x+=before.x-position.x;rig.position.z+=before.z-position.z;}
function wrapHead(){head();rig.position.x+=wrap(position.x)-position.x;rig.position.z+=wrap(position.z)-position.z;}
function move(dx,dz){rig.position.x+=dx;rig.position.z+=dz;wrapHead();}
renderer.setAnimationLoop((time,frame)=>{const dt=Math.min((time-last)/1000||0,.05);last=time;let x=0,y=0,turnX=0;
if(session&&frame){const pose=frame.getViewerPose(renderer.xr.getReferenceSpace());if(pose){const p=pose.transform.position,q=pose.transform.orientation;camera.position.set(p.x,p.y,p.z);camera.quaternion.set(q.x,q.y,q.z,q.w);}if(pose&&session.visibilityState==='visible'){for(const source of session.inputSources){const axes=source.gamepad?.axes;if(!axes)continue;const sx=axes.length>=4?axes[2]:axes[0]||0,sy=axes.length>=4?axes[3]:axes[1]||0;if(source.handedness==='left'){x=dead(sx);y=dead(sy);}if(source.handedness==='right')turnX=sx;}}turn(-dead(turnX)*dt*Math.PI/3);}

else{x=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));y=Number(keys.has('KeyS'))-Number(keys.has('KeyW'));turn((Number(keys.has('ArrowLeft'))-Number(keys.has('ArrowRight')))*dt*Math.PI/3);}
rig.updateMatrixWorld(true);camera.getWorldDirection(forward);forward.y=0;if(forward.lengthSq()>.001)forward.normalize();else forward.set(0,0,-1).applyQuaternion(rig.quaternion);right.crossVectors(forward,up).normalize();const length=Math.max(1,Math.hypot(x,y));offset.copy(right).multiplyScalar(x/length).addScaledVector(forward,-y/length).multiplyScalar(dt*1.5);move(offset.x,offset.z);animateTrees(session&&session.visibilityState!=='visible'?0:dt);animateButterflies(session&&session.visibilityState!=='visible'?0:dt);if(skyStart===null)skyStart=time;sky.update((time-skyStart)/1000,head());renderer.render(scene,camera);
});
button.addEventListener('click',async()=>{button.disabled=true;try{session=await navigator.xr.requestSession('immersive-vr',{requiredFeatures:['local-floor']});reset();session.addEventListener('end',()=>{session=null;reset();keys.clear();document.querySelector('#panel').hidden=false;document.querySelector('#hint').hidden=false;button.disabled=false;button.textContent='Enter VR';status.textContent='Ready to explore again.';});await renderer.xr.setSession(session);document.querySelector('#panel').hidden=true;document.querySelector('#hint').hidden=true;}catch(e){if(session){await session.end().catch(()=>{});session=null;}button.disabled=false;status.textContent='Could not enter VR: '+e.message;}});
(async()=>{try{const supported=!!navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr');button.disabled=!supported;button.textContent=supported?'Enter VR':'Open on your Quest';status.textContent=supported?'Ready. Pick up your controllers and enter VR.':!window.isSecureContext?'VR requires HTTPS. Open the HTTPS GitHub Pages site on your Quest.':'Desktop preview · Open this page in Meta Quest Browser to enter VR.';}catch(e){status.textContent=e.message;}})();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
