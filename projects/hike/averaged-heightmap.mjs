// Render-only cache. Integer grid coordinates are independent of mesh origins.
export const AVERAGED_TERRAIN=Object.freeze({spacing:16,footprint:16,samplesPerAxis:3,blendStart:120,blendEnd:336});
const TILE=16;
export class AveragedHeightmap {
 constructor(height,options={}){
  this.height=height;this.settings={...AVERAGED_TERRAIN,...options};
  const {spacing,footprint,samplesPerAxis}=this.settings;
  if(!(spacing>0&&footprint>0&&Number.isInteger(samplesPerAxis)&&samplesPerAxis>=3&&samplesPerAxis<=4))throw Error('Invalid averaged heightmap settings');
  this.lastTile=null;this.lastX=Infinity;this.lastZ=Infinity;this.columns=new Map();this.nodeCount=0;this.byteLength=0;
 }
 node(ix,iz){
  const tx=Math.floor(ix/TILE),tz=Math.floor(iz/TILE);let tile=this.lastTile;
  if(tx!==this.lastX||tz!==this.lastZ){
   let column=this.columns.get(tx);
   if(!column){column=new Map();this.columns.set(tx,column);}
   tile=column.get(tz);
   if(!tile){tile={values:new Float32Array(TILE*TILE),ready:new Uint8Array(TILE*TILE)};column.set(tz,tile);this.byteLength+=tile.values.byteLength+tile.ready.byteLength;}
   this.lastX=tx;this.lastZ=tz;this.lastTile=tile;
  }
  const index=(iz-tz*TILE)*TILE+ix-tx*TILE;
  if(!tile.ready[index]){
   const {spacing,footprint,samplesPerAxis:n}=this.settings;let total=0;
   // Fixed 3×3 (or 4×4) stratified cell-center samples over a 16 m square.
   for(let z=0;z<n;z++)for(let x=0;x<n;x++)total+=this.height(ix*spacing+((x+.5)/n-.5)*footprint,iz*spacing+((z+.5)/n-.5)*footprint);
   tile.values[index]=total/(n*n);tile.ready[index]=1;this.nodeCount++;
  }
  return tile.values[index];
 }
 sample(x,z){
  const step=this.settings.spacing,gx=x/step,gz=z/step,ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz;
  const a=this.node(ix,iz),b=this.node(ix+1,iz),c=this.node(ix,iz+1),d=this.node(ix+1,iz+1);
  return (a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v;
 }
}
export class RenderTerrainHeight {
 constructor(world,options={}){
  this.world=world;this.settings={...AVERAGED_TERRAIN,...options};
  if(!(this.settings.blendEnd>this.settings.blendStart&&this.settings.blendStart>0))throw Error('Invalid terrain blend distances');
  this.map=new AveragedHeightmap((x,z)=>world.height(x,z),this.settings);
 }
 weight(x,z,cx,cz){
  const {blendStart,blendEnd}=this.settings,t=Math.max(0,Math.min(1,(Math.hypot(x-cx,z-cz)-blendStart)/(blendEnd-blendStart)));
  return t*t*(3-2*t);
 }
 height(x,z,cx,cz){
  const weight=this.weight(x,z,cx,cz);
  if(weight===0)return this.world.height(x,z);
  const averaged=this.map.sample(x,z);if(weight===1)return averaged;
  const detailed=this.world.height(x,z);return detailed+(averaged-detailed)*weight;
 }
 sample(x,z,cx,cz,out,detailedHeight,detailedNormal){
  const {blendStart,blendEnd}=this.settings,r=Math.hypot(x-cx,z-cz),weight=this.weight(x,z,cx,cz);
  if(weight===0){out.height=detailedHeight??this.world.height(x,z);if(detailedNormal)Object.assign(out,detailedNormal);else this.world.normal(x,z,out);return out;}
  const map=this.map,e=.35,averaged=map.sample(x,z),ax=(map.sample(x+e,z)-map.sample(x-e,z))/(2*e),az=(map.sample(x,z+e)-map.sample(x,z-e))/(2*e);
  let gx=ax,gz=az;out.height=averaged;
  if(weight<1){
   const detailed=detailedHeight??this.world.height(x,z),n=detailedNormal??this.world.normal(x,z,out),dx=-n.x/n.y,dz=-n.z/n.y;
   const t=(r-blendStart)/(blendEnd-blendStart),derivative=6*t*(1-t)/(blendEnd-blendStart),delta=averaged-detailed;
   gx=dx+(ax-dx)*weight+delta*derivative*(x-cx)/r;gz=dz+(az-dz)*weight+delta*derivative*(z-cz)/r;
   out.height=detailed+delta*weight;
  }
  const length=Math.hypot(gx,1,gz);out.x=-gx/length;out.y=1/length;out.z=-gz/length;out.slope=Math.atan(Math.hypot(gx,gz))*180/Math.PI;return out;
 }
 normal(x,z,cx,cz,out){return this.sample(x,z,cx,cz,out);}
}
