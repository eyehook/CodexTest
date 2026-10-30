import {generatePlant,GROWTH_SECONDS} from './generator.mjs?v=51';
import {generateVine} from './vine-generator.mjs?v=41';
import {doorwayPlantingBlocked,gardenGroundContains,vineDoorExclusion} from './garden-layout.mjs?v=46';
export class PlantManager {
  constructor(renderer,randomSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0],randomRotation=()=>Math.random()*Math.PI*2,randomScale=()=>.8+Math.random()*.4) {
    this.renderer=renderer;this.randomSeed=randomSeed;this.randomRotation=randomRotation;this.randomScale=randomScale;this.instances=new Map();this.growing=new Set();this.clonedSeed=null;this.clonedSurface=null;this.nextId=1;this.revision=0;this.shadowRevision=0;
  }
  canClone(surface='ground') {return this.clonedSeed!==null&&(this.clonedSurface??'ground')===surface;}
  plant(position,now,surface=null) {
    const type=surface?.type??'ground',cloning=this.canClone(type);
    if(type==='ground'&&!gardenGroundContains(position)||type==='wall'&&doorwayPlantingBlocked(position)||!['ground','wall'].includes(type))return null;
    const seed=cloning?this.clonedSeed:this.randomSeed(),id=this.nextId++;
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
    instance.visual=this.renderer.create(structure,placement,id,rotationY,scale);this.instances.set(id,instance);this.growing.add(instance);this.revision++;if(!['grass','vine'].includes(structure.parameters.form))this.shadowRevision++;this.renderer.update(instance,0);if(!cloning)this.copy(null);return instance;
  }
  copy(id) {const p=this.instances.get(id);this.clonedSeed=p?.seed??null;this.clonedSurface=p?(p.surface??'ground'):null;}
  remove(id) {const p=this.instances.get(id);if(!p)return;this.growing.delete(p);this.renderer.remove(p.visual);this.instances.delete(id);this.revision++;if(!['grass','vine'].includes(p.structure.parameters.form))this.shadowRevision++;}
  reset() {
    for(const p of this.instances.values())this.renderer.remove(p.visual,{flush:false});
    this.renderer.flush?.();this.instances.clear();this.growing.clear();this.copy(null);this.nextId=1;
    this.revision++;this.shadowRevision++;
  }
  update(now) {for(const p of this.growing){const age=Math.max(0,now-p.born);this.renderer.update(p,Math.min(age,GROWTH_SECONDS));if(age>=GROWTH_SECONDS){p.state='mature';this.renderer.mature?.(p);this.growing.delete(p);}}this.renderer.flush?.();}
  get hasGrowingShadows(){for(const p of this.growing)if(!['grass','vine'].includes(p.structure.parameters.form))return true;return false;}
  get label(){return this.clonedSeed===null?'RANDOM':`CLONE: ${this.clonedSeed}`;}
  get targets(){return [...this.instances.values()].map(p=>p.visual.group);}
}
