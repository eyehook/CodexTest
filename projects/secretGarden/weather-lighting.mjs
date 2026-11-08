import {Color} from '../../shared/vendor/three-r180/three.module.js';
// Change existing light uniforms only; sun pose and cached shadow geometry stay fixed.
export class WeatherLighting {
 constructor(sun,hemisphere){
  this.sun=sun;this.hemisphere=hemisphere;
  this.clearSun=sun.color.clone();this.clearSky=hemisphere.color.clone();this.clearGround=hemisphere.groundColor.clone();
  this.clearSunIntensity=sun.intensity;this.clearHemisphereIntensity=hemisphere.intensity;
  this.rainSun=new Color('#c7cdd3');this.rainSky=new Color('#c3c7cb');this.rainGround=new Color('#514a41');
 }
 update(intensity){
  const t=Math.max(0,Math.min(1,intensity));
  this.sun.intensity=this.clearSunIntensity+(.75-this.clearSunIntensity)*t;
  this.hemisphere.intensity=this.clearHemisphereIntensity+(1.7-this.clearHemisphereIntensity)*t;
  this.sun.color.copy(this.clearSun).lerp(this.rainSun,t);
  this.hemisphere.color.copy(this.clearSky).lerp(this.rainSky,t);this.hemisphere.groundColor.copy(this.clearGround).lerp(this.rainGround,t);
 }
}
