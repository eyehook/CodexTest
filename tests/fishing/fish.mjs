import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LINE_SEGMENTS} from '../../src/fishing/rods/LinePhysics.mjs';
import {FishEncounter,FISHING_RULES} from '../../src/fishing/rods/FishEncounter.mjs';
import {FishingRod} from '../../src/fishing/rods/FishingRod.js';
import {RodSystem} from '../../src/fishing/rods/RodSystem.js';
import * as THREE from '../../projects/forest/vendor/three.module.js';
function tick(p,seconds,{rest=true,reel=false,length=5,fps=120}={}){const events=[];for(let i=0;i<Math.round(seconds*fps);i++){const e=p.update(1/fps,rest,reel,length);if(e)events.push(e);}return events;}
function toBite(p,fps=120){const events=[];for(let i=0;i<fps*30&&p.phase!=='bite';i++){const e=p.update(1/fps,true,false,5);if(e)events.push(e);}assert.equal(p.phase,'bite');return events;}
test('settled water wait, nibble counts and variable gaps obey configured ranges',()=>{
 for(const value of [0,.5,.999999])for(const fps of [30,72,90,120]){
 const p=new FishEncounter({random:()=>value});tick(p,.3,{fps});assert.equal(p.phase,'idle');
 while(p.phase==='idle')p.update(1/fps,true,false,5);
 assert.ok(p.time>=3&&p.time<=6);
 const events=[],times=[];let time=0;
 while(p.phase!=='bite'&&time<30){time+=1/fps;const e=p.update(1/fps,true,false,5);if(e){events.push(e);times.push(time);}}
 assert.equal(events.at(-1),'bite');assert.equal(events.filter(e=>e==='nibble').length,2+Math.floor(value*6));
 assert.ok(times[0]>=3-1/fps&&times[0]<=6+1/fps);
 for(let i=1;i<times.length;i++)assert.ok(times[i]-times[i-1]>=.5-1/fps-1e-8&&times[i]-times[i-1]<=2+1/fps+1e-8);
 }
});
test('movement and early retrieval cancel waiting or nibbles and require a fresh wait',()=>{
 const p=new FishEncounter({random:()=>0});tick(p,2,{rest:false});assert.equal(p.phase,'idle');
 tick(p,1);assert.equal(p.phase,'waiting');p.update(.01,false,false,5);assert.equal(p.phase,'idle');
 tick(p,3.5);assert.equal(p.phase,'nibbling');p.update(.01,true,true,5);assert.equal(p.phase,'idle');
 tick(p,2,{reel:true});assert.equal(p.phase,'idle');tick(p,.4);assert.equal(p.phase,'waiting');assert.equal(p.time,3);
});
test('bite timeout restarts the encounter; timely retrieval hooks once and fades at three feet',()=>{
 for(const fps of [30,72,90,120]){
 const p=new FishEncounter({random:()=>0});toBite(p,fps);tick(p,1.1,{fps});assert.notEqual(p.phase,'bite');assert.notEqual(p.phase,'hooked');
 toBite(p,fps);tick(p,.5,{fps});assert.equal(p.update(1/fps,true,true,5),'hooked');assert.equal(p.phase,'hooked');
 tick(p,1,{rest:false,reel:false,length:2,fps});assert.equal(p.phase,'hooked');
 p.update(1/fps,false,true,.6096);assert.equal(p.phase,'caught');assert.equal(p.opacity,1);
 tick(p,2,{fps});assert.equal(p.opacity,1);tick(p,.5,{fps});assert.ok(p.opacity>.45&&p.opacity<.55);tick(p,.5,{fps});assert.equal(p.phase,'idle');
 toBite(p,fps);assert.equal(p.phase,'bite');
 }
 const late=new FishEncounter({random:()=>0});toBite(late);tick(late,.99);assert.equal(late.update(.02,true,true,5),'lost');assert.equal(late.phase,'idle');
});
test('hooked fish replaces hook, follows its moving anchor and restores after fading or reset',()=>{
 const scene=new THREE.Scene(),rod=new FishingRod(scene);scene.add(rod.root);rod.update(true,1/120);
 rod.physics.length=2;rod.physics.phase='cast';rod.physics.deployed=true;rod.encounter.phase='hooked';rod.update(true,1/120);
 assert.ok(rod.fish.visible);assert.equal(rod.hook.visible,false);
 rod.root.updateWorldMatrix(true,true);rod.bobber.updateWorldMatrix(true,true);
 const anchor=rod.hook.getWorldPosition(new THREE.Vector3()),fish=rod.fish.getWorldPosition(new THREE.Vector3());assert.ok(anchor.distanceTo(fish)<1e-6);
 rod.physics.length=rod.physics.homeLength;rod.update(true,1/120);assert.equal(rod.encounter.phase,'caught');
 for(let i=0;i<360;i++)rod.update(true,1/120);
 assert.equal(rod.fish.visible,false);assert.ok(rod.hook.visible);
 rod.encounter.phase='hooked';rod.physics.length=2;rod.update(true,1/120);rod.root.position.x+=100;rod.update(true,1/120);assert.equal(rod.encounter.phase,'idle');assert.equal(rod.fish.visible,false);
 rod.update(false);assert.equal(rod.encounter.phase,'idle');rod.dispose();
});
test('nibble and bite vibrations return while the line stays white for either hand',()=>{
 for(const hand of ['left','right']){
 const scene=new THREE.Scene(),rig=new THREE.Group(),grips=[new THREE.Group(),new THREE.Group()],calls=[];scene.add(rig);
 const system=new RodSystem({xr:{getControllerGrip:i=>grips[i]}},scene,rig);
 const source={handedness:hand,gripSpace:{},gamepad:{mapping:'xr-standard',buttons:[{pressed:false},{},{},{},{},{pressed:true}],hapticActuators:[{pulse:(s,t)=>{calls.push([s,t]);return Promise.resolve(true);}}]}};
 const session={visibilityState:'visible',inputSources:[source]},frame={getPose:()=>({})};grips[0].dispatchEvent({type:'connected',data:source});system.update(session,frame,{},true,1/120);
 const rod=system.activeSlot.rod;
 for(const [phase,color,lineLength] of [['nibbling',0xffffff,5],['bite',0xffffff,5],['hooked',0xffffff,5],['hooked',0xffffff,2],['caught',0xffffff,2],['idle',0xffffff,2]]){
 rod.physics.length=lineLength;
 rod.encounter.update=()=>{rod.encounter.phase=phase;return phase==='nibbling'?'nibble':phase;};
 system.update(session,frame,{},true,1/120);
 assert.equal(rod.line.material.color.getHex(),color);assert.equal(rod.leader.material.color.getHex(),color);
 }
 assert.deepEqual(calls,[[.12,50],[.8,300],[.3,120],[0,1]]);for(const slot of system.slots)slot.rod.dispose();
 }
});

test('actual floating bobber drives a complete encounter, hooking and retrieval',()=>{
 const scene=new THREE.Scene(),rod=new FishingRod(scene,{water:()=>0,surface:()=>-5});scene.add(rod.root);rod.update(true,1/120);
 rod.encounter.random=()=>0;rod.physics.phase='cast';rod.physics.spoolOpen=true;rod.physics.deployed=true;rod.physics.length=6;
 rod.physics.position[LINE_SEGMENTS*3]=5;rod.physics.position[LINE_SEGMENTS*3+1]=.0251043614;rod.physics.velocity.fill(0);
 const events=[];
 for(let i=0;i<3600&&rod.encounter.phase!=='bite';i++){rod.update(true,1/120);if(rod.fishingEvent)events.push(rod.fishingEvent);}
 assert.equal(rod.encounter.phase,'bite');assert.deepEqual(events,['nibble','nibble','bite']);
 rod.update(true,1/120,0,0,0,true);assert.equal(rod.encounter.phase,'hooked');assert.ok(rod.fish.visible);
 for(let i=0;i<2400&&rod.encounter.phase!=='caught';i++)rod.update(true,1/120,0,0,0,true);
 assert.equal(rod.encounter.phase,'caught');assert.equal(rod.physics.length,rod.physics.homeLength);
 for(let i=0;i<360;i++)rod.update(true,1/120,0,0,0,true);
 assert.equal(rod.encounter.phase,'idle');assert.equal(rod.fish.visible,false);assert.ok(rod.hook.visible);rod.dispose();
});

test('nibble survives WebXR source disconnection and reversed controller indices without B/Y',()=>{
 const scene=new THREE.Scene(),rig=new THREE.Group(),grips=[new THREE.Group(),new THREE.Group()];scene.add(rig);
 const system=new RodSystem({xr:{getControllerGrip:i=>grips[i]}},scene,rig);
 const input=(hand,shown=false)=>({handedness:hand,gripSpace:{},gamepad:{mapping:'xr-standard',buttons:[{pressed:false},{},{},{},{},{pressed:shown}]}});
 let right=input('right',true),left=input('left');const session={visibilityState:'visible',inputSources:[right,left]},frame={getPose:()=>({})};
 grips[0].dispatchEvent({type:'connected',data:right});grips[1].dispatchEvent({type:'connected',data:left});system.update(session,frame,{},true,1/120);
 right.gamepad.buttons[5].pressed=false;system.update(session,frame,{},true,1/120);
 const rod=system.activeSlot.rod,p=rod.physics,encounter=rod.encounter,leader=rod.leaderPhysics;
 p.water=()=>0;p.surface=()=>-5;p.phase='cast';p.spoolOpen=true;p.length=6;p.deployed=true;
 const end=LINE_SEGMENTS*3;p.position[end]=p.target[0]+5;p.position[end+1]=.025;p.position[end+2]=p.target[2];p.velocity.fill(0);
 encounter.phase='nibbling';encounter.remainingNibbles=2;encounter.time=10;
 const nodes=p.position.slice();
 grips[0].dispatchEvent({type:'disconnected'});grips[1].dispatchEvent({type:'disconnected'});session.inputSources=[];
 for(let i=0;i<144;i++)system.update(session,frame,{},true,1/120);
 assert.ok(system.controls.right.shown);assert.equal(encounter.phase,'nibbling');assert.ok(encounter.time<9);assert.notDeepEqual(p.position,nodes);assert.ok(rod.bobber.visible);assert.ok(rod.line.visible);assert.ok(rod.root.visible);assert.equal(rod.root.parent,system.activeSlot.fallback);
 // Browser re-adds left first in the former right slot, then right in slot 1.
 left=input('left');right=input('right');session.inputSources=[left,right];
 grips[0].dispatchEvent({type:'connected',data:left});system.update(session,frame,{},true,1/120);
 assert.equal(system.activeSlot.rod.physics,p);assert.ok(encounter.time<9);
 grips[1].dispatchEvent({type:'connected',data:right});system.update(session,frame,{},true,1/120);
 assert.equal(system.activeSlot,system.slots[1]);assert.equal(system.activeSlot.rod.physics,p);assert.equal(system.activeSlot.rod.encounter,encounter);assert.equal(system.activeSlot.rod.leaderPhysics,leader);
 assert.ok(system.activeSlot.rod.root.visible);assert.equal(encounter.phase,'nibbling');assert.ok(encounter.time<9);
 system.update(null,null,null,false);assert.equal(system.controls.right.shown,false);assert.ok(system.slots.every(s=>!s.rod.line.visible));
 for(const slot of system.slots)slot.rod.dispose();
});

test('sleeping controller holds a world-fixed rod indefinitely while physics and bite timers continue',()=>{
 const scene=new THREE.Scene(),rig=new THREE.Group(),grips=[new THREE.Group(),new THREE.Group()];scene.add(rig);
 const system=new RodSystem({xr:{getControllerGrip:i=>grips[i]}},scene,rig);
 const source={handedness:'right',gripSpace:{},gamepad:{mapping:'xr-standard',buttons:[{pressed:false},{},{},{},{},{pressed:true}]}},session={visibilityState:'visible',inputSources:[source]},frame={getPose:()=>({})};
 grips[0].position.set(.3,1,-.4);grips[0].dispatchEvent({type:'connected',data:source});system.update(session,frame,{},true,1/120);
 const rod=system.activeSlot.rod,before=rod.root.getWorldPosition(new THREE.Vector3()),nodes=rod.physics.position.slice();
 rod.encounter.phase='bite';rod.encounter.time=.2;
 grips[0].dispatchEvent({type:'disconnected'});grips[0].visible=false;session.inputSources=[];
 rig.position.set(3,2,1);rig.rotation.y=.5;
 for(let i=0;i<480;i++)system.update(session,frame,{},true,1/120,20,-10,5);
 assert.ok(rod.root.visible&&rod.line.visible&&rod.bobber.visible);
 const after=rod.root.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(20,5,-10));
 assert.ok(before.distanceTo(after)<1e-6);assert.notDeepEqual(rod.physics.position,nodes);
 assert.notEqual(rod.encounter.phase,'bite');assert.equal(rod.physics.initialized,true);
 for(const slot of system.slots)slot.rod.dispose();
});

test('landed fish stays for two seconds, blocks casting through fade, and requires a fresh press',()=>{
 const rod=new FishingRod(new THREE.Scene());rod.update(true,1/120);rod.encounter.phase='caught';rod.encounter.time=0;
 for(let i=0;i<240;i++){
  rod.update(true,1/120,0,0,0,i%2===0);
  assert.notEqual(rod.physics.phase,'armed');assert.equal(rod.physics.spoolOpen,false);assert.ok(rod.fish.visible);
 }
 assert.equal(rod.encounter.opacity,1);
 for(let i=0;i<119;i++){rod.update(true,1/120,0,0,0,true);assert.notEqual(rod.physics.phase,'armed');assert.ok(rod.fish.visible);}
 assert.ok(rod.encounter.opacity<.02);rod.update(true,1/120,0,0,0,true);assert.equal(rod.fish.visible,false);
 rod.update(true,1/120,0,0,0,true);assert.notEqual(rod.physics.phase,'armed');
 rod.update(true,1/120,0,0,0,false);rod.update(true,1/120,0,0,0,true);assert.equal(rod.physics.phase,'armed');rod.dispose();
});
test('each newly hooked fish gets a random color that stays stable through retrieval',()=>{
 const p=new FishEncounter({random:()=>.2});p.phase='bite';p.time=1;p.update(.01,true,true,5);const first=p.hue;
 tick(p,.5,{length:2});assert.equal(p.hue,first);
 p.reset();p.random=()=>.8;p.phase='bite';p.time=1;p.update(.01,true,true,5);assert.notEqual(p.hue,first);
 const rod=new FishingRod(new THREE.Scene());rod.update(true,1/120);rod.encounter=p;rod.physics.length=2;rod.update(true,1/120);
 const color=rod.fish.materials[0].color.getHex();rod.update(true,1/120);assert.equal(rod.fish.materials[0].color.getHex(),color);
 rod.encounter.hue=first;rod.update(true,1/120);assert.notEqual(rod.fish.materials[0].color.getHex(),color);rod.dispose();
});

test('nibble dips one inch and bite dips six inches before buoyancy restores the bobber',async()=>{
 const {LinePhysics,LINE_SEGMENTS}=await import('../../src/fishing/rods/LinePhysics.mjs');
 for(const fps of [30,72,90,120])for(const depth of [.0254,.1524]){
 const p=new LinePhysics(.6096,{water:()=>0,surface:()=>-5});p.reset(0,2,0);p.phase='cast';p.length=5;p.deployed=true;
 const end=LINE_SEGMENTS*3;p.position[end+1]=.0251043614;p.velocity.fill(0);const start=p.position[end+1];p.dip(depth);
 let min=start;for(let i=0;i<fps*3;i++){p.update(0,2,0,1/fps);min=Math.min(min,p.position[end+1]);}
 assert.ok(Math.abs(start-min-depth)<.003);assert.ok(Math.abs(p.position[end+1]-start)<.003);assert.equal(p.dipTime,0);
 }
});

test('moderate fish buzz renews while hooked, stops at retrieval, and follows the equipped actuator',()=>{
 const grips=[new THREE.Group(),new THREE.Group()],system=new RodSystem({xr:{getControllerGrip:i=>grips[i]}},new THREE.Scene(),new THREE.Group()),right=[],left=[];
 const a={pulse:(s,t)=>{right.push([s,t]);}},b={pulse:(s,t)=>{left.push([s,t]);}};
 system.updateFeedback(a,true,null,1/120);assert.deepEqual(right,[[.3,120]]);
 for(let i=0;i<12;i++)system.updateFeedback(a,true,null,1/120);assert.equal(right.length,2);
 system.updateFeedback(b,true,null,1/120);assert.deepEqual(right.at(-1),[0,1]);assert.deepEqual(left,[[.3,120]]);
 system.updateFeedback(b,false,'zone',1/120);assert.deepEqual(left.slice(-2),[[0,1],[.12,50]]);
 const count=left.length;for(let i=0;i<360;i++)system.updateFeedback(b,false,null,1/120);assert.equal(left.length,count);
 system.updateFeedback(a,true,null,1/120);system.resetPhysics();assert.deepEqual(right.at(-1),[0,1]);
 for(const slot of system.slots)slot.rod.dispose();
});

test('general slack limit removes only excess over six inches within one second',async()=>{
 const {LinePhysics,MAX_LINE_SLACK}=await import('../../src/fishing/rods/LinePhysics.mjs');
 for(const distance of [2,10,30]){
 const p=new LinePhysics();p.length=distance+5;
 for(let i=0;i<60;i++)p.trimSlack(distance,1/120);
 assert.ok(p.length>distance+MAX_LINE_SLACK);
 for(let i=0;i<60;i++)p.trimSlack(distance,1/120);
 assert.ok(Math.abs(p.length-distance-MAX_LINE_SLACK)<1e-8);
 const length=p.length;p.trimSlack(distance,1/120);assert.equal(p.length,length);
 }
});

test('FISH quad follows the bobber and survives early hooking',()=>{
 const rod=new FishingRod(new THREE.Scene());rod.update(true,1/120);
 assert.equal(rod.biteLabel.parent,rod.bobber);assert.ok(rod.biteLabel.isSprite);assert.ok(rod.biteLabel.position.y>0);
 for(const phase of ['waiting','nibbling','bite','hooked','caught','idle']){
 rod.encounter.update=()=>{rod.encounter.phase=phase;return null;};rod.update(true,1/120);
 assert.equal(rod.biteLabel.visible,['bite','hooked','caught','idle'].includes(phase));
 }
 rod.update(false);assert.equal(rod.biteLabel.visible,false);rod.dispose();
});
test('bite texture draws bold outlined FISH once using a system font',async()=>{
 const {createBiteTexture}=await import('../../src/fishing/rods/BiteLabel.js');const calls=[];
 const context={strokeText:(...args)=>calls.push(['stroke',...args]),fillText:(...args)=>calls.push(['fill',...args])};
 const canvas={getContext:type=>{assert.equal(type,'2d');return context;}};
 const texture=createBiteTexture(canvas);assert.equal(canvas.width,512);assert.equal(canvas.height,160);
 assert.ok(context.font.includes('900'));assert.equal(context.fillStyle,'#ff2222');assert.deepEqual(calls.map(c=>c.slice(0,2)),[['stroke','FISH!'],['fill','FISH!']]);assert.ok(texture.isCanvasTexture);texture.dispose();
});

test('FISH! label is ten times the original size and smoothly pulses only while biting',async()=>{
 const {BiteLabel}=await import('../../src/fishing/rods/BiteLabel.js');const label=new BiteLabel();
 assert.equal(label.scale.x,9);assert.equal(label.scale.y,2.8125);
 let min=Infinity,max=0;
 for(let i=0;i<120;i++){label.update(true,1/120);min=Math.min(min,label.scale.x);max=Math.max(max,label.scale.x);assert.ok(label.position.y-label.scale.y/2>0);}
 assert.ok(min<9&&max>9);assert.ok(min>=9*.85-1e-6&&max<=9*1.15+1e-6);
 label.reset();assert.equal(label.pulseTime,0);assert.equal(label.visible,false);label.material.dispose();
});

test('new fish sizes span 50–250 percent, stay fixed per catch and drive stronger bends',()=>{
 const bends=[];
 for(const value of [0,.5,1]){
 const encounter=new FishEncounter({random:()=>value});encounter.phase='bite';encounter.time=1;
 encounter.update(.01,true,true,5);assert.ok(Math.abs(encounter.size-(.5+2*value))<1e-9);assert.ok(Math.abs(encounter.weightKg-.35*encounter.size**3)<1e-9);
 const rod=new FishingRod(new THREE.Scene());rod.update(true,1/120);rod.encounter=encounter;rod.physics.length=5;
 const size=encounter.size;for(let i=0;i<120;i++)rod.update(true,1/120);
 assert.equal(encounter.size,size);assert.equal(rod.fish.scale.x,size);assert.equal(rod.fish.scale.y,size);assert.equal(rod.fish.scale.z,size);
 assert.ok(rod.fish.position.distanceTo(rod.hook.position)<1e-6);
 bends.push(rod.bend);rod.dispose();
 }
 assert.ok(bends[0]<bends[1]&&bends[1]<bends[2]);
});

test('fish weight persists through retrieval and controls bend independently of visual size',()=>{
 const bends=[];
 for(const weight of [.1,1,5]){
 const rod=new FishingRod(new THREE.Scene());rod.update(true,1/120);rod.encounter.phase='hooked';rod.encounter.size=1;rod.encounter.weightKg=weight;rod.physics.length=5;
 for(let i=0;i<120;i++)rod.update(true,1/120);
 assert.equal(rod.encounter.weightKg,weight);assert.equal(rod.fish.scale.x,1);bends.push(rod.bend);
 rod.physics.length=rod.physics.homeLength;rod.update(true,1/120);assert.equal(rod.encounter.weightKg,weight);assert.equal(rod.encounter.phase,'caught');rod.dispose();
 }
 assert.ok(bends[0]<bends[1]&&bends[1]<bends[2]);
 const p=new FishEncounter({random:()=>.25});p.phase='bite';p.time=1;p.update(.01,true,true,5);assert.equal(p.size,1);assert.equal(p.weightKg,.35);p.reset();assert.equal(p.weightKg,0);
});

test('fish mouth touches leader endpoint across random sizes and hook orientations',()=>{
 const scene=new THREE.Scene(),rod=new FishingRod(scene);scene.add(rod.root);rod.update(true,1/120);
 for(const size of [.5,1,2.5]){
 rod.encounter.phase='hooked';rod.encounter.size=size;rod.physics.length=5;
 for(let i=0;i<30;i++)rod.update(true,1/120);
 const endpoint=new THREE.Vector3().fromBufferAttribute(rod.leader.geometry.attributes.position,2);rod.bobber.localToWorld(endpoint);
 const mouth=rod.fish.localToWorld(new THREE.Vector3());assert.ok(mouth.distanceTo(endpoint)<1e-6);
 const body=rod.fish.children[0];assert.ok(Math.abs(body.position.y+body.scale.y)<1e-9);
 }
 rod.dispose();
});

test('general slack take-up works in flight, on dry land, and during held retrieval',async()=>{
 const {LinePhysics,LINE_SEGMENTS,MAX_LINE_SLACK}=await import('../../src/fishing/rods/LinePhysics.mjs');
 for(const fps of [30,72,90,120])for(const mode of ['air','land','reel']){
 const p=new LinePhysics(.6096,{water:()=>0,surface:()=>mode==='land'?1:-5});p.reset(0,3,0);p.phase='cast';p.spoolOpen=true;p.length=20;p.deployed=true;
 const end=LINE_SEGMENTS*3;p.position[end]=10;p.position[end+1]=mode==='land'?1.045:5;p.velocity.fill(0);
 if(mode==='reel')p.setTrigger(true);
 for(let i=0;i<fps;i++){if(mode==='reel')p.setTrigger(true);p.update(0,3,0,1/fps);}
 const distance=Math.hypot(p.position[end],p.position[end+1]-3,p.position[end+2]);
 assert.ok(p.length-distance<=MAX_LINE_SLACK+.03);
 if(mode==='reel'){assert.equal(p.phase,'reeling');assert.ok(p.reelTime>.9);}
 else assert.ok(Math.abs(p.position[end]-10)<1e-6);
 }
});

test('bite label stays for one second after hooking then shrinks to zero over one second',async()=>{
 const {BiteLabel}=await import('../../src/fishing/rods/BiteLabel.js');
 for(const fps of [30,72,90,120]){
 const label=new BiteLabel();label.update(true,1/fps);
 for(let i=0;i<fps;i++)label.update(false,1/fps);
 assert.ok(label.visible);assert.ok(Math.abs(label.scale.x-9)<1e-6);
 let previous=label.scale.x;
 for(let i=0;i<fps;i++){label.update(false,1/fps);assert.ok(label.scale.x<=previous+1e-6);previous=label.scale.x;}
 assert.equal(label.visible,false);assert.equal(label.scale.x,0);assert.equal(label.scale.y,0);
 label.update(true,1/fps);assert.ok(label.visible);assert.equal(label.age,0);label.material.dispose();
 }
});

test('LOST! replaces FISH!, floats upward and shrinks away over two seconds',async()=>{
 const {BiteLabel,createBiteTexture}=await import('../../src/fishing/rods/BiteLabel.js');
 for(const fps of [30,72,90,120]){
 const label=new BiteLabel();label.update(true,1/fps);label.update(false,1/fps,true);
 assert.equal(label.mode,'lost');assert.equal(label.age,0);const start=label.position.y;let size=label.scale.x;
 for(let i=0;i<fps*2;i++){label.update(false,1/fps);assert.ok(label.position.y>=start);assert.ok(label.scale.x<=size+1e-6);size=label.scale.x;}
 assert.equal(label.visible,false);assert.equal(label.scale.x,0);assert.ok(label.position.y>start+1);
 label.update(true,1/fps);assert.equal(label.mode,'fish');assert.ok(label.visible);assert.equal(label.position.y,2.4);label.dispose();
 }
 const calls=[],ctx={strokeText:t=>calls.push(t),fillText:t=>calls.push(t)},canvas={getContext:()=>ctx};
 const texture=createBiteTexture(canvas,'LOST!','#2288ff');assert.deepEqual(calls,['LOST!','LOST!']);assert.equal(ctx.fillStyle,'#2288ff');texture.dispose();
 const encounter=new FishEncounter();encounter.phase='nibbling';assert.equal(encounter.update(.01,true,true,5),'lost');
});

test('trigger presses after a loss do not restart LOST! during the next waiting delay',async()=>{
 const {BiteLabel}=await import('../../src/fishing/rods/BiteLabel.js');
 const encounter=new FishEncounter({random:()=>0}),label=new BiteLabel();encounter.phase='bite';encounter.time=.01;
 let losses=0;
 for(let i=0;i<242;i++){
  const event=encounter.update(1/120,true,i===90||i===180,5);
  if(event==='lost')losses++;
  label.update(encounter.phase==='bite',1/120,event==='lost');
  if(i===90||i===180)assert.ok(label.age>0.5);
 }
 assert.equal(losses,1);label.update(false,1/120);assert.equal(label.visible,false);
 // A genuinely new fish can still produce its own message.
 encounter.phase='nibbling';assert.equal(encounter.update(.01,true,true,5),'lost');label.update(false,.01,true);assert.equal(label.age,0);label.dispose();
});
