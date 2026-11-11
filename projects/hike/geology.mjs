// One landscape-wide ridge/drainage field, eroded once and shared by every mesh.
export const GRID_SIZE=1025,GRID_MIN=-1920,GRID_STEP=3840/(GRID_SIZE-1);
export function randomSource(seed){let state=seed>>>0;return ()=>{state+=0x6d2b79f5;let n=Math.imul(state^(state>>>15),1|state);n^=n+Math.imul(n^(n>>>7),61|n);return ((n^(n>>>14))>>>0)/4294967296;};}
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function generateLandscape(config,onProgress=()=>{}){
 const began=performance.now(),random=randomSource(config.seed),seed=config.seed|0;
 const parameters={height:config.elevation*(1.35+random()*.30),frequency:350+random()*260,rotation:random()*Math.PI*2,stretch:.7+random()*.65,warp:110+random()*120,erosion:100000+Math.floor(random()*40000)};
 const p=parameters,cos=Math.cos(p.rotation),sin=Math.sin(p.rotation);
 p.peakHeight=config.elevation*(.95+random()*.30);
 const angle=random()*Math.PI*2,range=650+random()*80;
 p.valleyX=GRID_MIN+Math.round((Math.cos(angle)*range-GRID_MIN)/GRID_STEP)*GRID_STEP;
 p.valleyZ=GRID_MIN+Math.round((Math.sin(angle)*range-GRID_MIN)/GRID_STEP)*GRID_STEP;
 const boundaryHeight=20;
 const hash=(x,z)=>{let n=Math.imul(x,374761393)^Math.imul(z,668265263)^seed;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
 function noise(x,z){const ix=Math.floor(x),iz=Math.floor(z),u=smooth(x-ix),v=smooth(z-iz);return (hash(ix,iz)*(1-u)+hash(ix+1,iz)*u)*(1-v)+(hash(ix,iz+1)*(1-u)+hash(ix+1,iz+1)*u)*v;}
 onProgress(0,'Raising ridges');
 const heights=new Float32Array(GRID_SIZE*GRID_SIZE);
 for(let z=0;z<GRID_SIZE;z++)for(let x=0;x<GRID_SIZE;x++){
  const wx=GRID_MIN+x*GRID_STEP,wz=GRID_MIN+z*GRID_STEP;
  const warpedX=wx+(noise(wx/380+15,wz/380-11)-.5)*p.warp*2;
  const warpedZ=wz+(noise(wx/380-19,wz/380+23)-.5)*p.warp*2;
  const lx=(warpedX*cos-warpedZ*sin)*p.stretch,lz=(warpedX*sin+warpedZ*cos)/p.stretch;
  // Correlated, warped ridge families span the entire map. The broad uplift
  // changes their prominence toward the middle; there are no placed peak blobs.
  const large=1-Math.abs(2*noise(lx/p.frequency,lz/p.frequency)-1);
  const medium=1-Math.abs(2*noise(lx/165+31,lz/165-17)-1);
  const small=1-Math.abs(2*noise(lx/48-9,lz/48+41)-1);
  const ridge=.60*large**2+.27*medium**2+.13*small;
  const uplift=.30+.70*Math.exp(-(wx*wx+wz*wz)/(630*630));
  const edge=smooth((1920-Math.abs(wx))/100)*smooth((1920-Math.abs(wz))/100);
  // A low drainage outlet gives the hike a unique low valley. It modifies this
  // same field before erosion; it is independent of route or mesh allocation.
  heights[z*GRID_SIZE+x]=boundaryHeight+p.height*uplift*(.10+.90*ridge)*edge;
 }
 // Establish a low drainage outlet within hiking distance of the central high point.
 let initialPeak=0;for(let i=0;i<heights.length;i++)if(heights[i]>heights[initialPeak])initialPeak=i;
 const px=GRID_MIN+(initialPeak%GRID_SIZE)*GRID_STEP,pz=GRID_MIN+Math.floor(initialPeak/GRID_SIZE)*GRID_STEP;
 const snap=v=>GRID_MIN+Math.round((Math.max(-850,Math.min(850,v))-GRID_MIN)/GRID_STEP)*GRID_STEP;
 p.valleyX=snap(px+Math.cos(angle)*range);p.valleyZ=snap(pz+Math.sin(angle)*range);
 function drain(radius){
  // Only the outlet's bounding square can change; retain the same sample order.
  const x0=Math.max(0,Math.ceil((p.valleyX-radius-GRID_MIN)/GRID_STEP)),x1=Math.min(GRID_SIZE-1,Math.floor((p.valleyX+radius-GRID_MIN)/GRID_STEP));
  const z0=Math.max(0,Math.ceil((p.valleyZ-radius-GRID_MIN)/GRID_STEP)),z1=Math.min(GRID_SIZE-1,Math.floor((p.valleyZ+radius-GRID_MIN)/GRID_STEP));
  for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){const d=Math.hypot(GRID_MIN+x*GRID_STEP-p.valleyX,GRID_MIN+z*GRID_STEP-p.valleyZ);if(d<radius)heights[z*GRID_SIZE+x]*=smooth(d/radius);}}
 drain(160);
 // Droplet transport: erode accelerating downhill water, deposit in slower reaches.
 // Work is bounded and paid only once, before terrain tiles or collision queries.
 const n=GRID_SIZE,gradient={};
 function sample(x,z,out){const ix=Math.floor(x),iz=Math.floor(z),u=x-ix,v=z-iz,i=iz*n+ix,a=heights[i],b=heights[i+1],c=heights[i+n],d=heights[i+n+1];out.y=(a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v;out.x=(b-a)*(1-v)+(d-c)*v;out.z=(c-a)*(1-u)+(d-b)*u;return out;}
 onProgress(.25,'Eroding the mountain');
 for(let drop=0;drop<p.erosion;drop++){
  if(drop%8192===0)onProgress(.25+.5*drop/p.erosion,'Eroding the mountain');
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
 // Keep the drainage outlet open after sediment transport.
 drain(70);
 // Brief talus relaxation removes isolated erosion needles without smoothing ridges away.
 const delta=new Float32Array(heights.length),talus=Math.tan(48*Math.PI/180)*GRID_STEP;
 for(let pass=0;pass<5;pass++){
  onProgress(.75+.2*pass/5,'Settling rock and sediment');
  delta.fill(0);
  for(let z=1;z<n-1;z++)for(let x=1;x<n-1;x++){
   const i=z*n+x;let low=i;for(const j of [i-1,i+1,i-n,i+n])if(heights[j]<heights[low])low=j;
   const excess=heights[i]-heights[low]-talus;if(excess>0){const amount=excess*.17;delta[i]-=amount;delta[low]+=amount;}
  }
  for(let i=0;i<heights.length;i++)heights[i]=Math.max(0,heights[i]+delta[i]);
 }
 // Normalize the elevation budget without changing ridge/drainage topology.
 // The whole field, including distant terrain, receives the same scaling.
 let maximum=0;for(const value of heights)maximum=Math.max(maximum,value);
 const scale=p.peakHeight/maximum;
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){const edge=smooth((1920-Math.max(Math.abs(GRID_MIN+x*GRID_STEP),Math.abs(GRID_MIN+z*GRID_STEP)))/100);heights[z*n+x]=boundaryHeight+(heights[z*n+x]*scale-boundaryHeight)*edge;}
 // Restore the exact border after erosion, and locate endpoints in the same field.
 for(let q=0;q<n;q++){heights[q]=heights[(n-1)*n+q]=heights[q*n]=heights[q*n+n-1]=boundaryHeight;}
 let peakIndex=0,minIndex=0;
 for(let i=0;i<heights.length;i++){if(heights[i]>heights[peakIndex])peakIndex=i;if(heights[i]<heights[minIndex])minIndex=i;}
 const summit={x:GRID_MIN+(peakIndex%n)*GRID_STEP,z:GRID_MIN+Math.floor(peakIndex/n)*GRID_STEP,y:heights[peakIndex]};
 const start={x:GRID_MIN+(minIndex%n)*GRID_STEP,z:GRID_MIN+Math.floor(minIndex/n)*GRID_STEP,y:heights[minIndex]};
 function height(x,z){const gx=(x-GRID_MIN)/GRID_STEP,gz=(z-GRID_MIN)/GRID_STEP;if(gx<0||gz<0||gx>=n-1||gz>=n-1)return boundaryHeight;return sample(gx,gz,gradient).y;}
 onProgress(1,'Mountain shape complete');
 return {height,summit,start,boundaryHeight,extent:1920,gridSize:n,gridStep:GRID_STEP,parameters,heights,generationMs:performance.now()-began};
}
