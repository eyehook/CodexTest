export const HALF_WIDTH=4.572,HALF_DEPTH=6.858,WALL_HEIGHT=3.048;
export const ROOM_SIZE=3.6576,ROOM_HEIGHT=2.6,DOOR_WIDTH=1.15,DOOR_HEIGHT=2.25;
export const HALL_LENGTH=1.8288,HALL_WIDTH=DOOR_WIDTH-.06,HALL_HEIGHT=DOOR_HEIGHT-.03,HALL_ENTRY_INSET=.015;
export const DOOR_WALL_ID=0,GARDEN_FRONT=HALF_DEPTH,DOOR_Z=GARDEN_FRONT+HALL_LENGTH/2;
export const ROOM_FRONT=GARDEN_FRONT+HALL_LENGTH,ROOM_BACK=ROOM_FRONT+ROOM_SIZE;
export const VINE_CLEARANCE=.28;
export function doorwayPlantingBlocked(point){return Math.abs(point.z-GARDEN_FRONT)<.2&&Math.abs(point.x)<DOOR_WIDTH/2+VINE_CLEARANCE&&point.y<DOOR_HEIGHT+VINE_CLEARANCE;}
export function gardenGroundContains(point){return Math.abs(point.x)<=HALF_WIDTH&&Math.abs(point.z)<=HALF_DEPTH;}

// Rectangle on the unfolded wall perimeter, in the vine's scaled local frame.
export function vineDoorExclusion(bounds,surface,y,scale){
 if(!Number.isInteger(surface.id)||!bounds.wrapDepth)return [];
 const width=bounds.maxX-bounds.minX,depth=bounds.wrapDepth,lengths=[width,depth,width,depth];
 const face=(surface.id-DOOR_WALL_ID+4)%4;
 let center=bounds.minX;for(let i=0;i<face;i++)center+=lengths[i];center+=lengths[face]/2;
 return [{minX:center-(DOOR_WIDTH/2+VINE_CLEARANCE)/scale,maxX:center+(DOOR_WIDTH/2+VINE_CLEARANCE)/scale,
  minY:(-.1-y)/scale,maxY:(DOOR_HEIGHT+VINE_CLEARANCE-y)/scale}];
}

// Project the viewer into the union of garden, narrow passage and room.
export function constrainPosition(x,z,doorOpen=false){
 const margin=.18,halfPassage=HALL_WIDTH/2-margin;
 const rectangles=[[-HALF_WIDTH+margin,HALF_WIDTH-margin,-HALF_DEPTH+margin,HALF_DEPTH-margin],
  [-ROOM_SIZE/2+margin,ROOM_SIZE/2-margin,ROOM_FRONT+margin,ROOM_BACK-margin]];
 if(doorOpen)rectangles.push([-halfPassage,halfPassage,GARDEN_FRONT-margin,ROOM_FRONT+margin]);
 else {
  rectangles.push([-halfPassage,halfPassage,GARDEN_FRONT-margin,DOOR_Z-.12]);
  rectangles.push([-halfPassage,halfPassage,DOOR_Z+.12,ROOM_FRONT+margin]);
 }
 let best=null,distance=Infinity;
 for(const [left,right,back,front] of rectangles){
  const px=Math.max(left,Math.min(right,x)),pz=Math.max(back,Math.min(front,z));
  const d=(px-x)**2+(pz-z)**2;if(d<distance){distance=d;best={x:px,z:pz};}
 }
 return best;
}
