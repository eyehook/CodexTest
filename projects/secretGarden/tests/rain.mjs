import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {randomFor} from '../generator.mjs';
import {RainCycle,RAIN_LEVELS} from '../rain-cycle.mjs';
import {GardenRain,rainContains,RAIN_MARGIN} from '../garden-rain.mjs';
import {createSettingsPanel} from '../settings-panel.mjs';
import {Preferences,DEFAULT_SETTINGS} from '../preferences.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('rain frequency orders clear intervals and showers ease up to a random peak then back to clear',()=>{
 const intervals=[];for(let level=0;level<=4;level++){const c=new RainCycle(level,()=>.5);intervals.push(level===4?0:c.duration);assert.equal(c.intensity===0,level!==4);}
 assert.deepEqual(RAIN_LEVELS,['Never','Rarely','Sometimes','Often','Always']);assert.ok(intervals.every((v,i)=>i===0||intervals[i-1]>v));
 const c=new RainCycle(2,()=>.5);c.update(450);assert.equal(c.phase,'rise');assert.equal(c.intensity,0);
 c.update(15);near(c.intensity,.3125);c.update(15);near(c.intensity,.625);assert.equal(c.phase,'hold');
 c.update(52.5);assert.equal(c.phase,'fall');c.update(17.5);near(c.intensity,.3125);c.update(17.5);assert.equal(c.intensity,0);assert.equal(c.phase,'clear');
 const low=new RainCycle(2,()=>.1),high=new RainCycle(2,()=>.9);low.update(low.duration+40);high.update(high.duration+40);assert.ok(low.peak<high.peak);
});
test('rain cycles are time based; Never clears immediately and Always holds maximum intensity',()=>{
 const a=new RainCycle(4,()=>.5),b=new RainCycle(4,()=>.5);a.update(250);for(let i=0;i<2500;i++)b.update(.1);near(a.intensity,b.intensity);assert.equal(a.phase,b.phase);
 a.setLevel(0);assert.equal(a.intensity,0);a.update(30);assert.equal(a.intensity,0);a.update(1000);assert.equal(a.intensity,0);
 a.setLevel(4);assert.ok(a.intensity>0);assert.throws(()=>a.setLevel(5));
});
test('rain uses one reusable depth-tested batch, stays outdoors, and restores sky/cloud colors',()=>{
 const scene=new THREE.Scene();scene.background=new THREE.Color('#788f9c');const clouds={mesh:{material:new THREE.MeshBasicMaterial({color:0xffffff})}};
 const rain=new GardenRain(scene,clouds,{level:4,random:randomFor(41),maxDrops:300}),head=new THREE.Vector3(0,1.6,0);
 const positions=rain.positions,segments=rain.simulation.segments,clear=scene.background.clone(),white=clouds.mesh.material.color.clone();
 rain.update(15,head);assert.ok(rain.cycle.intensity>0);assert.ok(!scene.background.equals(clear));assert.ok(!clouds.mesh.material.color.equals(white));
 assert.equal(rain.object.material.transparent,false);assert.equal(rain.object.material.depthTest,true);assert.equal(rain.object.castShadow,false);
 for(let i=0;i<200;i++)rain.update(.05,head);assert.equal(rain.positions,positions);assert.equal(rain.simulation.segments,segments);assert.ok(rain.geometry.drawRange.count>0);
 for(let i=0;i<rain.geometry.drawRange.count*3;i+=3){assert.ok(Number.isFinite(positions[i]));assert.ok(rainContains(positions[i],positions[i+2]));assert.ok(positions[i+1]>=0&&positions[i+1]<=10.00001);}
 rain.setLevel(0);assert.equal(rain.object.visible,false);assert.equal(rain.geometry.drawRange.count,0);assert.ok(scene.background.equals(clear));assert.ok(clouds.mesh.material.color.equals(white));rain.dispose();assert.equal(scene.children.length,0);clouds.mesh.material.dispose();
});
test('five-stop rain slider quantizes from pointer input and frequency persists independently of garden saves',()=>{
 const old=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>new Proxy({}, {get:()=>()=>{}})})};
 try{
  const rain={level:2,setLevel(level){this.level=level;}},panel=createSettingsPanel(new THREE.Scene(),{shadowMap:{enabled:true}},{rain});
  assert.ok(panel.targets.includes(panel.rainSlider.mesh));
  for(let level=0;level<=4;level++){panel.rainSlider.drag({uv:{x:(100+824*level/4)/1024}});assert.equal(rain.level,level);assert.equal(panel.model.format(panel.model.definition('rain')),RAIN_LEVELS[level]);}
  const map=new Map(),disk={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},prefs=new Preferences(disk);prefs.save({...DEFAULT_SETTINGS,rain:4});assert.equal(new Preferences(disk).value.rain,4);assert.throws(()=>prefs.save({...DEFAULT_SETTINGS,rain:1.5}));
 }finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});

test('rain extends four feet past walls while excluding the covered hallway',()=>{
 near(RAIN_MARGIN,1.2192);assert.ok(rainContains(4.572+1,0));assert.ok(rainContains(0,-6.858-1));assert.ok(!rainContains(4.572+RAIN_MARGIN+.01,0));assert.ok(!rainContains(0,7.5));assert.ok(rainContains(2,7.5));
 const scene=new THREE.Scene();scene.background=new THREE.Color('#788f9c');const clouds={mesh:{material:new THREE.MeshBasicMaterial({color:0xffffff})}},rain=new GardenRain(scene,clouds,{level:4,random:randomFor(19)});
 rain.update(.05,new THREE.Vector3(0,1.6,0));let outside=false;
 for(let i=0;i<rain.geometry.drawRange.count*3;i+=3)if(Math.abs(rain.positions[i])>4.572||Math.abs(rain.positions[i+2])>6.858)outside=true;
 assert.ok(outside);rain.dispose();clouds.mesh.material.dispose();
});
test('real rain impacts generate shadow-free splashes and rings; Never and Always update all conditions immediately',()=>{
 const scene=new THREE.Scene();scene.background=new THREE.Color('#788f9c');const clouds={mesh:{material:new THREE.MeshBasicMaterial({color:0xffffff})}},rain=new GardenRain(scene,clouds,{level:0,random:randomFor(59)}),head=new THREE.Vector3(0,1.6,0);
 const clear=scene.background.clone(),white=clouds.mesh.material.color.clone();rain.setLevel(4);
 assert.ok(rain.cycle.intensity>0);assert.ok(rain.object.visible);assert.ok(rain.geometry.drawRange.count>0);assert.ok(!scene.background.equals(clear));assert.ok(!clouds.mesh.material.color.equals(white));
 for(let i=0;i<100;i++)rain.update(.05,head);
 const ground=rain.groundEffects;assert.ok(ground.splashes.freeCount<ground.splashes.capacity);assert.ok(ground.ripples.freeCount<ground.ripples.capacity);
 for(const object of [rain.object,ground.splashObject,ground.rippleObject]){assert.equal(object.castShadow,false);assert.equal(object.receiveShadow,false);}
 for(const pool of [ground.splashes,ground.ripples])for(let i=0;i<pool.capacity;i++)if(pool.active[i]){assert.ok(Math.abs(pool.x[i])<=4.572);assert.ok(Math.abs(pool.z[i])<=6.858);}
 rain.setLevel(0);assert.equal(rain.cycle.intensity,0);assert.equal(rain.object.visible,false);assert.equal(ground.group.visible,false);assert.equal(ground.splashes.freeCount,300);assert.equal(ground.ripples.freeCount,200);assert.ok(scene.background.equals(clear));assert.ok(clouds.mesh.material.color.equals(white));
 rain.dispose();assert.equal(scene.children.length,0);clouds.mesh.material.dispose();
});

test('overcast lighting blends with rain and restores immediately without changing sun pose or shadow flags',async()=>{
 const {WeatherLighting}=await import('../weather-lighting.mjs');
 const sun=new THREE.DirectionalLight(0xffefcf,3.1),hemi=new THREE.HemisphereLight(0xe7f1ff,0x665039,2.1);sun.position.set(-6,12,7);sun.castShadow=true;
 const colors=[sun.color.clone(),hemi.color.clone(),hemi.groundColor.clone()],lighting=new WeatherLighting(sun,hemi);
 lighting.update(.5);near(sun.intensity,1.925);near(hemi.intensity,1.9);
 lighting.update(1);near(sun.intensity,.75);near(hemi.intensity,1.7);assert.ok(sun.color.equals(new THREE.Color('#c7cdd3')));
 assert.deepEqual(sun.position.toArray(),[-6,12,7]);assert.equal(sun.castShadow,true);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#788f9c');const clouds={mesh:{material:new THREE.MeshBasicMaterial({color:0xffffff})}};
 const rain=new GardenRain(scene,clouds,{level:0,random:()=>.5,maxDrops:10,lighting});rain.setLevel(4);
 near(sun.intensity,.75);assert.ok(sun.intensity<3.1);assert.ok(hemi.intensity<2.1);
 rain.setLevel(0);near(sun.intensity,3.1);near(hemi.intensity,2.1);[sun.color,hemi.color,hemi.groundColor].forEach((c,i)=>assert.ok(c.equals(colors[i])));
 rain.dispose();clouds.mesh.material.dispose();
});

test('first Always selection applies maximum rain and full overcast',()=>{
 const scene=new THREE.Scene();scene.background=new THREE.Color('#788f9c');const clouds={mesh:{material:new THREE.MeshBasicMaterial({color:0xffffff})}};
 const rain=new GardenRain(scene,clouds,{level:2,random:()=>0,maxDrops:10});
 const panelOld=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>new Proxy({}, {get:()=>()=>{}})})};
 try{const panel=createSettingsPanel(scene,{shadowMap:{enabled:true}},{rain});panel.model.set('rain',4);near(rain.cycle.intensity,1);assert.equal(rain.cycle.overcast,1);assert.ok(scene.background.equals(rain.rainSky));assert.equal(clouds.mesh.material.color.getHexString(),rain.rainCloud.getHexString());panel.model.set('rain',0);assert.equal(rain.cycle.overcast,0);assert.ok(scene.background.equals(rain.clearSky));assert.ok(clouds.mesh.material.color.equals(rain.clearCloud));}
 finally{if(panelOld===undefined)delete globalThis.document;else globalThis.document=panelOld;rain.dispose();clouds.mesh.material.dispose();}
 const cycle=new RainCycle(2,()=>.5);cycle.update(465);near(cycle.overcast,.3125);cycle.update(15);near(cycle.overcast,.625);
});

test('Always stays at maximum indefinitely and middle settings resume random showers with matching darkness',()=>{
 const cycle=new RainCycle(4,()=>.5);cycle.update(100000);assert.equal(cycle.intensity,1);assert.equal(cycle.overcast,1);
 cycle.setLevel(2);assert.equal(cycle.phase,'fall');cycle.update(17.5);near(cycle.intensity,.5);near(cycle.overcast,.5);cycle.update(17.5);assert.equal(cycle.intensity,0);
 cycle.update(cycle.duration+30);near(cycle.intensity,.625);near(cycle.overcast,.625);cycle.setLevel(4);assert.equal(cycle.intensity,1);cycle.setLevel(0);assert.equal(cycle.intensity,0);assert.equal(cycle.overcast,0);
});

test('drops, splashes and rings darken with overcast using existing material instances',()=>{
 const scene=new THREE.Scene();scene.background=new THREE.Color('#788f9c');const clouds={mesh:{material:new THREE.MeshBasicMaterial({color:0xffffff})}},rain=new GardenRain(scene,clouds,{level:0,random:()=>.5,maxDrops:10});
 const materials=[rain.material,rain.groundEffects.splashObject.material,rain.groundEffects.rippleObject.material],clear=materials.map(m=>m.color.clone());
 rain.setLevel(4);materials.forEach((m,i)=>{assert.ok(m.color.r<clear[i].r&&m.color.g<clear[i].g&&m.color.b<clear[i].b);assert.equal(m,rain.effectTints[i].material);});
 rain.setLevel(2);rain.update(17.5,rain.head);materials.forEach((m,i)=>{const expected=clear[i].clone().lerp(rain.effectTints[i].dark,.5);near(m.color.r,expected.r);near(m.color.g,expected.g);near(m.color.b,expected.b);});
 rain.setLevel(0);materials.forEach((m,i)=>assert.ok(m.color.equals(clear[i])));rain.dispose();clouds.mesh.material.dispose();
});

test('rain volume stays anchored to the padded garden across movement and teleport',()=>{
 const scene=new THREE.Scene();scene.background=new THREE.Color('#788f9c');const clouds={mesh:{material:new THREE.MeshBasicMaterial({color:0xffffff})}},rain=new GardenRain(scene,clouds,{level:4,random:randomFor(67),maxDrops:300});
 const a=new THREE.Vector3(0,1.6,20),b=new THREE.Vector3(100,1.6,100);rain.update(0,a);const positions=rain.simulation.positions.slice();rain.update(0,b);
 assert.deepEqual(rain.simulation.positions,positions);assert.equal(rain.simulation.volume.x,0);assert.equal(rain.simulation.volume.z,0);
 near(rain.simulation.volume.radius,Math.hypot(4.572+RAIN_MARGIN,6.858+RAIN_MARGIN));
 rain.setLevel(0);rain.head.copy(b);rain.setLevel(4);assert.equal(rain.simulation.volume.x,0);assert.equal(rain.simulation.volume.z,0);assert.ok(rain.geometry.drawRange.count>0);rain.dispose();clouds.mesh.material.dispose();
});

test('inactive rain cleans effects once per stop and skips cleanup on clear startup and repeated Never',()=>{
 const scene=new THREE.Scene();scene.background=new THREE.Color('#788f9c');const clouds={mesh:{material:new THREE.MeshBasicMaterial({color:0xffffff})}},rain=new GardenRain(scene,clouds,{level:0,random:randomFor(29),maxDrops:10});
 let splashClears=0,rippleClears=0,uploads=0;const ground=rain.groundEffects;
 const splashClear=ground.splashes.clear.bind(ground.splashes),rippleClear=ground.ripples.clear.bind(ground.ripples),upload=ground.upload.bind(ground);
 ground.splashes.clear=()=>{splashClears++;splashClear();};ground.ripples.clear=()=>{rippleClears++;rippleClear();};ground.upload=()=>{uploads++;upload();};
 for(let i=0;i<100;i++)rain.update(.05,rain.head);assert.deepEqual([splashClears,rippleClears,uploads],[0,0,0]);
 for(let cycle=1;cycle<=2;cycle++){
  rain.setLevel(4);ground.splashes.spawn(0,0,0);ground.ripples.spawn(0,0,0);const beforeUploads=uploads;
  rain.setLevel(0);assert.deepEqual([splashClears,rippleClears,uploads],[cycle,cycle,beforeUploads+1]);assert.equal(ground.splashes.freeCount,300);assert.equal(ground.ripples.freeCount,200);assert.equal(rain.geometry.drawRange.count,0);assert.equal(ground.group.visible,false);assert.equal(rain.parameters.count,0);
  const after=[splashClears,rippleClears,uploads];rain.setLevel(0);for(let i=0;i<100;i++)rain.update(.05,rain.head);assert.deepEqual([splashClears,rippleClears,uploads],after);
 }
 rain.dispose();clouds.mesh.material.dispose();
});
