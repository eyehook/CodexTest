export class Sound {
  constructor(){this.last=0;}
  unlock(){if(!this.ctx){const Audio=window.AudioContext||window.webkitAudioContext;if(Audio)this.ctx=new Audio();}this.ctx?.resume().catch(()=>{});}
  play(kind,strength=1,x=0){
    const c=this.ctx;if(!c||c.state!=='running')return;
    const now=c.currentTime,impact=kind==='rail'||kind==='mallet';if(impact&&now-this.last<.035)return;if(impact)this.last=now;
    const goal=kind==='goal'||kind==='won';const o=c.createOscillator(),g=c.createGain(),pan=c.createStereoPanner();
    o.type=impact?'triangle':'sine';o.frequency.setValueAtTime(impact?(kind==='rail'?460:730):goal?660:360,now);o.frequency.exponentialRampToValueAtTime(goal?1100:180,now+(goal?.3:.055));
    g.gain.setValueAtTime(Math.min(.13,impact?.025+strength*.012:.08),now);g.gain.exponentialRampToValueAtTime(.001,now+(goal?.4:.085));pan.pan.value=Math.max(-.65,Math.min(.65,x));o.connect(g).connect(pan).connect(c.destination);o.start(now);o.stop(now+(goal?.45:.1));o.onended=()=>{o.disconnect();g.disconnect();pan.disconnect();};
  }
}
