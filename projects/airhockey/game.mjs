import {C,Physics,mallet,constrain,limitVelocity} from './physics.mjs';
import {Opponent} from './ai.mjs';
export class Game {
  constructor(onEvent=()=>{},random=Math.random){this.onEvent=onEvent;this.physics=new Physics((...args)=>onEvent(...args));this.ai=new Opponent(random);this.player=mallet(1);this.enemy=mallet(-1);this.mallets=[this.player,this.enemy];this.target={x:0,z:.88};this.skill=50;this.height=.8;this.scores=[0,0];this.newGame();}
  newGame(){this.scores.fill(0);this.ai.reset();Object.assign(this.enemy,mallet(-1));this.serve=0;this.state='ready';this.timer=1;this.message='READY • FIRST TO 7';this.resetPuck();this.onEvent('reset');}
  resetPuck(){Object.assign(this.physics.puck,{x:0,z:this.serve*.48,vx:0,vz:0});this.possession=0;this.owner=0;this.stall=0;}
  setTarget(x,z,discontinuous=false){this.target.x=x;this.target.z=z;constrain(this.target,1);if(discontinuous||Math.hypot(this.target.x-this.player.x,this.target.z-this.player.z)>.32){this.player.x=this.player.px=this.target.x;this.player.z=this.player.pz=this.target.z;this.player.vx=this.player.vz=0;}}
  step(dt){
    const m=this.player;m.px=m.x;m.pz=m.z;m.x=this.target.x;m.z=this.target.z;m.vx=(m.x-m.px)/dt;m.vz=(m.z-m.pz)/dt;limitVelocity(m,C.handSpeed);
    if(this.state==='won')return;
    if(this.state!=='play'){
      this.timer-=dt;if(this.timer<=0){this.state='play';this.message='';this.physics.puck.vz=(this.serve||1)*.35;}return;
    }
    this.ai.update(dt,this.physics.puck,this.enemy,this.skill);
    const scorer=this.physics.step(dt,this.mallets),p=this.physics.puck;
    if(scorer){const index=scorer===1?0:1;this.scores[index]++;this.serve=-scorer;this.state=this.scores[index]>=7?'won':'goal';this.timer=1.4;this.message=this.state==='won'?(index===0?'YOU WIN!':'BOT WINS!'):(index===0?'YOU SCORE!':'BOT SCORES!');this.onEvent(this.state,index);this.resetPuck();this.ai.reset();return;}
    const owner=p.z>.04?1:p.z<-.04?-1:this.owner;
    if(owner!==this.owner){this.owner=owner;this.possession=0;}this.possession+=dt;
    if(Math.hypot(p.vx,p.vz)<.08)this.stall+=dt;else this.stall=0;
    if(this.possession>7||this.stall>3){this.serve=-(this.owner||1);this.state='serve';this.timer=1;this.message='POSSESSION • CHANGE SERVE';this.resetPuck();this.ai.reset();this.onEvent('serve');}
  }
}
