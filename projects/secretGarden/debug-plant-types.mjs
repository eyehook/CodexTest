import {generatePlant} from './generator.mjs?v=82';
export const DEBUG_PLANT_TYPES=[
 {id:'flower',label:'Flowers',form:'flower'}, {id:'bush',label:'Shrubs',form:'bush'},
 {id:'grass',label:'Grass',form:'grass'}, {id:'vine',label:'Ivy',surface:'wall'},
 ...[['rounded','Rounded'],['open','Open leaf'],['pine','Pine'],['columnar','Cypress'],['umbrella','Umbrella']].map(([treeForm,label])=>({id:treeForm,label:'Tree · '+label,form:'tree',treeForm}))
];
export function selectPlantSeed(id,randomSeed,exclude=null){
 if(id==='random')return {seed:null,surface:null};
 const type=DEBUG_PLANT_TYPES.find(t=>t.id===id);if(!type)throw new Error('Unknown plant type');
 const start=randomSeed()>>>0;if(type.surface==='wall')return {seed:start===exclude?(start+0x9e3779b1)>>>0:start,surface:'wall'};
 // Search per debug placement using ordinary seeds; avoid repeating the last seed.
 for(let i=0;i<512;i++){const seed=(start+Math.imul(i,0x9e3779b1))>>>0,p=seed===exclude?null:generatePlant(seed).parameters;if(p&&p.form===type.form&&(!type.treeForm||p.treeForm===type.treeForm))return {seed,surface:'ground'};}
 throw new Error('No matching seed found');
}
