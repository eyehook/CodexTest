import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Euler} from '../../../shared/vendor/three-r180/three.module.js';
import {generatePlant,componentPose} from '../generator.mjs';
import {canopyRotation,placeCanopyFlowers} from '../canopy-flowers.mjs';
test('ellipsoid-tree flowers sit outside all mature crowns and face outward, with deterministic connected stems',()=>{
 const forms=new Set();let count=0;
 for(let seed=0;seed<1200;seed++){
  const plant=generatePlant(seed),flowers=plant.parts.filter(p=>p.canopy!==undefined);if(!flowers.length||plant.parameters.form!=='tree')continue;
  forms.add(plant.parameters.treeForm);assert.deepEqual(plant,generatePlant(seed));const poses=componentPose(plant,10),crowns=plant.parts.filter(p=>p.kind==='foliage'&&p.shape==='crown');
  for(const f of flowers){count++;const canopy=plant.parts[f.canopy],stalk=plant.parts[f.parent];assert.equal(stalk.parent,canopy.parent);assert.deepEqual(stalk.start,plant.parts[canopy.parent].end);assert.ok(stalk.parent<stalk.id&&stalk.id<f.id&&canopy.id<f.id);assert.deepEqual(plant.parts[f.parent].end,f.position);assert.ok(poses[f.id].anchor.every((v,i)=>Math.abs(v-f.position[i])<1e-9));assert.ok(Math.abs(Math.hypot(...f.normal)-1)<1e-9);
   for(const crown of crowns){const center=poses[crown.id].anchor,local=canopyRotation(f.position.map((v,i)=>v-center[i]),crown,true),level=local.reduce((sum,v,i)=>sum+(v/crown.scale[i])**2,0);assert.ok(level>=1-1e-9,'flower must not be hidden in a crown');if(crown.id===f.canopy){assert.ok(level<1.15);const normal=canopyRotation(local.map((v,i)=>v/crown.scale[i]**2),crown);assert.ok(normal.reduce((sum,v,i)=>sum+v*f.normal[i],0)>0);}}
  }
 }
 assert.deepEqual([...forms].sort(),['rounded','umbrella']);assert.ok(count>100);
});

test('canopy transform math matches the renderer Euler XYZ orientation',()=>{
 const canopy={tilt:.14,yaw:2.3},v=[.5,-.4,.8],expected=new Vector3().fromArray(v).applyEuler(new Euler(canopy.tilt,canopy.yaw,canopy.tilt*.6));const actual=canopyRotation(v,canopy);assert.ok(expected.distanceTo(new Vector3().fromArray(actual))<1e-10);const inverse=canopyRotation(actual,canopy,true);assert.ok(v.every((value,i)=>Math.abs(value-inverse[i])<1e-10));
});

test('flowers moved to a later branch canopy move their stalk support and retain valid growth order',()=>{
 const parts=[
  {id:0,kind:'stem',parent:null,start:[0,0,0],end:[0,1,0],begin:0,duration:.2},
  {id:1,kind:'foliage',shape:'crown',parent:0,attachment:1,scale:[1,1,1],tilt:0,yaw:0,begin:.2,duration:.2},
  {id:2,kind:'stem',parent:0,attachment:1,start:[0,1,0],end:[1,1,0],begin:.2,duration:.1},
  {id:3,kind:'flower',parent:2,attachment:1,canopy:1,position:[1,1,0],begin:.5,duration:.2},
  {id:4,kind:'stem',parent:null,start:[3,0,0],end:[3,1,0],begin:.1,duration:.3},
  {id:5,kind:'foliage',shape:'crown',parent:4,attachment:1,scale:[1,1,1],tilt:0,yaw:0,begin:.4,duration:.2}
 ];
 const destination=parts[5],support=parts[4],flower=parts[3];placeCanopyFlowers(parts,()=>.5);
 assert.equal(flower.canopy,destination.id);const stalk=parts[flower.parent];assert.equal(stalk.parent,support.id);assert.deepEqual(stalk.start,support.end);
 for(const part of parts)if(part.parent!==null)assert.ok(part.parent<part.id);
 for(const age of [1,3,5,10]){const poses=componentPose({parts},age);assert.deepEqual(poses[stalk.id].anchor,poses[support.id].end);assert.deepEqual(poses[flower.id].anchor,poses[stalk.id].end);}
});
