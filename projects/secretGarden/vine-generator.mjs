import {flowerHue} from './flower-colors.mjs?v=82';
import {randomFor,MAX_COMPONENTS,BLOOM_FORMS} from './generator.mjs?v=82';

// Local XY is the support wall, +Z faces into the garden. The seed defines
// growth rules; bounds determine floor/top bends and the continuous wall perimeter.
export function generateVine(seed,bounds) {
  seed>>>=0;
  const rng=randomFor(seed),range=(a,b)=>a+(b-a)*rng();
  const parameters={form:'vine',surface:'wall',leafHue:range(.24,.38),leafLight:range(.24,.4),
    leafSize:range(.1,.17),flowers:rng()<.38,flowerHue:flowerHue(rng()),flowerSaturation:range(.3,1),flowerBrightness:range(.35,1)};
  const sphereForm=BLOOM_FORMS.findIndex(form=>form.volume);
  parameters.bloomShape=[0,1,2,sphereForm][Math.floor(rng()*4)];
  const parts=[];
  const add=p=>{if(parts.length>=MAX_COMPONENTS)return null;p.id=parts.length;parts.push(p);return p;};
  const width=bounds.maxX-bounds.minX,depth=bounds.wrapDepth;
  const wrapping=Number.isFinite(depth)&&depth>0;
  const perimeter=2*(width+depth);
  const fold=(u,y)=>{
    if(!wrapping)return {position:[u,y,0],yaw:0};
    const distance=((u-bounds.minX)%perimeter+perimeter)%perimeter;
    if(distance<width)return {position:[bounds.minX+distance,y,0],yaw:0};
    if(distance<width+depth)return {position:[bounds.maxX,y,distance-width],yaw:-Math.PI/2};
    if(distance<2*width+depth)return {position:[bounds.maxX-(distance-width-depth),y,depth],yaw:-Math.PI};
    return {position:[bounds.minX,y,depth-(distance-2*width-depth)],yaw:-Math.PI*1.5};
  };
  function cuts(a,b) {
    const result=[0,1];
    if(wrapping&&Math.abs(b-a)>1e-9){
      const lo=Math.min(a,b),hi=Math.max(a,b);
      for(let cycle=Math.floor((lo-bounds.minX)/perimeter)-1;cycle<=Math.floor((hi-bounds.minX)/perimeter)+1;cycle++)
        for(const offset of [0,width,width+depth,2*width+depth]){
          const corner=bounds.minX+cycle*perimeter+offset;
          if(corner>lo+1e-9&&corner<hi-1e-9)result.push((corner-a)/(b-a));
        }
    }
    return result.sort((a,b)=>a-b);
  }
  function obstacles(a,b){
    const result=[];
    for(const rect of bounds.exclusions??[]){
      const first=wrapping?Math.floor((Math.min(a,b)-rect.maxX)/perimeter):-1;
      const last=wrapping?Math.ceil((Math.max(a,b)-rect.minX)/perimeter):1;
      for(let cycle=wrapping?first:0;cycle<=(wrapping?last:0);cycle++)result.push({...rect,minX:rect.minX+(wrapping?cycle*perimeter:0),maxX:rect.maxX+(wrapping?cycle*perimeter:0)});
    }
    return result;
  }
  function crosses(a,b,rect){
    let entry=0,exit=1;
    for(const [axis,min,max] of [[0,rect.minX,rect.maxX],[1,rect.minY,rect.maxY]]){
      const delta=b[axis]-a[axis];
      if(Math.abs(delta)<1e-10){if(a[axis]<min||a[axis]>max)return false;}
      else {let near=(min-a[axis])/delta,far=(max-a[axis])/delta;if(near>far)[near,far]=[far,near];entry=Math.max(entry,near);exit=Math.min(exit,far);if(entry>exit)return false;}
    }
    return true;
  }
  function shoot(start,parent,steps,heading,begin,duration,branching) {
    let position=start,previous=parent;
    for(let i=0;i<steps;i++) {
      heading+=range(-.24,.24);
      const length=range(.16,.27);
      let dx=Math.sin(heading)*length,dy=Math.cos(heading)*length;
      // Redirect instead of continuing through the support boundary.
      if(position[1]+dy>bounds.maxY){dy=-Math.abs(dy)*.4;dx=(dx<0?-1:1)*length;}
      if(position[1]+dy<bounds.minY){dy=Math.abs(dy)+.04;dx*=.7;}
      if(!wrapping&&position[0]+dx>bounds.maxX)dx=-Math.abs(dx);
      if(!wrapping&&position[0]+dx<bounds.minX)dx=Math.abs(dx);
      for(const rect of obstacles(position[0],position[0]+dx)){
        if(!crosses(position,[position[0]+dx,position[1]+dy],rect))continue;
        if(position[0]>rect.minX&&position[0]<rect.maxX&&position[1]>rect.minY&&position[1]<rect.maxY)return;
        if(position[0]<=rect.minX||position[0]>=rect.maxX){dx=0;dy=Math.abs(dy)+.06;}
        else {dy=position[1]>=rect.maxY?Math.abs(dy)+.04:-Math.abs(dy)-.04;}
      }
      heading=Math.atan2(dx,dy);
      const end=[wrapping?position[0]+dx:Math.max(bounds.minX,Math.min(bounds.maxX,position[0]+dx)),Math.max(bounds.minY,Math.min(bounds.maxY,position[1]+dy)),0];
      const breaks=cuts(position[0],end[0]),segments=[];
      let node=previous;
      for(let j=1;j<breaks.length;j++){
        const t0=breaks[j-1],t1=breaks[j];
        const at=t=>fold(position[0]+(end[0]-position[0])*t,position[1]+(end[1]-position[1])*t).position;
        node=add({kind:'stem',parent:node?.id??null,attachment:1,start:at(t0),end:at(t1),radius:branching?.009:.005,taper:.58,
          begin:begin+(i+t0)/steps*duration,duration:duration/steps*(t1-t0)});
        if(!node)return;
        segments.push({node,t0,t1});
      }
      const leafBegin=node.begin+node.duration+.02;
      for(let side=0;side<2;side++) {
        const t=.45+side*.4,y=position[1]+(end[1]-position[1])*t,x=position[0]+(end[0]-position[0])*t;
        if(y-bounds.minY<.12||bounds.maxY-y<.12||!wrapping&&(x-bounds.minX<.14||bounds.maxX-x<.14))continue;
        const face=fold(x,y),segment=segments.find(s=>t<=s.t1)??segments.at(-1);
        const attachment=(t-segment.t0)/(segment.t1-segment.t0);
        add({kind:'leaf',parent:segment.node.id,attachment,position:face.position,size:parameters.leafSize*range(.8,1.25),shape:3,
          orientation:[0,face.yaw,-heading+(side?1:-1)*range(.7,1.25),'YXZ'],offset:[Math.sin(face.yaw)*.025,0,Math.cos(face.yaw)*.025],hue:parameters.leafHue,light:parameters.leafLight+range(-.04,.05),begin:leafBegin,duration:.12});
      }
      if(branching&&i>2&&i%5===0)shoot(end,node,6,heading+(rng()<.5?-1:1)*range(.7,1.2),node.begin+node.duration,.18,false);
      previous=node;position=end;
    }
    if(parameters.flowers&&previous&&position[1]-bounds.minY>.12&&bounds.maxY-position[1]>.12) {
      const face=fold(position[0],position[1]);
      const normal=[Math.sin(face.yaw),0,Math.cos(face.yaw)],reach=range(.06,.09);
      const tip=face.position.map((v,i)=>v+normal[i]*reach);
      const stalk=add({kind:'stem',role:'flower-stalk',parent:previous.id,attachment:1,start:face.position,end:tip,
        radius:.003,taper:.58,begin:Math.max(.65,previous.begin+previous.duration),duration:.06});
      if(!stalk)return;
      add({kind:'flower',parent:stalk.id,attachment:1,position:tip,yaw:range(0,6.283),normal,size:range(.045,.085),
        petals:5+Math.floor(rng()*3),layers:1,shape:parameters.bloomShape,volume:BLOOM_FORMS[parameters.bloomShape].volume??false,centerScale:.2,hue:parameters.flowerHue,saturation:parameters.flowerSaturation,brightness:parameters.flowerBrightness,
        begin:Math.max(.74,stalk.begin+stalk.duration),duration:.14});
    }
  }
  for(let i=0;i<3;i++)shoot([0,0,0],null,18+Math.floor(rng()*5),i===2?range(2.1,3.8):range(-.8,.8),0,.58,true);
  return {seed,parameters,bounds:{...bounds},parts};
}
