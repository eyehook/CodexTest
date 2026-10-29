import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CONFIG as c,FT} from '../projects/spacerace/config.mjs';
import {Simulation,densityAt,integrateSpeed,triggerInput} from '../projects/spacerace/simulation.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} ≠ ${b}`);
test('configured feet/metres, density knots and interpolation',()=>{
 close(c.maxSpeed/FT,440);close(c.maxSpeed/FT*3600/5280,300);
 for(const [ratio,count] of c.densityCurve)close(densityAt(ratio*c.maxSpeed),count);
 close(densityAt(c.maxSpeed*0.375),600);
});
test('acceleration, braking, coasting and both speed limits integrate across frame rates',()=>{
 for(const hz of [30,72,90,120]){
  let speed=0,distance=0;
  for(let i=0;i<hz*8;i++){const s=integrateSpeed(speed,1,0,1/hz);speed=s.speed;distance+=s.distance;}
  close(speed,c.maxSpeed);close(distance,(440*8-440*440/120)*FT);
  close(integrateSpeed(speed,0,0,2).distance,880*FT);
  let braking=0;for(let i=0;i<hz*5;i++){const s=integrateSpeed(speed,0,1,1/hz);speed=s.speed;braking+=s.distance;}
  close(speed,0);close(braking,968*FT);
 }
 const capped=integrateSpeed(439*FT,1,0,1);close(capped.distance,(440-1/120)*FT);
});
test('fixed pool remains stopped, recycles within cylinder and keeps ring spacing',()=>{
 const sim=new Simulation();assert.equal(sim.rings.length,5);close(sim.rings.at(-1),-1000*FT);const positions=sim.positions.slice(),rings=sim.rings.slice();
 sim.step(1);assert.deepEqual(sim.positions,positions);assert.deepEqual(sim.rings,rings);
 sim.speed=c.maxSpeed;
 for(let frame=0;frame<3000;frame++)sim.step(1/72);
 assert.equal(sim.positions.length,9000);
 for(let i=0;i<sim.positions.length;i+=3){assert.ok(Math.hypot(sim.positions[i],sim.positions[i+1])<=c.fieldRadius+1e-5);assert.ok(Math.hypot(sim.positions[i],sim.positions[i+1])>=c.fieldInnerRadius-1e-5);assert.ok(sim.positions[i+2]>=-c.drawDistance-1e-5&&sim.positions[i+2]<=c.rearBoundary+1e-5);}
 const sorted=[...sim.rings].sort((a,b)=>a-b);for(let i=1;i<sorted.length;i++)close(sorted[i]-sorted[i-1],c.ringSpacing);
 const frozen=sim.positions.slice();sim.speed=0;sim.step(1);assert.deepEqual(sim.positions,frozen);
});
test('same displacement drives particles and rings before recycling',()=>{
 const sim=new Simulation();sim.positions[2]=-50;sim.rings[0]=-50;sim.step(0.01,1,0);assert.ok(Math.abs(sim.positions[2]-sim.rings[0])<4e-6);
});
test('analog triggers use handedness and xr-standard; simultaneous inputs combine',()=>{
 const source=(hand,value,mapping='xr-standard')=>({handedness:hand,gamepad:{mapping,buttons:[{value}]}});
 assert.deepEqual(triggerInput([source('right',0.7),source('left',0.4),source('right',1,'other')]),{accelerate:0.7,decelerate:0.4});
 close(integrateSpeed(100*FT,1,1,1).speed,60*FT);
 assert.deepEqual(triggerInput([{}, {handedness:'right'}]),{accelerate:0,decelerate:0});
});

test('FPS averages actual frame intervals and resets between active sessions',async()=>{
 const {FrameRate}=await import('../projects/spacerace/frame-rate.mjs');
 const fps=new FrameRate();assert.equal(fps.value,null);
 for(let i=0;i<90;i++)fps.sample(1/90);
 close(fps.value,90);
 fps.reset();assert.equal(fps.value,null);
 for(let i=0;i<5;i++)fps.sample(0.1);
 close(fps.value,10); // Raw 100 ms frames must not use the simulation's 50 ms cap.
 fps.reset();fps.sample(0);fps.sample(NaN);assert.equal(fps.value,null);
});

test('120 Hz request checks support and preserves VR on unsupported/rejected requests',async()=>{
 const {requestFrameRate}=await import('../projects/spacerace/xr-frame-rate.mjs');
 let requested=null;
 assert.equal(await requestFrameRate({supportedFrameRates:new Float32Array([72,90,120]),updateTargetFrameRate:async rate=>{requested=rate;}},120),true);
 assert.equal(requested,120);
 requested=null;
 assert.equal(await requestFrameRate({supportedFrameRates:[72,90],updateTargetFrameRate:async rate=>{requested=rate;}},120),false);
 assert.equal(requested,null);
 assert.equal(await requestFrameRate({},120),false);
 assert.equal(await requestFrameRate({supportedFrameRates:[120],updateTargetFrameRate:async()=>{throw Error('declined');}},120),false);
});

test('refresh-rate negotiation runs once after rendering and never gates XR startup',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../projects/spacerace/main.js',import.meta.url),'utf8');
 assert.ok(!source.includes('await requestFrameRate('));
 assert.ok(source.indexOf('await renderer.xr.setSession(requested)')<source.indexOf('void requestFrameRate('));
 assert.match(source,/renderer\.render\(scene,camera\);[\s\S]*if\(session&&frame&&active&&refreshPending\)\{\s*refreshPending=false;\s*void requestFrameRate/);
 const {requestFrameRate}=await import('../projects/spacerace/xr-frame-rate.mjs');
 let called=false;
 // A browser that never settles its request must still let the caller continue.
 void requestFrameRate({supportedFrameRates:[120],updateTargetFrameRate(){called=true;return new Promise(()=>{});}},120);
 assert.equal(called,true);
});

test('ring whoosh Doppler follows radial speed and fades before recycling',async()=>{
 const {ringSound}=await import('../projects/spacerace/ring-audio.mjs');
 const sound=z=>ringSound(z,c.maxSpeed,c.ringRadius,c.rearBoundary,65*FT);
 assert.ok(sound(-10).pitch>1);assert.ok(sound(4).pitch<1);close(sound(0).pitch,1);
 assert.ok(sound(-10).pitch>ringSound(-10,20,c.ringRadius,c.rearBoundary,65*FT).pitch);
 close(sound(-65*FT).gain,0);close(sound(c.rearBoundary).gain,0);
 assert.ok(sound(0).gain>sound(-10).gain);
 const stopped=ringSound(0,0,c.ringRadius,c.rearBoundary,65*FT);close(stopped.gain,0);close(stopped.pitch,1);
 // Crossing remains continuous because emitters sit on the rim, away from the ears.
 assert.ok(Math.abs(sound(-0.001).pitch-sound(0.001).pitch)<0.001);
});

test('audio uses a fixed voice pool, unlocks on demand, and mutes inactive sessions',async()=>{
 const {RingAudio}=await import('../projects/spacerace/ring-audio.mjs');
 let nodes=0,started=0,stopped=0;
 const parameter=()=>({value:0,setTargetAtTime(value){this.value=value;},cancelScheduledValues(){}});
 class Context {
  constructor(){this.sampleRate=100;this.currentTime=0;this.destination={};this.state='running';this.listener={};for(const key of ['positionX','positionY','positionZ','forwardX','forwardY','forwardZ','upX','upY','upZ'])this.listener[key]=parameter();}
  createGain(){nodes++;return {gain:parameter(),connect(){},disconnect(){}};}
  createBuffer(channels,length){return {getChannelData:()=>new Float32Array(length)};}
  createBufferSource(){nodes++;return {playbackRate:parameter(),connect(){},disconnect(){},start(){started++;},stop(){stopped++;}};}
  createBiquadFilter(){nodes++;return {frequency:parameter(),Q:parameter(),connect(){},disconnect(){}};}
  createPanner(){nodes++;return {positionX:parameter(),positionY:parameter(),positionZ:parameter(),connect(){},disconnect(){}};}
  resume(){return Promise.resolve();}close(){return Promise.resolve();}
 }
 const audio=new RingAudio(c,4,Context);assert.equal(audio.context,null);audio.unlock();
 assert.equal(started,8);const initialNodes=nodes;audio.unlock();assert.equal(nodes,initialNodes);
 const position={x:0,y:0,z:0},forward={x:0,y:0,z:-1},up={x:0,y:1,z:0};
 for(let i=0;i<240;i++)audio.update([-1,-62,-123,-184],c.maxSpeed,true,position,forward,up);
 assert.equal(nodes,initialNodes);assert.ok(audio.master.gain.value>0);assert.ok(audio.voices[0].gain.gain.value>0);
 audio.update([-1,-62,-123,-184],c.maxSpeed,false,position,forward,up);close(audio.master.gain.value,0);
 audio.toggle();audio.update([-1,-62,-123,-184],c.maxSpeed,true,position,forward,up);close(audio.master.gain.value,0);
 audio.dispose();assert.equal(stopped,8);
 const unavailable=new RingAudio(c,4,null);unavailable.unlock();unavailable.update([],0,false,position,forward,up);assert.equal(unavailable.context,null);
});

test('particle annulus samples uniform area between 10 and 200 feet',()=>{
 close(c.fieldInnerRadius/FT,10);close(c.fieldRadius/FT,200);
 const inner=new Simulation(c,()=>0);close(Math.hypot(inner.positions[0],inner.positions[1]),c.fieldInnerRadius);
 const middle=new Simulation(c,()=>0.5);
 const expected=Math.sqrt((c.fieldInnerRadius**2+c.fieldRadius**2)/2);
 assert.ok(Math.abs(Math.hypot(middle.positions[0],middle.positions[1])-expected)<1e-5);
});

test('ring wakes use continuous eight-segment geometry, linear alpha and shared recycling transforms',async()=>{
 const THREE=await import('../shared/vendor/three-r180/three.module.js');
 const {wakeLength,createRings}=await import('../projects/spacerace/rings.js');
 for(const feet of [0,100,200,300,440])close(wakeLength(feet*FT)/FT,feet*12/120);
 close(wakeLength(30,3,90),1);
 const system=createRings(c,c.ringCount),geometry=system.wakes.geometry;
 assert.equal(geometry.attributes.position.count,9*129);
 assert.equal(geometry.index.count,8*128*6);
 for(let row=0;row<=8;row++)for(let col=0;col<=128;col++){
  const index=row*129+col,p=geometry.attributes.position;
  close(p.getZ(index),-row/8);
  assert.ok(Math.abs(Math.hypot(p.getX(index),p.getY(index))-c.ringRadius)<1e-6);
 }
 assert.equal(system.wakes.instanceMatrix,system.rings.instanceMatrix);
 assert.equal(system.wakes.material.blending,THREE.AdditiveBlending);
 assert.equal(system.wakes.material.depthWrite,false);assert.equal(system.wakes.material.depthTest,true);
 assert.equal(system.wakes.material.side,THREE.DoubleSide);assert.equal(system.wakes.material.forceSinglePass,true);
 const sim=new Simulation(c);system.update(sim.rings,0);assert.equal(system.wakes.visible,false);
 sim.speed=c.maxSpeed;
 for(let i=0;i<1000;i++){sim.step(1/120);system.update(sim.rings,sim.speed);}
 for(let i=0;i<c.ringCount;i++)close(system.rings.instanceMatrix.array[i*16+14],Math.fround(sim.rings[i]));
 assert.equal(system.wakes.visible,true);close(system.wakes.material.uniforms.length.value,c.maxSpeed*12/120);
 assert.equal(system.wakes.geometry,geometry);
 system.update(sim.rings,30);close(system.wakes.material.uniforms.length.value,3);
 assert.match(system.wakes.material.vertexShader,/opacity=1.0\+position.z/);
 assert.match(system.wakes.material.fragmentShader,/vec4\(color,opacity\)/);
});
