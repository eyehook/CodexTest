import * as T from '../../shared/vendor/three-r180/three.module.js';
// Clip-space cover is identical in both XR eyes and cannot be left behind by
// head movement. The landscape still draws first, exercising its real XR path.
export function createLoadingView(scene){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#10251c';ctx.fillRect(0,0,1024,512);ctx.fillStyle='#eee8d5';ctx.font='32px system-ui';ctx.textAlign='center';ctx.fillText('Preparing landscape…',512,256);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
 const material=new T.ShaderMaterial({uniforms:{map:{value:texture}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy*2.0,0.0,1.0);}',fragmentShader:'uniform sampler2D map; varying vec2 vUv; void main(){gl_FragColor=texture2D(map,vUv);\n#include <colorspace_fragment>\n}',depthTest:false,depthWrite:false,toneMapped:false});
 const mesh=new T.Mesh(new T.PlaneGeometry(1,1),material);mesh.name='Loading cover';mesh.frustumCulled=false;mesh.renderOrder=1e9;mesh.visible=false;scene.add(mesh);
 const loadingScene=new T.Scene();loadingScene.background=new T.Color(0x10251c);const cover=mesh.clone();cover.visible=true;loadingScene.add(cover);
 return {mesh,scene:loadingScene,dispose(){mesh.removeFromParent();mesh.geometry.dispose();material.dispose();texture.dispose();}};
}
