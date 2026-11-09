import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {RainSimulation} from '../weather/src/rain-simulation.js?v=garden-fixed-136';
import {GroundEffects} from '../weather/src/ground-effects.js?v=shared-r180-1';
import {HALF_WIDTH,HALF_DEPTH,HALL_WIDTH,ROOM_SIZE,ROOM_FRONT,ROOM_BACK} from './garden-layout.mjs?v=182';
import {RainCycle} from './rain-cycle.mjs?v=133';
export const RAIN_MARGIN=1.2192; // Four feet beyond the garden walls.
export function rainContains(x,z){
 return Math.abs(x)<=HALF_WIDTH+RAIN_MARGIN&&Math.abs(z)<=HALF_DEPTH+RAIN_MARGIN
  &&!(z>HALF_DEPTH&&z<ROOM_FRONT&&Math.abs(x)<HALL_WIDTH/2+.12)
  &&!(z>=ROOM_FRONT&&z<=ROOM_BACK+.12&&Math.abs(x)<ROOM_SIZE/2+.12);
}
export class GardenRain {
 constructor(scene,clouds,{level=2,random=Math.random,maxDrops=6000,lighting=null}={}){
  this.scene=scene;this.clouds=clouds;this.lighting=lighting;this.head=new THREE.Vector3(0,1.6,0);this.center=new THREE.Vector3();this.cycle=new RainCycle(level,random);this.maxDrops=maxDrops;
  this.simulation=new RainSimulation(maxDrops,random,0);this.simulation.volume.radius=Math.hypot(HALF_WIDTH+RAIN_MARGIN,HALF_DEPTH+RAIN_MARGIN);this.simulation.volume.height=10;
  this.groundEffects=new GroundEffects(scene,null,random);this.groundEffects.group.visible=false;
  for(const object of [this.groundEffects.splashObject,this.groundEffects.rippleObject]){object.castShadow=false;object.receiveShadow=false;}
  this.simulation.onImpact=(x,y,z,vx,age,vy,vz)=>{if(Math.abs(x)<=HALF_WIDTH&&Math.abs(z)<=HALF_DEPTH)this.groundEffects.impact(x,y,z,vx,age,vy,vz);};
  this.parameters={count:0,wind:.25,turbulence:12,fallSpeed:1,trailDuration:18};
  this.clearSky=scene.background.clone();this.rainSky=new THREE.Color('#74777b');this.clearCloud=new THREE.Color(0xffffff);this.rainCloud=new THREE.Color('#64696f');
  this.geometry=new THREE.BufferGeometry();this.positions=new Float32Array(maxDrops*6);
  this.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));this.geometry.setDrawRange(0,0);
  this.material=new THREE.LineBasicMaterial({color:0xcbd1d5,transparent:false,depthTest:true,depthWrite:true,blending:THREE.NoBlending});
  this.object=new THREE.LineSegments(this.geometry,this.material);this.object.name='garden-rain';this.object.castShadow=false;this.object.receiveShadow=false;this.object.frustumCulled=false;this.object.visible=false;scene.add(this.object);
  this.effectTints=[[this.material,0x84909a],[this.groundEffects.splashObject.material,0x8d989f],[this.groundEffects.rippleObject.material,0x808e98]].map(([material,dark])=>({material,clear:material.color.clone(),dark:new THREE.Color(dark)}));
  this.uploadRange={start:0,count:0};this.wasRaining=false;
 }
 get level(){return this.cycle.level;}
 setLevel(level){this.cycle.setLevel(level);this.update(0,this.head);}
 update(dt,head){
  this.head.copy(head);const intensity=this.cycle.update(dt);const overcast=this.cycle.overcast;this.lighting?.update(overcast);this.scene.background.copy(this.clearSky).lerp(this.rainSky,overcast);this.clouds.mesh.material.color.copy(this.clearCloud).lerp(this.rainCloud,overcast);
  for(const tint of this.effectTints)tint.material.color.copy(tint.clear).lerp(tint.dark,overcast);
  const count=Math.round(this.maxDrops*intensity);this.object.visible=count>0;
  if(!count){
   if(this.wasRaining){
    this.geometry.setDrawRange(0,0);this.parameters.count=0;this.groundEffects.group.visible=false;
    this.groundEffects.splashes.clear();this.groundEffects.ripples.clear();this.groundEffects.upload();this.wasRaining=false;
   }
   return;
  }
  this.groundEffects.group.visible=true;this.groundEffects.update(dt);
  if(!this.wasRaining)this.simulation.resetVolume(this.center);this.wasRaining=true;
  this.parameters.count=count;this.simulation.update(dt,this.parameters,head,this.center);this.groundEffects.upload();
  const segments=this.simulation.segments;let written=0;
  // Compact outdoor drops into a fixed GPU buffer; none enter the roofed room/hall.
  for(let n=0;n<count;n++){
   const i=n*6;if(!rainContains(segments[i],segments[i+2])||!rainContains(segments[i+3],segments[i+5]))continue;
   for(let j=0;j<6;j++)this.positions[written++]=segments[i+j];
  }
  this.geometry.setDrawRange(0,written/3);const attribute=this.geometry.attributes.position;attribute.clearUpdateRanges();this.uploadRange.count=written;if(written)attribute.updateRanges.push(this.uploadRange);attribute.needsUpdate=written>0;
 }
 dispose(){this.lighting?.update(0);this.groundEffects.dispose();this.object.removeFromParent();this.geometry.dispose();this.material.dispose();this.scene.background.copy(this.clearSky);this.clouds.mesh.material.color.copy(this.clearCloud);}
}
