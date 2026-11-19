import * as T from '../../shared/vendor/three-r180/three.module.js';
export const SIDE_COLORS=['#188ce8','#ee5165'];
// Three short, staggered launches. One reusable buffer, material and draw call.
export function createCelebration(parent){
 const count=96,positions=new Float32Array(count*3),geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));
 const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const ctx=canvas.getContext('2d');
 const glow=ctx.createRadialGradient(16,16,0,16,16,16);glow.addColorStop(0,'white');glow.addColorStop(.35,'#ffffffdd');glow.addColorStop(1,'#ffffff00');ctx.fillStyle=glow;ctx.fillRect(0,0,32,32);
 const material=new T.PointsMaterial({size:.035,map:new T.CanvasTexture(canvas),transparent:true,depthWrite:false,blending:T.AdditiveBlending});
 const sparks=new T.Points(geometry,material);sparks.frustumCulled=false;sparks.visible=false;parent.add(sparks);
 let winner=-1,elapsed=0,lastTime=null;
 function update(game,time,paused){
  const dt=lastTime===null?0:Math.max(0,Math.min(.05,time-lastTime));lastTime=time;
  const next=game.state==='won'?(game.scores[0]>=7?0:1):-1;
  if(next!==winner){winner=next;elapsed=0;if(winner>=0)material.color.set(SIDE_COLORS[winner]);}
  else if(winner>=0&&!paused)elapsed+=dt;
  sparks.visible=winner>=0&&elapsed<3.3;
  if(sparks.visible){
   let active=0;
   for(let launch=0;launch<3;launch++){
    const age=elapsed-launch*.65;if(age<0||age>1.8)continue;
    const burst=age-.5;
    for(let i=0;i<32;i++){
     const angle=i*2.3999632297,vertical=1-2*(i+.5)/32,radial=Math.sqrt(1-vertical*vertical),spread=Math.max(0,burst)*.5;
     const x=launch===1?-.1:launch===2?.1:0;
     positions[active*3]=x+Math.cos(angle)*radial*spread;
     positions[active*3+1]=burst<0?.035+age*1.45:.76+vertical*spread-.24*burst*burst;
     positions[active*3+2]=Math.sin(angle)*radial*spread;
     active++;
    }
   }
   geometry.setDrawRange(0,active);geometry.attributes.position.needsUpdate=true;
  }else geometry.setDrawRange(0,0);
  return winner<0?true:Math.floor(elapsed/.55)%2===0;
 }
 return {sparks,update,get winner(){return winner;},get elapsed(){return elapsed;}};
}
