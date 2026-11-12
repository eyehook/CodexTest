export const COLUMNS=Object.freeze(['activeMs','intervalMs','cpuMs','navigationMs','terrainCheckMs','terrainApplyMs','terrainSnaps','terrainWorkerMs','terrainLatencyMs','pineMs','shadowMs','shadowRebuilds','grassMs','grassJobs','grassWorkerMs','renderSubmitMs','gpuMs','estimatedUploadBytes','colorTriangles','colorDrawCalls','pines','grassBlades','shadowCasters','x','y','z','movement','shadows','heightOffset','airspeed']);
export const COLUMN=Object.freeze(Object.fromEntries(COLUMNS.map((name,i)=>[name,i])));
export const MAX_FRAMES=8192;
function statistics(values){
 values=values.filter(Number.isFinite).sort((a,b)=>a-b);
 if(!values.length)return {samples:0,mean:null,p50:null,p95:null,p99:null,max:null};
 const at=q=>values[Math.min(values.length-1,Math.ceil(q*values.length)-1)];
 return {samples:values.length,mean:values.reduce((a,b)=>a+b,0)/values.length,p50:at(.5),p95:at(.95),p99:at(.99),max:values.at(-1)};
}
export function buildProfileReport({metadata,buffer,count,reason}){
 const data=new Float64Array(buffer),stride=COLUMNS.length,samples=[];
 for(let i=0;i<count;i++)samples.push(Array.from(data.subarray(i*stride,(i+1)*stride),value=>Number.isFinite(value)?value:null));
 const timing={};
 for(const key of ['intervalMs','cpuMs','navigationMs','terrainCheckMs','terrainApplyMs','pineMs','shadowMs','grassMs','renderSubmitMs','gpuMs'])timing[key]=statistics(samples.map(row=>row[COLUMN[key]]).filter(value=>value!==null&&(key!=='intervalMs'||value>0)));
 const sum=key=>samples.reduce((total,row)=>total+(row[COLUMN[key]]??0),0);
 const target=metadata.xrFrameRate>0?1000/metadata.xrFrameRate:null;
 const worstFrames=samples.map((row,index)=>({frame:index,intervalMs:row[COLUMN.intervalMs]??0})).sort((a,b)=>b.intervalMs-a.intervalMs).slice(0,10).map(({frame})=>Object.fromEntries(['activeMs','intervalMs','cpuMs','terrainApplyMs','terrainSnaps','shadowMs','shadowRebuilds','grassMs','grassJobs','renderSubmitMs','gpuMs','x','y','z','movement'].map(key=>[key,samples[frame][COLUMN[key]]]).concat([['frame',frame]])));
 const summary={frames:count,activeSeconds:count?samples.at(-1)[COLUMN.activeMs]/1000:0,reason,timing,terrainSnaps:sum('terrainSnaps'),grassJobs:sum('grassJobs'),estimatedUploadBytes:sum('estimatedUploadBytes'),lateCallbacks:target?samples.filter(row=>row[COLUMN.intervalMs]>target*1.5).length:null,averageCallbackFps:timing.intervalMs.mean?1000/timing.intervalMs.mean:null,worstFrames};
 const report={schemaVersion:1,project:'hike',captureId:metadata.captureId,metadata,columns:COLUMNS,samples,summary,notes:{cpu:'Application callback timing, including driver submission; terrainApplyMs can happen between callbacks and is reported separately.',gpu:'Sampled application render scope only; asynchronous results. Null means unavailable/not sampled/invalid. Excludes compositor and other apps.',cadence:'Callback intervals and late callbacks are not compositor dropped-frame counts.',uploads:'Estimated changed attribute bytes, not measured GPU transfer latency.',movement:'0=walking, 1=gliding, 2=landing runout',units:'Times are milliseconds, positions/heights metres, sizes bytes, other values counts/booleans.'}};
 return {json:JSON.stringify(report),summary,captureId:metadata.captureId};
}
