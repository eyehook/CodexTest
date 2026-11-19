import test from 'node:test';
import assert from 'node:assert/strict';
import {RAILS} from '../physics.mjs';
import {railSections,createRails} from '../rails-view.mjs';
test('adjacent rails share exact miter edges, including white/colored joins, without internal caps',()=>{
 const sections=railSections(RAILS),ends=new Map(),key=(x,z)=>`${x.toFixed(8)},${z.toFixed(8)}`;
 RAILS.forEach((s,i)=>{for(const [x,z,end] of [[s.ax,s.az,sections[i].a],[s.bx,s.bz,sections[i].b]]){const k=key(x,z);if(!ends.has(k))ends.set(k,[]);ends.get(k).push(end);}});
 let joints=0;
 for(const group of ends.values()){
  if(group.length===1){assert.ok(group[0].cap);continue;}
  assert.equal(group.length,2);const [a,b]=group;assert.equal(a.cap,false);assert.equal(b.cap,false);
  const near=(u,v)=>Math.hypot(u[0]-v[0],u[1]-v[1])<1e-9;
  assert.ok((near(a.plus,b.plus)&&near(a.minus,b.minus))||(near(a.plus,b.minus)&&near(a.minus,b.plus)));joints++;
 }
 assert.ok(joints>30);
});
test('rail top faces upward and materials form three bounded draw groups',()=>{
 const mesh=createRails(RAILS,[null,null,null]),g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal;
 assert.equal(g.groups.length,3);assert.equal(g.groups.reduce((sum,x)=>sum+x.count,0),p.count);
 for(let i=0;i<p.count;i++){
  assert.ok(Number.isFinite(p.getX(i)));assert.ok(Math.abs(p.getY(i))<.06);
  if(n.getY(i)>.5)assert.ok(Math.abs(p.getY(i)-.0575)<1e-7);
 }
 assert.ok(Array.from(n.array).some(v=>v>.9));
});
