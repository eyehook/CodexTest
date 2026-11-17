import * as T from '../../shared/vendor/three-r180/three.module.js';
import {phrase, chord, sample} from './score.mjs';

// One shell opens each seven-period movement. The six departures are shuffled per seed.
function formAt(seed, period) {
  const order = [0,1,2,3,4,5,6];
  for (let i = order.length-1; i > 1; i--) {
    const j = 1 + Math.floor(sample(seed, Math.floor(period/7), 70+i)*i);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order[period%order.length];
}

export function chamber(scene, seed) {
  // Each strip describes a lip of the shell. Angle runs around it, v across it.
  const geometry = new T.InstancedBufferGeometry();
  const strip = new T.PlaneGeometry(1, 1, 112, 2);
  geometry.index = strip.index;
  geometry.attributes.position = strip.attributes.position;
  geometry.attributes.uv = strip.attributes.uv;
  const lips = 43;
  const layers = Float32Array.from({length:lips}, (_,i) => i/(lips-1));
  geometry.setAttribute('layer', new T.InstancedBufferAttribute(layers, 1));
  geometry.instanceCount = lips;
  const uniforms = Object.fromEntries(['time','blend','energy','hue','twist','f1','f2','root','pulse','melody','pitch','volume','fromForm','toForm'].map(k => [k,{value:0}]));
  const material = new T.ShaderMaterial({uniforms, side:T.DoubleSide,
    vertexShader: `
      attribute float layer;
      uniform float time,blend,energy,twist,f1,f2,root,pulse,fromForm,toForm,melody,pitch,volume;
      varying float singing; varying vec3 ink; varying float distanceFog;
      vec3 shape(float form,float s,float v,float a,float fold){
        float loop=a+2.8*s+time;
        if(form<.5){
          float radius=.23+2.15*s+.18*v+(.10+.33*s)*fold;
          return vec3(radius*cos(a),radius*sin(a)*(.75+.18*energy),
            1.3*(1.-s*s)+(.16+.48*s)*fold+.18*sin(2.*loop)+.16*v);
        }
        if(form<1.5) return vec3((1.4+.35*fold)*cos(loop)+.65*sin(4.*s+time),
          (s-.5)*4.2+.58*sin(loop)+.17*v,(.85+.24*fold)*sin(loop)+.12*v);
        if(form<2.5) return vec3(3.1*cos(a)*(1.+.18*s),
          (s-.5)*1.9+.67*sin(2.*a+4.*s+time)+.18*fold+.14*v,1.55*sin(a)+1.7*(s-.5));
        if(form<3.5){
          // A trefoil with a fluted tube wound around its centerline.
          float b=3.*a+time, tube=.34*cos(6.283*s)+.13*v;
          float r=1.42+.60*cos(b)+tube;
          return vec3(r*cos(2.*a),r*sin(2.*a),.77*sin(b)+.36*sin(6.283*s)+.1*fold);
        }
        if(form<4.5){
          float latitude=(s-.5)*3.0+.068*v;
          float r=2.*cos(latitude)*(1.+.15*fold);
          return vec3(r*cos(a),1.98*sin(latitude)+.19*sin(2.*loop),r*sin(a));
        }
        if(form<5.5){
          float wing=sin(a), span=.45+2.45*s+.12*v;
          return vec3(span*wing,1.45*cos(2.*a)*s+.42*cos(a)+.29*fold,
            .82*cos(a)+s*sin(2.*a+time));
        }
        float waist=.57+1.38*pow(abs(2.*s-1.),1.4)+.15*fold;
        return vec3(waist*cos(loop),(s-.5)*4.1+.13*v+.26*sin(3.*loop),
          waist*sin(loop)+.12*v);
      }
      void main(){
        float s=layer, v=uv.y, a=uv.x*6.2831853;
        float turn=a+s*(2.1+twist*2.)+time;
        float fold=mix(cos(f1*turn),cos(f2*turn),blend);
        vec3 p=shape(toForm,s,v,a,fold);
        if(blend<1.) p=mix(shape(fromForm,s,v,a,fold),p,blend);
        float lane=s-pitch;
        singing=exp(-19.*lane*lane)*melody;
        float lift=singing*(.55+.28*cos(a+time));
        p.xy*=1.+.085*pulse+.07*volume;
        p.y+=lift*.78+.15*pulse*cos(a*2.+s*4.);
        p.z+=lift*.62+.24*pulse*cos(4.*s);
        float tilt=.33*sin(time*.5)+twist*.52;
        p.xz=mat2(cos(tilt),sin(tilt),-sin(tilt),cos(tilt))*p.xz;
        vec4 mv=modelViewMatrix*vec4(p,1.);
        ink=vec3(s,v,fold+.18*sin(a*3.+time)+root*.035);
        distanceFog=length(mv.xyz);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: `
      uniform float hue,energy,pulse,volume;
      varying float singing; varying vec3 ink; varying float distanceFog;
      void main(){
        float s=ink.x,v=ink.y,f=ink.z;
        vec3 pearl=.54+.43*cos(6.283*(hue+.18*s+.12*f+vec3(.10,.42,.56)));
        float ridge=smoothstep(.76,1.,v);
        vec3 color=pearl*(.30+.27*f+.36*v+.11*energy)+ridge*(pearl+.16)*(.53+.10*pulse);
        color+=ridge*(.25*volume+singing*.7)*mix(pearl,vec3(.96,.84,.66),.6);
        color+=vec3(.20,.12,.08)*pow(max(0.,f),6.)*.55;
        gl_FragColor=vec4(mix(color,vec3(.013,.023,.039),smoothstep(5.,16.,distanceFog)*.82),1.);
      }`
  });
  const shell = new T.Mesh(geometry, material);
  shell.position.set(0,0,-6.5);
  shell.scale.setScalar(1.022);
  shell.frustumCulled = false;
  scene.add(shell);
  // Static particle seeds; the GPU places and shades both populations in one draw.
  const particles = new T.BufferGeometry();
  const seeds = new Float32Array(480*3);
  for(let i=0;i<seeds.length;i++) seeds[i]=sample(seed,i,81);
  particles.setAttribute('position',new T.BufferAttribute(seeds,3));
  const motes = new T.Points(particles,new T.ShaderMaterial({
    uniforms, transparent:true, depthWrite:false, blending:T.AdditiveBlending,
    vertexShader:`
      uniform float time, pulse, pitch, melody, hue, volume, root;
      varying vec3 tint;
      void main(){
        float a=6.283185*position.x+time;
        vec3 p;
        float light;
        if(position.z<.45){
          // A shallow spray spreads from the rim as the kick envelope decays.
          float r=1.75+(1.-min(pulse,1.))*1.38+.28*position.y;
          p=vec3(r*cos(a),.75*r*sin(a),.8*sin(2.*a)+position.z);
          light=pulse*(.38+.62*position.y);
        }else{
          // A winding thread follows the lead's register, leaving space in its rests.
          a+=4.*position.y;
          float r=1.8+.65*position.y;
          p=vec3(r*cos(a),(pitch-.5)*3.+.65*sin(a)+.65*(position.y-.5),
                 r*sin(a));
          light=melody*(.35+.65*position.y);
        }
        vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp((13.+12.*light+6.*volume)/max(1.,-mv.z),1.,8.);
        tint=(.65+.35*cos(6.283*(hue+root*.026+position.z*.18+vec3(.1,.42,.56))))
             *light;
      }`,
    fragmentShader:`
      varying vec3 tint;
      void main(){
        vec2 xy=gl_PointCoord*2.-1.;
        float glow=max(0.,1.-dot(xy,xy));
        gl_FragColor=vec4(tint,glow*glow);
      }`
  }));
  motes.frustumCulled=false;
  shell.add(motes);
  const stars = new Float32Array(2100);
  for (let i=0;i<stars.length;i+=3) {
    const a=sample(seed,i)*2*Math.PI, h=2*sample(seed,i,1)-1, r=14+sample(seed,i,2)*6;
    const side=r*Math.sqrt(1-h*h);
    stars.set([side*Math.cos(a),r*h,side*Math.sin(a)],i);
  }
  const sky=new T.BufferGeometry();
  sky.setAttribute('position',new T.BufferAttribute(stars,3));
  scene.add(new T.Points(sky,new T.PointsMaterial({color:0x7c91a0,size:.023})));
  let last, prev, next;
  return (beat, response) => {
    const index=Math.floor(beat/32);
    if(index!==last){
      prev=phrase(seed,Math.max(0,index-1)); next=phrase(seed,index); last=index;
      uniforms.fromForm.value=formAt(seed,Math.max(0,index-1));
      uniforms.toForm.value=formAt(seed,index);
    }
    const local=beat%32, x=Math.min(1,local/5), blend=x*x*(3-2*x);
    const mix=(a,b)=>a+(b-a)*blend;
    uniforms.time.value=(beat*.035)%(Math.PI*4);
    const sway=beat*Math.PI/16;
    shell.position.x=.17*Math.sin(sway);
    shell.position.y=.10*Math.sin(sway*.5);
    shell.rotation.set(.10*Math.sin(sway*.5),.22*Math.sin(sway*.75),.07*Math.sin(sway));
    uniforms.blend.value=blend;
    uniforms.energy.value=mix(prev.energy,next.energy);
    uniforms.hue.value=prev.hue+(((next.hue-prev.hue+1.5)%1)-.5)*blend;
    uniforms.twist.value=mix(prev.twist,next.twist);
    uniforms.f1.value=prev.folds; uniforms.f2.value=next.folds;
    const step=Math.floor(beat*4), cellStart=Math.floor((step%128)/8)*8;
    const oldRoot=cellStart===0 ? chord(prev,127) : chord(next,cellStart-1);
    const approach=Math.min(1,(beat%2)*2);
    uniforms.root.value=oldRoot+(chord(next,step)-oldRoot)*approach;
    uniforms.pulse.value=response?.pulse ?? 0;
    uniforms.pitch.value=response?.pitch ?? .5;
    uniforms.melody.value=response?.melody ?? 0;
    uniforms.volume.value=response?.volume ?? 0;
  };
}
