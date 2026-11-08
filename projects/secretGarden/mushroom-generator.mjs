export const MUSHROOM_FORMS=['bolete','fly-agaric','chanterelle'];
export function generateMushrooms(random){
 const range=(a,b)=>a+(b-a)*random(),integer=(a,b)=>Math.floor(range(a,b+1));
 const mushroomForm=MUSHROOM_FORMS[integer(0,2)],count=random()<.45?1:integer(2,5);
 const varyUnit=(value,amount)=>{const v=value+range(-amount,amount);return v<0?-v:v>1?2-v:v;};
 const parameters={form:'mushroom',mushroomForm,count,flowers:false,height:range(.10,.30),capHue:random(),capSaturation:random(),capBrightness:range(.20,1)};
 const parts=[],add=p=>{p.id=parts.length;parts.push(p);return p;},phase=range(0,Math.PI*2);
 for(let i=0;i<count;i++){
  const size=range(.48,1.48),height=parameters.height*size;
  const angle=phase+i*2.399963,distance=count===1?0:Math.sqrt(i)*(parameters.height*.95+.06)*.5;
  const start=[Math.cos(angle)*distance,0,Math.sin(angle)*distance],lean=range(.0,.12),heading=range(0,Math.PI*2);
  const direction=[Math.sin(lean)*Math.cos(heading),Math.cos(lean),Math.sin(lean)*Math.sin(heading)],end=start.map((v,j)=>v+direction[j]*height);
  const stem=add({kind:'stem',parent:null,attachment:1,start,end,radius:height*(mushroomForm==='bolete'?.17:.085),taper:.58,hue:range(.10,.15),light:range(.65,.78),begin:range(0,.12),duration:.45});
  const radius=height*(mushroomForm==='chanterelle'?range(.41,.75):range(.42,.85));
  const cap={kind:'foliage',shape:'mushroom-'+mushroomForm,parent:stem.id,attachment:1,scale:[radius,radius,radius],direction,yaw:range(0,Math.PI*2),hue:(parameters.capHue+range(-.07,.07)+1)%1,saturation:varyUnit(parameters.capSaturation,.18),brightness:Math.max(.20,varyUnit(parameters.capBrightness,.20)),begin:stem.begin+stem.duration,duration:.3};add(cap);
  if(mushroomForm==='fly-agaric')add({...cap,shape:'mushroom-spots',scale:[...cap.scale],hue:.12,brightness:.92,saturation:.12});
 }
 return {parameters,parts};
}
