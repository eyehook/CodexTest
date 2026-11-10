import * as T from '../../shared/vendor/three-r180/three.module.js';
export const DETAIL_TILE_METERS=12;
// One seamless grayscale bitmap shared by all elevation zones and the plain.
// Generated once; standard mipmapped Lambert map adds one sampled color layer.
export function createDetailTexture(){
  const size=256,data=new Uint8Array(size*size*4);
  const hash=(x,z)=>{let n=Math.imul(x,374761393)^Math.imul(z,668265263)^7319;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
  const noise=(x,z,period)=>{
    const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
    const a=hash(ix%period,iz%period),b=hash((ix+1)%period,iz%period),c=hash(ix%period,(iz+1)%period),d=hash((ix+1)%period,(iz+1)%period);
    return (a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v;
  };
  for(let z=0;z<size;z++)for(let x=0;x<size;x++){
    const detail=.40*noise(x/32,z/32,8)+.35*noise(x/8,z/8,32)+.15*noise(x/2,z/2,128)+.10*hash(x,z);
    const value=Math.round(255*(.48+.52*detail)),i=(z*size+x)*4;
    data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
  }
  const texture=new T.DataTexture(data,size,size,T.RGBAFormat);
  texture.name='Ground noise · 12 m repeat';texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.generateMipmaps=true;texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;
  texture.colorSpace=T.NoColorSpace;texture.needsUpdate=true;return texture;
}
