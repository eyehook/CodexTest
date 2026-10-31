export const SAVE_VERSION=12;
export const SAVE_PREFIX='secretGarden.save.v1.';
const finite=Number.isFinite,vector=v=>Array.isArray(v)&&v.length===3&&v.every(finite);
export function validateSave(value){
 if(!value||value.version!==SAVE_VERSION||!finite(value.savedAt)||!Array.isArray(value.plants))throw new Error('Invalid garden save');
 for(const p of value.plants){
  if(!p||!Number.isInteger(p.seed)||p.seed<0||p.seed>4294967295||!vector(p.position)||!finite(p.rotationY)||!finite(p.scale)||p.scale<=0||p.scale>2||!finite(p.age)||p.age<0||p.age>10||!['ground','wall'].includes(p.surface))throw new Error('Invalid saved plant');
  if(p.surface==='wall'){
   const b=p.bounds;if(!Number.isInteger(p.wallId)||p.wallId<0||p.wallId>3||!b||!['minX','maxX','minY','maxY'].every(k=>finite(b[k]))||b.minX>b.maxX||b.minY>b.maxY||(b.wrapDepth!==undefined&&(!finite(b.wrapDepth)||b.wrapDepth<=0)))throw new Error('Invalid saved vine');
   if(b.exclusions!==undefined&&(!Array.isArray(b.exclusions)||!b.exclusions.every(e=>e&&['minX','maxX','minY','maxY'].every(k=>finite(e[k])))))throw new Error('Invalid saved vine bounds');
  }
 }
 return {version:SAVE_VERSION,savedAt:value.savedAt,plants:value.plants};
}
export class GardenSaves {
 constructor(storage){this.storage=storage;this.slots=[null,null,null];this.errors=[];this.refresh();}
 refresh(){
  this.errors=[];
  for(let i=0;i<3;i++){
   this.slots[i]=null;
   try{
    const key=SAVE_PREFIX+i,raw=this.storage.getItem(key);if(raw===null)continue;
    const parsed=JSON.parse(raw);
    if(parsed?.version!==SAVE_VERSION){this.storage.removeItem(key);continue;}
    this.slots[i]=validateSave(parsed);
   }catch{this.errors.push(i);}
  }
 }
 latest(){return this.slots.reduce((best,slot,index)=>slot&&(!best||slot.savedAt>best.save.savedAt)?{index,save:slot}:best,null);}
 save(index,data){
  if(!Number.isInteger(index)||index<0||index>2)throw new Error('Invalid save slot');
  const savedAt=Math.max(Date.now(),...this.slots.map(s=>(s?.savedAt??0)+1));
  const save=validateSave({plants:data.plants,version:SAVE_VERSION,savedAt});
  // Commit in-memory labels only after durable storage succeeds (including overwrites).
  this.storage.setItem(SAVE_PREFIX+index,JSON.stringify(save));this.slots[index]=save;return save;
 }
}
