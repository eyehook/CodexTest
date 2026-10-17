import * as THREE from '../../projects/forest/vendor/three.module.js';
import {noiseGLSL,octaveData} from './height.mjs';
import {bands} from './bands.mjs';
export function makeMaterial(c){return new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,uniforms:{lattice:{value:new Uint32Array(16)},fraction:{value:Array.from({length:8},()=>new THREE.Vector2())},frequency:{value:Array(8).fill(0)},amplitude:{value:Array(8).fill(0)},seed:{value:c.seed},colorAmplitude:{value:c.amplitude},ground:{value:0},fogStart:{value:c.fogStart},fogEnd:{value:c.fogEnd},fogColor:{value:new THREE.Color(c.fogColor)}},vertexShader:`
precision highp float;precision highp int;
${noiseGLSL}
attribute float spacing;uniform float ground;out vec3 normalV;out float elevation;out float distanceV;
void main(){vec2 p=position.xz;float h=heightAt(p,spacing);float e=max(0.5,spacing*0.35);float dx=heightAt(p+vec2(e,0),spacing)-heightAt(p-vec2(e,0),spacing);float dz=heightAt(p+vec2(0,e),spacing)-heightAt(p-vec2(0,e),spacing);normalV=normalize(vec3(-dx,2.0*e,-dz));elevation=h;vec4 view=modelViewMatrix*vec4(position.x,h-ground,position.z,1);distanceV=length(view.xyz);gl_Position=projectionMatrix*view;}`,fragmentShader:`precision highp float;in vec3 normalV;in float elevation;in float distanceV;uniform float fogStart;uniform float fogEnd;uniform float colorAmplitude;uniform vec3 fogColor;out vec4 outColor;
// Absolute world elevation keeps bands fixed while the player follows the ground.
vec3 terrainColor(float h){
 float level=h/max(colorAmplitude,0.001);
 vec3 sand=vec3(0.68,0.49,0.23);
 vec3 lowGrass=vec3(0.24,0.46,0.055);
 vec3 midGrass=vec3(0.055,0.25,0.035);
 vec3 highGrass=vec3(0.28,0.39,0.12);
 vec3 snow=vec3(0.72,0.82,0.88);
 vec3 summit=vec3(0.98,0.99,1.0);
 vec3 band=mix(sand,lowGrass,smoothstep(${bands.grassStart},${bands.beachEnd},level));
 band=mix(band,midGrass,smoothstep(${bands.midGrassStart},${bands.midGrassEnd},level));
 band=mix(band,highGrass,smoothstep(${bands.highGrassStart},${bands.highGrassEnd},level));
 band=mix(band,snow,smoothstep(${bands.snowStart},${bands.snowEnd},level));
 return mix(band,summit,smoothstep(${bands.summitStart},${bands.summitEnd},level));
}
void main(){
 vec3 n=normalize(normalV);
 float sun=max(dot(n,normalize(vec3(-0.5,0.8,0.3))),0.0);
 vec3 color=terrainColor(elevation)*(0.28+0.95*sun);
 color=mix(color,fogColor,smoothstep(fogStart,fogEnd,distanceV));
 outColor=vec4(color,1);
outColor=linearToOutputTexel(outColor);
}`});}
export function updateHeightUniforms(material,x,z,c){const d=octaveData(x,z,c,material.userData.octaveData),u=material.uniforms;material.userData.octaveData=d;for(let i=0;i<8;i++){u.lattice.value.set(d.base[i],i*2);u.fraction.value[i].set(...d.fraction[i]);}u.frequency.value=d.frequency;u.amplitude.value=d.amplitude;u.seed.value=c.seed;u.colorAmplitude.value=c.amplitude;}
