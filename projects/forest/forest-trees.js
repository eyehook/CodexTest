import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {GLTFLoader} from '../../shared/vendor/three-r180/addons/GLTFLoader.js';
import {SIZE} from './forest-world.mjs?v=shared-r180-1';

// Evaluate three original Blender rigs, then share their deformed geometry across
// instanced copies. This preserves the authored wind without hundreds of rigs.
export async function createAnimatedTrees(plants, load = url => new GLTFLoader().loadAsync(url)) {
  const group = new THREE.Group();
  const sources = await Promise.all([1,2,3].map(n => load(`./trees/tree_seed${n}.glb`)));
  const animated = [], vertex = new THREE.Vector3(), transform = new THREE.Object3D();
  sources.forEach((gltf, variety) => {
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root);
    const scale = 6 / (bounds.max.y - bounds.min.y);
    const mixer = new THREE.AnimationMixer(root);
    for (const clip of gltf.animations) mixer.clipAction(clip).play();
    mixer.setTime(variety * 1.37);
    const meshes = [];
    root.traverse(mesh => { if (mesh.isMesh) meshes.push(mesh); });
    const entries = [];
    for (const mesh of meshes) {
      if (mesh.morphTargetInfluences?.length) throw new Error('Tree morph targets need a separate deformation path.');
      const geometry = mesh.geometry.clone();
      geometry.deleteAttribute('skinIndex'); geometry.deleteAttribute('skinWeight');
      geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
      const selected = plants.filter(p => p.kind === variety);
      const instances = new THREE.InstancedMesh(geometry, mesh.material, selected.length * 9);
      let i = 0;
      for (let tx=-1;tx<=1;tx++) for (let tz=-1;tz<=1;tz++) for (const plant of selected) {
        transform.position.set(plant.x + tx*SIZE, -bounds.min.y * scale * plant.size, plant.z + tz*SIZE);
        transform.rotation.set(0,plant.rotation,0);
        transform.scale.setScalar(scale * plant.size);
        transform.updateMatrix(); instances.setMatrixAt(i++,transform.matrix);
      }
      // The geometry changes with wind; disable stale bounding-volume culling.
      // GPU clipping and the 28m far plane still discard distant repeated tiles.
      instances.frustumCulled = false;
      group.add(instances);
      entries.push({mesh, geometry});
    }
    animated.push({root,mixer,entries});
  });
  function update(dt) {
    for (const {root,mixer,entries} of animated) {
      mixer.update(dt); root.updateMatrixWorld(true);
      for (const {mesh,geometry} of entries) {
        if(mesh.isSkinnedMesh) mesh.skeleton.update();
        const source = mesh.geometry.attributes.position, dest = geometry.attributes.position;
        for(let i=0;i<source.count;i++) {
          vertex.fromBufferAttribute(source,i);
          if(mesh.isSkinnedMesh) mesh.applyBoneTransform(i,vertex);
          vertex.applyMatrix4(mesh.matrixWorld);
          dest.setXYZ(i,vertex.x,vertex.y,vertex.z);
        }
        dest.needsUpdate = true;
        geometry.computeVertexNormals();
      }
    }
  }
  update(0);
  return {group,update};
}
