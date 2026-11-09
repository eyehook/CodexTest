// One ambient loop; no positional attenuation inside the garden or control room.
export class RainAudio {
 constructor({createContext=()=>new AudioContext(),load=()=>fetch(new URL('../../assets/secretGarden/audio/rainfall.mp3',import.meta.url)).then(r=>{if(!r.ok)throw Error('Rain audio unavailable');return r.arrayBuffer();})}={}){
  this.createContext=createContext;this.load=load;this.enabled=true;this.intensity=0;this.active=true;this.disposed=false;
 }
 setEnabled(value){this.enabled=!!value;this.apply();}
 update(intensity,active=true){this.intensity=Math.max(0,Math.min(1,intensity));this.active=active;this.apply();}
 apply(){if(this.gain)this.gain.gain.setTargetAtTime(this.enabled&&this.active?this.intensity:0,this.context.currentTime,.08);}
 async unlock(){
  if(this.disposed)return;
  try{
   if(!this.context){this.context=this.createContext();this.gain=this.context.createGain();this.gain.gain.value=0;this.gain.connect(this.context.destination);}
   const resumed=this.context.resume();
   if(!this.loading)this.loading=this.load().then(data=>this.context.decodeAudioData(data)).then(buffer=>{
    if(this.disposed)return;this.source=this.context.createBufferSource();this.source.buffer=buffer;this.source.loop=true;this.source.connect(this.gain);this.source.start();this.apply();
   }).catch(()=>{this.loading=null;});
   await resumed;
  }catch{/* Browsers can deny autoplay; the next user gesture retries. */}
 }
 dispose(){this.disposed=true;this.source?.stop();this.context?.close();}
}
