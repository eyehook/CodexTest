import {C,Physics,mallet,constrain,limitVelocity} from './physics.mjs';
import {Opponent} from './ai.mjs';
export const BOT_SERVE_DURATION=1.1;
function boundServePuck(q){
  const r=C.puck,w=C.width/2,l=C.length/2,c=C.corner;
  q.x=Math.max(-w+r,Math.min(w-r,q.x));q.z=Math.max(r,Math.min(l-r,q.z));
  const dx=Math.abs(q.x)-(w-c),dz=q.z-(l-c),d=Math.hypot(dx,dz);
  if(dx>0&&dz>0&&d>c-r){q.x=Math.sign(q.x)*(w-c+dx/d*(c-r));q.z=l-c+dz/d*(c-r);}
}
export class Game {
  constructor(onEvent=()=>{},random=Math.random){this.onEvent=onEvent;this.random=random;this.physics=new Physics((...args)=>onEvent(...args));this.ai=new Opponent(random);this.player=mallet(1);this.enemy=mallet(-1);this.mallets=[this.player,this.enemy];this.target={x:0,z:.88};this.placementCandidate={x:0,z:0};this.botServe={x:0,y:-.18,z:-1.52};this.skill=50;this.height=.8;this.tableX=0;this.tableZ=0;this.scores=[0,0];this.newGame();}
  newGame(){this.scores.fill(0);this.ai.reset();Object.assign(this.enemy,mallet(-1));this.serve=this.random()<.5?1:-1;this.state='ready';this.timer=1;this.message=this.serve===1?'YOUR SERVE • GET READY':'BOT SERVES • GET READY';this.resetPuck();this.onEvent('reset');}
  resetPuck(){this.waitingForServeHit=false;this.servePreviewReady=false;Object.assign(this.physics.puck,{x:0,z:this.serve*.48,vx:0,vz:0});this.possession=0;this.owner=0;this.stall=0;}
  placeBotServe(){
    const p=this.physics.puck,clearance=C.puck+C.mallet+.012;
    for(let i=0;i<8;i++){
      const x=(this.random()*2-1)*.42,z=-.25-this.random()*.6;
      if(Math.hypot(x-this.enemy.x,z-this.enemy.z)>=clearance){p.x=x;p.z=z;p.vx=p.vz=0;return;}
    }
    // Even a constant RNG must yield a legal position clear of the bot's mallet.
    for(const x of [-.42,.42])for(const z of [-.25,-.85])if(Math.hypot(x-this.enemy.x,z-this.enemy.z)>=clearance){p.x=x;p.z=z;p.vx=p.vz=0;return;}
  }
  botServePose(progress){
    const t=progress*progress*(3-2*progress),u=1-t,p=this.physics.puck,q=this.botServe;
    // Lift behind the goal, arc over the end rail, and ease onto the selected spot.
    q.x=(3*u*t*t+t*t*t)*p.x;
    q.y=u*u*u*(-.18)+3*u*u*t*.65+3*u*t*t*.5+t*t*t*.008;
    q.z=(u*u*u+3*u*u*t)*(-1.52)+(3*u*t*t+t*t*t)*p.z;
  }
  previewServe(x,z){
    if(this.state!=='placing'||!Number.isFinite(x)||!Number.isFinite(z))return false;
    const p=this.physics.puck;
    p.x=x;p.z=z;boundServePuck(p);
    // A placed puck must not overlap the mallet or inherit a separation impulse.
    const clearance=C.puck+C.mallet+.002;
    if(Math.hypot(p.x-this.player.x,p.z-this.player.z)<clearance){
      let best=Infinity,bx=0,bz=.48;const q=this.placementCandidate;
      for(let i=0;i<16;i++){const angle=i*Math.PI/8;q.x=this.player.x+Math.cos(angle)*clearance;q.z=this.player.z+Math.sin(angle)*clearance;boundServePuck(q);if(Math.hypot(q.x-this.player.x,q.z-this.player.z)<clearance-1e-8)continue;const d=(q.x-x)**2+(q.z-z)**2;if(d<best){best=d;bx=q.x;bz=q.z;}}
      p.x=bx;p.z=bz;
    }
    p.vx=p.vz=0;this.servePreviewReady=true;return true;
  }
  placeServe(){if(this.state!=='placing'||!this.servePreviewReady)return false;this.state='play';this.message='';this.waitingForServeHit=true;this.possession=this.stall=0;this.owner=1;this.physics.puck.vx=this.physics.puck.vz=0;return true;}
  setTarget(x,z,discontinuous=false){this.target.x=x;this.target.z=z;constrain(this.target,1);if(discontinuous||Math.hypot(this.target.x-this.player.x,this.target.z-this.player.z)>.32){this.player.x=this.player.px=this.target.x;this.player.z=this.player.pz=this.target.z;this.player.vx=this.player.vz=0;}}
  step(dt){
    const m=this.player;m.px=m.x;m.pz=m.z;m.x=this.target.x;m.z=this.target.z;m.vx=(m.x-m.px)/dt;m.vz=(m.z-m.pz)/dt;limitVelocity(m,C.handSpeed);
    if(this.state==='won'||this.state==='placing')return;
    if(this.state==='botplacing'){this.timer=Math.max(0,this.timer-dt);this.botServePose(1-this.timer/BOT_SERVE_DURATION);if(this.timer<=0){this.state='play';this.message='';this.waitingForServeHit=true;}return;}
    if(this.state!=='play'){
      this.timer-=dt;if(this.timer<=0){if(this.serve===1){this.state='placing';this.message='YOUR SERVE • OFF-HAND TRIGGER TO PLACE';this.physics.puck.vx=this.physics.puck.vz=0;}else{this.placeBotServe();this.state='botplacing';this.timer=BOT_SERVE_DURATION;this.message='BOT PLACING PUCK';this.botServePose(0);}}return;
    }
    this.ai.update(dt,this.physics.puck,this.enemy,this.skill);
    const scorer=this.physics.step(dt,this.mallets),p=this.physics.puck;
    if(scorer){const index=scorer===1?0:1;this.scores[index]++;this.serve=-scorer;this.state=this.scores[index]>=7?'won':'goal';this.timer=1.4;this.message=this.state==='won'?(index===0?'YOU WIN!':'BOT WINS!'):(index===0?'YOU SCORE!':'BOT SCORES!');this.onEvent(this.state,index);this.resetPuck();this.ai.reset();return;}
    // A newly placed puck has no timeout until its first movement, even a gentle tap.
    if(this.waitingForServeHit){if(p.vx*p.vx+p.vz*p.vz<=1e-12){this.possession=this.stall=0;return;}this.waitingForServeHit=false;}
    const owner=p.z>.04?1:p.z<-.04?-1:this.owner;
    if(owner!==this.owner){this.owner=owner;this.possession=0;}this.possession+=dt;
    if(Math.hypot(p.vx,p.vz)<.08)this.stall+=dt;else this.stall=0;
    if(this.possession>7||this.stall>3){this.serve=-(this.owner||1);this.state='serve';this.timer=1;this.message='POSSESSION • CHANGE SERVE';this.resetPuck();this.ai.reset();this.onEvent('serve');}
  }
}
