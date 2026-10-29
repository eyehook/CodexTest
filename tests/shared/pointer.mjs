import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3} from '../../shared/vendor/three-r180/three.module.js';
import {ControllerPointer, createPointerLine} from '../../shared/xr/pointer.mjs';
test('controller ray respects parent transforms, nearest hit, range and misses', () => {
  const rig=new Group(), controller=new Group();rig.add(controller);
  rig.position.set(4,1,8);rig.rotation.y=0.7;controller.position.set(0.3,0,-0.4);
  const pointer=new ControllerPointer({far:4});pointer.setFromController(controller);
  const origin=pointer.raycaster.ray.origin.clone(), direction=pointer.raycaster.ray.direction.clone();
  const targets=[2,3].map(distance=>{
    const mesh=new Mesh(new PlaneGeometry(1,1),new MeshBasicMaterial());
    mesh.position.copy(origin).addScaledVector(direction,distance);mesh.quaternion.copy(rig.quaternion);mesh.updateMatrixWorld(true);return mesh;
  });
  assert.equal(pointer.cast(controller,targets).object,targets[0]);
  pointer.raycaster.far=1;assert.equal(pointer.cast(controller,targets),null);
  pointer.raycaster.far=4;controller.position.x+=10;
  assert.equal(pointer.cast(controller,targets),null);
  assert.equal(pointer.hits.length,0);
  for(const target of targets){target.geometry.dispose();target.material.dispose();}
});
test('pointer visuals retain configurable length/color/depth and local negative Z', () => {
  const line=createPointerLine({length:4,color:0xffb56a,depthTest:true,renderOrder:0});
  assert.equal(line.scale.z,4);assert.equal(line.material.depthTest,true);assert.equal(line.renderOrder,0);
  assert.equal(line.material.color.getHex(),0xffb56a);
  assert.equal(line.geometry.attributes.position.getZ(1),-1);
  line.geometry.dispose();line.material.dispose();
});
