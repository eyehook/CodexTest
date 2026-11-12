// Non-positional stereo bed: two persistent lanes, five reusable decoded buffers.
// AudioBufferSourceNodes are one-shot; only their cheap playback nodes are renewed.
export const FOREST_CLIPS=Object.freeze(Array.from({length:5},(_,i)=>{
 const id=`forest-${String(i+1).padStart(2,'0')}`;
 return Object.freeze({id,ogg:new URL(`../../assets/hike/audio/${id}.ogg`,import.meta.url),mp3:new URL(`../../assets/hike/audio/${id}.mp3`,import.meta.url)});
}));
export function equalPowerCurves(samples=128){
 const incoming=new Float32Array(samples),outgoing=new Float32Array(samples);
 for(let i=0;i<samples;i++){const angle=i/(samples-1)*Math.PI/2;incoming[i]=Math.sin(angle);outgoing[i]=Math.cos(angle);}
 incoming[0]=outgoing[samples-1]=0;incoming[samples-1]=outgoing[0]=1;
 return {incoming,outgoing};
}
export function nextForestClip(previous,count,random=Math.random){
 if(count<2)throw Error('Forest ambience requires at least two clips');
 const choice=Math.min(count-(previous>=0?2:1),Math.floor(random()*(count-(previous>=0?1:0))));
 return previous>=0&&choice>=previous?choice+1:choice;
}
const hold=(param,time)=>{
 if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(time);
 else {const value=param.value;param.cancelScheduledValues(time);param.setValueAtTime(value,time);}
};
export class ForestAmbience {
 constructor({createContext=()=>new AudioContext({sampleRate:32000,latencyHint:'playback'}),
  loadClip=async(index,format,signal)=>{const response=await fetch(FOREST_CLIPS[index][format],{signal});if(!response.ok)throw Error(`Forest clip ${index+1}: HTTP ${response.status}`);return response.arrayBuffer();},
  preferOgg=()=>!!document.createElement('audio').canPlayType('audio/ogg; codecs="vorbis"'),random=Math.random,
  setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id),defer=fn=>queueMicrotask(fn),crossfade=5,lookahead=60,volume=.35}={}){
  Object.assign(this,{createContext,loadClip,preferOgg,random,setTimer,clearTimer,defer,crossfade,lookahead,volume});
  this.curves=equalPowerCurves();this.sources=new Set();this.previous=-1;this.active=false;this.playing=false;this.disposed=false;this.pendingSync=false;this.abort=new AbortController();
  this.stats={scheduled:0,lateRecoveries:0};this.error=null;this.formats=[];
 }
 // Called directly by an existing gesture: resume must precede any await/fetch.
 async unlock(){
  if(this.disposed)return false;
  try{
   if(!this.context){
    this.context=this.createContext();this.master=this.context.createGain();this.master.gain.value=0;this.master.connect(this.context.destination);
    this.lanes=Array.from({length:2},()=>{const gain=this.context.createGain();gain.gain.value=0;gain.connect(this.master);return gain;});
    this.context.onstatechange=()=>this.requestSync();
   }
   if(this.suspendTimer){this.clearTimer(this.suspendTimer);this.suspendTimer=null;}
   const resumed=this.context.state==='running'?Promise.resolve():this.context.resume();
   // Consume resume rejection immediately, including while assets are loading.
   const resumeResult=Promise.resolve(resumed).catch(error=>{this.error=error.message;});
   if(!this.loading)this.loading=this.loadBuffers().catch(error=>{this.loading=null;if(!this.disposed)this.error=error.message;});
   await Promise.all([resumeResult,this.loading]);
   if(this.disposed)return false;this.requestSync();return this.context.state==='running'&&!!this.buffers;
  }catch(error){this.error=error.message;return false;}
 }
 async loadBuffers(){
  const formats=this.preferOgg()?['ogg','mp3']:['mp3'];const buffers=[];
  // Sequential decode bounds temporary memory; assets are fetched only once.
  for(let i=0;i<FOREST_CLIPS.length;i++){
   let decoded,lastError;
   for(const format of formats){
    try{
     const bytes=await this.loadClip(i,format,this.abort.signal);if(this.disposed)return;
     decoded=await this.context.decodeAudioData(bytes);if(this.disposed)return;
     if(decoded.numberOfChannels!==2||!Number.isFinite(decoded.duration)||decoded.duration<15||decoded.duration>30||decoded.duration<=2*this.crossfade)throw Error('Invalid forest clip');
     this.formats[i]=format;break;
    }catch(error){lastError=error;decoded=null;if(this.disposed)return;}
   }
   if(!decoded)throw lastError;buffers.push(decoded);
  }
  this.buffers=buffers;this.error=null;
 }
 // The render loop can report an activity EDGE only; automation/node creation
 // runs in the deferred callback or the independent five-second scheduler.
 setActive(value){value=!!value;if(this.disposed||value===this.active)return;this.active=value;this.requestSync();}
 requestSync(){
  if(this.disposed||this.pendingSync)return;this.pendingSync=true;
  this.defer(()=>{this.pendingSync=false;if(this.disposed)return;try{this.sync();}catch(error){this.error=error.message;this.halt();}});
 }
 sync(){
  if(!this.active){if(this.playing)this.halt();return;}
  if(!this.context||!this.buffers)return;
  if(this.suspendTimer){this.clearTimer(this.suspendTimer);this.suspendTimer=null;}
  if(this.context.state!=='running'){
   // Visibility/tracking recovery may resume without a fresh gesture. Rejection
   // is harmless; a click/controller gesture retries unlock().
   if(!this.resuming){this.resuming=true;Promise.resolve(this.context.resume()).catch(()=>{}).finally(()=>{this.resuming=false;if(this.context.state==='running')this.requestSync();});}
   return;
  }
  if(this.playing)return;
  this.playing=true;this.lane=0;const now=this.context.currentTime;
  this.nextStart=now+.25;
  if(this.retireUntil>now){
   // Preserve an in-flight stop fade during rapid restart; otherwise retiring
   // sources would be cut off at full master gain when their stop time arrives.
   this.master.gain.setValueAtTime(0,this.retireUntil);
   this.master.gain.linearRampToValueAtTime(this.volume,this.nextStart);
  }else {hold(this.master.gain,now);this.master.gain.linearRampToValueAtTime(this.volume,now+.2);}
  this.schedule();
 }
 schedule(){
  if(!this.playing||this.disposed)return;
  const now=this.context.currentTime;
  if(this.context.state==='running'){
   if(this.nextStart<now+.05){this.nextStart=now+.08;this.stats.lateRecoveries++;}
   while(this.nextStart<now+this.lookahead){
    const index=nextForestClip(this.previous,this.buffers.length,this.random),buffer=this.buffers[index],start=this.nextStart,end=start+buffer.duration;
    const lane=this.lanes[this.lane],source=this.context.createBufferSource();source.buffer=buffer;source.connect(lane);
    lane.gain.setValueCurveAtTime(this.curves.incoming,start,this.crossfade);
    lane.gain.setValueCurveAtTime(this.curves.outgoing,end-this.crossfade,this.crossfade);
    const record={source,index,start,end,lane:this.lane};this.sources.add(record);
    source.onended=()=>{source.disconnect();source.buffer=null;this.sources.delete(record);};
    source.start(start);source.stop(end);this.previous=index;this.lane=1-this.lane;this.nextStart=end-this.crossfade;this.stats.scheduled++;
   }
  }
  this.timer=this.setTimer(()=>{this.timer=null;try{this.schedule();}catch(error){this.error=error.message;this.halt();}},5000);
 }
 halt(){
  if(!this.context)return;
  this.playing=false;if(this.timer){this.clearTimer(this.timer);this.timer=null;}
  const now=this.context.currentTime;let audible=null;
  for(const record of this.sources)if(record.start<=now&&record.end>now&&(!audible||record.start>audible.start))audible=record;
  if(audible)this.previous=audible.index;
  hold(this.master.gain,now);this.master.gain.linearRampToValueAtTime(0,now+.15);
  // Hold lane automation while the master fades. A restart begins after .25 s,
  // beyond these retiring sources, so each lane has at most one sounding clip.
  for(const lane of this.lanes)hold(lane.gain,now);
  this.retireUntil=now+.16;
  for(const {source} of this.sources)try{source.stop(this.retireUntil);}catch{}
  if(this.suspendTimer)this.clearTimer(this.suspendTimer);
  this.suspendTimer=this.setTimer(()=>{this.suspendTimer=null;if(!this.active&&!this.disposed)Promise.resolve(this.context.suspend()).catch(()=>{});},220);
 }
 stop(){this.setActive(false);}
 dispose(){
  if(this.disposed)return;this.disposed=true;this.active=false;this.playing=false;this.abort.abort();
  if(this.timer)this.clearTimer(this.timer);if(this.suspendTimer)this.clearTimer(this.suspendTimer);
  for(const {source} of this.sources){source.onended=null;try{source.stop();}catch{}source.disconnect();source.buffer=null;}
  this.sources.clear();this.buffers=null;this.loading=null;
  for(const lane of this.lanes??[])lane.disconnect();this.master?.disconnect();
  if(this.context){this.context.onstatechange=null;Promise.resolve(this.context.close()).catch(()=>{});}
 }
}
// Reuse the host's existing XR session; no new controls or source positioning.
export function bindForestAudio(session,audio){
 const unlock=()=>void audio.unlock(),visibility=()=>{if(session.visibilityState!=='visible')audio.setActive(false);};
 session.addEventListener('selectstart',unlock);session.addEventListener('squeezestart',unlock);session.addEventListener('visibilitychange',visibility);
 const cleanup=()=>{session.removeEventListener('selectstart',unlock);session.removeEventListener('squeezestart',unlock);session.removeEventListener('visibilitychange',visibility);};
 session.addEventListener('end',cleanup,{once:true});return cleanup;
}
