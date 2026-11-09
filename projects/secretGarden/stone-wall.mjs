import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {HALF_WIDTH,HALF_DEPTH,WALL_HEIGHT,DOOR_WIDTH,DOOR_HEIGHT,DOOR_WALL_ID} from './garden-layout.mjs?v=182';
export const STONE_MAX_RELIEF=.0255;
export function createStoneFacingGeometry(seed=81473){
 let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;},range=(a,b)=>a+(b-a)*random();
 const positions=[],colors=[],stones=[];let side;
 const world=([x,y,z])=>[x*Math.cos(side.angle)+z*Math.sin(side.angle),y,-x*Math.sin(side.angle)+z*Math.cos(side.angle)];
 function triangle(a,b,c,color,shade=1){for(const v of [a,b,c]){positions.push(...world(v));colors.push(color.r*shade,color.g*shade,color.b*shade);}}
 function stone(x0,x1,y0,y1){
  if(x1-x0<.08||y1-y0<.07)return;
  const gap=.012;x0+=gap;x1-=gap;y0+=gap;y1-=gap;
  const w=x1-x0,h=y1-y0,cuts=Array.from({length:4},()=>range(.08,.23)*Math.min(w,h));
  const outline=[[x0,y0+cuts[0]],[x0+cuts[0],y0],[x1-cuts[1],y0],[x1,y0+cuts[1]],[x1,y1-cuts[2]],[x1-cuts[2],y1],[x0+cuts[3],y1],[x0,y1-cuts[3]]].map(([x,y])=>[Math.max(x0,Math.min(x1,x+range(-.035,.035)*w)),Math.max(y0,Math.min(y1,y+range(-.07,.07)*h))]);
  const cx=(x0+x1)/2,cy=(y0+y1)/2,base=side.distance-.0005,relief=range(.012,STONE_MAX_RELIEF),bevel=range(.018,.045);
  const rim=outline.map(([x,y])=>[x,y,base]),front=outline.map(([x,y])=>[x+(cx-x)*bevel/w,y+(cy-y)*bevel/h,side.distance-relief*range(.65,.85)]);
  const center=[cx+range(-.1,.1)*w,cy+range(-.1,.1)*h,side.distance-relief];
  const color=new THREE.Color().setHSL(range(.10,.13),range(.165,.255),range(.42,.55),THREE.SRGBColorSpace);
  for(let i=0;i<outline.length;i++){
   const next=(i+1)%outline.length;
   triangle(center,front[next],front[i],color,range(.97,1.03));
   triangle(rim[i],front[i],front[next],color,.88);triangle(rim[i],front[next],rim[next],color,.88);
  }
  stones.push({wall:side.id,minX:x0,maxX:x1,minY:y0,maxY:y1,relief});
 }
 function region(left,right,bottom,top){
  let y=bottom;
  while(y<top-.06){const nextY=Math.min(top,y+range(.24,.48));let x=left;
   while(x<right-.07){let nextX=Math.min(right,x+range(.38,1.25));if(right-nextX<.15)nextX=right;
    if(nextY-y>.33&&nextX-x>.65&&random()<.25){const split=y+(nextY-y)*range(.42,.58);stone(x,nextX,y,split);stone(x,nextX,split,nextY);}
    else stone(x,nextX,y,nextY);
    x=nextX;
   }
   y=nextY;
  }
 }
 for(let i=0;i<4;i++){
  side={id:i,angle:i*Math.PI/2,halfLength:i%2===0?HALF_WIDTH:HALF_DEPTH,distance:i%2===0?HALF_DEPTH:HALF_WIDTH};
  if(i===DOOR_WALL_ID){region(-side.halfLength,-DOOR_WIDTH/2,0,WALL_HEIGHT);region(DOOR_WIDTH/2,side.halfLength,0,WALL_HEIGHT);region(-DOOR_WIDTH/2,DOOR_WIDTH/2,DOOR_HEIGHT,WALL_HEIGHT);}
  else region(-side.halfLength,side.halfLength,0,WALL_HEIGHT);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData.stones=stones;
 return geometry;
}
export function createStoneFacing(){
 const mesh=new THREE.Mesh(createStoneFacingGeometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true}));mesh.name='garden-stone-facing';mesh.castShadow=false;mesh.receiveShadow=false;mesh.updateMatrix();mesh.matrixAutoUpdate=false;return mesh;
}
