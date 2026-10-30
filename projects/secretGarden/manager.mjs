import {generatePlant,GROWTH_SECONDS} from './generator.mjs?v=23';
export class PlantManager {
  constructor(renderer,randomSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0],randomRotation=()=>Math.random()*Math.PI*2,randomScale=()=>.8+Math.random()*.4) {
    this.renderer=renderer;this.randomSeed=randomSeed;this.randomRotation=randomRotation;this.randomScale=randomScale;this.instances=new Map();this.growing=new Set();this.clonedSeed=null;this.nextId=1;this.revision=0;
  }
  plant(position,now) {
    const seed=this.clonedSeed??this.randomSeed(),id=this.nextId++,structure=generatePlant(seed);
    const instance={id,seed,position:position.clone(),rotationY:this.randomRotation(),scale:this.clonedSeed===null?1:this.randomScale(),structure,born:now,state:'growing'};
    instance.visual=this.renderer.create(structure,position,id,instance.rotationY,instance.scale);this.instances.set(id,instance);this.growing.add(instance);this.revision++;this.renderer.update(instance,0);return instance;
  }
  copy(id) {this.clonedSeed=this.instances.get(id)?.seed??null;}
  remove(id) {const p=this.instances.get(id);if(!p)return;this.growing.delete(p);this.renderer.remove(p.visual);this.instances.delete(id);this.revision++;}
  update(now) {for(const p of this.growing){const age=Math.max(0,now-p.born);this.renderer.update(p,Math.min(age,GROWTH_SECONDS));if(age>=GROWTH_SECONDS){p.state='mature';this.renderer.mature?.(p);this.growing.delete(p);}}this.renderer.flush?.();}
  get label(){return this.clonedSeed===null?'RANDOM':`CLONE: ${this.clonedSeed}`;}
  get targets(){return [...this.instances.values()].map(p=>p.visual.group);}
}
