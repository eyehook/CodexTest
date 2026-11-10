// Sliding queries the authoritative heightfield, independently of rendered LOD.
export class SlopeSlide {
  constructor(world) {
    this.world=world;this.normal={};this.result={x:0,z:0,active:false,speed:0};this.reset();
  }
  reset(){this.speed=0;}
  update(x,z,dt,threshold=35,walkSpeed=1.4){
    const out=this.result;out.x=x;out.z=z;out.active=false;out.speed=this.speed;
    if(!Number.isFinite(dt)||dt<=0)return out;
    dt=Math.min(dt,.05);
    const n=this.world.normal(x,z,this.normal);
    if(n.slope<=threshold){this.reset();out.speed=0;return out;}
    // A downhill drift stronger than the walking input prevents powering uphill,
    // including with the 10x testing speed. Gravity then accelerates the slide.
    const radians=n.slope*Math.PI/180;
    this.speed=Math.min(Math.max(6,walkSpeed*1.5),Math.max(this.speed,walkSpeed*1.15)+9.81*Math.sin(radians)*Math.cos(radians)*dt);
    const steps=Math.max(1,Math.ceil(this.speed*dt/.2)),distance=this.speed*dt/steps;
    out.active=true;
    for(let i=0;i<steps;i++){
      this.world.normal(out.x,out.z,n);
      if(n.slope<=threshold){this.reset();out.active=false;break;}
      const length=Math.hypot(n.x,n.z);if(length<1e-8){this.reset();out.active=false;break;}
      // Horizontal normal points downhill. Reevaluate it on each short step so
      // curved gullies redirect a slide without cancelling player steering/yaw.
      const nx=out.x+n.x/length*distance,nz=out.z+n.z/length*distance;
      if(this.world.normal(nx,nz,this.normal).slope<=threshold){
        // Stop at the first gentler surface rather than carrying momentum across it.
        let lo=0,hi=1;
        for(let j=0;j<12;j++){const t=(lo+hi)/2;if(this.world.normal(out.x+(nx-out.x)*t,out.z+(nz-out.z)*t,this.normal).slope>threshold)lo=t;else hi=t;}
        out.x+=(nx-out.x)*hi;out.z+=(nz-out.z)*hi;this.reset();out.active=false;break;
      }
      out.x=nx;out.z=nz;
    }
    out.speed=this.speed;return out;
  }
}
