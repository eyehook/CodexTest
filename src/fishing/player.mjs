export function deadzone(x,z,d=0.15){const n=Math.hypot(x,z);if(n<=d)return [0,0];const scale=Math.min(1,(n-d)/(1-d))/n;return [x*scale,z*scale];}
export function advance(world,x,z,yaw,speed,dt){const s=Math.sin(yaw),c=Math.cos(yaw);world.x+=(x*c+z*s)*speed*dt;world.z+=(-x*s+z*c)*speed*dt;}
export function xrAxes(session){for(const source of session?.inputSources??[]){if(source.handedness==='left'&&source.gamepad){const a=source.gamepad.axes;return deadzone(a.length>=4?a[2]:a[0]||0,a.length>=4?a[3]:a[1]||0);}}return [0,0];}

// Right-stick X only: vertical deflection must not increase turning speed.
export function xrTurn(session){
 for(const source of session?.inputSources??[]){
  if(source.handedness!=='right'||!source.gamepad)continue;
  const axes=source.gamepad.axes,x=axes.length>=4?axes[2]:(axes[0]||0);
  return Math.abs(x)<=0.15?0:Math.sign(x)*Math.min(1,(Math.abs(x)-0.15)/0.85);
 }
 return 0;
}
// Rotate the rig about the tracked head, preserving its current world X/Z.
export function turnAtHead(rig,headX,headZ,delta){
 const old=rig.yaw,next=old+delta;
 rig.x+=Math.cos(old)*headX+Math.sin(old)*headZ-Math.cos(next)*headX-Math.sin(next)*headZ;
 rig.z+=-Math.sin(old)*headX+Math.cos(old)*headZ+Math.sin(next)*headX-Math.cos(next)*headZ;
 rig.yaw=next;
}

export const FLIGHT_DRAG=0.8,FLIGHT_RESPONSE=4; // Rates per second.
export function updateHorizontalMotion(world,motion,x,z,yaw,speed,dt,airborne,active=true){
 if(!active||dt<=0)return;
 const s=Math.sin(yaw),c=Math.cos(yaw),targetX=(x*c+z*s)*speed,targetZ=(-x*s+z*c)*speed;
 if(!airborne){
  motion.x=targetX;motion.z=targetZ;world.x+=targetX*dt;world.z+=targetZ*dt;return;
 }
 // A returning analog stick must not overwrite the momentum before it centres.
 const easingOff=targetX*targetX+targetZ*targetZ<motion.x*motion.x+motion.z*motion.z&&targetX*motion.x+targetZ*motion.z>=0;
 const rate=easingOff?FLIGHT_DRAG:FLIGHT_RESPONSE,decay=Math.exp(-rate*dt),travel=(1-decay)/rate;
 world.x+=targetX*dt+(motion.x-targetX)*travel;
 world.z+=targetZ*dt+(motion.z-targetZ)*travel;
 motion.x=targetX+(motion.x-targetX)*decay;
 motion.z=targetZ+(motion.z-targetZ)*decay;
}
