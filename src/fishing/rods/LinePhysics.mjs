export const LINE_STEP=1/120,LINE_SEGMENTS=8,MAX_LINE_LENGTH=38.1,REEL_MIN_SPEED=0.5,REEL_MAX_SPEED=10,REEL_ACCELERATION=(REEL_MAX_SPEED-REEL_MIN_SPEED)/5;
// Position-based rope: a moving pinned tip, light line nodes, and a heavier bobber.
// All positions/previous positions are Float64 world coordinates, retaining inertia
// across camera-relative terrain rebasing and making line payout possible later.
export class LinePhysics {
 constructor(length=0.8,{surface=null,radius=0.045}={}){
  this.homeLength=length;this.length=length;this.surface=surface;this.radius=radius;this.phase='ready';this.landed=false;this.triggerHeld=false;this.reelTime=0;this.reelSpeed=0;this.velocity=new Float64Array(3);this.position=new Float64Array((LINE_SEGMENTS+1)*3);this.previous=new Float64Array(this.position.length);this.target=new Float64Array(3);this.accumulator=0;this.initialized=false;
 }
 reset(x,y,z){
  this.phase='ready';this.landed=false;this.reelTime=0;this.reelSpeed=0;this.length=this.homeLength;this.velocity.fill(0);
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
  // A render frame can end between fixed ticks; enforce the cap against the
  // current tip too, rather than its slightly older interpolated physics pose.
  if(this.phase==='cast'||this.phase==='reeling')this.limitLine(x,y,z);
 }
 synchronizeTrigger(pressed){
  this.triggerHeld=pressed;
  if(this.phase==='armed')this.phase='ready';
  if(this.phase==='reeling'){this.phase='cast';this.reelTime=this.reelSpeed=0;}
 }
 setTrigger(pressed){
  // Retrieval follows the held state, not repeated trigger edges.
  if(this.phase==='cast'&&pressed){this.phase='reeling';this.reelTime=0;this.reelSpeed=REEL_MIN_SPEED;}
  else if(this.phase==='reeling'&&!pressed){this.phase='cast';this.reelTime=this.reelSpeed=0;if(this.landed)this.velocity.fill(0);}
  else if(pressed&&!this.triggerHeld&&this.phase==='ready')this.phase='armed';
  else if(!pressed&&this.triggerHeld&&this.phase==='armed'){
   this.bobberVelocity(this.velocity);this.phase='cast';this.landed=false;
  }
  this.triggerHeld=pressed;
 }
 limitLine(x,y,z){
  const p=this.position,j=LINE_SEGMENTS*3,dx=p[j]-x,dy=p[j+1]-y,dz=p[j+2]-z,distance=Math.hypot(dx,dy,dz);
  if(distance<=MAX_LINE_LENGTH)return;
  const nx=dx/distance,ny=dy/distance,nz=dz/distance;
  p[j]=x+nx*MAX_LINE_LENGTH;p[j+1]=y+ny*MAX_LINE_LENGTH;p[j+2]=z+nz*MAX_LINE_LENGTH;
  const outward=this.velocity[0]*nx+this.velocity[1]*ny+this.velocity[2]*nz;
  if(outward>0){this.velocity[0]-=nx*outward;this.velocity[1]-=ny*outward;this.velocity[2]-=nz*outward;}
  this.landed=false;
 }
 // Find the first surface crossed, even if a fast cast passes through a narrow ridge.
 collide(ax,ay,az,bx,by,bz){
  if(!this.surface)return false;
  const steps=Math.max(1,Math.ceil(Math.hypot(bx-ax,bz-az)/0.25));let previous=0;
  for(let i=0;i<=steps;i++){
   const t=i/steps,x=ax+(bx-ax)*t,y=ay+(by-ay)*t,z=az+(bz-az)*t;
   if(y<=this.surface(x,z)+this.radius){
    let low=previous,high=t;
    for(let j=0;j<20;j++){const m=(low+high)/2,mx=ax+(bx-ax)*m,mz=az+(bz-az)*m;if(ay+(by-ay)*m<=this.surface(mx,mz)+this.radius)high=m;else low=m;}
    const k=LINE_SEGMENTS*3,p=this.position;p[k]=ax+(bx-ax)*high;p[k+2]=az+(bz-az)*high;p[k+1]=this.surface(p[k],p[k+2])+this.radius;
    this.velocity.fill(0);this.landed=true;return true;
   }
   previous=t;
  }
  return false;
 }
 step(x,y,z){
  const p=this.position,old=this.previous,end=LINE_SEGMENTS*3,out=this.phase==='cast'||this.phase==='reeling';
  if(out){
   const ax=p[end],ay=p[end+1],az=p[end+2];
   if(this.phase==='reeling'){
    const startSpeed=Math.min(REEL_MAX_SPEED,REEL_MIN_SPEED+REEL_ACCELERATION*this.reelTime);
    this.reelTime+=LINE_STEP;this.reelSpeed=Math.min(REEL_MAX_SPEED,REEL_MIN_SPEED+REEL_ACCELERATION*this.reelTime);
    const travel=(startSpeed+this.reelSpeed)*0.5*LINE_STEP,dx=x-ax,dz=z-az,horizontal=Math.hypot(dx,dz),targetY=y-this.homeLength;
    if(Math.hypot(ax-x,ay-y,az-z)<=this.homeLength+0.04||Math.hypot(dx,targetY-ay,dz)<=travel+0.005){this.reset(x,y,z);return;}
    const onSurface=this.surface&&(this.landed||ay<=this.surface(ax,az)+this.radius+0.005);
    const pull=horizontal>1e-9?Math.min(1,travel/horizontal):0;
    p[end]=ax+dx*pull;p[end+2]=az+dz*pull;
    // The reel pulls across the surface; airborne bobbers still fall under gravity.
    this.velocity[1]-=9.81*LINE_STEP;
    const lifting=horizontal<=this.homeLength&&targetY>ay;
    if(lifting){
     // Close to the rod, winch tension supports the bobber's weight and lifts it
     // back to its hanging position instead of dragging it through the shore.
     const desired=Math.min(this.reelSpeed,(targetY-ay)/LINE_STEP);
     this.velocity[1]+=9.81*LINE_STEP;
     this.velocity[1]=desired+(this.velocity[1]-desired)*Math.exp(-8*LINE_STEP);
    }
    p[end+1]=ay+this.velocity[1]*LINE_STEP;
    this.landed=false;
    if(this.surface){
     const floor=this.surface(p[end],p[end+2])+this.radius;
     if((onSurface&&!lifting)||p[end+1]<=floor){p[end+1]=floor;this.velocity[1]=0;this.landed=true;}
    }
    this.velocity[0]=(p[end]-ax)/LINE_STEP;this.velocity[2]=(p[end+2]-az)/LINE_STEP;
   }else if(!this.landed){
    const decay=Math.exp(-0.05*LINE_STEP),travel=(1-decay)/0.05;
    const bx=ax+this.velocity[0]*travel,by=ay+this.velocity[1]*travel-0.5*9.81*LINE_STEP*LINE_STEP,bz=az+this.velocity[2]*travel;
    this.velocity[0]*=decay;this.velocity[1]=this.velocity[1]*decay-9.81*LINE_STEP;this.velocity[2]*=decay;
    if(!this.collide(ax,ay,az,bx,by,bz)){p[end]=bx;p[end+1]=by;p[end+2]=bz;}
   }
   this.limitLine(x,y,z);
   const distance=Math.hypot(p[end]-x,p[end+1]-y,p[end+2]-z);
   this.length=Math.min(MAX_LINE_LENGTH,this.phase==='reeling'?Math.max(this.homeLength,distance+0.025):Math.max(this.length,distance+0.05));
   for(let k=0;k<3;k++)old[end+k]=p[end+k]-this.velocity[k]*LINE_STEP;
  }
  const decay=Math.exp(-0.35*LINE_STEP),rest=this.length/LINE_SEGMENTS;
  for(let i=1;i<=(out?LINE_SEGMENTS-1:LINE_SEGMENTS);i++)for(let k=0;k<3;k++){
   const j=i*3+k,current=p[j];p[j]+=(current-old[j])*decay+(k===1?-9.81*LINE_STEP*LINE_STEP:0);old[j]=current;
  }
  p[0]=x;p[1]=y;p[2]=z;
  for(let iteration=0;iteration<24;iteration++)for(let i=0;i<LINE_SEGMENTS;i++){
   const a=i*3,b=a+3,dx=p[b]-p[a],dy=p[b+1]-p[a+1],dz=p[b+2]-p[a+2],distance=Math.hypot(dx,dy,dz);
   if(distance<=rest)continue;
   const wa=i===0?0:10,wb=i+1===LINE_SEGMENTS?(out?0:1):10,sum=wa+wb;
   if(!sum)continue;
   const error=(distance-rest)/distance/sum;
   p[a]+=dx*error*wa;p[a+1]+=dy*error*wa;p[a+2]+=dz*error*wa;
   p[b]-=dx*error*wb;p[b+1]-=dy*error*wb;p[b+2]-=dz*error*wb;
  }
 }
 bobberVelocity(out){const j=LINE_SEGMENTS*3;for(let k=0;k<3;k++)out[k]=(this.position[j+k]-this.previous[j+k])/LINE_STEP;return out;}
}
