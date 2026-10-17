import * as THREE from '../../projects/forest/vendor/three.module.js';
import {VRButton} from './vr.js';
import {defaults,terrainHeight} from './height.mjs';
import {meshData} from './mesh.mjs';
import {makeMaterial,updateHeightUniforms} from './material.js';
import {advance,xrAxes,xrTurn,turnAtHead,updateTravelSpeed} from './player.mjs';
import {checkGPU} from './check.js';
import {waterLevel,localWaterHeight,drySpawn} from './water.mjs';
import {TreeSystem} from './trees/TreeSystem.js';
import {treeDefaults} from './trees/TreeGenerator.mjs';
import {addTreeControls} from './trees/TreeControls.js';
import {updateTerrainFlight} from './flight.mjs';
import {Lighthouse} from './Lighthouse.js';
import './style.css';
const c={...defaults},world=drySpawn(c),canvas=document.querySelector('canvas');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');renderer.xr.setFoveation(1);
const scene=new THREE.Scene();scene.background=new THREE.Color(c.skyColor);scene.fog=new THREE.Fog(c.fogColor,c.fogStart,c.fogEnd);
const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,0.05,5000);camera.position.y=1.7;const rig=new THREE.Group();rig.add(camera);scene.add(rig);const turn={x:0,z:0,yaw:0};
const flight={height:0,velocity:0,altitude:null};
function resetFlight(){flight.height=0;flight.velocity=0;flight.altitude=null;rig.position.y=0;}
function resetTurn(){resetFlight();turn.x=turn.z=turn.yaw=0;rig.position.set(0,0,0);rig.rotation.set(0,0,0);}
const material=makeMaterial(c),mesh=new THREE.Mesh(new THREE.BufferGeometry(),material);mesh.frustumCulled=false;scene.add(mesh);
// A single static disk: depth testing exposes water only where terrain is lower.
const water=new THREE.Mesh(new THREE.CircleGeometry(1,128),new THREE.MeshBasicMaterial({color:0x197fb5,fog:true,side:THREE.DoubleSide}));
water.rotation.x=-Math.PI/2;water.frustumCulled=false;scene.add(water);
const lighthouse=new Lighthouse(scene,c);
lighthouse.ready.then(()=>{if(!renderer.xr.isPresenting&&document.pointerLockElement!==canvas){yaw=Math.atan2(world.x-lighthouse.site.x,world.z-lighthouse.site.z);pitch=0.15;camera.rotation.set(pitch,yaw,0,'YXZ');}}).catch(error=>{document.querySelector('#result').textContent='Lighthouse could not load: '+error.message;console.error(error);});
scene.add(new THREE.HemisphereLight(0xe5f1ff,0x62634b,2));
const sun=new THREE.DirectionalLight(0xfff4de,2.2);sun.position.set(0.4,0.8,0.3);scene.add(sun);
const treeConfig={...treeDefaults},trees=new TreeSystem(scene,c,treeConfig);
let vertexCount=0,triangleCount=0;
function rebuild(){water.scale.set(c.radius,c.radius,1);const data=meshData(c.radius,c.rings,c.segments),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(data.positions,3));g.setAttribute('spacing',new THREE.BufferAttribute(data.spacings,1));g.setIndex(new THREE.BufferAttribute(data.indices,1));mesh.geometry.dispose();mesh.geometry=g;vertexCount=data.positions.length/3;triangleCount=data.indices.length/3;camera.far=Math.max(5000,c.radius*2);camera.updateProjectionMatrix();}
rebuild();document.body.append(VRButton(renderer));
const keys=new Set();let yaw=0,pitch=0;addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement)return;if(['KeyW','KeyA','KeyS','KeyD'].includes(e.code)){keys.add(e.code);e.preventDefault();}});addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());document.addEventListener('pointerlockchange',()=>keys.clear());canvas.addEventListener('click',()=>{if(!renderer.xr.isPresenting)canvas.requestPointerLock();});document.addEventListener('mousemove',e=>{if(document.pointerLockElement!==canvas||renderer.xr.isPresenting)return;yaw-=e.movementX*0.002;pitch=THREE.MathUtils.clamp(pitch-e.movementY*0.002,-1.45,1.45);camera.rotation.set(pitch,yaw,0,'YXZ');});
renderer.xr.addEventListener('sessionstart',()=>{document.exitPointerLock();keys.clear();resetTurn();camera.position.set(0,0,0);camera.rotation.set(0,0,0);document.body.classList.add('xr');});renderer.xr.addEventListener('sessionend',()=>{document.getElementById('speed').value=c.speed;resetTurn();camera.position.set(0,1.7,0);camera.rotation.set(pitch,yaw,0,'YXZ');document.body.classList.remove('xr');});
const fields=[['radius','Radius (m)',100,5000,100],['rings','Radial rings',16,256,1],['segments','Angular segments',32,512,8],['amplitude','Amplitude (m)',0,150,1],['frequency','Noise frequency',0.0001,0.02,0.0001],['octaves','Noise octaves',1,8,1],['persistence','Persistence',0.1,0.8,0.01],['lacunarity','Lacunarity',1.2,3,0.1],['seed','Seed',0,65535,1],['speed','Walk speed (m/s)',0.5,25,0.5],['turnSpeed','Turn speed (°/s)',10,120,5],['fogStart','Fog start (m)',10,4500,10],['fogEnd','Fog end (m)',20,4900,10]];
for(const [key,label,min,max,step]of fields){const l=document.createElement('label');l.textContent=label;const input=document.createElement('input');input.type='number';input.id=key;input.value=c[key];input.min=min;input.max=max;input.step=step;l.append(input);document.querySelector('#controls').append(l);}
for(const key of ['fogColor','skyColor']){const l=document.createElement('label');l.textContent=key==='fogColor'?'Fog color':'Sky color';const i=document.createElement('input');i.type='color';i.id=key;i.value=c[key];l.append(i);document.querySelector('#controls').append(l);}
const treeControls=addTreeControls(document.querySelector('#controls'),treeConfig,c);
const terrainSignature=()=>[c.seed,c.amplitude,c.frequency,c.octaves,c.persistence,c.lacunarity].join(',');
const result=document.querySelector('#result');
function runCheck(){try{result.textContent=checkGPU(renderer,c);}catch(error){result.textContent=error.message;console.error(error);}}
document.querySelector('#apply').onclick=()=>{const previousHeight=terrainSignature();let topology=false;for(const [key,,min,max]of fields){const input=document.getElementById(key);let value=Number(input.value);if(!Number.isFinite(value))value=c[key];value=THREE.MathUtils.clamp(value,min,max);if(['rings','segments','octaves','seed'].includes(key))value=Math.round(value);if(['radius','rings','segments'].includes(key)&&value!==c[key])topology=true;c[key]=value;input.value=value;}c.fogEnd=Math.min(c.fogEnd,c.radius*0.98);c.fogStart=Math.min(c.fogStart,c.fogEnd*0.8);document.getElementById('fogStart').value=c.fogStart;document.getElementById('fogEnd').value=c.fogEnd;for(const key of ['fogColor','skyColor'])c[key]=document.getElementById(key).value;scene.background.set(c.skyColor);scene.fog.color.set(c.fogColor);scene.fog.near=c.fogStart;scene.fog.far=c.fogEnd;material.uniforms.fogColor.value.set(c.fogColor);material.uniforms.fogStart.value=c.fogStart;material.uniforms.fogEnd.value=c.fogEnd;if(topology)rebuild();const treeSettingsChanged=treeControls.apply();if(treeSettingsChanged||previousHeight!==terrainSignature())trees.invalidate();if(previousHeight!==terrainSignature())lighthouse.relocate();runCheck();};
document.querySelector('#wire').onchange=e=>material.wireframe=e.target.checked;document.querySelector('#check').onclick=runCheck;document.querySelector('#reset').onclick=()=>{world.x=world.z=0;resetFlight();};
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
const forward=new THREE.Vector3(),eye=new THREE.Vector3();let last=0,frames=0,elapsed=0,ground=0,speed=0;const stats=document.querySelector('#stats');runCheck();
renderer.setAnimationLoop((time,frame)=>{const rawDt=last?(time-last)/1000:0,dt=Math.min(rawDt,0.05);last=time;let x=0,z=0,angle=yaw;const session=renderer.xr.getSession();let tracked=!session;if(session&&frame&&session.visibilityState==='visible'){const pose=frame.getViewerPose(renderer.xr.getReferenceSpace());tracked=!!pose;if(tracked){[x,z]=xrAxes(session);const head=pose.transform.position;turnAtHead(turn,head.x,head.z,-xrTurn(session)*c.turnSpeed*Math.PI/180*dt);rig.rotation.y=turn.yaw;rig.position.set(turn.x,0,turn.z);const q=pose.transform.orientation;forward.set(0,0,-1).applyQuaternion(q);angle=turn.yaw;if(Math.hypot(forward.x,forward.z)>0.001)angle+=Math.atan2(-forward.x,-forward.z);eye.set(turn.x+Math.cos(turn.yaw)*head.x+Math.sin(turn.yaw)*head.z,0,turn.z-Math.sin(turn.yaw)*head.x+Math.cos(turn.yaw)*head.z);}}else if(!session&&document.visibilityState==='visible'){x=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));z=Number(keys.has('KeyS'))-Number(keys.has('KeyW'));const n=Math.hypot(x,z);if(n>1){x/=n;z/=n;}}c.speed=updateTravelSpeed(c.speed,session,tracked,dt);if(tracked)advance(world,x,z,angle,c.speed,dt);speed=Math.hypot(x,z)*c.speed;const sampleX=world.x+(session?eye.x:0),sampleZ=world.z+(session?eye.z:0);ground=terrainHeight(sampleX,sampleZ,c);updateTerrainFlight(flight,session,tracked,dt,ground);rig.position.y=flight.height;updateHeightUniforms(material,sampleX,sampleZ,c);material.uniforms.ground.value=ground;
// Recenter around room-scale tracking without changing any geometry buffers.
mesh.position.set(session?eye.x:0,0,session?eye.z:0);
water.position.set(mesh.position.x,localWaterHeight(c,ground),mesh.position.z);
trees.update(sampleX,sampleZ,ground,mesh.position.x,mesh.position.z);
lighthouse.update(world.x,world.z,ground);
renderer.render(scene,camera);{frames++;elapsed+=rawDt;if(elapsed>=0.5){stats.textContent=`${session?'XR · ':''}${(frames/elapsed).toFixed(1)} FPS · ${(1000*elapsed/frames).toFixed(2)} ms\n${triangleCount.toLocaleString()} terrain triangles\n${vertexCount.toLocaleString()} terrain vertices\n${trees.population.treeCount.toLocaleString()} active trees · ${trees.population.cells.size} cells\nTree draws/frame ${trees.drawCalls} · uploads ${trees.bufferUpdates}\nX ${world.x.toFixed(2)} m · Z ${world.z.toFixed(2)} m\nElevation ${ground.toFixed(2)} m\nWater level ${waterLevel(c).toFixed(2)} m\nWalking ${speed.toFixed(2)} m/s · set ${c.speed.toFixed(2)}\nFlight clearance ${flight.height.toFixed(2)} m\nAltitude ${(flight.altitude??ground).toFixed(2)} m · ${flight.velocity.toFixed(2)} m/s`;if(session)document.getElementById('speed').value=c.speed;frames=0;elapsed=0;}}});
