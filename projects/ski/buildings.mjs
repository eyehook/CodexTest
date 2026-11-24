import * as THREE from '../../shared/vendor/three-r180/three.module.js';

const BUILDING_HEIGHT = 5;

export function createBuildings(scene, map, footprints) {
  const geometry = new THREE.BoxGeometry();
  const normals = geometry.attributes.normal;
  const colors = new Float32Array(normals.count * 3);
  const roof = new THREE.Color(0x61534d);
  const wall = new THREE.Color(0xa4917d);
  const shade = new THREE.Color(0x78695e);
  for (let i = 0; i < normals.count; i++) {
    const color = normals.getY(i) > 0 ? roof : normals.getX(i) + normals.getZ(i) > 0 ? wall : shade;
    color.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.MeshBasicMaterial({vertexColors: true});
  const mesh = new THREE.InstancedMesh(geometry, material, footprints.length);
  mesh.name = 'Mapped building footprints';
  const box = new THREE.Object3D();
  const corner = new THREE.Vector3();
  for (const [index, {x, z, width, depth, yaw}] of footprints.entries()) {
    box.rotation.y = yaw;
    const centerGround = map.height(x, z);
    let bottom = centerGround;
    let highest = centerGround;
    for (const u of [-0.5, 0.5]) {
      for (const v of [-0.5, 0.5]) {
        corner.set(u * width, 0, v * depth).applyQuaternion(box.quaternion);
        const ground = map.height(x + corner.x, z + corner.z);
        bottom = Math.min(bottom, ground);
        highest = Math.max(highest, ground);
      }
    }
    const top = Math.max(centerGround + BUILDING_HEIGHT, highest + 1);
    box.position.set(x, (bottom + top) / 2, z);
    box.scale.set(width, top - bottom, depth);
    box.updateMatrix();
    mesh.setMatrixAt(index, box.matrix);
  }
  mesh.computeBoundingSphere();
  scene.add(mesh);
  return mesh;
}
