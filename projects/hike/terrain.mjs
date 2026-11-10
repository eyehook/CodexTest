import * as T from '../../shared/vendor/three-r180/three.module.js';
import {surfaceColor} from './surface.mjs';
import {createDetailTexture,DETAIL_TILE_METERS} from './detail-texture.mjs';
const TILE=128,N=64,COUNT=10,ORIGIN=-640,VERTS=(N+1)**2;
// Persistent mesh/buffer pool. A tile only uploads on a discrete LOD change.
export class Terrain {
  constructor(scene,world,settings) {
    this.world=world;this.settings=settings;this.tiles=[];this.triangles=0;this.updateMs=0;this.lastX=Infinity;this.lastZ=Infinity;
    this.normal={};this.proximity={};this.color=new T.Color();this.treadColor=new T.Color(.19,.115,.052);
    this.detailTexture=createDetailTexture();
    this.material=new T.MeshLambertMaterial({vertexColors:true,map:this.detailTexture});
    for(let z=0;z<COUNT;z++)for(let x=0;x<COUNT;x++) {
      const geometry=new T.BufferGeometry();
      for(const name of ['position','normal','color'])geometry.setAttribute(name,new T.BufferAttribute(new Float32Array(VERTS*3),3).setUsage(T.DynamicDrawUsage));
      geometry.setAttribute('uv',new T.BufferAttribute(new Float32Array(VERTS*2),2));
      geometry.setIndex(new T.BufferAttribute(new Uint16Array(N*N*6),1).setUsage(T.DynamicDrawUsage));
      const mesh=new T.Mesh(geometry,this.material);scene.add(mesh);
      const tile={x:ORIGIN+x*TILE,z:ORIGIN+z*TILE,ix:x,iz:z,mesh,step:0,next:8,pinned:false};
      // Trail plus a 14 m shoulder, and summit, keep fixed fine geometry at all distances.
      tile.pinned=world.route.some(p=>p.x>=tile.x-16&&p.x<=tile.x+TILE+16&&p.z>=tile.z-16&&p.z<=tile.z+TILE+16);
      tile.pinned ||= world.landmarks.some(({x:px,z:pz})=>px>=tile.x-55&&px<=tile.x+TILE+55&&pz>=tile.z-55&&pz<=tile.z+TILE+55);
      this.tiles.push(tile);
    }
    // Flat surroundings only: no second surface beneath the massif. Even a small
    // vertical separation can z-fight at shallow viewing angles in a large XR world.
    const limit=7000,edge=ORIGIN+COUNT*TILE,positions=[],indices=[],uv=[];
    const vertex=(x,z)=>{const i=positions.length/3;positions.push(x,0,z);uv.push(x/DETAIL_TILE_METERS,z/DETAIL_TILE_METERS);return i;};
    const triangle=(a,b,c)=>{
      const cross=(positions[c*3]-positions[a*3])*(positions[b*3+2]-positions[a*3+2])-(positions[b*3]-positions[a*3])*(positions[c*3+2]-positions[a*3+2]);
      indices.push(a,cross>=0?b:c,cross>=0?c:b);
    };
    // Match every 2 m terrain perimeter vertex, including from distant views.
    // Four fans plus corner quads avoid long coarse edges meeting fine tiles.
    for(let side=0;side<4;side++){
      const point=(u,v)=>side===0?vertex(u,-v):side===1?vertex(v,u):side===2?vertex(-u,v):vertex(-v,-u);
      const center=point(0,limit);let previous=point(-edge,limit);
      for(let u=-edge;u<=edge;u+=2){const current=point(u,edge);triangle(center,previous,current);previous=current;}
      triangle(center,previous,point(edge,limit));
    }
    for(const sx of [-1,1])for(const sz of [-1,1]){
      const a=vertex(sx*edge,sz*edge),b=vertex(sx*limit,sz*edge),c=vertex(sx*edge,sz*limit),d=vertex(sx*limit,sz*limit);
      triangle(a,b,c);triangle(b,d,c);
    }
    const groundGeometry=new T.BufferGeometry();
    groundGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    groundGeometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
    groundGeometry.setIndex(indices);groundGeometry.computeVertexNormals();
    this.ground=new T.Mesh(groundGeometry,new T.MeshLambertMaterial({color:new T.Color(.075,.16,.055),map:this.detailTexture}));
    scene.add(this.ground);
    const began=performance.now();this.update(world.start.x,world.start.z,true);this.generationMs=performance.now()-began;this.updateMs=0;
  }
  at(x,z){return this.tiles[z*COUNT+x];}
  update(x,z,force=false) {
    if(!force&&Math.hypot(x-this.lastX,z-this.lastZ)<16)return false;
    const began=performance.now();this.lastX=x;this.lastZ=z;
    for(const t of this.tiles) {
      const d=Math.hypot(t.x+TILE/2-x,t.z+TILE/2-z),r=this.settings.radius;
      // Hysteresis avoids repeated uploads when walking along a threshold.
      const bias=!force&&t.step<=2?24:0;
      t.next=t.pinned?1:d<r+bias?(this.settings.quality>=2?1:2):d<r+this.settings.transition?4:8;
    }
    let triangles=0,changed=0;
    for(const t of this.tiles) {
      if(t.step!==t.next){this.fill(t);t.step=t.next;changed++;}
      triangles+=t.mesh.geometry.drawRange.count/3;
    }
    this.triangles=triangles;this.changed=changed;if(changed)this.updateMs=performance.now()-began;return !!changed;
  }
  fill(t) {
    const g=t.mesh.geometry,p=g.attributes.position.array,n=g.attributes.normal.array,c=g.attributes.color.array,s=t.next;
    const h=(ix,iz)=>this.world.height(t.x+ix*2,t.z+iz*2);
    if(!t.initialized) for(let z=0;z<=N;z++)for(let x=0;x<=N;x++) {
      const i=(z*(N+1)+x)*3,wx=t.x+x*2,wz=t.z+z*2;let y=h(x,z);
      p[i]=wx;p[i+1]=y;p[i+2]=wz;
      const uvIndex=(z*(N+1)+x)*2;g.attributes.uv.array[uvIndex]=wx/DETAIL_TILE_METERS;g.attributes.uv.array[uvIndex+1]=wz/DETAIL_TILE_METERS;
      this.world.normal(wx,wz,this.normal);n[i]=this.normal.x;n[i+1]=this.normal.y;n[i+2]=this.normal.z;
      surfaceColor(wx,wz,y,this.normal.slope,this.world.summit.y,this.world.config.seed,this.color);
      this.world.trail(wx,wz,this.proximity);
      const tread=Math.max(0,Math.min(1,(this.world.config.trailWidth/2+1-this.proximity.distance)/1.3));
      this.color.lerp(this.treadColor,tread*.92);
      c[i]=this.color.r;c[i+1]=this.color.g;c[i+2]=this.color.b;
    }
    let k=0;const idx=g.index.array;
    const vertex=(x,z)=>z*(N+1)+x;
    const tri=(a,b,c)=>{idx[k++]=a;idx[k++]=b;idx[k++]=c;};
    for(let z=0;z<N;z+=s)for(let x=0;x<N;x+=s){
      const a=vertex(x,z),b=vertex(x+s,z),d=vertex(x,z+s),e=vertex(x+s,z+s);
      if(s===1||!(x===0||z===0||x+s===N||z+s===N)){tri(a,d,b);tri(b,d,e);continue;}
      // Every tile perimeter retains 2 m vertices, even on coarse tiles.
      // Boundary cells fan into an existing center vertex; no T-junctions or skirts.
      const center=vertex(x+s/2,z+s/2);
      const edge=(x0,z0,x1,z1,fine)=>{const count=fine?s:1;for(let j=0;j<count;j++)tri(center,vertex(x0+(x1-x0)*j/count,z0+(z1-z0)*j/count),vertex(x0+(x1-x0)*(j+1)/count,z0+(z1-z0)*(j+1)/count));};
      edge(x,z,x,z+s,x===0);edge(x,z+s,x+s,z+s,z+s===N);edge(x+s,z+s,x+s,z,x+s===N);edge(x+s,z,x,z,z===0);
    }
    g.setDrawRange(0,k);g.index.clearUpdateRanges();g.index.addUpdateRange(0,k);g.index.needsUpdate=true;
    if(!t.initialized){for(const name of ['position','normal','color','uv'])g.attributes[name].needsUpdate=true;t.initialized=true;}
    // Bounds must only include initialized vertices (unused slots remain zero).
    g.boundingBox=new T.Box3(new T.Vector3(t.x,-1,t.z),new T.Vector3(t.x+TILE,420,t.z+TILE));g.boundingSphere=new T.Sphere();g.boundingBox.getBoundingSphere(g.boundingSphere);
  }
}
