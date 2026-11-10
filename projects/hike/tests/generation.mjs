import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorld} from '../world.mjs';
const seeds=[0,1,3,8,42,999,123456,0xffffffff,15,3307485663];
const worlds=seeds.map(seed=>createWorld({seed}));
test('seeds change large-scale topology, not just position or small surface noise',()=>{
 const signatures=worlds.map(w=>{
  const p=w.summit;return Array.from({length:24},(_,i)=>{const angle=i*Math.PI*2/24,r=180;return w.rawHeight(p.x+Math.cos(angle)*r,p.z+Math.sin(angle)*r)/p.y;});
 });
 for(let i=1;i<signatures.length;i++){
  const rms=Math.sqrt(signatures[i].reduce((sum,h,j)=>sum+(h-signatures[0][j])**2,0)/24);
  assert.ok(rms>.04,`seed ${seeds[i]} only changed fine detail: RMS ${rms}`);
 }
 assert.ok(Math.max(...worlds.map(w=>w.summit.y))-Math.min(...worlds.map(w=>w.summit.y))>40);
 assert.ok(new Set(worlds.map(w=>w.mountain.parameters.ridges)).size>=3);
});
test('one dominant connected summit region and finite, nonnegative cached geology',()=>{
 for(const w of worlds){
  const heights=w.mountain.heights,n=513,threshold=w.summit.y*.85,visited=new Uint8Array(heights.length);let significant=0;
  assert.equal(Math.max(...Array.from(heights).filter(h=>h>threshold)),w.summit.y);
  for(let start=0;start<heights.length;start++){
   assert.ok(Number.isFinite(heights[start])&&heights[start]>=0);
   if(heights[start]<threshold||visited[start])continue;
   const stack=[start];visited[start]=1;let count=0;
   while(stack.length){const i=stack.pop();count++;for(const j of [i-1,i+1,i-n,i+n])if(j>=0&&j<heights.length&&!visited[j]&&heights[j]>=threshold){visited[j]=1;stack.push(j);}}
   if(count>=10)significant++;
  }
  assert.equal(significant,1,`seed ${w.config.seed} created separate high peaks`);
 }
});
test('varied generated mountains retain visible summits and usable 20-minute ascents',()=>{
 for(const w of worlds){
  assert.ok(w.totalLength>=1500&&w.totalLength<=1700);assert.ok(w.maxGrade<=.301);
  assert.ok(w.maxEarthwork<12,`excessive earthworks: ${w.maxEarthwork}`);
  assert.deepEqual(w.sections,[{kind:'ground',start:0,end:800}]);
  for(let i=1;i<100;i++){const t=i/100,a=w.start,b=w.summit,y=a.y+1.7+(b.y+17-a.y-1.7)*t;assert.ok(w.rawHeight(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t)<y);}
  for(let i=0;i<w.route.length;i++){const p=w.route[i];assert.ok(w.normal(p.x,p.z).slope<30,`seed ${w.config.seed}, point ${i}`);}
 }
});
