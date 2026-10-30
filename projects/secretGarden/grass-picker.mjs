import * as THREE from '../../shared/vendor/three-r180/three.module.js';
// One analytic ray/ellipsoid intersection replaces all blade triangle tests.
export function installGrassPicker(group,structure) {
  const p=structure.parameters;
  const radius=(p.radius*1.22+p.height*.32)*.8;
  const picker={height:0,center:new THREE.Vector3(),radii:new THREE.Vector3(radius,1,radius*p.stretch)};
  const inverse=new THREE.Matrix4(),ray=new THREE.Ray(),point=new THREE.Vector3(),sphere=new THREE.Sphere(new THREE.Vector3(),1);
  group.raycast=(raycaster,hits)=>{
    if(picker.height<=.002)return false;
    inverse.copy(group.matrixWorld).invert();ray.copy(raycaster.ray).applyMatrix4(inverse);
    ray.origin.sub(picker.center).divide(picker.radii);ray.direction.divide(picker.radii).normalize();
    if(ray.intersectSphere(sphere,point)){
      point.multiply(picker.radii).add(picker.center).applyMatrix4(group.matrixWorld);
      const distance=point.distanceTo(raycaster.ray.origin);
      if(distance>=raycaster.near&&distance<=raycaster.far)hits.push({distance,point:point.clone(),object:group});
    }
    return false; // Skip recursive blade raycasts, including on a miss.
  };
  return picker;
}
