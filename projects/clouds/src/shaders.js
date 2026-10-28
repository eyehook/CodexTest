export const vertex = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const shared = `precision highp float;
precision highp sampler3D;
varying vec2 vUv;
uniform sampler2D sceneColor, sceneDepth;
uniform sampler3D noiseMap;
uniform mat4 inverseProjection, eyeWorld;
uniform vec3 eye, center, halfSize;
uniform float density, threshold, termination;
uniform int steps, mode;
uniform bool enabled;
// Reconstruct this eye's world position from its own opaque depth and asymmetric projection.
vec3 unproject(float depth){vec4 p=inverseProjection*vec4(vUv*2.-1.,depth*2.-1.,1.);return (eyeWorld*vec4(p.xyz/p.w,1.)).xyz;}
float field(vec3 p){vec3 q=(p-center)/halfSize;float n=texture(noiseMap,q*.5+.5).r;
// Overlapping rounded lobes and noise perturbations make an isolated cumulus envelope.
float shape=min(length((q-vec3(-.3,-.12,0.))/vec3(.7,.7,.85)),length((q-vec3(.3,-.18,.08))/vec3(.65,.62,.8)));
shape=min(shape,length((q-vec3(0.,.3,-.08))/vec3(.56,.66,.65)));
float envelope=1.-smoothstep(.6,1.,shape+(0.5-n)*.8);
return envelope*max(0.,(n-threshold)/max(.05,1.-threshold))*density;}
void writeColor(vec3 color){gl_FragColor=linearToOutputTexel(vec4(color,1.));}
vec4 marchCloud(){if(!enabled)return vec4(0.,0.,0.,1.);
vec3 ray=normalize(unproject(1.)-eye);
// Avoid undefined 0/0 at parallel slab boundaries.
vec3 safeRay=mix(vec3(1.e-7),ray,greaterThan(abs(ray),vec3(1.e-7)));
vec3 a=(center-halfSize-eye)/safeRay,b=(center+halfSize-eye)/safeRay;
vec3 lo=min(a,b),hi=max(a,b);
float entry=max(0.,max(lo.x,max(lo.y,lo.z)));
float exit=min(hi.x,min(hi.y,hi.z));
if(exit<=entry)return vec4(0.,0.,0.,1.);
float depth=texture2D(sceneDepth,vUv).r;
if(depth<1.)exit=min(exit,max(0.,dot(unproject(depth)-eye,ray)));
if(exit<=entry)return vec4(0.,0.,0.,1.);
float stepLength=(exit-entry)/float(steps),T=1.;int count=0;
for(int i=0;i<128;i++){if(i>=steps)break;vec3 p=eye+ray*(entry+(float(i)+.5)*stepLength);float d=field(p);float attenuation=exp(-d*stepLength);T*=attenuation;count++;if(T<termination)break;}
vec3 result=(1.-T)*vec3(.94,.95,.96);
if(mode==1){result=vec3(1.-T);T=0.;}
if(mode==2){float heat=float(count)/128.;result=mix(vec3(.05,.15,.8),vec3(1.,.15,.02),heat);T=0.;}
return vec4(result,T);
}`;

// Reference mode marches directly at the output resolution. Low-resolution data
// stores linear cloud contribution and transmittance, never opaque scene color.
export const fragment = shared + `
void main(){vec4 cloud=marchCloud();writeColor(cloud.rgb+cloud.a*texture2D(sceneColor,vUv).rgb);}`;
export const cloudFragment = shared + `
void main(){gl_FragColor=marchCloud();}`;
export const compositeFragment = shared + `
uniform sampler2D cloudMap;
uniform vec2 cloudSize;
float distanceAt(vec2 uv){float d=texture2D(sceneDepth,uv).r;
vec4 p=inverseProjection*vec4(uv*2.-1.,d*2.-1.,1.);return -p.z/p.w;}
void main(){
vec2 cell=vUv*cloudSize-.5, base=floor(cell), weight=fract(cell);
vec2 uv00=clamp((base+.5)/cloudSize,.5/cloudSize,1.-.5/cloudSize);
vec2 uv11=clamp((base+1.5)/cloudSize,.5/cloudSize,1.-.5/cloudSize);
float z=distanceAt(vUv), tolerance=max(.03,z*.002);
float error=max(max(abs(distanceAt(uv00)-z),abs(distanceAt(uv11)-z)),
 max(abs(distanceAt(vec2(uv00.x,uv11.y))-z),abs(distanceAt(vec2(uv11.x,uv00.y))-z)));
vec4 cloud;
// Full-resolution marching at depth boundaries protects thin columns and UI,
// including foreground surfaces absent from the low-resolution sample grid.
if(error>tolerance)cloud=marchCloud();
else cloud=mix(mix(texture2D(cloudMap,uv00),texture2D(cloudMap,vec2(uv11.x,uv00.y)),weight.x),
 mix(texture2D(cloudMap,vec2(uv00.x,uv11.y)),texture2D(cloudMap,uv11),weight.x),weight.y);
writeColor(cloud.rgb+cloud.a*texture2D(sceneColor,vUv).rgb);
}`;
