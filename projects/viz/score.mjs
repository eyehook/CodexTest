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
// Two-bar cells leave room for breath and syncopation, rather than filling bars.
const rhythms = [
  [0,6,10,18,24], [2,8,14,20,27], [0,4,11,16,22,28],
  [0,7,12,19,26], [3,9,16,23,28], [0,5,10,14,22,28],
  [0,8,18,24,30], [2,6,12,20,26]
];
const triad = (degree, root) => [0,2,4].includes(((degree-root)%7+7)%7);
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

// Pass 1: a shared subject and a phrase-wide arc. Adjacent subjects inherit
// half their contour; all variants within a subject retain the opening rhythm.
function planLead(seed, index, role) {
  const family = Math.floor(index/4);
  const contour = Array.from({length:6}, (_,i) =>
    Math.floor(sample(seed,family+Math.floor(i/3),60+i%3)*5)-2);
  const rhythm = rhythms[Math.floor(sample(seed,family,64)*rhythms.length)];
  const ending = Math.floor(sample(seed,index,65)*3); // settle, pickup, flow
  const peak = 4 + Math.floor(sample(seed,index,66)*2);
  const slots = [];
  for(let cell=0;cell<4;cell++) {
    let pattern = rhythm.slice();
    if(cell===2) { // Develop a fragment in shorter calls.
      pattern = [0,4,10,16,20,26];
      if(role===3) pattern = [0,10,20];
    }
    if(cell===3) pattern = ending===0 ? [0,6,16] :
      ending===1 ? [0,8,18,29] : [2,10,18,24,30];
    for(let i=0;i<pattern.length;i++) {
      const step=cell*32+pattern[i], bar=step/16;
      const arch = 1-Math.min(1,Math.abs(bar-peak)/4);
      const shape = contour[i%contour.length]*(role===1?-1:1);
      slots.push({step,target:10+shape+arch*3+(cell===1?1:0),
        cadence:cell===3 && i===pattern.length-1});
    }
  }
  return {slots,ending};
}

// Pass 2: choose among four complete harmonic realizations. Scoring a whole
// phrase lets repetition, contour and leap recovery influence the choice.
function realizeLead(seed,index,key,harmony,plan,variant) {
  let previous=11, before=11, cost=0, repeats=0;
  const line=[];
  for(let i=0;i<plan.slots.length;i++) {
    const slot=plan.slots[i], root=harmony[Math.floor(slot.step/8)];
    let chosen=7, best=Infinity;
    for(let degree=7;degree<=19;degree++) {
      if(!triad(degree,root)) continue;
      if(slot.cadence && plan.ending===0 && (degree-root)%7!==0) continue;
      const motion=degree-previous, lastMotion=previous-before;
      const target=slot.target+(variant-1.5)*.55;
      const score=Math.abs(degree-target)*1.25+Math.abs(motion)*.35+
        Math.max(0,Math.abs(motion)-4)*1.5+
        (Math.abs(lastMotion)>3 && (motion*lastMotion>=0 || Math.abs(motion)>2)?3:0)+
        (motion===0?1.4:0)+sample(seed,index,100+variant*512+i*16+degree)*1.5;
      if(score<best) {best=score;chosen=degree;}
    }
    const motion=chosen-previous;
    cost+=Math.abs(chosen-slot.target)+Math.max(0,Math.abs(motion)-4)*2;
    if(motion===0) {repeats++;cost+=repeats*2;} else repeats=0;
    if(i && Math.abs(previous-before)>3 && motion*(previous-before)>=0) cost+=3;
    line.push({...slot,degree:chosen,note:tone(key,root,chosen)});
    before=previous;previous=chosen;
  }
  // Reward recognizable interval shapes in the repeated two-bar opening.
  const n=plan.slots.filter(s=>s.step<32).length;
  for(let i=1;i<n;i++)
    cost+=.6*Math.abs((line[i].degree-line[i-1].degree)-
      (line[n+i].degree-line[n+i-1].degree));
  return {line,cost};
}

function makeLead(seed, index, key, harmony, role) {
  const plan=planLead(seed,index,role);
  let winner;
  for(let variant=0;variant<4;variant++) {
    const candidate=realizeLead(seed,index,key,harmony,plan,variant);
    if(!winner || candidate.cost<winner.cost) winner=candidate;
  }
  const notes=new Array(128);
  const line=winner.line;
  for(let i=0;i<line.length;i++) {
    const current=line[i], next=line[i+1];
    const boundary=Math.min(next?.step ?? 128,
      (Math.floor(current.step/8)+1)*8);
    // Release at a harmony boundary unless the note belongs to the new triad.
    let end=next?.step ?? 128;
    if(boundary<end && !triad(current.degree,harmony[Math.floor(boundary/8)])) end=boundary;
    notes[current.step]={note:current.note,length:Math.max(1,end-current.step-1),
      level:current.cadence ? .32 : .26+.025*(current.step%8===0)};
  }
  // Pass 3: sparse, soft ornaments, all resolved by step into a known chord
  // tone. Never cross a harmony change or decorate the closing arrival.
  for(let i=0;i<line.length-1;i++) {
    const a=line[i], b=line[i+1], gap=b.step-a.step;
    if(gap<5 || b.cadence || sample(seed,index,2300+i)>.48) continue;
    const root=harmony[Math.floor(a.step/8)];
    if(Math.floor(a.step/8)!==Math.floor(b.step/8)) continue;
    const delta=b.degree-a.degree;
    const degree=Math.abs(delta)===2 ? a.degree+Math.sign(delta) :
      b.degree+(delta>0?-1:1);
    const note=tone(key,root,degree);
    if(triad(degree,root) || Math.abs(note-b.note)>2) continue;
    const step=b.step-2;
    notes[a.step].length=Math.min(notes[a.step].length,step-a.step-1);
    notes[step]={note,length:1,level:.20};
  }
  return notes;
}

function basePhrase(seed,index){
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
// Keep one tempo for the sequence so audio and visuals share a continuous clock.
export function sequence(seed) {
  const bpm=78+Math.floor(sample(seed,1)*18);
  return {bpm,periods:Math.round(300*bpm/(60*32))};
}

export function songAt(seed,index) {
  const {bpm,periods}=sequence(seed);
  return {index,seed:index===0?seed:Math.floor(sample(seed,index,5000)*4294967296),
    periods,bpm,seconds:periods*32*60/bpm};
}

export function phrase(seed,index) {
  const {periods}=sequence(seed), number=Math.floor(index/periods), position=index%periods;
  const song=songAt(seed,number);
  const section=position===0?'intro':position<3?'themeA':position<5?'themeB':
    position<7?'variation':position===7?'bridge':position<periods-2?'climax':'outro';
  const theme=section==='themeB'?5:section==='bridge'?9:0;
  const p=basePhrase(song.seed,theme);
  // Returning themes retain their pitches and rhythm; phrasing and orchestration develop.
  if(section==='variation') p.lead=p.lead.map(n=>n?{...n,length:Math.max(1,n.length-1)}:n);
  p.role={intro:3,themeA:0,themeB:1,variation:1,bridge:3,climax:2,outro:3}[section];
  p.energy={intro:.23,themeA:.48,themeB:.68,variation:.57,bridge:.25,climax:.95,outro:.24}[section];
  // Visual character evolves even when the musical theme returns.
  p.hue=sample(song.seed,position,2);p.twist=2*sample(song.seed,position,3)-1;
  p.folds=2+Math.floor(sample(song.seed,position,5)*6);
  const final=position===periods-1;
  if(final) {
    // A dominant-to-tonic close, then two beats for releases before the next intro.
    p.harmony=p.harmony.slice();p.harmony.fill(4,10,12);p.harmony.fill(0,12);
    p.lead=p.lead.slice(0,78);p.lead.length=128;
    p.lead[96]={note:p.key.tonic+19,length:6,level:.26};
    p.lead[112]={note:p.key.tonic+12,length:6,level:.28};
  }
  return {...p,song:number,songSeed:song.seed,songPeriod:position,songPeriods:periods,section,final};
}

export function chord(p, step) { return p.harmony[Math.floor(step/8)%16]; }

export function events(seed, p, step, emit) {
  const output=emit;
  emit=(kind,note,level,length)=>{
    const local=step%128;
    if(p.section==='intro' && (kind==='reed' || kind==='brush' || kind==='hat' ||
      (kind==='bell' && local<64) || (kind==='bass' && local<32) || kind==='kick')) return;
    if(p.section==='bridge' && ['kick','hat','brush','reed'].includes(kind)) return;
    if(p.section==='outro' && ['hat','brush','reed'].includes(kind)) return;
    if(p.final && (local>=120 || (kind==='kick' && local>=64))) return;
    const gain=p.section==='intro' ? .32+.68*local/128:
      p.section==='outro'?(p.final ? .62 : .85):p.section==='bridge' ? .7 : 1;
    const capped=p.final?Math.min(length,120-local):length;
    output(kind,note,level*gain,capped);
  };
  seed=p.songSeed ?? seed;
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
