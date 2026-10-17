import {elevationLimits} from './TreeGenerator.mjs';

const fields=[
 ['treesPerCluster','Tree density (per cluster)',0,80,1],
 ['visibilityDistance','Tree streaming radius (m)',150,1200,10],
 ['minHeight','Minimum tree height (m)',1,16,0.5],
 ['maxHeight','Maximum tree height (m)',1,20,0.5],
 ['seed','Tree seed',0,4294967295,1],
 ['cellSize','Tree cell size (m)',32,128,1],
 ['clusterProbability','Cluster probability',0,1,0.05],
 ['clusterRadius','Cluster radius (m)',5,40,1],
 ['widthRatio','Tree width / height',0.2,0.8,0.01],
 ['minElevation','Minimum elevation (blank = beach)',-1000,1000,0.5],
 ['maxElevation','Maximum elevation (blank = snow)',-1000,1000,0.5],
 ['cutoffDistance','Tree cutoff distance (m)',10,1199,10],
 ['baseSink','Tree base sink (m)',0,1,0.05]
];
const generationKeys=['treesPerCluster','visibilityDistance','minHeight','maxHeight','seed',
 'cellSize','clusterProbability','clusterRadius','widthRatio','minElevation','maxElevation'];

export function addTreeControls(parent,config,terrain){
 const heading=document.createElement('h3');heading.textContent='Trees';parent.append(heading);
 const label=document.createElement('label'),show=document.createElement('input');
 label.textContent='Show trees';show.type='checkbox';show.checked=config.enabled;
 show.id='showTrees';show.onchange=()=>{config.enabled=show.checked;};label.append(show);parent.append(label);
 const inputs=new Map();
 for(const [key,title,min,max,step]of fields){
  const row=document.createElement('label'),input=document.createElement('input');row.textContent=title;
  input.type='number';input.min=min;input.max=max;input.step=step;input.id=`tree-${key}`;
  input.value=config[key]??'';row.append(input);parent.append(row);inputs.set(key,input);
 }
 function updatePlaceholders(){
  const limits=elevationLimits(terrain,config);
  inputs.get('minElevation').placeholder=`Auto ${limits.min.toFixed(2)} m`;
  inputs.get('maxElevation').placeholder=`Auto ${limits.max.toFixed(2)} m`;
 }
 updatePlaceholders();
 return {apply(){
  let regenerate=false;
  for(const [key,,min,max]of fields){
   const input=inputs.get(key),optional=key==='minElevation'||key==='maxElevation';
   let value=optional&&input.value===''?null:Number(input.value);
   if(value!==null){
    if(!Number.isFinite(value))value=config[key]??min;
    value=Math.min(max,Math.max(min,value));
    if(['seed','cellSize','treesPerCluster'].includes(key))value=Math.round(value);
   }
   if(generationKeys.includes(key)&&value!==config[key])regenerate=true;
   config[key]=value;input.value=value??'';
  }
  config.maxHeight=Math.max(config.minHeight,config.maxHeight);
  config.cutoffDistance=Math.min(config.cutoffDistance,config.visibilityDistance-1);
  for(const key of ['maxHeight','cutoffDistance'])inputs.get(key).value=config[key];
  updatePlaceholders();return regenerate;
 }};
}
