// Metres, seconds; x across the table, z toward the human. Rendering is independent.
export const C = Object.freeze({width:1.22, length:2.44, corner:.13, goal:.42, puck:.032, mallet:.052, step:1/240, maxSpeed:8, handSpeed:5});
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function constrain(m, side) {
  const r=C.mallet, x=C.width/2, z=C.length/2;
  m.x=clamp(m.x,-x+r,x-r); m.z=side*clamp(side*m.z,r,z-r);
  const cx=x-C.corner, cz=z-C.corner, dx=Math.abs(m.x)-cx, dz=Math.abs(m.z)-cz;
  if(dx>0&&dz>0){const d=Math.hypot(dx,dz), limit=C.corner-r;if(d>limit){m.x=Math.sign(m.x)*(cx+dx/d*limit);m.z=side*(cz+dz/d*limit);}}
  return m;
}
export function limitVelocity(p,max=C.maxSpeed){const s=Math.hypot(p.vx,p.vz);if(s>max){p.vx*=max/s;p.vz*=max/s;}}
export function makeRails(){
  const rails=[], w=C.width/2,l=C.length/2,c=C.corner,g=C.goal/2;
  const add=(ax,az,bx,bz)=>rails.push({ax,az,bx,bz});
  for(const s of [-1,1]){
    add(s*w,-l+c,s*w,l-c);add(-w+c,s*l,-g,s*l);add(g,s*l,w-c,s*l);
    // Recessed throat sides: the full disc must cross the end line before scoring.
    add(-g,s*l,-g,s*(l+.15));add(g,s*l,g,s*(l+.15));
    for(const t of [-1,1])for(let i=0;i<8;i++){
      const a=i*Math.PI/16,b=(i+1)*Math.PI/16;
      add(s*(w-c+c*Math.cos(a)),t*(l-c+c*Math.sin(a)),s*(w-c+c*Math.cos(b)),t*(l-c+c*Math.sin(b)));
    }
  }
  return rails;
}
export const RAILS=makeRails();
const EPS=1e-7;
export class Physics {
  constructor(onImpact=()=>{}){this.puck={x:0,z:0,vx:0,vz:0};this.onImpact=onImpact;this.hit={t:0,nx:0,nz:0,vx:0,vz:0,kind:''};}
  candidate(t,nx,nz,vx,vz,kind){if(t>=-EPS&&t<this.hit.t){const h=this.hit;h.t=Math.max(0,t);h.nx=nx;h.nz=nz;h.vx=vx;h.vz=vz;h.kind=kind;}}
  circle(x,z,vx,vz,r,time,ivx=0,ivz=0,kind='rail'){
    const p=this.puck,dx=p.x-x,dz=p.z-z,ux=p.vx-vx,uz=p.vz-vz,a=ux*ux+uz*uz;
    if(a<EPS)return;
    const b=dx*ux+dz*uz,c=dx*dx+dz*dz-r*r;
    if(b>=0)return;
    const disc=b*b-a*c;if(disc<0)return;
    const t=c<=0?0:(-b-Math.sqrt(disc))/a;
    if(t>time||t< -EPS)return;
    const nx=dx+ux*t,nz=dz+uz*t,d=Math.hypot(nx,nz)||1;
    this.candidate(t,nx/d,nz/d,ivx,ivz,kind);
  }
  rail(s,time){
    const p=this.puck,dx=s.bx-s.ax,dz=s.bz-s.az,len=Math.hypot(dx,dz),nx=-dz/len,nz=dx/len;
    const dist=(p.x-s.ax)*nx+(p.z-s.az)*nz, speed=p.vx*nx+p.vz*nz;
    if(Math.abs(speed)>EPS){
      const sign=speed<0?1:-1,t=(sign*C.puck-dist)/speed;
      if(t>=-EPS&&t<=time){const x=p.x+p.vx*t,z=p.z+p.vz*t,u=((x-s.ax)*dx+(z-s.az)*dz)/(len*len);if(u>=0&&u<=1)this.candidate(t,nx*sign,nz*sign,0,0,'rail');}
    }
    this.circle(s.ax,s.az,0,0,C.puck,time);this.circle(s.bx,s.bz,0,0,C.puck,time);
  }
  step(dt,mallets){
    const p=this.puck;let remaining=dt,elapsed=0;
    // Resolve initial overlaps (e.g. switching hands) without injecting energy.
    for(const m of mallets){const dx=p.x-m.px,dz=p.z-m.pz,d=Math.hypot(dx,dz),r=C.puck+C.mallet;if(d<r){const nx=d>EPS?dx/d:0,nz=d>EPS?dz/d:-m.side;p.x=m.px+nx*(r+EPS);p.z=m.pz+nz*(r+EPS);}}
    for(let iteration=0;remaining>EPS&&iteration<16;iteration++){
      this.hit.t=remaining+EPS;
      for(const s of RAILS)this.rail(s,remaining);
      for(const m of mallets){const vx=(m.x-m.px)/dt,vz=(m.z-m.pz)/dt;this.circle(m.px+vx*elapsed,m.pz+vz*elapsed,vx,vz,C.puck+C.mallet,remaining,m.vx,m.vz,'mallet');}
      const h=this.hit;
      if(h.t>remaining){p.x+=p.vx*remaining;p.z+=p.vz*remaining;remaining=0;break;}
      p.x+=p.vx*h.t;p.z+=p.vz*h.t;elapsed+=h.t;remaining-=h.t;
      const impact=(p.vx-h.vx)*h.nx+(p.vz-h.vz)*h.nz;
      if(impact<0){const j=-(h.kind==='rail'?1.94:1.9)*impact;p.vx+=j*h.nx;p.vz+=j*h.nz;limitVelocity(p);this.onImpact(h.kind,Math.abs(impact),p.x);}
      p.x+=h.nx*.00001;p.z+=h.nz*.00001;
      // Bound work under a pin. Unconsumed time is intentionally discarded.
      if(h.t<EPS){remaining-=Math.min(remaining,.00001);elapsed+=.00001;}
    }
    p.vx*=Math.exp(-.075*dt);p.vz*=Math.exp(-.075*dt);
    // Containment fallback after overlapping a rail and mallet. Never creates goals.
    p.x=clamp(p.x,-C.width/2+C.puck,C.width/2-C.puck);
    if(Math.abs(p.x)>C.goal/2-C.puck)p.z=clamp(p.z,-C.length/2+C.puck,C.length/2-C.puck);
    return Math.abs(p.z)>C.length/2+C.puck&&Math.abs(p.x)<=C.goal/2-C.puck ? (p.z>0?-1:1):0;
  }
}
export function mallet(side){return {x:0,z:side*.88,px:0,pz:side*.88,vx:0,vz:0,side};}
