import {test} from 'node:test';
import assert from 'node:assert/strict';
import {phrase,events} from '../score.mjs';

const pc=n=>(n%12+12)%12;
function chordPitches(p,step) {
  const root=p.harmony[Math.floor(step/8)];
  return [0,2,4].map(interval=>{
    const degree=root+interval, letter=degree%7;
    return pc(p.key.tonic+p.key.scale[letter]+
      (p.key.minor && root===4 && letter===6?1:0));
  });
}

test('seeded phrases are seekable and independent of request order',()=>{
  const expected=phrase(123,17);
  for(let i=35;i>=0;i--) phrase(123,i);
  assert.deepEqual(phrase(123,17),expected);
  assert.notDeepEqual(phrase(124,17).lead,expected.lead);
});

test('melodies stay bounded, ornaments resolve, and events remain finite',()=>{
  let ornaments=0, syncopations=0;
  const endings=new Set(), rhythms=new Set();
  for(let seed=0;seed<48;seed++) for(let index=0;index<32;index++) {
    const p=phrase(seed,index), line=[];
    p.lead.forEach((n,step)=>line.push({...n,step}));
    assert.ok(line.length>=12 && line.length<=40);
    rhythms.add(line.filter(n=>n.step<32).map(n=>n.step).join(','));
    endings.add(line.at(-1).step);
    for(let i=0;i<line.length;i++) {
      const n=line[i], next=line[i+1];
      assert.ok(Number.isFinite(n.note) && n.note>=p.key.tonic+12 && n.note<=p.key.tonic+36);
      assert.ok(n.length>=1 && n.step+n.length<=128);
      assert.ok(n.level>0 && n.level<=.34);
      if(next) assert.ok(n.step+n.length<=next.step);
      if(n.step%4) syncopations++;
      if(!chordPitches(p,n.step).includes(pc(n.note))) {
        ornaments++;
        assert.ok(next && next.step-n.step===2);
        assert.ok(Math.abs(next.note-n.note)<=2);
        assert.ok(chordPitches(p,next.step).includes(pc(next.note)));
      }
    }
    assert.ok(chordPitches(p,line.at(-1).step).includes(pc(line.at(-1).note)));
    for(let step=0;step<128;step++) events(seed,p,index*128+step,(kind,note,level,length)=>{
      assert.ok([note,level,length].every(Number.isFinite));
      assert.ok(level>0 && length>0);
    });
  }
  assert.ok(ornaments>500);
  assert.ok(syncopations>1000);
  assert.ok(rhythms.size>=8);
  assert.ok(endings.size>=3);
  console.log({ornaments,syncopations,rhythms:rhythms.size,endings:[...endings]});
});

test('the repeated opening retains its two-bar rhythm within each subject',()=>{
  for(let seed=0;seed<48;seed++) {
    const p=phrase(seed,0);
    const structural=[];
    p.lead.forEach((n,step)=>{if(n.level>.20) structural.push(step);});
    assert.deepEqual(structural.filter(s=>s<32),structural.filter(s=>s>=32 && s<64).map(s=>s-32));
  }
});
