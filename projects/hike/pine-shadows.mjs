import * as T from '../../shared/vendor/three-r180/three.module.js';
import {TREE_STRIDE} from './flora-placement.mjs?v=dense-1';
export const PINE_SHADOWS=Object.freeze({mapSize:2048,fadeStart:180,far:200,padding:8,selectionStep:2});
export function shadowStrength(distance){const t=T.MathUtils.clamp((distance-180)/20,0,1);return 1-t*t*(3-2*t);}
// Apply distance fading to direct-light occlusion, retaining ambient lighting.
export function pineShadowReceiver(shader,viewer){
 shader.uniforms.hikeShadowViewer=viewer;
 shader.vertexShader='varying vec3 vHikeShadowWorld;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
 vec4 hikeShadowPosition=vec4(transformed,1.0);
 #ifdef USE_INSTANCING
 hikeShadowPosition=instanceMatrix*hikeShadowPosition;
 #endif
 vHikeShadowWorld=(modelMatrix*hikeShadowPosition).xyz;`);
 shader.fragmentShader='uniform vec3 hikeShadowViewer; varying vec3 vHikeShadowWorld;\n'+shader.fragmentShader;
 const lights=T.ShaderChunk.lights_fragment_begin.replace(/getShadow\( directionalShadowMap\[ i \],([^;]+?)\) : 1\.0;/g,
  'mix(1.0,getShadow( directionalShadowMap[ i ],$1),1.0-smoothstep(180.0,200.0,length(vHikeShadowWorld.xz-hikeShadowViewer.xz))) : 1.0;');
 shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',lights);
}
export class PineShadows {
 constructor(scene,renderer,sun,terrain,flora,world){
  Object.assign(this,{scene,renderer,sun,terrain,flora,world});this.enabled=false;this.disposed=false;this.viewer={value:new T.Vector3()};
  this.direction=sun.position.clone().sub(sun.target.position).normalize();
  this.right=new T.Vector3().crossVectors(T.Object3D.DEFAULT_UP,this.direction).normalize();this.up=new T.Vector3().crossVectors(this.direction,this.right).normalize();
  const trees=flora.data.trees;let maxHeight=0,maxRadius=0;
  for(let id=0;id<flora.data.count;id++){const k=id*TREE_STRIDE,v=flora.variants[trees[k+7]];maxHeight=Math.max(maxHeight,(v.height+1)*trees[k+4]);maxRadius=Math.max(maxRadius,3*trees[k+3]);}
  const range=flora.data.range??{min:world.boundaryHeight??0,max:world.config.elevation};
  this.minY=Math.min(range.min,world.boundaryHeight??range.min)-(world.maxEarthwork??0)-2;
  this.maxY=range.max+(world.maxEarthwork??0)+maxHeight+2;
  this.centerY=(this.minY+this.maxY)/2;const halfY=(this.maxY-this.minY)/2,horizontal=Math.hypot(this.direction.x,this.direction.z);
  this.halfWidth=PINE_SHADOWS.far+PINE_SHADOWS.padding;
  this.halfHeight=PINE_SHADOWS.far*this.direction.y+halfY*horizontal+PINE_SHADOWS.padding;
  // Conservative uphill reach includes the entire world's elevation envelope.
  this.selectionRadius=PINE_SHADOWS.far+(this.maxY-this.minY)*horizontal/this.direction.y+maxRadius+PINE_SHADOWS.padding;
  this.maxRadius=maxRadius;this.center=new T.Vector3();this.temp=new T.Vector3();this.matrix=new T.Matrix4();this.quaternion=new T.Quaternion();this.scale=new T.Vector3();this.axis=new T.Vector3(0,1,0);
  this.lastX=Infinity;this.lastZ=Infinity;this.lastU=Infinity;this.lastV=Infinity;this.lastD=Infinity;this.instanceCount=0;this.updateMs=0;this.rebuilds=0;this.candidates=0;
  this.group=new T.Group();this.group.name='Nearby pine shadow casters';scene.add(this.group);scene.add(sun.target);
  this.material=new T.MeshBasicMaterial({colorWrite:false,depthWrite:false});
  this.batches=flora.variants.map(v=>{
   const geometry=v.geometry.clone();geometry.setDrawRange(0,0);
   const mesh=new T.InstancedMesh(geometry,this.material,128);mesh.count=0;mesh.castShadow=true;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
   // Shadow-only geometry: no triangles enter either eye's color/depth pass.
   mesh.onBeforeShadow=()=>geometry.setDrawRange(0,Infinity);mesh.onAfterShadow=()=>geometry.setDrawRange(0,0);this.group.add(mesh);return mesh;
  });
  this.group.visible=false;
  for(const material of [terrain.material,flora.material]){
   const previous=material.onBeforeCompile;material.onBeforeCompile=shader=>{previous.call(material,shader);pineShadowReceiver(shader,this.viewer);};
   material.customProgramCacheKey=()=> 'hike-pine-shadows-1';material.needsUpdate=true;
  }
  terrain.mesh.receiveShadow=true;for(const mesh of flora.batches)mesh.receiveShadow=true;
  const shadow=sun.shadow,camera=shadow.camera;shadow.mapSize.set(2048,2048);shadow.bias=-.00005;shadow.normalBias=.15;
  camera.left=-this.halfWidth;camera.right=this.halfWidth;camera.top=this.halfHeight;camera.bottom=-this.halfHeight;
  this.depth=this.selectionRadius+this.maxY-this.minY+100;camera.near=.1;camera.far=2*this.depth;camera.updateProjectionMatrix();
  renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
 }
 setEnabled(value){
  value=!!value;if(value===this.enabled)return;
  this.enabled=value;this.renderer.shadowMap.enabled=value;this.sun.castShadow=value;this.group.visible=value;
  this.lastU=this.lastV=this.lastD=Infinity;this.lastX=this.lastZ=Infinity;
  if(!value)this.renderer.shadowMap.needsUpdate=false;
 }
 rebuild(x,z){
  const {trees,cells,minCell,columns,cellSize}=this.flora.data,r=this.selectionRadius,ids=[[],[],[],[]];
  const minX=Math.max(minCell,Math.floor((x-r)/cellSize)-1),maxX=Math.min(minCell+columns-1,Math.floor((x+r)/cellSize)+1);
  const minZ=Math.max(minCell,Math.floor((z-r)/cellSize)-1),maxZ=Math.min(minCell+columns-1,Math.floor((z+r)/cellSize)+1);
  this.candidates=0;
  for(let cz=minZ;cz<=maxZ;cz++)for(let cx=minX;cx<=maxX;cx++){
   const c=((cz-minCell)*columns+cx-minCell)*2,end=cells[c]+cells[c+1];
   for(let id=cells[c];id<end;id++){
    this.candidates++;const k=id*TREE_STRIDE,dx=trees[k]-x,dz=trees[k+2]-z;if(dx*dx+dz*dz>r*r)continue;
    const variant=this.flora.variants[trees[k+7]],height=(variant.height+1)*trees[k+4],radius=3*trees[k+3];
    this.temp.set(trees[k],trees[k+1]-.65*trees[k+4],trees[k+2]).sub(this.center);
    const u=this.temp.dot(this.right),v=this.temp.dot(this.up),pad=radius+PINE_SHADOWS.padding;
    if(Math.abs(u)>this.halfWidth+pad||v>this.halfHeight+pad||v+height*this.up.y < -this.halfHeight-pad)continue;
    ids[trees[k+7]].push(id);
   }
  }
  this.instanceCount=0;
  ids.forEach((list,i)=>{
   const mesh=this.batches[i];
   if(list.length>mesh.instanceMatrix.count){mesh.dispose();mesh.instanceMatrix=new T.InstancedBufferAttribute(new Float32Array(2**Math.ceil(Math.log2(list.length))*16),16).setUsage(T.DynamicDrawUsage);}
   mesh.count=list.length;mesh.visible=!!list.length;this.instanceCount+=list.length;
   list.forEach((id,slot)=>{const k=id*TREE_STRIDE;this.temp.set(trees[k],trees[k+1],trees[k+2]);this.quaternion.setFromAxisAngle(this.axis,trees[k+5]);this.scale.set(trees[k+3],trees[k+4],trees[k+3]);this.matrix.compose(this.temp,this.quaternion,this.scale);mesh.setMatrixAt(slot,this.matrix);});
   mesh.instanceMatrix.needsUpdate=true;
  });
  this.lastX=x;this.lastZ=z;this.rebuilds++;
 }
 update(viewer){
  if(!this.enabled||this.disposed){this.updateMs=0;return;}
  const began=performance.now();this.viewer.value.copy(viewer);this.temp.set(viewer.x,this.centerY,viewer.z);
  const texelX=2*this.halfWidth/2048,texelY=2*this.halfHeight/2048;
  const u=Math.round(this.temp.dot(this.right)/texelX)*texelX,v=Math.round(this.temp.dot(this.up)/texelY)*texelY,d=Math.round(this.temp.dot(this.direction)/texelX)*texelX;
  this.center.copy(this.right).multiplyScalar(u).addScaledVector(this.up,v).addScaledVector(this.direction,d);
  let changed=u!==this.lastU||v!==this.lastV||d!==this.lastD;
  if((viewer.x-this.lastX)**2+(viewer.z-this.lastZ)**2>=PINE_SHADOWS.selectionStep**2){this.rebuild(viewer.x,viewer.z);changed=true;}
  if(changed){this.sun.target.position.copy(this.center);this.sun.position.copy(this.center).addScaledVector(this.direction,this.depth);this.sun.target.updateMatrixWorld();this.sun.updateMatrixWorld();this.renderer.shadowMap.needsUpdate=true;}
  this.lastU=u;this.lastV=v;this.lastD=d;this.updateMs=performance.now()-began;
 }
 dispose(){if(this.disposed)return;this.setEnabled(false);this.disposed=true;this.group.removeFromParent();for(const mesh of this.batches){mesh.dispose();mesh.geometry.dispose();}this.material.dispose();this.sun.shadow.dispose();}
}
