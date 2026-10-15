import {Vector3, MathUtils} from 'three';
// Enclose all eight flight-volume corners in a sphere, then fit its angular radius.
export function overviewDistance(bounds, verticalFov=65, aspect=1) {
  const centerY=(bounds.minY+bounds.maxY)/2;
  const radius=Math.hypot(bounds.x,(bounds.maxY-bounds.minY)/2,bounds.z);
  const vertical=MathUtils.degToRad(verticalFov)/2;
  const halfAngle=Math.min(vertical,Math.atan(Math.tan(vertical)*aspect));
  return Math.sqrt((radius*1.12/Math.sin(halfAngle))**2-(centerY-1.6)**2);
}
export function fitDesktop(camera,bounds) {
  camera.position.set(0,1.6,overviewDistance(bounds,camera.fov,camera.aspect));
  camera.lookAt(new Vector3(0,(bounds.minY+bounds.maxY)/2,0));
}
