import * as THREE from '../../shared/vendor/three-r180/three.module.js';
// All silhouettes attach at (0,0,0), extend toward +Y, and have a shallow ridge.
export function vineLeafGeometry(form){
 let outline;
 if(form==='heart')outline=[[0,0],[-.18,-.09],[-.38,-.04],[-.51,.12],[-.52,.31],[-.41,.52],[-.22,.76],[0,1],[.22,.76],[.41,.52],[.52,.31],[.51,.12],[.38,-.04],[.18,-.09]];
 else if(form==='oval')outline=Array.from({length:20},(_,i)=>{const a=i*Math.PI/10;return [-.38*Math.sin(a),.5-.5*Math.cos(a)];});
 else if(form==='five-lobed')outline=[[0,0],[-.2,.17],[-.65,.26],[-.32,.4],[-.6,.73],[-.2,.58],[0,1],[.2,.58],[.6,.73],[.32,.4],[.65,.26],[.2,.17]];
 else throw Error('Unknown vine leaf form');
 const shape=new THREE.Shape(outline.map(([x,y])=>new THREE.Vector2(x,y))),geometry=new THREE.ShapeGeometry(shape);
 // Triangulate concave notches rather than filling them with a center fan.
 const positions=geometry.attributes.position;
 for(let i=0;i<positions.count;i++){const y=positions.getY(i),x=positions.getX(i);positions.setZ(i,.06*Math.sin(Math.PI*Math.max(0,y))*Math.max(0,1-Math.abs(x)/.65));}
 if(form==='heart'||form==='oval')geometry.scale(.8,.8,.8);
 geometry.computeVertexNormals();return geometry;
}
