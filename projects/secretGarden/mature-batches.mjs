import * as THREE from '../../shared/vendor/three-r180/three.module.js';

const poolKey=(key,cast,receive)=>cast===(key!=='leaf4')&&receive===(key!=='leaf4')?key:`${key}:cast-${Number(cast)}-receive-${Number(receive)}`;

// Dense shared instance pools. Slot handles follow swaps so deletion never
// rebuilds the garden or changes any other plant's placement or color.
export class MatureBatches {
  constructor(scene,geometries,material) {
    this.scene=scene;this.geometries=geometries;this.material=material;
    this.pools=new Map();this.dirty=new Set();
    this.local=new THREE.Matrix4();this.world=new THREE.Matrix4();this.color=new THREE.Color();
  }
  reserve(key,needed,castShadow=key!=='leaf4',receiveShadow=key!=='leaf4') {
    const poolId=poolKey(key,castShadow,receiveShadow);
    let pool=this.pools.get(poolId);
    if(pool&&pool.capacity>=needed)return pool;
    let capacity=pool?.capacity??64;
    while(capacity<needed)capacity*=2;
    const mesh=new THREE.InstancedMesh(this.geometries[key],this.material,capacity);
    mesh.name=`mature-${poolId}`;mesh.count=pool?.mesh.count??0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3).setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow=castShadow;mesh.receiveShadow=receiveShadow;
    if(pool) {
      mesh.instanceMatrix.array.set(pool.mesh.instanceMatrix.array);
      mesh.instanceColor.array.set(pool.mesh.instanceColor.array);
      this.scene.remove(pool.mesh);pool.mesh.dispose();pool.mesh=mesh;pool.capacity=capacity;
    } else {
      pool={key,id:poolId,mesh,capacity,slots:[]};this.pools.set(poolId,pool);
    }
    this.scene.add(mesh);this.dirty.add(pool);return pool;
  }
  add(visual) {
    if(visual.matureSlots||visual.removed)return;
    visual.group.updateWorldMatrix(true,true);
    visual.matureSlots=[];
    for(const {key,mesh:source} of visual.batches) {
      const poolId=poolKey(key,source.castShadow,source.receiveShadow);
      const pool=this.reserve(key,(this.pools.get(poolId)?.mesh.count??0)+source.count,source.castShadow,source.receiveShadow);
      for(let i=0;i<source.count;i++) {
        const index=pool.mesh.count++;
        source.getMatrixAt(i,this.local);
        this.world.multiplyMatrices(source.matrixWorld,this.local);
        pool.mesh.setMatrixAt(index,this.world);
        source.getColorAt(i,this.color);pool.mesh.setColorAt(index,this.color);
        const handle={pool,index};pool.slots.push(handle);visual.matureSlots.push(handle);
      }
      this.dirty.add(pool);
      // Keep the CPU matrices/geometry for exact per-plant picking, releasing
      // the source mesh's GPU instance buffers. Its static world pose is frozen.
      source.dispose();
    }
    this.scene.remove(visual.group);
  }
  remove(visual) {
    if(!visual.matureSlots)return;
    for(const handle of visual.matureSlots) {
      const {pool,index}=handle,mesh=pool.mesh,last=mesh.count-1;
      if(index!==last) {
        mesh.getMatrixAt(last,this.world);mesh.setMatrixAt(index,this.world);
        mesh.getColorAt(last,this.color);mesh.setColorAt(index,this.color);
        const moved=pool.slots[last];moved.index=index;pool.slots[index]=moved;
      }
      mesh.count--;pool.slots.pop();this.dirty.add(pool);
      if(mesh.count===0) {
        this.scene.remove(mesh);mesh.dispose();this.pools.delete(pool.id);this.dirty.delete(pool);
      }
    }
    visual.matureSlots=null;
  }
  flush() {
    for(const pool of this.dirty) {
      pool.mesh.instanceMatrix.needsUpdate=true;pool.mesh.instanceColor.needsUpdate=true;
      pool.mesh.computeBoundingSphere();
    }
    this.dirty.clear();
  }
  dispose() {
    for(const pool of this.pools.values()){this.scene.remove(pool.mesh);pool.mesh.dispose();}
    this.pools.clear();this.dirty.clear();
  }
}
