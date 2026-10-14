import {CONFIG} from './config.mjs';
export function createSimulation(){return {distance:0,speed:0,lateral:0};}
export function steeringAxis(value,deadZone=CONFIG.deadZone){
 if(!Number.isFinite(value)||Math.abs(value)<=deadZone)return 0;
 return Math.sign(value)*Math.min(1,(Math.abs(value)-deadZone)/(1-deadZone));
}
export function stepSimulation(state,dt,steer,config=CONFIG){
 if(!Number.isFinite(dt)||dt<=0)return;
 const acceleration=config.cruiseSpeed/config.accelerationTime;
 const accelerating=Math.max(0,Math.min(dt,(config.cruiseSpeed-state.speed)/acceleration));
 state.distance+=state.speed*accelerating+.5*acceleration*accelerating*accelerating+config.cruiseSpeed*(dt-accelerating);
 state.speed=Math.min(config.cruiseSpeed,state.speed+acceleration*dt);
 const input=Number.isFinite(steer)?Math.max(-1,Math.min(1,steer)):0;
 state.lateral=Math.max(-config.lateralLimit,Math.min(config.lateralLimit,state.lateral+input*config.steeringSpeed*dt));
}
// A bounded ring of adjacent road segments: +Z is behind the car.
export function segmentZ(index,distance,config=CONFIG){
 const span=config.segmentLength*config.segmentCount;
 const phase=((index*config.segmentLength-distance)%span+span)%span;
 return config.behindDistance-config.segmentLength/2-phase;
}
