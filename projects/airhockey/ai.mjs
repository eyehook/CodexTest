import {C,clamp,constrain,limitVelocity} from './physics.mjs';
export function skillParameters(skill,out={}){const s=clamp(skill,0,100)/100;out.delay=.32-.28*s;out.speed=.55+2.45*s;out.acceleration=2.5+15.5*s;out.error=.23*(1-s)**2;out.shotError=.28*(1-s);out.quality=s;return out;}
export function predictX(x,vx,time){const w=C.width-2*C.puck,a=w/2;let u=((x+a+vx*time)%(2*w)+2*w)%(2*w);return (u>w?2*w-u:u)-a;}
export class Opponent {
  constructor(random=Math.random){this.random=random;this.params={};this.observation={};this.reset();}
  reset(){this.clock=0;this.tx=0;this.tz=-.9;this.mode='defend';this.shot=0;this.recover=0;}
  observe(p){Object.assign(this.observation,p);}
  decide(m){
    const p=this.observation,k=this.params;this.tx=p.x*.32;this.tz=-.94;this.mode='defend';
    const error=(this.random()*2-1)*k.error;
    if(p.vz<-.08){const t=clamp((-.94+C.mallet+C.puck-p.z)/p.vz,0,1.8);this.tx=predictX(p.x,p.vx,t)+error;this.mode='intercept';}
    if(p.z<-.12&&(Math.hypot(p.vx,p.vz)<.9||(p.vz>=-.1&&p.vz<1.2))&&this.recover<=0){
      this.mode='attack';
      // Approach behind the puck; then drive through toward a selected goal/bank line.
      if(m.z>p.z-.075){this.tx=p.x+(m.x<p.x?-.15:.15);this.tz=p.z-.17;}
      else {const aim=this.shot-p.x;this.tx=p.x-aim*.07+error;this.tz=p.z+.13;}
    }
    if(this.recover>0)this.mode='recover';
    this.tx+=error;const target=this.target??(this.target={x:0,z:0});target.x=this.tx;target.z=this.tz;constrain(target,-1);this.tx=target.x;this.tz=target.z;
  }
  update(dt,p,m,skill){
    const k=skillParameters(skill,this.params);this.clock-=dt;this.recover-=dt;
    if(this.clock<=0){this.clock=k.delay;this.observe(p);this.shot=(this.random()<.5?-.145:.145)*k.quality+(this.random()*2-1)*k.shotError;if(this.random()<k.quality*.22)this.shot=(p.x>0?-1:1)*C.width;this.decide(m);}
    if(this.mode==='attack'&&p.vz>1.2){this.recover=.22;this.tx=0;this.tz=-.94;this.mode='recover';}
    m.px=m.x;m.pz=m.z;
    const dx=this.tx-m.x,dz=this.tz-m.z,d=Math.hypot(dx,dz),speed=Math.min(k.speed,Math.sqrt(2*k.acceleration*d)),vx=d>.001?dx/d*speed:0,vz=d>.001?dz/d*speed:0;
    const ax=vx-m.vx,az=vz-m.vz,ad=Math.hypot(ax,az),f=ad?Math.min(1,k.acceleration*dt/ad):0;m.vx+=ax*f;m.vz+=az*f;limitVelocity(m,k.speed);
    m.x+=m.vx*dt;m.z+=m.vz*dt;constrain(m,-1);m.vx=(m.x-m.px)/dt;m.vz=(m.z-m.pz)/dt;
  }
}
