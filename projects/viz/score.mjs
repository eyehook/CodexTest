// Counter-based randomness keeps the score seekable and independent of frame rate.
export function sample(seed, index, lane = 0) {
  let x = seed ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(lane + 1, 0x85ebca77);
  x = Math.imul(x ^ x >>> 16, 0x21f0aaad);
  x = Math.imul(x ^ x >>> 15, 0x735a2d97);
  return ((x ^ x >>> 15) >>> 0) / 4294967296;
}
const major = [0,2,4,5,7,9,11];
const minor = [0,2,3,5,7,8,10];
const forms = [[0,1,2,3],[0,2,1,3],[0,1,3,2]];
const rhythms = [[0,6,10],[2,8,14],[0,4,7,12],[0,7,10,14],[0,5,12]];
const groove = [
  {kick:[0,8], bass:[0,10], hat:[2,10], brush:[4,12]},
  {kick:[0,6,10], bass:[0,7,12], hat:[2,6,10,14], brush:[4,12]},
  {kick:[0,4,8,12], bass:[2,6,10,14], hat:[2,5,6,10,14], brush:[4,12]},
  {kick:[0], bass:[0], hat:[6,14], brush:[8]}
];

// Degrees are zero-based. In minor, V borrows the raised seventh from
// harmonic minor, so its third sits one semitone below the tonic.
function tone(key, root, degree) {
  const letter = (degree % 7 + 7) % 7;
  const alteration = key.minor && root === 4 && letter === 6 ? 1 : 0;
  return key.tonic + key.scale[letter] + 12*Math.floor(degree/7) + alteration;
}

function makeLead(seed, index, key, harmony, role) {
  const family = Math.floor(index/4);
  // The second half of a family's subject becomes the head of the next one.
  const contour = Array.from({length:6}, (_,i) => {
    const source = family + Math.floor(i/3);
    return Math.floor(sample(seed,source,20+i%3)*5)-2;
  });
  const head = rhythms[Math.floor(sample(seed,family,27)*rhythms.length)];
  const reply = rhythms[Math.floor(sample(seed,index,28)*rhythms.length)];
  const notes = new Array(128);
  let previous = key.tonic+19;
  for(let bar=0;bar<8;bar++){
    const cadence = bar%4===3;
    const rhythm = cadence ? [0] : bar%2===0 ? head : reply;
    for(let i=0;i<rhythm.length;i++){
      const slot=rhythm[i], step=16*bar+slot;
      const root=harmony[Math.floor(step/8)];
      const direction=role===1 ? -1 : 1;
      const shape=contour[(i+bar%2*3)%6]*direction;
      const target=key.tonic+18+shape*2+(bar===2 || bar===5 ? 3 : 0);
      let bestDegree=root, cost=Infinity;
      for(let degree=5;degree<=17;degree++){
        const interval=(degree-root+7)%7;
        if(![0,2,4].includes(interval) || (cadence && interval!==0)) continue;
        const note=tone(key,root,degree);
        const movement=Math.abs(note-previous);
        const score=Math.abs(note-target)+.42*movement+Math.max(0,movement-5);
        if(score<cost){ bestDegree=degree;cost=score; }
      }
      const note=tone(key,root,bestDegree);
      const gap=(rhythm[i+1] ?? 16)-slot;
      notes[step]={note,length:cadence ? 11 : Math.max(1,gap-1),level:cadence ? .34 : .26+.04*(i===0)};
      // A short pickup takes one diatonic step into a known chord tone.
      if(i>0 && rhythm[i]-rhythm[i-1]>=4 && (bar+i+index)%3===0){
        notes[step-1]={note:tone(key,root,bestDegree+(previous>note?1:-1)),length:1,level:.20};
        notes[bar*16+rhythm[i-1]].length=Math.max(1,rhythm[i]-rhythm[i-1]-2);
      }
      previous=note;
    }
  }
  return notes;
}

export function phrase(seed,index){
  const r = lane => sample(seed,index,lane);
  const family=Math.floor(index/4), part=index%4;
  const role=forms[Math.floor(sample(seed,family,31)*forms.length)][part];
  const majorTonic=43+Math.floor(sample(seed,0,30)*12);
  const homeMinor=sample(seed,0,31)<.5;
  const inMinor=part===1 ? !homeMinor : homeMinor;
  const key={tonic:inMinor?majorTonic-3:majorTonic,minor:inMinor,scale:inMinor?minor:major};
  // Relative major/minor share a pitch collection. Move away in the second
  // period, return home, and vary the predominant and cadence on each visit.
  const predominant=inMinor?3:r(4)<.5?1:3;
  const middle=r(5)<.5?5:2;
  const end=part===0 && r(6)<.55?5:0;
  const question = [0,0,middle,middle,predominant,predominant,4,4];
  const answers = [
    [0,0,middle,predominant,predominant,4,end,end],
    [middle,middle,3,3,4,4,end,end],
    [0,middle,predominant,4,5,3,0,0]
  ];
  const harmony = question.concat(answers[Math.floor(r(7)*answers.length)]);
  return {key,role,harmony,lead:makeLead(seed,index,key,harmony,role),
    folds:2+Math.floor(sample(seed,family+(part%3),5)*6),
    energy:[.45,.64,.88,.28][role]+.1*r(1),hue:r(2),twist:2*r(3)-1};
}
export function chord(p, step) { return p.harmony[Math.floor(step/8)%16]; }

export function events(seed, p, step, emit) {
  const local=step%128, bar=Math.floor(local/16), slot=local%16;
  const key=p.key, root=chord(p,step);
  const g=groove[p.role], arrival=bar===7;
  const dynamic = p.energy * (arrival ? .72 : 1);
  if (g.kick.includes(slot) && (!arrival || slot<8)) emit('kick',0,.48+.23*dynamic,2);
  if (g.brush.includes(slot) && (!arrival || slot<8)) emit('brush',0,.22+.22*dynamic,1);
  if (g.hat.includes(slot) && (!arrival || slot<8)) emit('hat',0,.14+.18*sample(seed,step,9),1);
  if (g.bass.includes(slot) && (!arrival || slot<8))
    emit('bass',tone(key,root,root+(slot===12?4:0))-12,.40+.08*dynamic,p.role===3?9:3);

  if (local%8===0 && (local===0 || root!==chord(p,local-1))) {
    let length=8;
    while(local+length<128 && chord(p,local+length)===root) length+=8;
    // Keep the inner voices in one register as the bass moves beneath them.
    for (const interval of [0,2,4,6]) {
      const offset=tone(key,root,root+interval)-key.tonic;
      const voicedTone = offset % 12 < 5 ? offset % 12 + 12 : offset % 12;
      emit('pad',key.tonic+voicedTone,(.12+.035*dynamic)*.5,length);
    }
  }

  const lead=p.lead[local];
  if(lead) emit('bell',lead.note,lead.level,lead.length);
  if(p.role===2 && !arrival && slot%4===2)
    emit('reed',tone(key,root,root+[0,2,4,2][Math.floor(slot/4)]),.18,3);
}
