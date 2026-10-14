export const MOVE_SPEED=1.5; // Meters per second, shared by walking and flight.

// Quest Touch controllers expose A (right) and X (left) at button index 4.
export function ascentPressed(source) {
 return (source.handedness==='left'||source.handedness==='right') &&
  source.gamepad?.mapping==='xr-standard' && !!source.gamepad.buttons?.[4]?.pressed;
}
export const GRAVITY=1.5; // Gentle gravity, meters per second squared.
export const UPWARD_THRUST=4.5; // Net upward acceleration is 3 m/s².

// Integrate acceleration exactly, including the portion after reaching a speed cap.
export function updateFlight(state,ascending,dt) {
 if(dt<=0)return;
 const acceleration=(ascending?UPWARD_THRUST:0)-GRAVITY;
 const limit=ascending?MOVE_SPEED:-MOVE_SPEED;
 const start=state.velocity;
 const accelerating=Math.max(0,Math.min(dt,(limit-start)/acceleration));
 const end=start+acceleration*accelerating;
 state.height+=start*accelerating+.5*acceleration*accelerating*accelerating+end*(dt-accelerating);
 state.velocity=end;
 if(state.height<=0){state.height=0;state.velocity=0;}
}
