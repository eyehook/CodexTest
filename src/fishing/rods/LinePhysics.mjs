export const LINE_STEP=1/120,LINE_SEGMENTS=12,MIN_LINE_LENGTH=0.6096,AUTO_REEL_LENGTH=2,MAX_LINE_SLACK=.1524,SLACK_TAKEUP_TIME=1,MAX_LINE_LENGTH=38.1,REEL_MIN_SPEED=0.5,REEL_MAX_SPEED=10,REEL_ACCELERATION=(REEL_MAX_SPEED-REEL_MIN_SPEED)/5;
// Position-based rope: a moving pinned tip, light line nodes, and a heavier bobber.
// All positions/previous positions are Float64 world coordinates, retaining inertia
// across camera-relative terrain rebasing and making line payout possible later.
export class LinePhysics {
 constructor(length=MIN_LINE_LENGTH,{surface=null,water=null,radius=0.045}={}){
  this.autoReel=false;this.slackRemaining=0;this.dipTime=0;this.dipDepth=0;this.resetCount=0;this.completedRetrievals=0;this.settleTime=-1;this.spoolOpen=false;this.triggerAction=null;this.deployed=false;this.water=water;this.tension=0;this.spoolSpeed=0;this.homeLength=length;this.length=length;this.surface=surface;this.radius=radius;this.phase='ready';this.landed=false;this.triggerHeld=false;this.reelTime=0;this.reelSpeed=0;this.velocity=new Float64Array(3);this.position=new Float64Array((LINE_SEGMENTS+1)*3);this.previous=new Float64Array(this.position.length);this.target=new Float64Array(3);this.accumulator=0;this.initialized=false;
 }
 reset(x,y,z){
  this.autoReel=false;this.slackRemaining=0;this.dipTime=0;this.dipDepth=0;this.resetCount++;
  this.settleTime=-1;this.spoolOpen=false;this.triggerAction=null;this.deployed=false;this.phase='ready';this.landed=false;this.tension=0;this.spoolSpeed=0;this.reelTime=0;this.reelSpeed=0;this.length=this.homeLength;this.velocity.fill(0);
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
  this.triggerHeld=pressed;this.triggerAction=null;
  this.phase=this.length<=this.homeLength?'ready':this.autoReel?'reeling':'cast';
  this.reelTime=this.reelSpeed=0;
 }
 setTrigger(pressed){
  if(pressed&&!this.triggerHeld){
   // Latch the action once, from the paid-out length at the start of the press.
   this.triggerAction=this.length<=this.homeLength+1e-9?'cast':'reel';
   if(this.triggerAction==='cast'){this.settleTime=-1;this.spoolOpen=false;this.phase='armed';}
   else {this.spoolOpen=false;this.phase='reeling';this.reelTime=0;this.reelSpeed=REEL_MIN_SPEED;}
  }else if(!pressed&&this.triggerHeld){
   if(this.triggerAction==='cast'){
    this.bobberVelocity(this.velocity);this.autoReel=false;this.slackRemaining=0;this.spoolOpen=true;this.deployed=true;this.phase='cast';this.landed=false;
   }else this.phase=this.length<=this.homeLength?'ready':this.autoReel?'reeling':'cast';
   this.triggerAction=null;if(!this.autoReel)this.reelTime=this.reelSpeed=0;
  }
  this.triggerHeld=pressed;
 }
 trimSlack(distance,dt){
  const target=Math.max(this.homeLength,distance+MAX_LINE_SLACK),excess=Math.max(0,this.length-target);
  if(excess<=1e-9){this.slackRemaining=0;return;}
  if(this.slackRemaining<=0)this.slackRemaining=SLACK_TAKEUP_TIME;
  this.length-=excess*Math.min(1,dt/this.slackRemaining);
  this.slackRemaining=Math.max(0,this.slackRemaining-dt);
 }
 dip(depth){this.dipFloor=this.position[LINE_SEGMENTS*3+1]-depth;this.dipDepth=depth;this.dipTime=depth>.05?1.2:.75;}
 settlingDamping(){
  // Retrieval and the fully retrieved line retain settling damping. Arming
  // and the open casting spool always bypass it, even before line pays out.
  if(this.phase==='armed'||this.spoolOpen)return 0;
  if(this.phase==='reeling'||this.length<=this.homeLength+1e-9)
   return 3*(1-Math.min(1,Math.max(0,this.length-this.homeLength)/2))**2;
  return 0;
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
    this.velocity[0]*=0.92;this.velocity[1]=0;this.velocity[2]*=0.92;this.landed=true;return true;
   }
   previous=t;
  }
  return false;
 }
 step(x,y,z){
  const p=this.position,old=this.previous,end=LINE_SEGMENTS*3,out=this.deployed||this.phase==='cast'||this.phase==='reeling';
  if(out){
   this.deployed=true;
   const ax=p[end],ay=p[end+1],az=p[end+2],h=LINE_STEP;
   const actualWater=this.water?this.water():-Infinity;
   // Close casts may finish automatically after landing, never in flight.
   const onWater=ay<=actualWater+this.radius&&(!this.surface||this.surface(ax,az)<actualWater-this.radius);
   if(this.phase==='cast'&&this.length>this.homeLength&&this.length<AUTO_REEL_LENGTH&&(!this.spoolOpen||onWater)){
    this.autoReel=true;this.spoolOpen=false;this.phase='reeling';this.reelTime=0;this.reelSpeed=REEL_MIN_SPEED;
   }
   if(this.phase==='reeling'){
    if(this.length<AUTO_REEL_LENGTH)this.autoReel=true;
    // Taper the final 2 metres quadratically, retaining a small speed so retrieval
    // reaches the minimum rather than approaching it forever.
    const remaining=Math.max(0,this.length-this.homeLength);
    const ramp=Math.min(REEL_MAX_SPEED,REEL_MIN_SPEED+REEL_ACCELERATION*this.reelTime);
    const startSpeed=Math.min(ramp,Math.max(0.30,ramp*Math.min(1,remaining/2)**2));
    this.reelTime+=h;
    const nextRamp=Math.min(REEL_MAX_SPEED,REEL_MIN_SPEED+REEL_ACCELERATION*this.reelTime);
    this.reelSpeed=Math.min(nextRamp,Math.max(0.30,nextRamp*Math.min(1,remaining/2)**2));
    const previousLength=this.length;
    this.length=Math.max(this.homeLength,this.length-(startSpeed+this.reelSpeed)*0.5*h);
    if(previousLength>this.homeLength&&this.length<=this.homeLength)this.completedRetrievals++;
    this.spoolSpeed=0;
    // Stop winding at minimum length without resetting any particle or velocity.
    if(this.length<=this.homeLength){this.autoReel=false;this.phase='ready';this.settleTime=0.8;this.reelTime=this.reelSpeed=0;}
   }
   // A light bobber floats mostly above water. Strong immersion drag absorbs
   // impact momentum while buoyancy returns it naturally, without a depth clamp.
   // A short fish pull lowers the buoyancy equilibrium; normal buoyancy brings
   // it back up afterward. Collisions and line tension still constrain motion.
   const hold=this.dipDepth>.05?.6:.25;
   const duration=this.dipDepth>.05?1.2:.75;
   const age=duration-this.dipTime;
   const pull=this.dipTime>0&&age<hold?this.dipDepth:0;
   this.dipTime=Math.max(0,this.dipTime-h);
   const water=actualWater-pull;
   const depth=Math.max(0,Math.min(2*this.radius,water-ay+this.radius));
   const q=depth/this.radius,immersed=q*q*(3-q)/4;
   if(this.settleTime>=0&&this.phase==='ready')this.settleTime+=h;
   const settling=this.settlingDamping();
   const drag=Math.exp(-(0.05+immersed*120+settling)*h);
   this.velocity[0]*=drag;this.velocity[2]*=drag;
   this.velocity[1]=(this.velocity[1]+9.81*(8*immersed-1)*h)*drag;
   const bx=ax+this.velocity[0]*h,bz=az+this.velocity[2]*h;
   let by=ay+this.velocity[1]*h;
   if(pull>0&&by<this.dipFloor){by=this.dipFloor;if(this.velocity[1]<0)this.velocity[1]=0;}
   this.landed=false;
   if(!this.collide(ax,ay,az,bx,by,bz)){p[end]=bx;p[end+1]=by;p[end+2]=bz;}
   const dx=p[end]-x,dy=p[end+1]-y,dz=p[end+2]-z,distance=Math.hypot(dx,dy,dz);
   // A general slack allowance applies in air, on water, and while retrieving.
   // Only surplus line is wound, so this never adds inward bobber tension.
   this.trimSlack(distance,h);
   const nx=dx/(distance||1),ny=dy/(distance||1),nz=dz/(distance||1);
   // Tension responds to motion relative to the rod tip, transferring a new
   // controller swing into bobber momentum even after a previous retrieval.
   const radial=(this.velocity[0]-(x-p[0])/h)*nx+(this.velocity[1]-(y-p[1])/h)*ny+(this.velocity[2]-(z-p[2])/h)*nz;
   // An open spool pays out only when the bobber exhausts the available slack.
   // Small spool resistance slows the cast without manufacturing extra line.
   if(this.phase==='cast'&&this.spoolOpen&&distance>this.length&&this.length<MAX_LINE_LENGTH&&radial>0){
    this.spoolSpeed=Math.max(0,radial-0.35*h);
    this.length=Math.min(MAX_LINE_LENGTH,this.length+Math.min(distance-this.length,this.spoolSpeed*h));
   }else this.spoolSpeed=0;
   const stretch=Math.max(0,distance-this.length);
   let load=0;
   if(stretch>0){
    p[end]-=nx*stretch;p[end+1]-=ny*stretch;p[end+2]-=nz*stretch;
    // Constraint impulse changes velocity as well as position. Reeling winds
    // the spool, and the taut line supplies the inward pull (slack supplies none).
    const desired=this.phase==='reeling'?-this.reelSpeed:this.spoolSpeed;
    const impulse=Math.max(0,radial-desired);
    this.velocity[0]-=nx*impulse;this.velocity[1]-=ny*impulse;this.velocity[2]-=nz*impulse;
    load=impulse/h;
   }
   // Resolve terrain contact after the line impulse, including shore retrieval.
   if(this.surface){const floor=this.surface(p[end],p[end+2])+this.radius;if(p[end+1]<floor){p[end+1]=floor;if(this.velocity[1]<0)this.velocity[1]=0;this.landed=true;}}
   this.tension+=(Math.min(1,load/60)-this.tension)*(1-Math.exp(-12*h));
   for(let k=0;k<3;k++)old[end+k]=p[end+k]-this.velocity[k]*h;
  }
  const settling=this.settlingDamping();
  const decay=Math.exp(-(0.35+settling)*LINE_STEP),rest=this.length/LINE_SEGMENTS;
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
