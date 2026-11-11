import Clipper from '../../shared/vendor/clipper-6.4.2.2/clipper.mjs';
import {ShapeUtils,Vector2} from '../../shared/vendor/three-r180/three.module.js';
export const SCALE=4;
export const point=(x,z)=>({X:Math.round(x*SCALE),Y:Math.round(z*SCALE)});
export function rect(x0,z0,x1,z1){return [point(x0,z0),point(x1,z0),point(x1,z1),point(x0,z1)];}
export function offsetRoute(route,width){const c=new Clipper.ClipperOffset(2,.025*SCALE),paths=[];c.AddPath(route.map(p=>point(p.x,p.z)),Clipper.JoinType.jtRound,Clipper.EndType.etOpenRound);c.Execute(paths,width*SCALE);return paths;}
export function boolean(subject,clip,operation){
 const c=new Clipper.Clipper();c.StrictlySimple=true;c.PreserveCollinear=true;c.AddPaths(subject,Clipper.PolyType.ptSubject,true);if(clip.length)c.AddPaths(clip,Clipper.PolyType.ptClip,true);
 const tree=new Clipper.PolyTree();c.Execute(Clipper.ClipType[operation],tree,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);
 const polygons=[];
 function visit(node){for(const child of node.Childs()){if(!child.IsHole())polygons.push({outer:child.Contour(),holes:child.Childs().filter(p=>p.IsHole()).map(p=>p.Contour())});visit(child);}}
 visit(tree);return {paths:Clipper.Clipper.PolyTreeToPaths(tree),polygons};
}
export class PointIndex {
 constructor(){this.bins=new Map();this.seen=new Set();}
 add(p){const key=p.X+','+p.Y;if(this.seen.has(key))return;this.seen.add(key);const cell=Math.floor(p.X/(SCALE*4))+','+Math.floor(p.Y/(SCALE*4));if(!this.bins.has(cell))this.bins.set(cell,[]);this.bins.get(cell).push(p);}
 along(a,b,tolerance=.05){const found=[];for(let x=Math.floor(Math.min(a.X,b.X)/(SCALE*4));x<=Math.floor(Math.max(a.X,b.X)/(SCALE*4));x++)for(let z=Math.floor(Math.min(a.Y,b.Y)/(SCALE*4));z<=Math.floor(Math.max(a.Y,b.Y)/(SCALE*4));z++)for(const p of this.bins.get(x+','+z)??[]){const dx=b.X-a.X,dz=b.Y-a.Y,len=dx*dx+dz*dz,u=((p.X-a.X)*dx+(p.Y-a.Y)*dz)/len;if(u>1e-8&&u<1-1e-8&&Math.abs((p.X-a.X)*dz-(p.Y-a.Y)*dx)/Math.sqrt(len)<tolerance)found.push({p,u});}return found.sort((a,b)=>a.u-b.u).map(p=>p.p);}
}
// Earcut supplies polygon topology; reinsert every collinear boundary vertex so
// grid-cell cuts, trail edges and coarser terrain share actual indexed edges.
export function triangulate(polygons,emit,extra=null){
 for(const poly of polygons){
  const loops=[poly.outer,...poly.holes],flat=loops.flat(),points=flat.map(p=>new Vector2(p.X/SCALE,p.Y/SCALE));
  const faces=ShapeUtils.triangulateShape(points.slice(0,poly.outer.length),poly.holes.map(h=>h.map(p=>new Vector2(p.X/SCALE,p.Y/SCALE))));
  const boundary=new PointIndex();for(const p of flat)boundary.add(p);
  for(const face of faces){
   const abc=face.map(i=>flat[i]);if(!abc[0]||!abc[1]||!abc[2])continue;
   const ring=[];
   for(let e=0;e<3;e++){const a=abc[e],b=abc[(e+1)%3];ring.push(a);const candidates=[...boundary.along(a,b),...(extra?.along(a,b)??[])];const dx=b.X-a.X,dz=b.Y-a.Y;candidates.sort((p,q)=>((p.X-q.X)*dx+(p.Y-q.Y)*dz));const seen=new Set([a.X+','+a.Y,b.X+','+b.Y]);for(const p of candidates){const key=p.X+','+p.Y;if(!seen.has(key)){ring.push(p);seen.add(key);}}}
   if(ring.length===3)emit(...abc);else {const center={X:(abc[0].X+abc[1].X+abc[2].X)/3,Y:(abc[0].Y+abc[1].Y+abc[2].Y)/3};for(let i=0;i<ring.length;i++)emit(center,ring[i],ring[(i+1)%ring.length]);}
  }
 }
}
