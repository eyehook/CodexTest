const STEP=1/120;
export const LEADER_LENGTH=.25,HOOK_OFFSET_X=.012,HOOK_OFFSET_Y=-.047,HOOK_LENGTH=Math.hypot(HOOK_OFFSET_X,HOOK_OFFSET_Y);
// Four points: bobber attachment, leader joint, hook eye, hook bend/mass.
// The bobber drives this lightweight chain; hook load does not alter casting yet.
export class LeaderPhysics {
 constructor(water=null){this.water=water;this.position=new Float64Array(12);this.previous=new Float64Array(12);this.target=new Float64Array(3);this.initialized=false;this.accumulator=0;}
 reset(x,y,z){
  for(let i=0;i<4;i++){const j=i*3;this.position[j]=x+(i===3?HOOK_OFFSET_X:0);this.position[j+1]=y-Math.min(i,2)*LEADER_LENGTH/2+(i===3?HOOK_OFFSET_Y:0);this.position[j+2]=z;}
  this.previous.set(this.position);this.target.set([x,y,z]);this.accumulator=0;this.initialized=true;
 }
 update(x,y,z,dt){
  if(!this.initialized||Math.hypot(x-this.target[0],y-this.target[1],z-this.target[2])>3){this.reset(x,y,z);return;}
  if(dt<=0)return;
  dt=Math.min(.05,dt);const before=this.accumulator;this.accumulator+=dt;
  const steps=Math.min(6,Math.floor((this.accumulator+1e-12)/STEP));
  for(let i=0;i<steps;i++){
   const a=Math.min(1,(STEP-before+i*STEP)/dt);
   this.step(this.target[0]+(x-this.target[0])*a,this.target[1]+(y-this.target[1])*a,this.target[2]+(z-this.target[2])*a);this.accumulator-=STEP;
  }
  this.accumulator=Math.max(0,this.accumulator);this.target[0]=x;this.target[1]=y;this.target[2]=z;
 }
 step(x,y,z){
  const p=this.position,old=this.previous,water=this.water?this.water():-Infinity;
  for(let i=1;i<4;i++){
   const j=i*3,drag=Math.exp(-(p[j+1]<water?10:.8)*STEP);
   for(let k=0;k<3;k++){const current=p[j+k];p[j+k]+=(current-old[j+k])*drag+(k===1?-9.81*STEP*STEP:0);old[j+k]=current;}
  }
  p[0]=x;p[1]=y;p[2]=z;
  for(let iteration=0;iteration<24;iteration++)for(let i=0;i<3;i++){
   const a=i*3,b=a+3,dx=p[b]-p[a],dy=p[b+1]-p[a+1],dz=p[b+2]-p[a+2],d=Math.hypot(dx,dy,dz),rest=i===2?HOOK_LENGTH:LEADER_LENGTH/2;
   if(d<1e-12||(i<2&&d<=rest))continue;
   const wa=i===0?0:i===1?10:4,wb=i===0?10:i===1?4:1,error=(d-rest)/d/(wa+wb);
   p[a]+=dx*error*wa;p[a+1]+=dy*error*wa;p[a+2]+=dz*error*wa;p[b]-=dx*error*wb;p[b+1]-=dy*error*wb;p[b+2]-=dz*error*wb;
  }
 }
}
