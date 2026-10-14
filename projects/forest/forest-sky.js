import * as THREE from './vendor/three.module.js';

// Full sunrise-to-sunrise period. Increase this after testing.
export const DAY_NIGHT_SECONDS = 60;
export function skyState(seconds) {
 const angle = (seconds % DAY_NIGHT_SECONDS) / DAY_NIGHT_SECONDS * Math.PI * 2 + Math.PI / 4;
 const elevation = Math.sin(angle);
 const daylight = THREE.MathUtils.smoothstep(elevation, -.18, .3);
 return {angle, elevation, daylight,
  sunlight: 2.7 * THREE.MathUtils.smoothstep(elevation, -.04, .35),
  moonlight: .75 * THREE.MathUtils.smoothstep(-elevation, -.04, .35)};
}
export function createForestSky(scene) {
 const ambient=new THREE.HemisphereLight(0xffffff,0xffffff,1);
 const sun=new THREE.DirectionalLight(0xffdf94,0),moon=new THREE.DirectionalLight(0x8aafff,0);
 scene.add(ambient,sun,moon,sun.target,moon.target);
 const orbit=new THREE.Group();scene.add(orbit);
 function body(radius,color){const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,24,16),new THREE.MeshBasicMaterial({color,fog:false,toneMapped:false}));orbit.add(mesh);return mesh;}
 const sunDisc=body(3.5,0xffe29a),moonDisc=body(2.8,0xc5d6ff);
 const daySky=new THREE.Color('#b7c5a5'),nightSky=new THREE.Color('#08132c');
 const warmAmbient=new THREE.Color('#ffedbf'),coolAmbient=new THREE.Color('#769bdc');
 const dayGround=new THREE.Color('#6f7141'),nightGround=new THREE.Color('#182b52');
 const dusk=new THREE.Color('#c18262'),direction=new THREE.Vector3();
 function update(seconds,viewer){
  const state=skyState(seconds),d=state.daylight;
  direction.set(Math.cos(state.angle),Math.sin(state.angle),-.35*Math.cos(state.angle)).normalize();
  // Sky follows translation only, so locomotion and world wrapping never move the horizon.
  orbit.position.copy(viewer);
  sunDisc.position.copy(direction).multiplyScalar(100);moonDisc.position.copy(sunDisc.position).negate();
  sunDisc.visible=direction.y>-.045;moonDisc.visible=direction.y<.045;
  sun.position.copy(viewer).addScaledVector(direction,100);moon.position.copy(viewer).addScaledVector(direction,-100);
  sun.target.position.copy(viewer);moon.target.position.copy(viewer);
  sun.intensity=state.sunlight;moon.intensity=state.moonlight;
  ambient.color.copy(coolAmbient).lerp(warmAmbient,d);ambient.groundColor.copy(nightGround).lerp(dayGround,d);ambient.intensity=.45+1.85*d;
  scene.background.copy(nightSky).lerp(daySky,d);
  const twilight=(1-THREE.MathUtils.smoothstep(Math.abs(state.elevation),0,.3))*.35;
  scene.background.lerp(dusk,twilight);scene.fog.color.copy(scene.background);
 }
 return {update,sun,moon,sunDisc,moonDisc,ambient};
}
