// Seeded single-mountain heightmap, generated once. No browser or renderer state.
export const GRID_SIZE=513,GRID_MIN=-640,GRID_STEP=1280/(GRID_SIZE-1);
export function randomSource(seed){let state=seed>>>0;return ()=>{state+=0x6d2b79f5;let n=Math.imul(state^(state>>>15),1|state);n^=n+Math.imul(n^(n>>>7),61|n);return ((n^(n>>>14))>>>0)/4294967296;};}
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function generateMountain(config){
 const began=performance.now(),random=randomSource(config.seed),seed=config.seed|0;
 const parameters={x:(random()-.5)*130,z:(random()-.5)*130,rx:260+random()*230,rz:280+random()*220,height:config.elevation*(.92+random()*.53),rotation:random()*Math.PI*2,profile:1.0+random()*1.15,ridges:4+Math.floor(random()*5),twist:(random()-.5)*2,phase:random()*Math.PI*2,erosion:45000+Math.floor(random()*35000)};
 parameters.ridgeStrength=.08+random()*.22;parameters.cap=.018+random()*.065;parameters.headwall=random()*.18;
 const p=parameters,cos=Math.cos(p.rotation),sin=Math.sin(p.rotation);
 const hash=(x,z)=>{let n=Math.imul(x,374761393)^Math.imul(z,668265263)^seed;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
 function noise(x,z){const ix=Math.floor(x),iz=Math.floor(z),u=smooth(x-ix),v=smooth(z-iz);return (hash(ix,iz)*(1-u)+hash(ix+1,iz)*u)*(1-v)+(hash(ix,iz+1)*(1-u)+hash(ix+1,iz+1)*u)*v;}
 const heights=new Float32Array(GRID_SIZE*GRID_SIZE);
 for(let z=0;z<GRID_SIZE;z++)for(let x=0;x<GRID_SIZE;x++){
  const wx=GRID_MIN+x*GRID_STEP,wz=GRID_MIN+z*GRID_STEP,dx=wx-p.x,dz=wz-p.z;
  const lx=(dx*cos-dz*sin)/p.rx,lz=(dx*sin+dz*cos)/p.rz,theta=Math.atan2(lz,lx),radius=Math.hypot(lx,lz);
  const warp=(noise(wx/125,wz/125)-.5)*.75;
  const fold=Math.cos(theta*p.ridges+p.phase+radius*p.twist+warp);
  const branches=Math.cos(theta*(p.ridges*2+1)+radius*5+p.phase);
  const footprint=1+.11*Math.sin(theta*3+p.phase)+.065*Math.sin(theta*5-p.phase);
  const r=radius/footprint;if(r>=1)continue;
  // A rounded summit cap feeds asymmetric radiating spurs, all part of one peak.
  const capped=r*r/(r+p.cap);
  const flankProfile=p.profile+.55*Math.cos(theta-p.phase)*smooth(r/.14);
  const profile=Math.pow(Math.max(0,1-capped),flankProfile);
  const valleys=(1-fold)*.5;
  const erosionShape=(valleys*p.ridgeStrength+(1-branches)*.018)*(Math.sin(Math.PI*r)**1.2);
  const bowlAngle=Math.atan2(Math.sin(theta-p.phase),Math.cos(theta-p.phase));
  const headwall=p.headwall*Math.exp(-(((r-.48)/.17)**2)-((bowlAngle/.5)**2))*Math.sin(Math.PI*r);
  const strata=(noise(wx/44,wz/44)-.5)*.026*Math.sin(Math.PI*r);
  const edge=smooth((625-Math.abs(wx))/50)*smooth((625-Math.abs(wz))/50);
  heights[z*GRID_SIZE+x]=Math.max(0,p.height*(profile-erosionShape-headwall+strata)*edge);
 }
 // Droplet transport: erode accelerating downhill water, deposit in slower reaches.
 // Work is bounded and paid only once, before terrain tiles or collision queries.
 const n=GRID_SIZE,gradient={};
 function sample(x,z,out){const ix=Math.floor(x),iz=Math.floor(z),u=x-ix,v=z-iz,i=iz*n+ix,a=heights[i],b=heights[i+1],c=heights[i+n],d=heights[i+n+1];out.y=(a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v;out.x=(b-a)*(1-v)+(d-c)*v;out.z=(c-a)*(1-u)+(d-b)*u;return out;}
 for(let drop=0;drop<p.erosion;drop++){
  let x=2+random()*(n-5),z=2+random()*(n-5),vx=0,vz=0,sediment=0,water=1,speed=1;
  for(let life=0;life<55;life++){
   sample(x,z,gradient);const oldHeight=gradient.y;if(oldHeight<.15)break;
   vx=vx*.22-gradient.x*.78;vz=vz*.22-gradient.z*.78;const length=Math.hypot(vx,vz);if(length<1e-7)break;vx/=length;vz/=length;
   const nx=x+vx,nz=z+vz;if(nx<1||nz<1||nx>=n-2||nz>=n-2)break;
   const ix=Math.floor(x),iz=Math.floor(z),u=x-ix,v=z-iz,index=iz*n+ix;
   sample(nx,nz,gradient);const change=gradient.y-oldHeight,capacity=Math.max(.02,-change*speed*water*3);
   let amount;
   if(change>0||sediment>capacity){amount=change>0?Math.min(change,sediment):(sediment-capacity)*.22;sediment-=amount;}
   else {amount=-Math.min((capacity-sediment)*.20,Math.max(0,-change)*.6);sediment-=amount;}
   heights[index]+=amount*(1-u)*(1-v);heights[index+1]+=amount*u*(1-v);heights[index+n]+=amount*(1-u)*v;heights[index+n+1]+=amount*u*v;
   speed=Math.sqrt(Math.max(.05,speed*speed-change*.65));water*=.975;x=nx;z=nz;
  }
 }
 // Brief talus relaxation removes isolated erosion needles without smoothing ridges away.
 const delta=new Float32Array(heights.length),talus=Math.tan(48*Math.PI/180)*GRID_STEP;
 for(let pass=0;pass<5;pass++){
  delta.fill(0);
  for(let z=1;z<n-1;z++)for(let x=1;x<n-1;x++){
   const i=z*n+x;let low=i;for(const j of [i-1,i+1,i-n,i+n])if(heights[j]<heights[low])low=j;
   const excess=heights[i]-heights[low]-talus;if(excess>0){const amount=excess*.17;delta[i]-=amount;delta[low]+=amount;}
  }
  for(let i=0;i<heights.length;i++)heights[i]=Math.max(0,heights[i]+delta[i]);
 }
 let peakIndex=0;for(let i=0;i<heights.length;i++)if(heights[i]>heights[peakIndex])peakIndex=i;
 const summit={x:GRID_MIN+(peakIndex%n)*GRID_STEP,z:GRID_MIN+Math.floor(peakIndex/n)*GRID_STEP,y:heights[peakIndex]};
 function height(x,z){const gx=(x-GRID_MIN)/GRID_STEP,gz=(z-GRID_MIN)/GRID_STEP;if(gx<0||gz<0||gx>=n-1||gz>=n-1)return 0;return sample(gx,gz,gradient).y;}
 return {height,summit,parameters,heights,generationMs:performance.now()-began};
}
