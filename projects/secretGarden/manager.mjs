import {Vector3} from '../../shared/vendor/three-r180/three.module.js';
import {selectPlantSeed,DEBUG_PLANT_TYPES} from './debug-plant-types.mjs?v=89';
import {generatePlant,GROWTH_SECONDS} from './generator.mjs?v=89';
import {generateVine} from './vine-generator.mjs?v=89';
import {doorwayPlantingBlocked,gardenGroundContains,vineDoorExclusion} from './garden-layout.mjs?v=46';
export class PlantManager {
  constructor(renderer,randomSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0],randomRotation=()=>Math.random()*Math.PI*2,randomScale=()=>.8+Math.random()*.4) {
    this.renderer=renderer;this.randomSeed=randomSeed;this.randomRotation=randomRotation;this.randomScale=randomScale;this.instances=new Map();this.growing=new Set();this.clonedSeed=null;this.clonedSurface=null;this.debugType=null;this.lastDebugSeed=null;this.nextId=1;this.revision=0;this.shadowRevision=0;
  }
  chooseType(id){if(id!=='random'&&!DEBUG_PLANT_TYPES.some(type=>type.id===id))throw new Error('Unknown plant type');this.copy(null);this.debugType=id==='random'?null:id;}
  canDebug(surface='ground'){return this.debugType!==null&&(this.debugType==='vine'?'wall':'ground')===surface;}
  canClone(surface='ground') {return this.clonedSeed!==null&&(this.clonedSurface??'ground')===surface;}
  plant(position,now,surface=null) {
    const type=surface?.type??'ground',cloning=this.canClone(type),debugging=this.canDebug(type);
    if(this.debugType!==null&&!debugging)return null;
    if(type==='ground'&&!gardenGroundContains(position)||type==='wall'&&doorwayPlantingBlocked(position)||!['ground','wall'].includes(type))return null;
    const seed=debugging?selectPlantSeed(this.debugType,this.randomSeed,this.lastDebugSeed).seed:cloning?this.clonedSeed:this.randomSeed(),id=this.nextId++;
    let structure,rotationY,scale,placement=position.clone();
    if(type==='wall') {
      rotationY=surface.yaw;scale=cloning?this.randomScale():1;
      const along=position.x*Math.cos(rotationY)-position.z*Math.sin(rotationY);
      const bounds={minX:-surface.halfLength-along+.045,maxX:surface.halfLength-along-.045,minY:-position.y+.025,maxY:surface.height-position.y-.025};
      if(surface.adjacentHalfLength)bounds.wrapDepth=surface.adjacentHalfLength*2-.09;
      for(const key of Object.keys(bounds))bounds[key]/=scale;
      if(bounds.minX>0||bounds.maxX<0||bounds.minY>0||bounds.maxY<0)return null;
      bounds.exclusions=vineDoorExclusion(bounds,surface,position.y,scale);
      structure=generateVine(seed,bounds);
      placement.addScaledVector(surface.normal,.045);
    } else {
      structure=generatePlant(seed);rotationY=this.randomRotation();scale=cloning?this.randomScale():1;
    }
    const instance={id,seed,position:placement,surface:type,support:surface,rotationY,scale,structure,born:now,state:'growing'};
    instance.visual=this.renderer.create(structure,placement,id,rotationY,scale);this.instances.set(id,instance);this.growing.add(instance);this.revision++;if(!['grass','vine'].includes(structure.parameters.form))this.shadowRevision++;this.renderer.update(instance,0);if(debugging)this.lastDebugSeed=seed;else if(!cloning)this.copy(null);return instance;
  }
  snapshot(now) {
    return [...this.instances.values()].map(p=>({seed:p.seed,position:p.position.toArray(),rotationY:p.rotationY,scale:p.scale,surface:p.surface,wallId:p.support?.id??null,bounds:p.structure.bounds??null,age:Math.min(GROWTH_SECONDS,Math.max(0,now-p.born))}));
  }
  restore(records,now,surfaces=[]) {
    // Prepare every deterministic structure before replacing the current garden.
    const prepared=records.map(record=>{
      const support=record.surface==='wall'?surfaces.find(s=>s.id===record.wallId):null;
      if(record.surface==='wall'&&!support)throw new Error('Saved wall is unavailable');
      return {...record,position:new Vector3().fromArray(record.position),support,structure:record.surface==='wall'?generateVine(record.seed,record.bounds):generatePlant(record.seed)};
    });
    this.reset();
    for(const record of prepared){
      const id=this.nextId++,instance={...record,id,born:now-record.age,state:'growing'};
      instance.visual=this.renderer.create(instance.structure,instance.position,id,instance.rotationY,instance.scale);
      this.instances.set(id,instance);this.growing.add(instance);
    }
    this.update(now);
  }
  copy(id) {this.debugType=null;this.lastDebugSeed=null;const p=this.instances.get(id);this.clonedSeed=p?.seed??null;this.clonedSurface=p?(p.surface??'ground'):null;}
  remove(id) {const p=this.instances.get(id);if(!p)return;this.growing.delete(p);this.renderer.remove(p.visual);this.instances.delete(id);this.revision++;if(!['grass','vine'].includes(p.structure.parameters.form))this.shadowRevision++;}
  reset() {
    for(const p of this.instances.values())this.renderer.remove(p.visual,{flush:false});
    this.renderer.flush?.();this.instances.clear();this.growing.clear();this.copy(null);this.nextId=1;
    this.revision++;this.shadowRevision++;
  }
  update(now) {for(const p of this.growing){const age=Math.max(0,now-p.born);this.renderer.update(p,Math.min(age,GROWTH_SECONDS));if(age>=GROWTH_SECONDS){p.state='mature';this.renderer.mature?.(p);this.growing.delete(p);}}this.renderer.flush?.();}
  get hasGrowingShadows(){for(const p of this.growing)if(!['grass','vine'].includes(p.structure.parameters.form))return true;return false;}
  get label(){if(this.debugType!==null)return 'DEBUG: '+this.debugType;return this.clonedSeed===null?'RANDOM':`CLONE: ${this.clonedSeed}`;}
  get targets(){return [...this.instances.values()].map(p=>p.visual.group);}
}
