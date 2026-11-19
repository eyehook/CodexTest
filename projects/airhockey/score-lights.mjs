import * as T from '../../shared/vendor/three-r180/three.module.js';
import {SIDE_COLORS} from './celebration.mjs?v=1.0.5';
export const SCORE_EXTENSION_WIDTH=.1524,SCORE_PANEL_X=.68+SCORE_EXTENSION_WIDTH/2;
export function createScoreLights(parent){
 const material=new T.MeshStandardMaterial({color:0xffffff,roughness:.4,metalness:.15,flatShading:true,emissive:0xffffff,emissiveIntensity:.35});
 // Standard instance colors tint diffuse only; also tint emission so unscored balls stay black.
 material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n totalEmissiveRadiance *= vColor.rgb;');};
 material.customProgramCacheKey=()=> 'score-instance-emission-v1';
 const lights=new T.InstancedMesh(new T.IcosahedronGeometry(.035,1),material,14);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');
 const gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'#ffffffff');gradient.addColorStop(.5,'#ffffffcc');gradient.addColorStop(1,'#ffffff00');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
 const glowMaterial=new T.MeshBasicMaterial({map:new T.CanvasTexture(canvas),transparent:true,opacity:.8,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
 const halos=new T.InstancedMesh(new T.PlaneGeometry(.15,.15),glowMaterial,14);parent.add(halos);
 const matrix=new T.Matrix4(),black=new T.Color(0x000000),colors=SIDE_COLORS.map(c=>new T.Color(c));
 for(let side=0;side<2;side++)for(let i=0;i<7;i++){
  // Player lights fill from +Z; opponent lights fill from -Z, toward the center.
  matrix.makeTranslation(side===0?-SCORE_PANEL_X:SCORE_PANEL_X,.025,(side===0?1:-1)*(1.12-i*.16));lights.setMatrixAt(side*7+i,matrix);lights.setColorAt(side*7+i,black);
  matrix.makeRotationX(-Math.PI/2);matrix.setPosition(side===0?-SCORE_PANEL_X:SCORE_PANEL_X,.0255,(side===0?1:-1)*(1.12-i*.16));halos.setMatrixAt(side*7+i,matrix);halos.setColorAt(side*7+i,black);
 }
 parent.add(lights);let lastPlayer=-1,lastEnemy=-1,lastFlash=null,lastWinner=-1;
 function update(scores,winner,flash){
  if(scores[0]===lastPlayer&&scores[1]===lastEnemy&&winner===lastWinner&&flash===lastFlash)return;
  lastPlayer=scores[0];lastEnemy=scores[1];lastWinner=winner;lastFlash=flash;
  for(let side=0;side<2;side++)for(let i=0;i<7;i++){
   const color=i<scores[side]&&(side!==winner||flash)?colors[side]:black;
   lights.setColorAt(side*7+i,color);halos.setColorAt(side*7+i,color);
  }
  lights.instanceColor.needsUpdate=true;halos.instanceColor.needsUpdate=true;
 }
 return {mesh:lights,halos,update};
}
