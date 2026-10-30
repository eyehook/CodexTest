// Pure plant data: meters, local coordinates, explicit attachments, normalized time.
export const GROWTH_SECONDS = 10;
export const MAX_COMPONENTS = 600;
export function randomFor(seed) {
  let state = seed >>> 0;
  return () => { state += 0x6D2B79F5; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export const TREE_FORMS=['rounded','open','pine','umbrella'];
export const BLOOM_FORMS = [
  {name:'daisy', petals:[9,13], layers:1, width:.32, cup:.08, center:.27},
  {name:'buttercup', petals:[5,6], layers:1, width:.85, cup:.38, center:.2},
  {name:'lily', petals:[6,6], layers:1, width:.4, cup:.65, center:.12},
  {name:'bell', petals:[5,6], layers:1, width:.5, cup:1.05, center:.1},
  {name:'rosette', petals:[7,9], layers:3, width:.7, cup:.3, center:.13},
  {name:'star', petals:[5,7], layers:1, width:.22, cup:.18, center:.17},
];
const mix = (a,b,t) => a+(b-a)*t;
export function generatePlant(seed) {
  seed >>>= 0;
  const rng = randomFor(seed), range = (a,b) => mix(a,b,rng()), integer = (a,b) => Math.floor(range(a,b+1));
  const form = ['flower','bush','tree'][integer(0,2)];
  // Correlated parameter distributions feed the same recursive construction.
  const profiles = {flower:[.35,1.05,1,3,1,.018], bush:[.45,.85,4,6,2,.045], tree:[1.7,2.85,1,1,3,.035]};
  const [lo,hi,minStems,maxStems,depth,radius] = profiles[form];
  const parameters = {form,height:range(lo,hi),width:form==='bush'?range(1.1,1.5):range(.65,1.15),primaryStems:integer(minStems,maxStems),depth,
    branchProbability:range(.8,1),branchAngle:range(.45,.95),taper:range(.48,.67),leafSize:form==='tree'?range(.18,.3):range(.09,.19),
    leafShape:integer(0,2),leafDensity:form==='tree'?integer(6,8):integer(3,5),leafHue:range(.22,.36),leafLight:range(.29,.44),
    flowers:form==='flower'||rng()<.3,petals:integer(5,8),petalShape:integer(0,2),flowerSize:range(.1,.18),flowerHue:rng(),flowerSaturation:rng(),flowerBrightness:range(.25,1)};
  const bloomIndex=integer(0,BLOOM_FORMS.length-1), bloom=BLOOM_FORMS[bloomIndex];
  parameters.bloomForm=bloom.name;
  parameters.petals=integer(...bloom.petals);
  parameters.bloomIndex=bloomIndex;
  parameters.clusterCount=rng()<.32?integer(4,8):1;
  if(form==='tree') {
    parameters.treeForm=TREE_FORMS[integer(0,TREE_FORMS.length-1)];
    if(parameters.treeForm==='umbrella'){parameters.depth=2;parameters.width=range(1,1.3);}
    if(parameters.treeForm==='columnar')parameters.width=range(.6,.85);
    if(parameters.treeForm==='pine'){parameters.depth=1;parameters.flowers=false;parameters.leafHue=range(.28,.4);}
  }
  const treeForm=parameters.treeForm;
  const parts = [];
  let treeBloomCount=0;
  const add = part => { if(parts.length>=MAX_COMPONENTS) return null; part.id=parts.length; parts.push(part); return part; };
  const point = (a,b,t) => a.map((v,i)=>mix(v,b[i],t));
  function stem(start,length,angle,azimuth,thickness,level,parent=null,attachment=1) {
    const direction=[Math.sin(angle)*Math.cos(azimuth),Math.cos(angle),Math.sin(angle)*Math.sin(azimuth)];
    const end=start.map((v,i)=>v+direction[i]*length);
    const begin=parent ? parent.begin+parent.duration*attachment : 0;
    const duration=level===0?.32:.15;
    const node=add({kind:'stem',parent:parent?.id??null,attachment,start,end,radius:thickness,taper:parameters.taper,begin,duration});
    if(!node) return;
    const leafy=form!=='tree'||treeForm==='open'&&level>=2;
    const leafCount=form==='tree'&&level===2?Math.ceil(parameters.leafDensity*.5):parameters.leafDensity;
    if(leafy) for(let i=0;i<leafCount;i++) {
      const t=range(.28,.96), yaw=azimuth+i*2.399+range(-.3,.3);
      add({kind:'leaf',parent:node.id,attachment:t,position:point(start,end,t),yaw,tilt:range(-.4,.6),
        size:parameters.leafSize*range(.75,1.4),shape:parameters.leafShape,hue:parameters.leafHue,
        light:parameters.leafLight+range(-.04,.06),begin:begin+duration*t+.035,duration:.14});
    }
    if(form==='tree'&&treeForm!=='open') {
      if(treeForm==='pine'&&level===0) {
        const tiers=integer(5,7);
        for(let tier=0;tier<tiers;tier++) {
          const t=.18+tier/(tiers-1)*.64;
          const radius=parameters.height*range(.29,.36)*(1-tier/tiers*.77);
          add({kind:'foliage',shape:'pine',parent:node.id,attachment:t,
            scale:[radius,parameters.height*range(.3,.4)*(1-tier/tiers*.25),radius],
            yaw:range(0,Math.PI*2),tilt:range(-.05,.05),hue:parameters.leafHue,
            light:parameters.leafLight+range(-.06,.04),begin:begin+duration*t+.04,duration:.2});
        }
      } else if(treeForm!=='pine'&&level===parameters.depth) {
        const radius=parameters.height*(treeForm==='umbrella'?range(.18,.25):range(.1,.16));
        const scale=treeForm==='columnar'?[radius*.65,radius*1.8,radius*.65]:
          treeForm==='umbrella'?[radius*1.25,radius*.34,radius]:[radius*range(.9,1.4),radius*range(.8,1.2),radius];
        add({kind:'foliage',shape:'crown',parent:node.id,attachment:1,scale,
          yaw:range(0,Math.PI*2),tilt:range(-.15,.15),hue:parameters.leafHue,
          light:parameters.leafLight+range(-.06,.06),begin:begin+duration+.025,duration:.16});
      }
    }
    let branched=false;
    if(level<parameters.depth) {
      // Trees always establish a scaffold and fork into fine outer twigs.
      // Five scaffold limbs × three branches × three twigs remains bounded.
      const count=form==='tree'?(treeForm==='pine'?6:level===0?integer(4,5):3):form==='flower'?integer(1,2):integer(2,3);
      for(let i=0;i<count;i++) if(form==='tree'||rng()<parameters.branchProbability) {
        branched=true;
        const tree=form==='tree';
        const t=tree?(treeForm==='umbrella'&&level===0?.78+i/(count-1)*.18:level===0?.42+i/(count-1)*.5+range(-.025,.025):i===count-1?1:range(.48,.9)):range(.3,.95);
        const lengthRatio=tree?(treeForm==='columnar'?range(.24,.35):treeForm==='pine'?range(.08,.13)*(1-t*.85):level===0?range(.4,.6):range(.52,.73)):range(.36,.63);
        // An upright continuation fills the crown; other children spread outward.
        const childAngle=tree?(treeForm==='umbrella'?range(1.15,1.5):treeForm==='columnar'?range(.25,.55):treeForm==='pine'?range(1.3,1.55):i===count-1?range(.12,.4):range(.65,1.25)):form==='bush'?range(1.1,1.5):parameters.branchAngle+range(-.15,.22);
        stem(point(start,end,t),length*lengthRatio*parameters.width,childAngle,
          azimuth+i*2.399+range(-.6,.6),thickness*parameters.taper,level+1,node,t);
      }
    }
    if(parameters.flowers&&!branched&&(form!=='tree'||treeBloomCount<30)) {
      for(let bloomNumber=0;bloomNumber<parameters.clusterCount&&(form!=='tree'||treeBloomCount<30);bloomNumber++) {
        if(form==='tree')treeBloomCount++;
        let flowerParent=node,flowerPosition=end;
        const clustered=parameters.clusterCount>1;
        if(clustered) {
          const spread=parameters.flowerSize*range(.65,1.4);
          const heading=bloomNumber/parameters.clusterCount*Math.PI*2+range(-.25,.25);
          flowerPosition=[end[0]+Math.cos(heading)*spread,end[1]+range(.035,.13),end[2]+Math.sin(heading)*spread];
          flowerParent=add({kind:'stem',parent:node.id,attachment:1,start:end,end:flowerPosition,
            radius:Math.max(.002,thickness*.3),taper:.48,begin:begin+duration,duration:.065});
          if(!flowerParent) break;
        }
        const tilt=bloom.name==='bell'?range(1.9,2.65):angle*.5+range(.25,.85);
        const heading=azimuth+range(-.55,.55)+(clustered?bloomNumber*2.399:0);
        add({kind:'flower',parent:flowerParent.id,attachment:1,position:flowerPosition,
          yaw:range(0,Math.PI*2),size:parameters.flowerSize*(form==='flower'?1:.65)*(clustered?range(.38,.56):1),
          petals:parameters.petals,shape:bloomIndex,layers:bloom.layers,
          normal:[Math.sin(tilt)*Math.cos(heading),Math.cos(tilt),Math.sin(tilt)*Math.sin(heading)],
          centerScale:bloom.center,hue:parameters.flowerHue,saturation:parameters.flowerSaturation,brightness:parameters.flowerBrightness,
          begin:Math.max(.69,flowerParent.begin+flowerParent.duration)+(clustered?range(0,.015):0),
          duration:clustered?.18:.25});
      }
    }
  }
  for(let i=0;i<parameters.primaryStems;i++) stem([0,0,0],parameters.height*range(.78,1),form==='tree'?range(.015,.09):form==='bush'?range(.85,1.2):range(.04,.42),form==='bush'?i/parameters.primaryStems*Math.PI*2+range(-.2,.2):range(0,Math.PI*2),radius*parameters.height*range(.8,1.1),0);
  if(treeForm==='columnar') {
    // Stretch vertically without widening the crown; progressively narrow its top.
    const heightMultiplier=range(1.5,2);
    const crownHeight=Math.max(...parts.filter(p=>p.kind==='stem').map(p=>p.end[1]));
    const taperAt=y=>.95*(1-.25*Math.max(0,Math.min(1,y/crownHeight)));
    const transform=point=>{const taper=taperAt(point[1]);return [point[0]*taper,point[1]*heightMultiplier,point[2]*taper];};
    for(const part of parts) {
      const parent=part.parent===null?null:parts[part.parent];
      // Process original coordinates in a second pass so parent data stays intact.
      if(part.kind==='foliage') {
        const y=parent.start[1]+(parent.end[1]-parent.start[1])*part.attachment;
        const taper=taperAt(y);part.scale=[part.scale[0]*taper,part.scale[1]*heightMultiplier,part.scale[2]*taper];
        part.shape='spire';
      }
    }
    for(const part of parts) {
      const parent=part.parent===null?null:parts[part.parent];
      if(part.start)part.start=parent?point(parent.start,parent.end,part.attachment):transform(part.start);
      if(part.end)part.end=transform(part.end);
      if(part.position)part.position=parent?point(parent.start,parent.end,part.attachment):transform(part.position);
    }
    parameters.heightMultiplier=heightMultiplier;parameters.height*=heightMultiplier;
  }
  return {seed,parameters,parts};
}
export function growthAmount(part, ageSeconds) {
  const t = Math.max(0,Math.min(1,(ageSeconds/GROWTH_SECONDS-part.begin)/part.duration));
  return t*t*(3-2*t);
}
export function componentPose(structure, ageSeconds) {
  const endpoints=[], poses=[];
  for(const part of structure.parts) {
    const parent=part.parent===null?null:structure.parts[part.parent];
    const anchor=parent ? parent.start.map((v,i)=>mix(v,endpoints[parent.id][i],part.attachment)) : part.start;
    const growth=growthAmount(part,ageSeconds);
    if(part.kind==='stem') {
      const end=part.end.map((v,i)=>anchor[i]+(v-part.start[i])*growth);
      endpoints[part.id]=end; poses.push({anchor,end,growth});
    } else poses.push({anchor,growth});
  }
  return poses;
}
