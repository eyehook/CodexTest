// Place the tracked head over the endpoint, retaining the physical head offset.
export function placeAtEndpoint(rig,viewer,world,destination,tracked=false){
 const base=destination==='base',point=base?world.start:world.summit;
 const ahead=world.route[base?Math.min(12,world.route.length-1):Math.max(0,world.route.length-13)];
 rig.rotation.set(0,Math.atan2(point.x-ahead.x,point.z-ahead.z),0);
 rig.position.set(point.x,point.y,point.z);
 if(tracked){const offset=viewer.position.clone().applyQuaternion(rig.quaternion);rig.position.x-=offset.x;rig.position.z-=offset.z;}
 rig.updateMatrixWorld(true);
}
