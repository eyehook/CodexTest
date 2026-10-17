// Reuse Forest's controller mapping, thrust, gravity and speed caps.
import {ascentPressed,updateFlight} from '../../projects/forest/forest-flight.mjs';
export function updateTerrainFlight(state,session,tracked,dt,ground=0){
 if(!session||!tracked||session.visibilityState!=='visible')return;
 let ascending=false;
 for(const source of session.inputSources)if(ascentPressed(source)){ascending=true;break;}
 if(state.altitude==null)state.altitude=ground+state.height;
 // Walking follows the ground. Airborne altitude persists across horizontal travel.
 if(state.height<=0||state.altitude<=ground){state.altitude=ground;state.velocity=0;}
 // Express the fixed world altitude relative to today's terrain only for integration
 // and landing. A lower ground increases clearance without lowering world altitude.
 state.height=state.altitude-ground;
 updateFlight(state,ascending,dt);
 state.altitude=ground+state.height;
}
