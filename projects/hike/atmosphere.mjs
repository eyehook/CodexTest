import * as T from '../../shared/vendor/three-r180/three.module.js';
// Clear-afternoon defaults. Distances and heights are metres; colors are sRGB.
export const ATMOSPHERE=Object.freeze({horizon:0xb9cbd3,midSky:0x83afd0,zenith:0x427eb5,start:90,end:950,strength:.48,heightScale:240,valleyBoost:.16});
export function atmosphereAmount(distance,cameraY,fragmentY,settings=ATMOSPHERE){
 const t=T.MathUtils.clamp((distance-settings.start)/(settings.end-settings.start),0,1),progress=t*t*(3-2*t);
 const density=1+settings.valleyBoost*T.MathUtils.clamp(1-(cameraY+fragmentY)*.5/settings.heightScale,0,1);
 return Math.min(1,progress*settings.strength*density);
}
const skyGradientGLSL=`
vec3 hikeSkyColor(float elevation){
 vec3 color=mix(atmosphereColor,atmosphereMidSky,smoothstep(0.0,0.45,max(0.0,elevation)));
 return mix(color,atmosphereZenith,smoothstep(0.25,1.0,max(0.0,elevation)));
}`;
export function atmosphereShader(shader,uniforms){
 Object.assign(shader.uniforms,uniforms);
 shader.vertexShader='varying vec3 vAtmosphereView; varying float vAtmosphereHeight;\n'+shader.vertexShader;
 // mvPosition includes terrain displacement, instancing and grass wind. Recover
 // world height from the eye view rotation/translation; no CPU viewer pose needed.
 const end=shader.vertexShader.lastIndexOf('}');
 shader.vertexShader=shader.vertexShader.slice(0,end)+`\n vAtmosphereView=mvPosition.xyz;
 vAtmosphereHeight=cameraPosition.y+dot(viewMatrix[1].xyz,mvPosition.xyz);
 `+shader.vertexShader.slice(end);
 shader.fragmentShader=`uniform vec3 atmosphereColor;
 uniform vec3 atmosphereMidSky; uniform vec3 atmosphereZenith;
 uniform vec4 atmosphereRange;
 uniform vec2 atmosphereHeight;
 varying vec3 vAtmosphereView;
 varying float vAtmosphereHeight;
 ${skyGradientGLSL}
 `+shader.fragmentShader;
 // Blend lit, tone-mapped linear RGB before output encoding, then retain the
 // renderer's existing visibility fog. One mix provides cooling, desaturation,
 // lightening of dark surfaces and contrast reduction without duplicate effects.
 shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>',`
 float atmosphereDistance=length(vAtmosphereView);
 float atmosphereProgress=smoothstep(atmosphereRange.x,atmosphereRange.y,atmosphereDistance);
 float atmosphereDensity=1.0+atmosphereHeight.y*clamp(1.0-(cameraPosition.y+vAtmosphereHeight)*0.5/atmosphereHeight.x,0.0,1.0);
 float atmosphereAlpha=min(1.0,atmosphereProgress*atmosphereRange.z*atmosphereDensity);
 gl_FragColor.rgb=mix(gl_FragColor.rgb,atmosphereColor,atmosphereAlpha);
 #include <colorspace_fragment>`);
 // Match the sky along the fragment ray at the existing visibility boundary.
 // Fog range/progression stays exactly the stock chunk; only its target varies.
 shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>',T.ShaderChunk.fog_fragment.replace(
  'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );',
  `if(fogFactor>0.0){
   float elevation=(vAtmosphereHeight-cameraPosition.y)/max(atmosphereDistance,0.001);
   vec3 skyOutput=linearToOutputTexel(vec4(hikeSkyColor(elevation),1.0)).rgb;
   gl_FragColor.rgb=mix(gl_FragColor.rgb,skyOutput,fogFactor);
  }`));
}
export class Atmosphere {
 constructor(scene,settings=ATMOSPHERE){
  this.settings=settings;this.horizon=new T.Color(settings.horizon);
  this.uniforms={atmosphereColor:{value:this.horizon},atmosphereMidSky:{value:new T.Color(settings.midSky)},atmosphereZenith:{value:new T.Color(settings.zenith)},atmosphereRange:{value:new T.Vector4(settings.start,settings.end,settings.strength,0)},atmosphereHeight:{value:new T.Vector2(settings.heightScale,settings.valleyBoost)}};
  // Keep the existing boundary distances and its single fog blend.
  scene.background=this.horizon.clone();if(scene.fog)scene.fog.color.copy(this.horizon);
  this.geometry=new T.BufferGeometry();this.geometry.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
  this.material=new T.ShaderMaterial({depthTest:false,depthWrite:false,fog:false,toneMapped:false,
   uniforms:{inverseProjection:{value:new T.Matrix4()},...this.uniforms},
   vertexShader:`uniform mat4 inverseProjection; varying vec3 skyRay;
    void main(){vec4 ray=inverseProjection*vec4(position.xy,1.0,1.0);
     skyRay=vec3(dot(viewMatrix[0].xyz,ray.xyz),dot(viewMatrix[1].xyz,ray.xyz),dot(viewMatrix[2].xyz,ray.xyz));
     gl_Position=vec4(position.xy,1.0,1.0);}`,
   fragmentShader:`uniform vec3 atmosphereColor; uniform vec3 atmosphereMidSky; uniform vec3 atmosphereZenith; varying vec3 skyRay;
    ${skyGradientGLSL}
    void main(){gl_FragColor=vec4(hikeSkyColor(normalize(skyRay).y),1.0);
     #include <colorspace_fragment>
    }`});
  this.mesh=new T.Mesh(this.geometry,this.material);this.mesh.name='Afternoon sky';this.mesh.frustumCulled=false;this.mesh.renderOrder=-10000;
  // Three supplies the current eye camera here, including asymmetric XR frusta.
  this.mesh.onBeforeRender=(renderer,scene,camera)=>{this.material.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);this.material.uniformsNeedUpdate=true;};
  scene.add(this.mesh);this.materials=new WeakSet();
 }
 apply(material){
  if(this.materials.has(material))return;this.materials.add(material);
  const previous=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
  const previousKey=key();
  material.onBeforeCompile=(shader,renderer)=>{previous.call(material,shader,renderer);atmosphereShader(shader,this.uniforms);};
  material.customProgramCacheKey=()=>previousKey+':hike-atmosphere-1';material.needsUpdate=true;
 }
 dispose(){this.mesh.removeFromParent();this.geometry.dispose();this.material.dispose();}
}
