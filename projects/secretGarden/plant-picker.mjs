import * as THREE from '../../shared/vendor/three-r180/three.module.js';

// Bounds reject whole plants during growth. At maturity a static hierarchy
// rejects individual components before running the original triangle tests.
export function installPlantPicker(group,batches) {
  const box=new THREE.Box3(),inverse=new THREE.Matrix4(),ray=new THREE.Ray();
  const matrix=new THREE.Matrix4(),local=new THREE.Matrix4(),sphereBox=new THREE.Box3();
  const probe=new THREE.Mesh(batches[0].mesh.geometry,batches[0].mesh.material);
  const stack=[],hits=[];
  let root=null;
  const picker={enabled:true,box,
    refresh(){
      box.makeEmpty();
      for(const {mesh} of batches){
        const sphere=mesh.boundingSphere;if(!sphere)continue;
        sphereBox.min.copy(sphere.center).addScalar(-sphere.radius);
        sphereBox.max.copy(sphere.center).addScalar(sphere.radius);
        sphereBox.applyMatrix4(mesh.matrix);box.union(sphereBox);
      }
    },
    freeze(){
      const records=[];
      for(const {mesh} of batches){
        if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
        for(let i=0;i<mesh.count;i++){
          mesh.getMatrixAt(i,local);matrix.multiplyMatrices(mesh.matrix,local);
          records.push({mesh,index:i,box:mesh.geometry.boundingBox.clone().applyMatrix4(matrix)});
        }
      }
      function build(items){
        const bounds=new THREE.Box3();for(const item of items)bounds.union(item.box);
        if(items.length<=8)return {box:bounds,items};
        const size=new THREE.Vector3();bounds.getSize(size);
        const axis=size.x>=size.y&&size.x>=size.z?'x':size.y>=size.z?'y':'z';
        items.sort((a,b)=>(a.box.min[axis]+a.box.max[axis])-(b.box.min[axis]+b.box.max[axis]));
        const middle=Math.floor(items.length/2);
        return {box:bounds,left:build(items.slice(0,middle)),right:build(items.slice(middle))};
      }
      root=build(records);box.copy(root.box);
    },
  };
  group.raycast=(raycaster,intersections)=>{
    if(!picker.enabled)return;
    inverse.copy(group.matrixWorld).invert();ray.copy(raycaster.ray).applyMatrix4(inverse);
    if(box.isEmpty()||!ray.intersectsBox(box))return false;
    if(!root)return; // Growing geometry retains its exact normal raycasting.
    stack.length=0;stack.push(root);
    while(stack.length){
      const node=stack.pop();if(!ray.intersectsBox(node.box))continue;
      if(!node.items){stack.push(node.left,node.right);continue;}
      for(const item of node.items){
        if(!ray.intersectsBox(item.box))continue;
        item.mesh.getMatrixAt(item.index,local);matrix.multiplyMatrices(item.mesh.matrix,local);
        probe.geometry=item.mesh.geometry;probe.material=item.mesh.material;
        probe.matrixWorld.multiplyMatrices(group.matrixWorld,matrix);
        hits.length=0;probe.raycast(raycaster,hits);
        for(const hit of hits){hit.object=item.mesh;hit.instanceId=item.index;intersections.push(hit);}
      }
    }
    return false; // The hierarchy already handled the exact candidate hits.
  };
  return picker;
}
