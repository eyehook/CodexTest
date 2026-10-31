import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {installPlantPicker} from './plant-picker.mjs?v=40';
import {installGrassPicker} from './grass-picker.mjs?v=35';
import {MatureBatches} from './mature-batches.mjs?v=48';
import {componentPose,BLOOM_FORMS} from './generator.mjs?v=82';
const up=new THREE.Vector3(0,1,0);
function leafGeometry(shape) {
  const widths=[.48,.8,.24],w=widths[shape];
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-w,.45,0,0,.42,.13,0,1,0,w,.45,0],3));
  g.setIndex([0,1,2,1,3,2,3,4,2,4,0,2]);g.computeVertexNormals();return g;
}
function ivyGeometry() {
  const points=[[0,0,0],[-.42,.22,0],[-.65,.6,0],[-.25,.55,.03],[0,1,0],[.25,.55,.03],[.65,.6,0],[.42,.22,0],[0,.45,.07]];
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
  const indices=[];for(let i=0;i<8;i++)indices.push(8,i,(i+1)%8);g.setIndex(indices);g.computeVertexNormals();return g;
}
function grassGeometry() {
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([-.5,0,0,.5,0,0,-.35,.45,.04,.35,.45,.04,-.18,.8,.14,.18,.8,.14,.1,1,.3],3));
  g.setIndex([0,1,2,1,3,2,2,3,4,3,5,4,4,5,6]);g.computeVertexNormals();return g;
}
function hydrangeaGeometry() {
  const geometry=new THREE.IcosahedronGeometry(1,1).translate(0,0,.65);
  geometry.computeVertexNormals();return geometry;
}
// Petals have real faceted depth, rather than reusing flat leaf silhouettes.
function petalGeometry(form) {
  const g=new THREE.BufferGeometry(),vertices=[],indices=[];
  const sections=4;
  for(let row=0;row<=sections;row++) {
    const t=row/sections;
    const width=Math.sin(Math.PI*t)*form.width;
    const y=t;
    const z=form.cup*t*t;
    vertices.push(-width,y,z, 0,y,z-.12*Math.sin(Math.PI*t), width,y,z);
    if(row<sections) for(let col=0;col<2;col++) {
      const a=row*3+col,b=a+3;indices.push(a,b,a+1,a+1,b,b+1);
    }
  }
  g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
const bloomAxis=new THREE.Vector3(0,0,1),petalHinge=new THREE.Vector3(1,0,0);
export class PlantRenderer {
  constructor(scene,{batchMature=true}={}) {
    this.scene=scene;this.dummy=new THREE.Object3D();this.direction=new THREE.Vector3();this.bloomQuaternion=new THREE.Quaternion();this.petalQuaternion=new THREE.Quaternion();this.openQuaternion=new THREE.Quaternion();
    this.geometries={stemPoint:new THREE.CylinderGeometry(0,1,1,5,1),stem0:new THREE.CylinderGeometry(.48,1,1,5,1),stem1:new THREE.CylinderGeometry(.58,1,1,5,1),stem2:new THREE.CylinderGeometry(.67,1,1,5,1),leaf0:leafGeometry(0),leaf1:leafGeometry(1),leaf2:leafGeometry(2),leaf3:ivyGeometry(),leaf4:grassGeometry(),crown:new THREE.IcosahedronGeometry(1,1),pine:new THREE.ConeGeometry(1,1,7,1).translate(0,.5,0),hydrangea:hydrangeaGeometry(),center:new THREE.IcosahedronGeometry(1,0)};
    this.geometries.crown.computeVertexNormals();
    this.geometries.spire=this.geometries.crown.clone();
    const spirePositions=this.geometries.spire.attributes.position;
    for(let i=0;i<spirePositions.count;i++){
      const taper=1-.45*(spirePositions.getY(i)+1)/2;
      spirePositions.setXYZ(i,spirePositions.getX(i)*taper,spirePositions.getY(i),spirePositions.getZ(i)*taper);
    }
    this.geometries.spire.computeVertexNormals();
    this.geometries.pine=this.geometries.pine.toNonIndexed();this.geometries.pine.computeVertexNormals();
    BLOOM_FORMS.forEach((form,i)=>{if(!form.volume)this.geometries['petal'+i]=petalGeometry(form);});
    this.material=new THREE.MeshStandardMaterial({roughness:.95,side:THREE.DoubleSide});
    this.batchMature=batchMature;this.matureBatches=new MatureBatches(scene,this.geometries,this.material);
  }
  create(structure,position,id,rotationY=0,scale=1) {
    const group=new THREE.Group();group.position.copy(position);group.rotation.y=rotationY;group.scale.setScalar(scale);group.userData.plantId=id;
    const buckets=new Map();
    const put=(key,part,petal=null)=>{if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push({part,petal});};
    for(const p of structure.parts) {
      if(p.kind==='stem')put(p.taper===0?'stemPoint':'stem'+Math.round((p.taper-.48)/.095),p);
      else if(p.kind==='foliage')put(p.shape,p);
      else if(p.kind==='leaf')put('leaf'+p.shape,p);
      else if(p.volume)put('hydrangea',p);
      else {for(let i=0;i<p.petals*p.layers;i++)put('petal'+p.shape,p,i);put('center',p);}
    }
    const batches=[];
    for(const [key,entries] of buckets) {
      const mesh=new THREE.InstancedMesh(this.geometries[key],this.material,entries.length);mesh.userData.plantId=id;
      mesh.castShadow=!['grass','vine'].includes(structure.parameters.form);mesh.receiveShadow=structure.parameters.form!=='grass';mesh.frustumCulled=true;
      entries.forEach(({part:p},i)=>{const color=new THREE.Color();
        if(key.startsWith('stem'))color.set(structure.parameters.form==='tree'?0x6e5940:0x507044);
        else if(key==='center')color.set(p.shape===0?0x79512d:0xe6ba55);
        else if(key.startsWith('petal')||key==='hydrangea') {
          // Seeded HSV brightness, converted to HSL in display (sRGB) space.
          const light=p.brightness*(1-p.saturation/2);
          const saturation=light===0||light===1?0:(p.brightness-light)/Math.min(light,1-light);
          color.setHSL(p.hue,saturation,light,THREE.SRGBColorSpace);
        } else color.setHSL(p.hue,.38,p.light);
        mesh.setColorAt(i,color);
      });group.add(mesh);batches.push({key,mesh,entries});
    }
    const picker=structure.parameters.form==='grass'?installGrassPicker(group,structure):null;
    const targeting=picker?null:installPlantPicker(group,batches);
    this.scene.add(group);return {group,batches,picker,targeting};
  }
  update(instance,age) {
    const poses=componentPose(instance.structure,age),d=this.dummy;
    if(instance.visual.picker){
      let height=0;instance.structure.parts.forEach((p,i)=>{height=Math.max(height,p.height*poses[i].growth);});
      const picker=instance.visual.picker;picker.height=height;picker.center.set(0,height*.15,0);picker.radii.y=Math.max(.0001,height*.95*.8);
    }
    for(const {key,mesh,entries} of instance.visual.batches) {
      entries.forEach(({part:p,petal},i)=>{
        const pose=poses[p.id],g=pose.growth;
        d.position.fromArray(pose.anchor);d.quaternion.identity();
        if(key.startsWith('stem')) {
          this.direction.fromArray(pose.end).sub(d.position); const length=this.direction.length();
          d.position.addScaledVector(this.direction,.5);d.quaternion.setFromUnitVectors(up,this.direction.normalize());
          // Three shared taper profiles keep stem batches compact.
          d.scale.set(p.radius*g,length,p.radius*g);
        } else if(key==='crown'||key==='pine'||key==='spire') {
          d.rotation.set(p.tilt,p.yaw,p.tilt*.6);d.scale.fromArray(p.scale).multiplyScalar(g);
        } else if(key.startsWith('leaf')) {
          if(p.orientation)d.rotation.fromArray(p.orientation);else d.rotation.set(.5+p.tilt,p.yaw,.7);
          if(p.offset)d.position.set(d.position.x+p.offset[0],d.position.y+p.offset[1],d.position.z+p.offset[2]);if(p.shape===4)d.scale.set(p.width*g,p.height*g,p.height*g);else d.scale.setScalar(p.size*g);
        } else {
          this.direction.fromArray(p.normal).normalize();
          this.bloomQuaternion.setFromUnitVectors(bloomAxis,this.direction);
          if(key==='hydrangea'){
            this.petalQuaternion.setFromAxisAngle(bloomAxis,p.yaw);d.quaternion.copy(this.bloomQuaternion).multiply(this.petalQuaternion);d.scale.setScalar(p.size*g);
          } else if(key.startsWith('petal')) {
            const layer=Math.floor(petal/p.petals), layerScale=1-layer*.23;
            const a=p.yaw+(petal%p.petals+layer*.5)/p.petals*Math.PI*2;
            this.petalQuaternion.setFromAxisAngle(bloomAxis,a);
            this.openQuaternion.setFromAxisAngle(petalHinge,(1-g)*1.2+layer*.13);
            d.quaternion.copy(this.bloomQuaternion).multiply(this.petalQuaternion).multiply(this.openQuaternion);
            d.position.addScaledVector(this.direction,p.size*layer*.07*g);
            d.scale.setScalar(p.size*layerScale*g);
          } else {
            d.quaternion.copy(this.bloomQuaternion);
            d.position.addScaledVector(this.direction,p.size*.04*g);
            d.scale.set(p.size*p.centerScale*g,p.size*p.centerScale*g,p.size*.19*g);
          }
        }
        // Zero scale cannot be inverted reliably during raycasting.
        if(g===0)d.scale.setScalar(1e-7);
        d.updateMatrix();mesh.setMatrixAt(i,d.matrix);
      });mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
    }
    instance.visual.targeting?.refresh();
  }
  mature(instance) {instance.visual.targeting?.freeze();if(this.batchMature)this.matureBatches.add(instance.visual);}
  flush() {this.matureBatches.flush();}
  remove(visual,{flush=true}={}) {
    if(visual.removed)return;
    if(visual.matureSlots)this.matureBatches.remove(visual);
    else {this.scene.remove(visual.group);for(const {mesh} of visual.batches)mesh.dispose();}
    visual.removed=true;if(flush)this.flush();
  }
  dispose() {this.matureBatches.dispose();for(const g of Object.values(this.geometries))g.dispose();this.material.dispose();}
}
