import {generatePlant} from './generator.mjs?v=124';
export const SPAWN_MENU_ITEMS=[
 {id:'flower',label:'Flowers',form:'flower'}, {id:'bush',label:'Shrubs',form:'bush'},
 {label:'Grass',children:[{id:'grass',label:'Grass',form:'grass',seedHeads:false}, {id:'seed-grass',label:'Seeded grass',form:'grass',seedHeads:true}]}, {id:'fern',label:'Ferns',form:'fern'}, {id:'vine',label:'Ivy',surface:'wall'},
 {label:'Mushrooms',children:[['bolete','Bolete'],['fly-agaric','Fly agaric'],['chanterelle','Chanterelle']].map(([mushroomForm,label])=>({id:mushroomForm,label,form:'mushroom',mushroomForm}))},
 {label:'Trees',children:[['rounded','Rounded'],['open','Open leaf'],['pine','Pine'],['columnar','Cypress'],['umbrella','Umbrella']].map(([treeForm,label])=>({id:treeForm,label,form:'tree',treeForm}))}
];
export function flattenSpawnItems(items){return items.flatMap(item=>item.children?flattenSpawnItems(item.children):[item]);}
export const SPAWN_PLANT_TYPES=flattenSpawnItems(SPAWN_MENU_ITEMS);
export function selectPlantSeed(id,randomSeed,exclude=null){
 if(id==='random')return {seed:null,surface:null};
 const type=SPAWN_PLANT_TYPES.find(t=>t.id===id);if(!type)throw new Error('Unknown plant type');
 const start=randomSeed()>>>0;if(type.surface==='wall')return {seed:start===exclude?(start+0x9e3779b1)>>>0:start,surface:'wall'};
 // Search per spawn placement using ordinary seeds; avoid repeating the last seed.
 for(let i=0;i<512;i++){const seed=(start+Math.imul(i,0x9e3779b1))>>>0,p=seed===exclude?null:generatePlant(seed).parameters;if(p&&p.form===type.form&&(!type.treeForm||p.treeForm===type.treeForm)&&(!type.mushroomForm||p.mushroomForm===type.mushroomForm)&&(type.seedHeads===undefined||p.seedHeads===type.seedHeads))return {seed,surface:'ground'};}
 throw new Error('No matching seed found');
}
