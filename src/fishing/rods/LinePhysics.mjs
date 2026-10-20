export const LINE_STEP=1/120,LINE_SEGMENTS=8;
// Position-based rope: a moving pinned tip, light line nodes, and a heavier bobber.
// All positions/previous positions are Float64 world coordinates, retaining inertia
// across camera-relative terrain rebasing and making line payout possible later.
export class LinePhysics {
 constructor(length=0.8){
  this.length=length;this.position=new Float64Array((LINE_SEGMENTS+1)*3);this.previous=new Float64Array(this.position.length);this.target=new Float64Array(3);this.accumulator=0;this.initialized=false;
 }
 reset(x,y,z){
  for(let i=0;i<=LINE_SEGMENTS;i++){const j=i*3;this.position[j]=x;this.position[j+1]=y-this.length*i/LINE_SEGMENTS;this.position[j+2]=z;}
  this.previous.set(this.position);this.target[0]=x;this.target[1]=y;this.target[2]=z;this.accumulator=0;this.initialized=true;
 }
 update(x,y,z,dt){
  if(!this.initialized||Math.hypot(x-this.target[0],y-this.target[1],z-this.target[2])>3){this.reset(x,y,z);return;}
  if(dt<=0)return;
  dt=Math.min(dt,0.05);const oldAccumulator=this.accumulator;this.accumulator+=dt;
  const steps=Math.min(6,Math.floor((this.accumulator+1e-12)/LINE_STEP));
  for(let i=0;i<steps;i++){
   const alpha=Math.min(1,(LINE_STEP-oldAccumulator+i*LINE_STEP)/dt);
   this.step(this.target[0]+(x-this.target[0])*alpha,this.target[1]+(y-this.target[1])*alpha,this.target[2]+(z-this.target[2])*alpha);
   this.accumulator-=LINE_STEP;
  }
  this.accumulator=Math.max(0,this.accumulator);this.target[0]=x;this.target[1]=y;this.target[2]=z;
 }
 step(x,y,z){
  const p=this.position,old=this.previous,decay=Math.exp(-0.35*LINE_STEP),rest=this.length/LINE_SEGMENTS;
  for(let i=1;i<=LINE_SEGMENTS;i++)for(let k=0;k<3;k++){
   const j=i*3+k,current=p[j];p[j]+=(current-old[j])*decay+(k===1?-9.81*LINE_STEP*LINE_STEP:0);old[j]=current;
  }
  p[0]=x;p[1]=y;p[2]=z;
  for(let iteration=0;iteration<24;iteration++)for(let i=0;i<LINE_SEGMENTS;i++){
   const a=i*3,b=a+3,dx=p[b]-p[a],dy=p[b+1]-p[a+1],dz=p[b+2]-p[a+2],distance=Math.hypot(dx,dy,dz);
   // A string pulls when taut but never pushes when slack.
   if(distance<=rest)continue;
   const wa=i===0?0:10,wb=i+1===LINE_SEGMENTS?1:10,error=(distance-rest)/distance/(wa+wb);
   p[a]+=dx*error*wa;p[a+1]+=dy*error*wa;p[a+2]+=dz*error*wa;
   p[b]-=dx*error*wb;p[b+1]-=dy*error*wb;p[b+2]-=dz*error*wb;
  }
 }
 bobberVelocity(out){const j=LINE_SEGMENTS*3;for(let k=0;k<3;k++)out[k]=(this.position[j+k]-this.previous[j+k])/LINE_STEP;return out;}
}
