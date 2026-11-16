import * as T from '../../shared/vendor/three-r180/three.module.js';
// Multiply only Lambert's direct diffuse result. Existing pine occlusion has
// already attenuated the same direct term; ambient and atmosphere stay intact.
export function sunlightShader(shader,uniforms=null){
 if(uniforms){
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='varying vec2 vTerrainSunXZ;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvTerrainSunXZ=(modelMatrix*vec4(transformed,1.0)).xz;');
  shader.fragmentShader='uniform sampler2D terrainSunMap; uniform vec2 terrainSunMapping; varying vec2 vTerrainSunXZ;\n'+shader.fragmentShader;
 }else{
  shader.vertexShader='attribute float terrainSunlight; varying float vTerrainSunlight;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTerrainSunlight=terrainSunlight;');
  shader.fragmentShader='varying float vTerrainSunlight;\n'+shader.fragmentShader;
 }
 const value=uniforms?'texture2D(terrainSunMap,(vTerrainSunXZ+terrainSunMapping.x)*terrainSunMapping.y).r':'vTerrainSunlight';
 shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>\nreflectedLight.directDiffuse *= ${value};`);
}
export class TerrainSunlight {
 constructor(map){
  this.map=map;
  this.texture=new T.DataTexture(map.visibility,map.size,map.size,T.RedFormat,T.UnsignedByteType);
  this.texture.minFilter=this.texture.magFilter=T.LinearFilter;this.texture.generateMipmaps=false;this.texture.needsUpdate=true;
  // Grid endpoints correspond to texel centers, including at the map boundary.
  this.uniforms={terrainSunMap:{value:this.texture},terrainSunMapping:{value:new T.Vector2(map.extent+map.step*.5,1/(map.step*map.size))}};
 }
 apply(material,instanced=false){
  const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{previous.call(material,shader,renderer);sunlightShader(shader,instanced?null:this.uniforms);};
  material.customProgramCacheKey=()=>key+':terrain-sunlight-'+instanced;material.needsUpdate=true;
 }
 dispose(){this.texture.dispose();}
}
