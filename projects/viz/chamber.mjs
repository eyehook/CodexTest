import * as T from '../../shared/vendor/three-r180/three.module.js';
import {phrase, chord, sample} from './score.mjs?v=progressions1';
import {particleMotion} from './particle-motion.mjs?v=songs1';

import {shapePlan,shapeGLSL} from './shapes.mjs?v=families2';

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
  const uniforms = Object.fromEntries(['time','motion','particlePitch','particleVelocity','particlePull','blend','energy','hue','twist','f1','f2','root','pulse','melody','pitch','volume'].map(k => [k,{value:0}]));
  for(const side of ['from','to'])for(const part of ['Curve','Section','Profile','Deform','Frame'])
    uniforms[side+part]={value:new T.Vector4()};
  const material = new T.ShaderMaterial({uniforms, side:T.DoubleSide,
    vertexShader: `
      attribute float layer;
      uniform float time,motion,blend,energy,twist,f1,f2,root,pulse,melody,pitch,volume;
      varying float singing; varying vec3 ink; varying float distanceFog;
      uniform vec4 fromCurve,fromSection,fromProfile,fromDeform,fromFrame;
      uniform vec4 toCurve,toSection,toProfile,toDeform,toFrame;
      ${shapeGLSL}
      void main(){
        float s=layer, v=uv.y, a=uv.x*6.2831853;
        float turn=a+s*(2.1+twist*2.)+time;
        float fold=mix(cos(f1*turn),cos(f2*turn),blend);
        vec3 p=generatedShape(toCurve,toSection,toProfile,toDeform,toFrame,s,v,a,fold,motion);
        if(blend<1.) p=mix(generatedShape(fromCurve,fromSection,fromProfile,fromDeform,fromFrame,
          s,v,a,fold,motion),p,blend);
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
  const seeds = new Float32Array(1440*3);
  for(let i=0;i<seeds.length;i++) seeds[i]=sample(seed,i,81);
  particles.setAttribute('position',new T.BufferAttribute(seeds,3));
  const motes = new T.Points(particles,new T.ShaderMaterial({
    uniforms, transparent:true, depthWrite:false, blending:T.AdditiveBlending,
    vertexShader:`
      uniform float time, pulse, pitch, melody, hue, volume, root;
      uniform float particlePitch,particleVelocity,particlePull;
      varying vec3 tint;
      void main(){
        float a=6.283185*position.x+time;
        vec3 p;
        float light;
        // Square-root envelopes leave luminous trails after the sharper surface response.
        float spray=sqrt(clamp(pulse,0.,1.));
        float song=sqrt(clamp(melody,0.,1.));
        if(position.z<.45){
          // A broad three-dimensional burst expands beyond the sculpture's rim.
          float travel=1.-spray;
          float r=1.65+travel*2.35+.65*position.y;
          a+=travel*(position.y-.5)*1.6;
          p=vec3(r*cos(a),.82*r*sin(a),
            1.15*sin(2.*a)+1.8*(position.z/.45-.5)*travel);
          light=spray*(.55+.45*position.y);
        }else{
          // Independent drifting orbits, gently attracted toward the lead's
          // height. Velocity lag spreads each note into a wave through the cloud.
          float phase=6.283185*position.z;
          float drift=time*8.;
          float along=position.y;
          a+=drift*(.35+.65*position.z)+.35*sin(drift*.7+phase);
          float r=2.5+.65*sin(phase+along*4.)+.24*sin(drift+phase);
          float floating=.65*sin(drift*(.65+.4*along)+phase)
            +.30*cos(drift*.6+position.x*12.);
          float lag=.15+.55*along;
          float height=(clamp(particlePitch-particleVelocity*lag,0.,1.)-.5)*3.6;
          float attraction=particlePull*(.55+.65*position.z);
          p=vec3(r*cos(a),floating+attraction*height
            +.40*sin(a*2.+phase),r*sin(a)+.24*cos(drift*.8+phase));
          light=song*(.55+.45*along);

        }
        vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp((30.+38.*light+12.*volume)/max(1.,-mv.z),2.,22.);
        tint=(.65+.35*cos(6.283*(hue+root*.026+position.z*.18+vec3(.1,.42,.56))))
             *light*1.9;
      }`,
    fragmentShader:`
      varying vec3 tint;
      void main(){
        vec2 xy=gl_PointCoord*2.-1.;
        float radius=dot(xy,xy);
        if(radius>1.) discard;
        float halo=exp(-3.8*radius)*(1.-smoothstep(.65,1.,radius));
        float core=exp(-22.*radius);
        gl_FragColor=vec4(tint*(.8+core*1.2),halo);
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
  // Analytic rotation around vertical stays seekable and never drifts.
  const rotationAxis=new T.Vector3(0,1,0);
  const rotationPeriod=80+32*sample(seed,0,93);
  const floatMotion=particleMotion();
  let last, prev, next,fromFolds,toFolds;
  const update=(beat, response) => {
    const index=Math.floor(beat/32);
    if(index!==last){
      prev=phrase(seed,Math.max(0,index-1)); next=phrase(seed,index); last=index;
      const before=shapePlan(seed,Math.max(0,index-1)),after=shapePlan(seed,index);
      fromFolds=before.folds;toFolds=after.folds;
      for(const part of ['Curve','Section','Profile','Deform','Frame']){
        const key=part.toLowerCase();
        uniforms['from'+part].value.fromArray(before[key]);
        uniforms['to'+part].value.fromArray(after[key]);
      }
    }
    const local=beat%32, x=Math.min(1,local/5), blend=x*x*(3-2*x);
    const mix=(a,b)=>a+(b-a)*blend;
    uniforms.time.value=beat*.035;
    uniforms.motion.value=(beat*Math.PI/32+sample(seed,0,90)*Math.PI*2)%(Math.PI*2);
    const sway=beat*Math.PI/16;
    shell.position.x=.17*Math.sin(sway);
    shell.position.y=.10*Math.sin(sway*.5);
    shell.quaternion.setFromAxisAngle(rotationAxis,(beat%rotationPeriod)*Math.PI*2/rotationPeriod);
    uniforms.blend.value=blend;
    uniforms.energy.value=mix(prev.energy,next.energy);
    uniforms.hue.value=prev.hue+(((next.hue-prev.hue+1.5)%1)-.5)*blend;
    update.hue=uniforms.hue.value;
    uniforms.twist.value=mix(prev.twist,next.twist);
    // Generated shape plans own the broad fold count; music still drives the response.
    uniforms.f1.value=fromFolds; uniforms.f2.value=toFolds;
    const step=Math.floor(beat*4), cellStart=Math.floor((step%128)/8)*8;
    const oldRoot=cellStart===0 ? chord(prev,127) : chord(next,cellStart-1);
    const approach=Math.min(1,(beat%2)*2);
    uniforms.root.value=oldRoot+(chord(next,step)-oldRoot)*approach;
    const floating=floatMotion(beat,response?.pitch ?? .5,response?.melody ?? 0);
    uniforms.particlePitch.value=floating.pitch;
    uniforms.particleVelocity.value=floating.velocity;
    uniforms.particlePull.value=floating.pull;
    uniforms.pulse.value=response?.pulse ?? 0;
    uniforms.pitch.value=response?.pitch ?? .5;
    uniforms.melody.value=response?.melody ?? 0;
    uniforms.volume.value=response?.volume ?? 0;
  };
  update.hue=0;
  return update;
}
