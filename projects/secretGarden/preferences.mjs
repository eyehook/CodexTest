export const SETTINGS_VERSION=4;
export const SETTINGS_KEY='secretGarden.settings.v1';
export const DEFAULT_SETTINGS=Object.freeze({shadows:true,bees:3,heightOffset:0,moveSpeed:1,turnSpeed:45,teleport:true,snapTurn:true,snapAngle:30});
export function validateSettings(value){
 if(!value||typeof value.teleport!=='boolean'||typeof value.snapTurn!=='boolean'||![15,30,45].includes(value.snapAngle)||typeof value.shadows!=='boolean'||!Number.isInteger(value.bees)||value.bees<0||value.bees>10)throw new Error('Invalid settings');
 for(const [key,min,max] of [['heightOffset',0,1],['moveSpeed',.25,3],['turnSpeed',15,120]])if(!Number.isFinite(value[key])||value[key]<min||value[key]>max)throw new Error('Invalid VR settings');
 return Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map(key=>[key,value[key]]));
}
export class Preferences {
 constructor(storage){this.storage=storage;this.value={...DEFAULT_SETTINGS};this.error=false;this.exists=false;try{const raw=storage.getItem(SETTINGS_KEY);if(raw!==null){const parsed=JSON.parse(raw);if(parsed?.version!==SETTINGS_VERSION){storage.removeItem(SETTINGS_KEY);}else{this.value=validateSettings(parsed);this.exists=true;}}}catch{this.error=true;}}
 save(value){const next=validateSettings(value);this.storage.setItem(SETTINGS_KEY,JSON.stringify({version:SETTINGS_VERSION,...next}));this.value=next;this.error=false;this.exists=true;}
}
