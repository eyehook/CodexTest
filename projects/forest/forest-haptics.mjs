import {wrap} from './forest-world.mjs';

// Approximate contact volumes, independent of animated mesh deformation.
// Test the nearest wrapped copy rather than all nine rendered tiles.
export function plantContact(plants, point) {
 let contact=null;
 for(let i=0;i<plants.length;i++) {
  const p=plants[i],s=p.size;
  if(p.kind<3) {
   const dx=wrap(point.x-p.x),dz=wrap(point.z-p.z),radius=.18*s+.07;
   if(point.y>=-.07&&point.y<=6*s+.07&&dx*dx+dz*dz<=radius*radius)
    return {id:i,intensity:.16,duration:120};
  } else {
   for(let j=0;j<3;j++) {
    const angle=p.rotation+j*2.1;
    const dx=wrap(point.x-p.x-Math.cos(angle)*.35*s)/(.6*s+.07);
    const dy=(point.y-.4*s)/((p.kind===3?.7:.4)*s+.07);
    const dz=wrap(point.z-p.z-Math.sin(angle)*.35*s)/(.55*s+.07);
    if(dx*dx+dy*dy+dz*dz<=1) {contact={id:i,intensity:.10,duration:120};break;}
   }
  }
 }
 return contact;
}

// Renew a short pulse every 80 ms; the overlap keeps contact buzzing smooth.
// Short pulses also bound any residual feedback if animation frames stop.
export function createContactHaptics(plants) {
 const states=new Map();
 function pulse(actuator,intensity,duration) {
  if(typeof actuator?.pulse!=='function')return;
  try {Promise.resolve(actuator.pulse(intensity,duration)).catch(()=>{});}catch {}
 }
 function stop(source) {
  const state=states.get(source);
  if(state)pulse(state.actuator,0,1);
  states.delete(source);
 }
 return {
  reset(){for(const source of states.keys())stop(source);},
  retain(sources){const active=new Set(sources);for(const source of states.keys())if(!active.has(source))stop(source);},
  update(source,point,time) {
   const contact=point?plantContact(plants,point):null;
   if(!contact){stop(source);return;}
   const actuator=source.gamepad?.hapticActuators?.[0];
   if(typeof actuator?.pulse!=='function'){stop(source);return;}
   let state=states.get(source);
   if(state&&state.actuator!==actuator){stop(source);state=null;}
   if(!state)state={actuator,last:-Infinity,intensity:null};
   if(time-state.last>=80||state.intensity!==contact.intensity) {
    pulse(actuator,contact.intensity,contact.duration);
    state.last=time;state.intensity=contact.intensity;
   }
   states.set(source,state);
  }
 };
}
