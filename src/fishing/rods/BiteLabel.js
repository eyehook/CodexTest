import * as THREE from '../../../projects/forest/vendor/three.module.js';
// A Sprite is a camera-facing quad. Rasterize once on first render, using the
// browser's existing bold sans-serif font; there are no external font assets.
export function createBiteTexture(canvas,text='FISH!',color='#ff2222'){
 canvas.width=512;canvas.height=160;
 const ctx=canvas.getContext('2d');
 ctx.font='900 112px Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
 ctx.strokeStyle='#111111';ctx.lineWidth=12;ctx.strokeText(text,256,84,476);
 ctx.fillStyle=color;ctx.fillText(text,256,84,476);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
export class BiteLabel extends THREE.Sprite {
 constructor(){
  super(new THREE.SpriteMaterial({transparent:true,depthWrite:false,toneMapped:false,fog:false}));
  this.textures={};this.mode='fish';this.name='BiteLabel';this.visible=false;this.position.y=2.4;this.pulseTime=0;this.wasBiting=false;this.age=-1;this.scale.set(9,2.8125,1);
  this.onBeforeRender=()=>{
   if(this.material.map)return;
   this.material.map=this.textures[this.mode]??=createBiteTexture(document.createElement('canvas'),this.mode==='lost'?'LOST!':'FISH!',this.mode==='lost'?'#2288ff':'#ff2222');this.material.needsUpdate=true;
  };
 }
 setMode(mode){
  if(this.mode===mode)return;
  this.mode=mode;this.material.map=this.textures[mode]??null;this.material.needsUpdate=true;
 }
 reset(){this.visible=false;this.age=-1;this.wasBiting=false;this.pulseTime=0;this.position.y=2.4;this.setMode('fish');this.scale.set(9,2.8125,1);}
 update(biting,dt,lost=false){
  if(lost){this.setMode('lost');this.age=0;this.visible=true;}
  else if(biting&&!this.wasBiting){this.setMode('fish');this.age=0;this.visible=true;}
  else if(this.age>=0)this.age=Math.min(2,this.age+Math.max(0,Math.min(.05,dt)));
  this.wasBiting=biting;
  if(this.age<0)return;
  this.pulseTime=this.age;
  const t=Math.max(0,Math.min(1,this.mode==='lost'?this.age/2:this.age-1));
  const size=this.mode==='fish'&&this.age<1?1+.15*Math.sin(this.age*Math.PI*4):1-t*t*(3-2*t);
  this.position.y=2.4+(this.mode==='lost'?this.age*.8:0);
  this.scale.set(9*size,2.8125*size,1);this.visible=this.age<2-1e-9;
  if(!this.visible)this.scale.set(0,0,1);
 }
 dispose(){for(const texture of Object.values(this.textures))texture.dispose();this.material.dispose();}
}
