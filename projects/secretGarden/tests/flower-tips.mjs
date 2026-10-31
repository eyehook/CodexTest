import test from 'node:test';
import assert from 'node:assert/strict';
import {generatePlant,MAX_COMPONENTS,componentPose,GROWTH_SECONDS} from '../generator.mjs';

test('every standalone flower stem ends in a bloom or blooming cluster, including branched stems',()=>{
 let plants=0,branchedTips=0,clusters=0;
 for(let seed=0;seed<1200;seed++){
  const plant=generatePlant(seed);if(plant.parameters.form!=='flower')continue;
  plants++;assert.ok(plant.parts.length<MAX_COMPONENTS);
  const poses=componentPose(plant,GROWTH_SECONDS);
  for(const stem of plant.parts.filter(part=>part.kind==='stem')){
   const children=plant.parts.filter(part=>part.parent===stem.id);
   const blooms=children.filter(part=>part.kind==='flower');
   const stalks=children.filter(part=>part.kind==='stem'&&part.attachment===1);
   assert.ok(blooms.length||stalks.length,`seed ${seed}: bare stem ${stem.id}`);
   for(const bloom of blooms){assert.deepEqual(bloom.position,stem.end);assert.equal(poses[bloom.id].growth,1);}
   if(stalks.length)clusters++;
   if(children.some(part=>part.kind==='stem'&&part.attachment<1))branchedTips++;
  }
 }
 assert.ok(plants>100);assert.ok(branchedTips>100);assert.ok(clusters>100);
});
