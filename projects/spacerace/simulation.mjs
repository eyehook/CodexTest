import {CONFIG} from './config.mjs';
export function densityAt(speed, c = CONFIG) {
  const t = Math.max(0, Math.min(1, speed / c.maxSpeed));
  const curve = c.densityCurve;
  for (let i=1; i<curve.length; i++) {
    const [x,y] = curve[i], [a,b] = curve[i-1];
    if (t <= x) return b + (y-b)*(t-a)/(x-a);
  }
  return curve.at(-1)[1];
}
export function triggerInput(sources) {
  let accelerate=0, decelerate=0;
  for (const source of sources) {
    if (source.gamepad?.mapping !== 'xr-standard') continue;
    const button = source.gamepad.buttons[0];
    const value = button ? Math.max(0, Math.min(1, button.value ?? Number(button.pressed))) : 0;
    if (source.handedness === 'right') accelerate = Math.max(accelerate,value);
    if (source.handedness === 'left') decelerate = Math.max(decelerate,value);
  }
  return {accelerate, decelerate};
}
export function integrateSpeed(speed, accelerate, decelerate, dt, c=CONFIG) {
  const a=accelerate*c.acceleration-decelerate*c.deceleration;
  const next=Math.max(0,Math.min(c.maxSpeed,speed+a*dt));
  // Integrate exactly even if a speed limit is reached during this frame.
  const movingTime=a===0 ? dt : Math.min(dt,Math.max(0,(next-speed)/a));
  return {speed:next, distance:(speed+next)*0.5*movingTime+next*(dt-movingTime)};
}
export class Simulation {
  constructor(c=CONFIG, random=Math.random) {
    this.config=c; this.random=random; this.speed=c.initialSpeed;
    this.positions=new Float32Array(c.maxParticles*3);
    this.rings=new Float64Array(c.ringCount);
    this.reset();
  }
  scatter(i) {
    const c=this.config, angle=this.random()*Math.PI*2;
    // Uniform area throughout the annulus, leaving the central flight corridor clear.
    const inner=c.fieldInnerRadius;
    const radius=Math.sqrt(inner*inner+this.random()*(c.fieldRadius*c.fieldRadius-inner*inner));
    this.positions[i]=Math.cos(angle)*radius; this.positions[i+1]=Math.sin(angle)*radius;
  }
  reset() {
    const c=this.config; this.speed=c.initialSpeed;
    for(let i=0;i<this.positions.length;i+=3){this.scatter(i);this.positions[i+2]=c.rearBoundary-this.random()*(c.drawDistance+c.rearBoundary);}
    for(let i=0;i<this.rings.length;i++)this.rings[i]=-(i+1)*c.ringSpacing;
  }
  step(dt,accelerate=0,decelerate=0) {
    if (!(dt>0) || !Number.isFinite(dt)) return;
    const c=this.config, result=integrateSpeed(this.speed,accelerate,decelerate,dt,c);
    this.speed=result.speed; const distance=result.distance;
    if(distance===0)return;
    const span=c.drawDistance+c.rearBoundary;
    for(let i=0;i<this.positions.length;i+=3){
      let z=this.positions[i+2]+distance;
      if(z>c.rearBoundary){z=c.rearBoundary-((c.rearBoundary-z)%span+span)%span;this.scatter(i);}
      this.positions[i+2]=z;
    }
    const ringSpan=this.rings.length*c.ringSpacing;
    for(let i=0;i<this.rings.length;i++){
      let z=this.rings[i]+distance;
      if(z>c.rearBoundary) z-=Math.ceil((z-c.rearBoundary)/ringSpan)*ringSpan;
      this.rings[i]=z;
    }
  }
}
