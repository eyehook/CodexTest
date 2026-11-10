// Broad surface patterns baked once into existing vertex colors: no runtime
// texture sampling, extra materials, geometry or fragment-shader noise.
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
function hash(x,z,seed){let n=Math.imul(x,374761393)^Math.imul(z,668265263)^seed;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
function noise(x,z,seed){const ix=Math.floor(x),iz=Math.floor(z),u=smooth(0,1,x-ix),v=smooth(0,1,z-iz);return (hash(ix,iz,seed)*(1-u)+hash(ix+1,iz,seed)*u)*(1-v)+(hash(ix,iz+1,seed)*(1-u)+hash(ix+1,iz+1,seed)*u)*v;}
export function surfaceColor(x,z,height,slope,summitHeight,seed,out){
  const patches=noise(x/51,z/51,seed|0)-.5;
  const grain=noise(x/8,z/8,(seed|0)^0x51f2)-.5;
  const altitude=height/Math.max(1,summitHeight)+patches*.14;
  // Green foothills, ochre grass, brown earth, gray alpine stone, pale summit.
  out.r=.075;out.g=.16;out.b=.055;
  let t=smooth(.14,.36,altitude);
  out.r+=(.36-out.r)*t;out.g+=(.285-out.g)*t;out.b+=(.105-out.b)*t;
  t=smooth(.35,.59,altitude);
  out.r+=(.235-out.r)*t;out.g+=(.155-out.g)*t;out.b+=(.085-out.b)*t;
  t=smooth(.56,.81,altitude);
  out.r+=(.31-out.r)*t;out.g+=(.325-out.g)*t;out.b+=(.34-out.b)*t;
  const rock=smooth(28,55,slope);
  const strata=Math.sin(height*.42+x*.075+z*.035)*.018+grain*.045;
  out.r+=(.285+strata-out.r)*rock;out.g+=(.30+strata-out.g)*rock;out.b+=(.32+strata-out.b)*rock;
  // White patches accumulate high on gentler terrain; cliff faces stay exposed.
  t=smooth(.82,1.01,altitude)*(1-rock*.98);
  out.r+=(.76-out.r)*t;out.g+=(.79-out.g)*t;out.b+=(.80-out.b)*t;
  const variation=1+(patches*.18+grain*.12)*smooth(0,12,height);
  out.r*=variation;out.g*=variation;out.b*=variation;
  return out;
}
