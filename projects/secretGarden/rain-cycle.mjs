export const RAIN_LEVELS=['Never','Rarely','Sometimes','Often','Always'];
const CLEAR_INTERVALS=[[Infinity,Infinity],[600,1200],[300,600],[120,300],[0,0]];
const smooth=t=>t*t*(3-2*t);
export class RainCycle {
 constructor(level=2,random=Math.random){this.random=random;this.intensity=0;this.phase='clear';this.elapsed=0;this.level=-1;this.setLevel(level);}
 get overcast(){return this.intensity;}
 range(a,b){return a+(b-a)*this.random();}
 setLevel(level){
  if(!Number.isInteger(level)||level<0||level>4)throw new Error('Invalid rain frequency');
  if(level===this.level)return;const previous=this.level;this.level=level;
  if(level===0)this.clear();
  else if(level===4){this.phase='hold';this.peak=1;this.intensity=1;this.elapsed=0;this.duration=Infinity;}
  else if(previous===4){this.phase='fall';this.from=this.intensity;this.elapsed=0;this.duration=this.range(25,45);}
  else if(this.phase==='clear')this.clear();
 }
 clear(){this.phase='clear';this.elapsed=0;this.intensity=0;const [a,b]=CLEAR_INTERVALS[this.level];this.duration=this.level===0?Infinity:this.range(a,b);}
 advance(){
  this.elapsed=0;
  if(this.phase==='clear'){this.phase='rise';this.peak=this.range(.25,1);this.duration=this.range(20,40);}
  else if(this.phase==='rise'){this.phase='hold';this.duration=this.range(30,75);}
  else if(this.phase==='hold'){this.phase='fall';this.from=this.peak;this.duration=this.range(25,45);}
  else this.clear();
 }
 update(dt){
  if(!Number.isFinite(dt)||dt<0)return this.intensity;
  while(dt>0||this.duration===0){
   const step=Math.min(dt,this.duration-this.elapsed);this.elapsed+=step;dt-=step;
   const t=this.duration===Infinity?0:Math.min(1,this.elapsed/this.duration);
   this.intensity=this.phase==='rise'?this.peak*smooth(t):this.phase==='hold'?this.peak:this.phase==='fall'?this.from*(1-smooth(t)):0;
   if(this.elapsed>=this.duration)this.advance();else break;
  }
  return this.intensity;
 }
}
