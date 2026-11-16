import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSummitCut,summitCutHeight,roundedCap} from '../summit-cut.mjs';
function fixture(){
 const gridSize=41,gridStep=1,extent=20,heights=new Float32Array(gridSize**2);
 for(let z=0;z<gridSize;z++)for(let x=0;x<gridSize;x++)heights[z*gridSize+x]=Math.max(20-Math.hypot(x-20,z-20)*2,25-Math.hypot(x-35,z-20)*3);
 const height=(x,z)=>{const gx=x+extent,gz=z+extent,ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz,i=iz*gridSize+ix;return (heights[i]*(1-u)+heights[i+1]*u)*(1-v)+(heights[i+gridSize]*(1-u)+heights[i+gridSize+1]*u)*v;};
 return {gridSize,gridStep,extent,heights,height};
}
test('rounded cap only removes material, retaining exact flat and untouched regions',()=>{
 const level=10,k=.75,e=1e-5;
 for(let y=0;y<20;y+=.01)assert.ok(roundedCap(y,level,k)<=y+1e-12);
 assert.equal(roundedCap(20,level,k),level);assert.equal(roundedCap(0,level,k),0);
 const derivative=y=>(roundedCap(y+e,level,k)-roundedCap(y-e,level,k))/(2*e);
 assert.ok(Math.abs(derivative(level-k)-1)<1e-5);assert.ok(Math.abs(derivative(level+k))<1e-5);
});
test('connected summit cut guarantees standing disk and leaves separate high points alone',()=>{
 const landscape=fixture(),cut=createSummitCut(landscape,{x:0,z:0});
 assert.deepEqual(cut,createSummitCut(landscape,{x:0,z:0}));
 for(let z=-4;z<=4;z+=.125)for(let x=-4;x<=4;x+=.125){
  const raw=landscape.height(x,z),y=summitCutHeight(cut,x,z,raw);assert.ok(y<=raw);
  if(Math.hypot(x,z)<=1.5)assert.equal(y,cut.level);
 }
 assert.equal(summitCutHeight(cut,15,0,25),25);
 assert.equal(summitCutHeight(cut,-100,0,0),0);
 // No step at cell-mask boundaries: the soft cap is inactive there.
 for(let z=-10;z<10;z++)for(let x=-10;x<10;x++){
  const a=summitCutHeight(cut,x-1e-6,z,landscape.height(x-1e-6,z)),b=summitCutHeight(cut,x+1e-6,z,landscape.height(x+1e-6,z));
  assert.ok(Math.abs(a-b)<1e-4);
 }
});
