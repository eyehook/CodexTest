import assert from 'node:assert/strict';
import * as THREE from '../shared/vendor/three-r180/three.module.js';
import {createForestSky,skyState,DAY_NIGHT_SECONDS} from '../projects/forest/forest-sky.js';
const scene=new THREE.Scene();scene.background=new THREE.Color();scene.fog=new THREE.Fog(0,10,26);
const sky=createForestSky(scene),viewer=new THREE.Vector3(14,1.7,-12);
assert.equal(DAY_NIGHT_SECONDS,60);
for(let t=0;t<60;t+=.1){sky.update(t,viewer);assert.ok(sky.sunDisc.position.clone().add(sky.moonDisc.position).length()<1e-9);assert.ok(sky.sun.intensity>=0&&sky.moon.intensity>=0);assert.ok(scene.background.toArray().every(Number.isFinite));assert.ok(Math.abs(skyState(t).daylight-skyState(t+60).daylight)<1e-12);}
sky.update(7.5,viewer);assert.equal(sky.sun.intensity,2.7);assert.equal(sky.moon.intensity,0);assert.ok(sky.ambient.color.r>sky.ambient.color.b);
sky.update(37.5,viewer);assert.equal(sky.sun.intensity,0);assert.equal(sky.moon.intensity,.75);assert.ok(sky.ambient.color.b>sky.ambient.color.r);
console.log('60-second repeat, opposing sun/moon, finite transitions, warm noon and blue midnight pass.');
