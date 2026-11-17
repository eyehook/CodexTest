import {sample} from './score.mjs?v=progressions1';

export const shapeFamilies=Object.freeze([
  'Sphere','Cone','Cylinder','Torus','Simple knot','Hourglass','Bowl',
  'Spiral','Saddle','Figure eight','Möbius strip'
]);

// Eleven is prime: a seeded stride visits every family before repeating it.
// A return to a family uses entirely new dimensions and deformation parameters.
export function shapeFamily(seed,index) {
  const count=shapeFamilies.length;
  const offset=Math.floor(sample(seed,0,9100)*count);
  const stride=1+Math.floor(sample(seed,0,9101)*(count-1));
  return (offset+(index%count)*stride)%count;
}

export function shapePlan(seed,index) {
  const r=lane=>sample(seed,index,9000+lane),family=shapeFamily(seed,index);
  const radius=family===0?1.05+.8*r(2):family===1?.9+1.05*r(2):
    family===2?.75+.85*r(2):family===4?.9+.5*r(2):1.05+.65*r(2);
  const ripple=radius*(.04+.15*r(3));
  const tube=family===4?radius*(.13+.09*r(4)):family===5?.18+.32*r(4):
    family===7?radius*(.055+.035*r(4)):family===9?radius*(.12+.10*r(4)):
    family===10?.28+.4*r(4):radius*(.17+.22*r(4));
  const span=family===7?(1.25+1.35*r(0))*Math.PI*2:Math.PI*2;
  const winding=-.95+1.9*r(6),spread=.45+1.8*r(7);
  const height=.85+1.35*r(8);
  const taper=family===1?.015+.22*r(9):-.38+.76*r(9);
  const stretchX=.65+.7*r(10),stretchY=.65+.7*r(11);
  const phase=r(12)*Math.PI*2,asymmetry=.10+.25*r(13);
  const curl=.18+.47*r(14),opening=.35+.65*r(15);
  const rise=.15+.55*r(16);
  const tiltX=-.8+1.6*r(17),tiltZ=-.75+1.5*r(18);
  const ridge=.115,cross=tube*(1+Math.abs(taper))*1.15;
  const planarStretch=Math.max(stretchX,stretchY);
  let bound;
  if(family===0)bound=Math.hypot((radius+ripple+ridge)*(1+Math.abs(taper))*1.1*Math.max(stretchX,1),height*stretchY);
  else if(family<=2 || family===5)bound=Math.hypot(
    (radius*(1+Math.abs(taper)+.1*opening)+ripple+ridge)*Math.max(stretchX,1),height*stretchY);
  else if(family===6)bound=Math.hypot((radius+ripple+ridge)*Math.max(stretchX,1),height*.5*stretchY);
  else if(family===7)bound=Math.hypot((.25+radius+cross+ridge)*planarStretch,height*.3+cross);
  else if(family===8)bound=Math.hypot(radius*stretchX,radius,(height*.5+.10)*stretchY);
  else if(family===9)bound=Math.hypot((Math.hypot(radius,.65*height)+cross)*planarStretch, .25+spread*.12+cross);
  else if(family===10)bound=Math.hypot((radius+.5*ripple+1.15*tube+ridge)*planarStretch,1.15*tube);
  else bound=Math.hypot((radius*(family===4?1.37:1)+cross+ripple+ridge)*planarStretch,
    (family===4?height*.35:0)+cross);
  // Include the stronger, independently seeded bend/curl/skew before fitting
  // the sculpture. Audio response remains a separate, unchanged shader stage.
  bound+=((family===1 || family===2?2:1)*rise+curl+asymmetry)*Math.max(stretchX,stretchY,1);
  return {
    folds:1+Math.floor(r(19)*3),
    curve:[radius,ripple,family,family===4?3:1+Math.floor(r(1)*3)],
    section:[tube,span,winding,spread],
    profile:[height,taper,stretchX,stretchY],
    deform:[phase,asymmetry,curl,opening],
    frame:[rise,tiltX,tiltZ,3.2/bound]
  };
}

// All constructions share angle/layer coordinates. Evaluate each endpoint in
// full before blending, rather than interpolating family IDs during a morph.
export const shapeGLSL=`
  vec3 generatedShape(vec4 curve,vec4 section,vec4 profile,vec4 deform,vec4 frame,
    float s,float v,float a,float fold,float motion){
    float phase=deform.x;
    float t=clamp(s+(v-.5)*.020,0.,1.);
    float envelope=sin(3.14159265*t);
    float breath=.5-.5*cos(motion-1.8*s+phase);
    float unwind=sin(motion-2.4*s+phase);
    float angle=a+section.z*(2.*t-1.)+.3*deform.w*unwind*envelope;
    float ripple=curve.y*(.65+.35*breath)*sin(curve.w*a+phase+section.z*(s-.5));
    float ridge=(.05+.065*s)*fold;
    float beta=t*6.2831853+section.z*sin(a)+deform.w*unwind*envelope;
    float crossRadius=section.x*(1.+profile.y*sin(a+phase))*(.85+.3*breath);
    vec3 p;
    if(curve.z<.5){
      // Latitude bands, with an egg-like taper and broad breathing lobes.
      float latitude=(t-.5)*3.14159265;
      float radius=(curve.x+ripple+ridge)*cos(latitude)*(.9+.2*breath)
        *(1.+profile.y*(2.*t-1.));
      p=vec3(radius*cos(angle),profile.x*sin(latitude),radius*sin(angle));
    }else if(curve.z<2.5){
      // Cone curvature ranges from straight to flared/concave; both axial
      // families can be squat, slender, leaning, fluted and substantially twisted.
      float radius=curve.z<1.5?curve.x*mix(1.,profile.y,pow(t,section.w)):
        curve.x*(1.+profile.y*(2.*t-1.)+.16*deform.w*unwind*(t-.5));
      float lip=curve.z<1.5?1.-t:1.;
      radius+=(ripple+ridge)*lip;
      p=vec3(radius*cos(angle),(2.*t-1.)*profile.x,radius*sin(angle));
      p.x+=frame.x*t*t*unwind;
    }else if(curve.z<4.5){
      angle=a+section.z*sin(6.2831853*t)+.3*deform.w*unwind*envelope;
      if(curve.z<3.5){
        float radius=curve.x+crossRadius*cos(beta)+ripple+ridge;
        p=vec3(radius*cos(angle),radius*sin(angle),crossRadius*sin(beta));
      }else{
        float radius=curve.x*(1.+(.26+.1*breath)*cos(3.*a+phase))
          +crossRadius*cos(beta)+ripple+ridge;
        p=vec3(radius*cos(2.*a),radius*sin(2.*a),
          profile.x*.35*sin(3.*a+phase)+crossRadius*sin(beta));
      }
    }else if(curve.z<5.5){
      // Opposing bells with variable waist width, flare and counter-twist.
      float waist=section.x+(1.-section.x)*pow(abs(2.*t-1.),1.1+section.w*.6);
      float radius=(curve.x*(1.+profile.y*(2.*t-1.))+ripple+ridge)*waist;
      p=vec3(radius*cos(angle),(2.*t-1.)*profile.x,radius*sin(angle));
    }else if(curve.z<6.5){
      // Rounded dishes and deeper bowls, with a curling, scalloped rim.
      float arc=t*1.57079633;
      float radius=(curve.x+ripple+ridge)*pow(sin(arc),section.w);
      p=vec3(radius*cos(angle),profile.x*(.5-cos(arc)),radius*sin(angle));
    }else if(curve.z<7.5){
      // An open coil; its winding amount and depth change continuously.
      float u=a/6.2831853;
      float coil=u*(section.y+.7*deform.w*unwind)+phase;
      float radius=.25+curve.x*u+crossRadius*cos(beta)+ridge;
      p=vec3(radius*cos(coil),radius*sin(coil),
        profile.x*(.35*(u-.5)+.10*sin(coil))+crossRadius*sin(beta));
    }else if(curve.z<8.5){
      // An open rectangular sheet, bent into a hyperbolic saddle.
      float x=2.*a/6.2831853-1.,z=2.*t-1.;
      p=vec3(curve.x*x,profile.x*.5*(x*x-z*z),curve.x*z);
      p.y+=.10*fold*envelope;
    }else if(curve.z<9.5){
      // A thin tube around a figure-eight, with depth separating its crossing.
      vec2 tangent=normalize(vec2(curve.x*cos(a),1.3*profile.x*cos(2.*a)));
      vec2 normal=vec2(-tangent.y,tangent.x);
      vec2 center=vec2(curve.x*sin(a),profile.x*.65*sin(2.*a));
      p=vec3(center+normal*crossRadius*cos(beta),(.25+section.w*.12)*cos(a)+crossRadius*sin(beta));
    }else{
      // One half-twist. The two ends meet with opposite cross-strip directions.
      float width=(2.*t-1.)*section.x*(1.+.15*cos(2.*a+phase));
      float twist=.5*a+.25*section.z*sin(a)+.25*deform.w*sin(motion+phase);
      float radius=curve.x+.5*curve.y*sin(curve.w*a+phase)+width*cos(twist)
        +.05*cos(curve.w*a+phase)*envelope;
      p=vec3(radius*cos(a),radius*sin(a),width*sin(twist));
    }
    float drift=curve.z>9.5?sin(motion+phase):unwind;
    float swell=curve.z>9.5 ? .5-.5*cos(motion+phase) : breath;
    p.x+=frame.x*envelope*sin(a+phase)*drift;
    p.z+=deform.z*envelope*sin(curve.w*a+phase)*swell;
    p.y+=deform.y*envelope*sin(a+phase)*drift;
    p.x*=profile.z;p.y*=profile.w;
    p.yz=mat2(cos(frame.y),sin(frame.y),-sin(frame.y),cos(frame.y))*p.yz;
    p.xy=mat2(cos(frame.z),sin(frame.z),-sin(frame.z),cos(frame.z))*p.xy;
    return p*frame.w;
  }
`;
