// Shared surface of revolution: sphere, or a fuller base tapering to a rounded tip.
export function shrubProfile(shape,theta){
 const y=-Math.cos(theta),s=Math.sin(theta),t=shape==='shrubDrop'?.55:0;
 return {radius:s*(1-t*y),y,dr:Math.cos(theta)*(1-t*y)-t*s*s,dy:s};
}
export function shrubSurface(shape,theta,angle){
 const {radius,y,dr,dy}=shrubProfile(shape,theta),c=Math.cos(angle),s=Math.sin(angle);
 return {position:[radius*c,y,radius*s],normal:[dy*c,-dr,dy*s]};
}
