import * as THREE from '../../forest/vendor/three.module.js';
import { vertex, fragment, cloudFragment, compositeFragment } from './shaders.js?v=2';
import { cloudScales } from './parameters.js?v=2';
const liveUniforms=['density','threshold','termination','steps','mode'];
export class VolumeRenderer {
  constructor(renderer,parameters){
    this.renderer=renderer;
    this.parameters=parameters;
    this.size=new THREE.Vector2();
    this.viewport=new THREE.Vector4();
    this.target=null;
    this.cloudTarget=null;
    this.passCamera=new THREE.PerspectiveCamera();
    this.desktopViewport=new THREE.Vector4();
    this.uniforms={
      cloudMap:{value:null},cloudSize:{value:new THREE.Vector2()},sceneColor:{ value: null },sceneDepth:{ value: null },noiseMap:{ value: null },inverseProjection:{ value: new THREE.Matrix4() },eyeWorld:{ value: new THREE.Matrix4() },eye:{ value: new THREE.Vector3() },center:{ value: new THREE.Vector3(0,7,-20) },halfSize:{ value: new THREE.Vector3(10,5,10) },density:{ value: 1 },threshold:{ value: .4 },termination:{ value: .02 },steps:{ value: 16 },mode:{ value: 0 },enabled:{ value: true }
    };
    this.material=new THREE.ShaderMaterial({
      vertexShader:vertex,fragmentShader:fragment,uniforms:this.uniforms,depthTest:false,depthWrite:false,toneMapped:false
    });
    this.cloudMaterial=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:cloudFragment,uniforms:this.uniforms,depthTest:false,depthWrite:false,toneMapped:false});
    this.compositeMaterial=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:compositeFragment,uniforms:this.uniforms,depthTest:false,depthWrite:false,toneMapped:false});
    this.scene=new THREE.Scene();
    this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);
    this.quad.frustumCulled=false;
    this.scene.add(this.quad);
    this.camera=new THREE.Camera();
    this.worker=new Worker(new URL('./noise-worker.js',import.meta.url),{
      type:'module'
    });
    this.request=0;
    this.busy=false;
    this.pending=null;
    this.worker.onmessage=({
      data
    })=>{
      this.busy=false;
      if(this.pending){
        const next=this.pending;
        this.pending=null;
        this.sendNoise(next);
        return;
      }
      if(data.id!==this.request)return;
      const texture=new THREE.Data3DTexture(data.data,data.size,data.size,data.size);
      texture.format=THREE.RedFormat;
      texture.type=THREE.UnsignedByteType;
      texture.minFilter=texture.magFilter=THREE.LinearFilter;
      texture.unpackAlignment=1;
      texture.needsUpdate=true;
      this.uniforms.noiseMap.value?.dispose();
      this.uniforms.noiseMap.value=texture;
      this.onNoise?.(false);
    };
    this.worker.onerror=e=>this.onError?.(e.message);
    this.regenerate();
    this.unsubscribe=parameters.subscribe(id=>{
      if(id==='resolution'||id==='octaves')this.regenerate();
    });
  }
  regenerate(){
    const v=this.parameters.values;
    this.onNoise?.(true);
    const next={
      size:[32,64,128][v.resolution],octaves:v.octaves,id:++this.request
    };
    if(this.busy)this.pending=next;
    else this.sendNoise(next);
  }
  sendNoise(next){
    this.busy=true;
    this.worker.postMessage(next);
  }
  resize(w,h){
    if(this.target?.width===w&&this.target?.height===h)return;
    this.target?.dispose();
    this.target=new THREE.WebGLRenderTarget(w,h,{
      minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:true
    });
    this.target.depthTexture=new THREE.DepthTexture(w,h,THREE.UnsignedIntType);
    this.uniforms.sceneColor.value=this.target.texture;
    this.uniforms.sceneDepth.value=this.target.depthTexture;
  }
  render(scene,camera){
    const r=this.renderer,xr=r.xr.isPresenting,output=r.getRenderTarget(),wasEnabled=r.xr.enabled;
    this.viewport.copy(r.getViewport(this.viewport));
    if(xr){
      camera.parent?.updateMatrixWorld(true);
      r.xr.updateCamera(camera);
    }
    else camera.updateWorldMatrix(true,false);
    const eyes=xr?r.xr.getCamera().cameras:null;
    r.xr.enabled=false;
    try{
      if(eyes){
        for(const eye of eyes)this.renderEye(scene,eye,output,eye.viewport);
      }
      else{
        r.getDrawingBufferSize(this.size);
        this.desktopViewport.set(0,0,this.size.x,this.size.y);
        this.renderEye(scene,camera,output,this.desktopViewport);
      }
    }
    finally{
      r.xr.enabled=wasEnabled;
      r.setRenderTarget(output);
      r.setViewport(this.viewport);
      r.setScissorTest(false);
    }
  }
  renderEye(scene,camera,output,viewport){
    const r=this.renderer;
    this.resize(viewport.z,viewport.w);
    r.setRenderTarget(this.target);
    r.setViewport(0,0,viewport.z/r.getPixelRatio(),viewport.w/r.getPixelRatio());
    r.setScissorTest(false);
    // The XR subcamera's viewport refers to the output framebuffer, not this eye target.
    // A plain PerspectiveCamera copy prevents renderer viewport/camera auto-updates.
    const c=this.passCamera;
    c.matrixAutoUpdate=false;
    c.matrix.copy(camera.matrixWorld);
    c.matrixWorld.copy(camera.matrixWorld);
    c.matrixWorldInverse.copy(camera.matrixWorldInverse);
    c.projectionMatrix.copy(camera.projectionMatrix);
    c.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    c.layers.mask=camera.layers.mask;
    r.render(scene,c);
    const v=this.parameters.values,u=this.uniforms;
    u.eye.value.setFromMatrixPosition(c.matrixWorld);
    u.eyeWorld.value.copy(c.matrixWorld);
    u.inverseProjection.value.copy(c.projectionMatrixInverse);
    u.halfSize.value.set(10,5,10).multiplyScalar(v.scale);
    for(const key of liveUniforms)u[key].value=v[key];
    u.enabled.value=Boolean(v.cloud&&u.noiseMap.value);
    const scale=cloudScales[v.cloudResolution]/100;
    const reduced=scale<1&&u.enabled.value;
    if(reduced){
      const w=Math.max(1,Math.ceil(viewport.z*scale)),h=Math.max(1,Math.ceil(viewport.w*scale));
      if(!this.cloudTarget){
        this.cloudTarget=new THREE.WebGLRenderTarget(w,h,{type:THREE.HalfFloatType,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:false});
      }else if(this.cloudTarget.width!==w||this.cloudTarget.height!==h)this.cloudTarget.setSize(w,h);
      u.cloudMap.value=this.cloudTarget.texture;
      u.cloudSize.value.set(w,h);
      r.setRenderTarget(this.cloudTarget);
      r.setViewport(0,0,w/r.getPixelRatio(),h/r.getPixelRatio());
      this.quad.material=this.cloudMaterial;
      r.render(this.scene,this.camera);
    }
    this.quad.material=reduced?this.compositeMaterial:this.material;
    r.setRenderTarget(output);
    // setViewport/setScissor always take logical pixels in this Three.js version.
    const ratio=r.getPixelRatio();
    r.setViewport(viewport.x/ratio,viewport.y/ratio,viewport.z/ratio,viewport.w/ratio);
    r.setScissor(viewport.x/ratio,viewport.y/ratio,viewport.z/ratio,viewport.w/ratio);
    r.setScissorTest(true);
    r.render(this.scene,this.camera);
  }
  dispose(){
    this.unsubscribe();
    this.worker.terminate();
    this.target?.dispose();
    this.uniforms.noiseMap.value?.dispose();
    this.quad.geometry.dispose();
    this.material.dispose();
    this.cloudMaterial.dispose();
    this.compositeMaterial.dispose();
    this.cloudTarget?.dispose();
  }
}
