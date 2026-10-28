// Seeded, continuous value-noise sampled in world-independent normalized volume coordinates.
const smooth=t=>t*t*(3-2*t);
function hash(x,y,z){
  let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,2147483647)^1337;
  h=Math.imul(h^(h>>>13),1274126177);
  return ((h^(h>>>16))>>>0)/4294967295;
}
export function noise(x,y,z){
  const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),u=smooth(x-ix),v=smooth(y-iy),w=smooth(z-iz);
  let sum=0;
  for(let k=0;k<2;k++)for(let j=0;j<2;j++)for(let i=0;i<2;i++)sum+=hash(ix+i,iy+j,iz+k)*(i?u:1-u)*(j?v:1-v)*(k?w:1-w);
  return sum;
}
export function generateNoise(size,octaves){
  const data=new Uint8Array(size**3);
  let n=0;
  for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let value=0,weight=0,a=1,f=3;
    for(let o=0;o<octaves;o++){
      value+=a*noise(x/(size-1)*f+17,y/(size-1)*f+31,z/(size-1)*f+47);
      weight+=a;
      a*=.5;
      f*=2;
    }
    data[n++]=Math.round(255*value/weight);
  }
  return data;
}
