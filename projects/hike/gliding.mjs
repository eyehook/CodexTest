// Arcade flight in world-space floor coordinates. Angles are radians.
export const GLIDE_DEFAULTS=Object.freeze({launchHeight:.9,launchSpeed:4,minSpeed:2,maxSpeed:60,gravity:9.81,climbDeceleration:.5,drag:.018,glideRatio:8,tiltDeadZone:2.5*Math.PI/180,pitchDeadZone:5*Math.PI/180,maxTurnRate:Math.PI/3,tiltGain:4.5,turnResponse:4,pitchResponse:2.5,maxPitchRate:45*Math.PI/180,maxClimb:35*Math.PI/180,maxDive:65*Math.PI/180,stallSpeed:3,fullLiftSpeed:7,stallDive:25*Math.PI/180,bankMax:0,bankResponse:5,bankEnabled:true,maxDelta:.05,maxStep:1/120,collisionStep:.25});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
const ease=(x,a,b)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export class Glider {
 constructor(world,options={}){this.world=world;this.settings={...GLIDE_DEFAULTS,...options};this.position={x:0,y:0,z:0};this.velocity={x:0,y:0,z:0};this.landingVelocity={x:0,z:0};this.reset();}
 reset(){this.landingVelocity.x=this.landingVelocity.z=0;this.active=false;this.landed=false;this.velocity.x=this.velocity.y=this.velocity.z=0;this.heading=0;this.pathPitch=0;this.turnRate=0;this.bank=0;this.boostTime=0;}
 get speed(){const v=this.velocity;return Math.hypot(v.x,v.y,v.z);}
 launch(x,y,z,headYaw,vx=0,vz=0,groundRiseSpeed=0){
  if(this.active)return false;
  const c=this.settings,v=this.velocity,p=this.position,ground=this.world.height(x,z),horizontal=Math.hypot(vx,vz);
  if(horizontal<.05){vx=-Math.sin(headYaw)*c.launchSpeed;vz=-Math.cos(headYaw)*c.launchSpeed;}
  else {const scale=clamp(horizontal,c.launchSpeed,c.maxSpeed)/horizontal;vx*=scale;vz*=scale;}
  const impulse=Math.sqrt(2*c.gravity*c.launchHeight),rise=clamp(groundRiseSpeed,0,Math.hypot(vx,vz)*.5);
  v.x=vx;v.z=vz;v.y=impulse+rise;p.x=x;p.y=Math.max(y,ground)+.005;p.z=z;
  this.heading=Math.atan2(-vx,-vz);this.pathPitch=Math.atan2(v.y,Math.hypot(vx,vz));this.turnRate=0;this.bank=0;this.boostTime=impulse/c.gravity;this.active=true;this.landed=false;return true;
 }
 settle(dt){this.bankToward(dt,0);}
 bankToward(dt,target){
  const c=this.settings;if(!c.bankEnabled||c.bankMax<=0){this.bank=0;return;}
  this.bank+=(target-this.bank)*(1-Math.exp(-c.bankResponse*Math.max(0,dt)));if(Math.abs(this.bank)<1e-7)this.bank=0;
 }
 land(x,y,z){this.landingVelocity.x=this.velocity.x;this.landingVelocity.z=this.velocity.z;this.position.x=x;this.position.y=y;this.position.z=z;this.active=false;this.landed=true;this.velocity.x=this.velocity.y=this.velocity.z=0;this.turnRate=0;this.boostTime=0;}
 sweep(x0,y0,z0,x1,y1,z1){
  const world=this.world,mx=(x0+x1)/2,mz=(z0+z1)/2,my=(y0+y1)/2;
  // Short segments plus a midpoint catch terrain contact even in fast dives.
  let hi;if(my<=world.height(mx,mz))hi=.5;else if(y1<=world.height(x1,z1))hi=1;else return false;
  let lo=0;
  for(let i=0;i<12;i++){const t=(lo+hi)/2,x=x0+(x1-x0)*t,z=z0+(z1-z0)*t,y=y0+(y1-y0)*t;if(y<=world.height(x,z))hi=t;else lo=t;}
  const x=x0+(x1-x0)*hi,z=z0+(z1-z0)*hi;this.land(x,world.height(x,z),z);return true;
 }
 update(dt,x,y,z,headTilt,headPitch){
  this.landed=false;const p=this.position;if(!this.active)return p;
  p.x=x;p.y=y;p.z=z;if(!Number.isFinite(dt)||dt<=0)return p;
  const c=this.settings,v=this.velocity;
  const initialGround=this.world.height(x,z);if(y<initialGround-.001){this.land(x,initialGround,z);return p;}
  let remaining=Math.min(dt,c.maxDelta),steps=0;
  while(remaining>1e-8&&this.active&&steps++<64){
   const speed=this.speed,h=Math.min(remaining,c.maxStep,c.collisionStep/Math.max(1,speed),this.boostTime>1e-8?this.boostTime:Infinity),oldX=v.x,oldY=v.y,oldZ=v.z;
   const outside=Math.sign(headTilt)*Math.max(0,Math.abs(headTilt)-c.tiltDeadZone),targetRate=clamp(outside*c.tiltGain,-c.maxTurnRate,c.maxTurnRate);
   this.turnRate+=(targetRate-this.turnRate)*(1-Math.exp(-c.turnResponse*h));this.heading=wrap(this.heading+this.turnRate*h);
   if(this.boostTime>1e-8){
    const horizontal=Math.hypot(v.x,v.z),next=horizontal/(1+c.drag*horizontal*h);
    v.x=-Math.sin(this.heading)*next;v.z=-Math.cos(this.heading)*next;v.y-=c.gravity*h;this.boostTime=Math.max(0,this.boostTime-h);this.pathPitch=Math.atan2(v.y,next);
   }else{
    const pitchInput=Math.sign(headPitch)*Math.max(0,Math.abs(headPitch)-c.pitchDeadZone),requested=clamp(-Math.atan(1/c.glideRatio)+pitchInput,-c.maxDive,c.maxClimb),authority=ease(speed,c.stallSpeed,c.fullLiftSpeed),target=-c.stallDive*(1-authority)+requested*authority;
    const oldPitch=this.pathPitch,delta=(target-oldPitch)*(1-Math.exp(-c.pitchResponse*h));this.pathPitch+=clamp(delta,-c.maxPitchRate*h,c.maxPitchRate*h);
    // Arcade climb tuning halves the combined gravity/drag speed loss uphill.
    // Level flight and descent retain their original acceleration and drag.
    const midPitch=(oldPitch+this.pathPitch)/2,acceleration=(-c.gravity*Math.sin(midPitch)-c.drag*speed*speed)*(midPitch>0?c.climbDeceleration:1),next=clamp(speed+acceleration*h,c.minSpeed,c.maxSpeed),horizontal=next*Math.cos(this.pathPitch);
    v.x=-Math.sin(this.heading)*horizontal;v.y=next*Math.sin(this.pathPitch);v.z=-Math.cos(this.heading)*horizontal;
   }
   const nx=p.x+(oldX+v.x)*h/2,ny=p.y+(oldY+v.y)*h/2,nz=p.z+(oldZ+v.z)*h/2;
   if(!this.sweep(p.x,p.y,p.z,nx,ny,nz)){p.x=nx;p.y=ny;p.z=nz;}
   const targetBank=this.active?-c.bankMax*this.turnRate/Math.max(c.maxTurnRate,1e-6):0;this.bankToward(h,targetBank);remaining-=h;
  }
  return p;
 }
}

// Ground runout follows the authoritative floor, retaining horizontal impact
// momentum. Constant friction reaches exact rest in finite time.
export class LandingRunout {
 constructor(world,{friction=8}={}){this.world=world;this.friction=friction;this.velocity={x:0,z:0};this.position={x:0,y:0,z:0};this.reset();}
 reset(){this.active=false;this.velocity.x=this.velocity.z=0;}
 get speed(){return Math.hypot(this.velocity.x,this.velocity.z);}
 takeOver(requestedSpeed){
  if(this.active&&Number.isFinite(requestedSpeed)&&requestedSpeed>0&&requestedSpeed>=this.speed){this.reset();return true;}
  return false;
 }
 start(vx,vz){this.velocity.x=vx;this.velocity.z=vz;this.active=this.speed>0;}
 update(dt,x,z){
  const p=this.position,v=this.velocity;p.x=x;p.z=z;p.y=this.world.height(x,z);
  if(!this.active||!Number.isFinite(dt)||dt<=0)return p;
  const speed=this.speed,friction=Math.max(.01,this.friction),h=Math.min(dt,.05,speed/friction),next=Math.max(0,speed-friction*h),distance=(speed+next)*h/2,dx=v.x/speed,dz=v.z/speed;
  const steps=Math.max(1,Math.ceil(distance/.25));
  for(let i=0;i<steps;i++){p.x=x+dx*distance*(i+1)/steps;p.z=z+dz*distance*(i+1)/steps;p.y=this.world.height(p.x,p.z);}
  v.x=dx*next;v.z=dz*next;if(next<1e-8)this.reset();return p;
 }
}
