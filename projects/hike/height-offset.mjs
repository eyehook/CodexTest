// Call after copying the raw tracked (or desktop local camera) pose each frame.
// The same offset is composed once for rendering and gameplay; the floor rig stays put.
export function applyHeightOffset(heightRig,viewer,offset){
 heightRig.position.y=offset;
 viewer.position.y+=offset;
}
