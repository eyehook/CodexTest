import {readMovementAxes} from '../../shared/xr/input.mjs';
// Project interaction policy; shared Locomotion owns translation and head-pivot rotation.
export class SnapTurn {
 constructor(){this.axes={x:0,z:0,turn:0};this.states=new Map();}
 reset(){this.states.clear();}
 update(navigation,dt,sources,viewer,settings,isTracked=()=>true){
  readMovementAxes(sources,this.axes);
  const xMove=settings.teleport?0:this.axes.x,zMove=settings.teleport?0:this.axes.z;
  const available=new Set();let smooth=0,snap=0;
  for(const source of sources){
   if(source.gamepad?.mapping!=='xr-standard'||!isTracked(source)||!(source.handedness==='right'||settings.teleport&&source.handedness==='left'))continue;
   const x=source.gamepad.axes[2],y=source.gamepad.axes[3];if(!Number.isFinite(x)||!Number.isFinite(y))continue;available.add(source);
   // Either stick has the same response; two sticks cannot double turning speed.
   if(Math.abs(x)>Math.abs(smooth))smooth=x;else if(Math.abs(x)===Math.abs(smooth)&&x!==smooth)smooth=0;
   let state=this.states.get(source);if(!state){state={armed:false};this.states.set(source,state);}
   if((settings.teleport?Math.abs(x):Math.hypot(x,y))<=.2)state.armed=true;
   else if(state.armed&&Math.abs(x)>=.65&&dt>0){state.armed=false;snap+=Math.sign(x);}
  }
  for(const source of this.states.keys())if(!available.has(source))this.states.delete(source);
  if(!settings.snapTurn){this.reset();navigation.move(dt,xMove,zMove,smooth,viewer);return;}
  navigation.move(dt,xMove,zMove,0,viewer);
  if(!snap)return;
  const speed=navigation.settings.turnSpeed,step=navigation.settings.maxDelta;
  // At most one shared pivot move per frame; simultaneous opposing snaps cancel.
  try{navigation.settings.turnSpeed=settings.snapAngle*Math.PI/180/step;navigation.move(step,0,0,Math.sign(snap),viewer);}finally{navigation.settings.turnSpeed=speed;}
 }
}
