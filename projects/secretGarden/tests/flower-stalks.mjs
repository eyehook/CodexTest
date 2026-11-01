import test from 'node:test';
import assert from 'node:assert/strict';
import {generatePlant} from '../generator.mjs';
const spacingTolerance=Math.PI/9,leanTolerance=Math.PI/9,singleTolerance=Math.PI/18,wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
test('flower primary stalks balance around the base with 20 degree lean variation and a 10 degree single-stalk limit',()=>{
 const counts=new Set(),headings=new Set();let irregular=false,minSingle=Infinity;
 for(let seed=0;seed<3000;seed++){
  const plant=generatePlant(seed);if(plant.parameters.form!=='flower')continue;
  const roots=plant.parts.filter(p=>p.kind==='stem'&&p.parent===null),n=roots.length;counts.add(n);
  const angles=roots.map(p=>{const d=p.end.map((v,i)=>v-p.start[i]);return {lean:Math.acos(d[1]/Math.hypot(...d)),heading:Math.atan2(d[2],d[0])};});
  headings.add(Math.floor((angles[0].heading+Math.PI)*4/Math.PI));
  if(n===1){assert.ok(angles[0].lean>=0&&angles[0].lean<=singleTolerance+1e-9);minSingle=Math.min(minSingle,angles[0].lean);}
  else for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
   assert.ok(Math.abs(angles[i].lean-angles[j].lean)<=leanTolerance+1e-9);
   const error=Math.abs(wrap(angles[j].heading-angles[i].heading-(j-i)*2*Math.PI/n));
   assert.ok(error<=spacingTolerance+1e-9);if(error>.01)irregular=true;
  }
 }
 assert.deepEqual([...counts].sort(),[1,2,3]);assert.ok(headings.size>=7);assert.ok(irregular);assert.ok(minSingle<Math.PI/180);
});
