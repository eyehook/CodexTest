import * as T from '../../shared/vendor/three-r180/three.module.js';

// Outward-flowing point stream, one draw with static seeds and no buffer uploads.
export function particlePointer() {
  const seeds=new Float32Array(96*3);
  for(let i=0;i<96;i++)seeds.set([i/96,(i*.61803398875)%1,(i*.41421356237)%1],i*3);
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(seeds,3));
  const uniforms={clock:{value:0},reach:{value:1.2},tint:{value:new T.Color()}};
  const points=new T.Points(geometry,new T.ShaderMaterial({
    uniforms,transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    vertexShader:`
      uniform float clock,reach;
      varying float fade;
      void main(){
        // Every particle advances outward, with independent radial breathing
        // and angular drift around one shared axis, rather than fixed strands.
        float travel=fract(position.x+clock*.22);
        float distance=travel*reach;
        float phase=position.y*6.283185;
        float phase2=position.z*6.283185;
        float angle=phase+clock*(.45+.65*position.z)
          +.65*sin(clock*(.55+.4*position.y)+phase2);
        float breathing=.5+.5*sin(clock*(.65+.65*position.y)+phase2);
        float radius=(.004+.019*travel)*(.15+.85*breathing);
        float x=radius*cos(angle)+.003*sin(clock*.83+phase2);
        float y=radius*sin(angle)+.003*cos(clock*.71+phase);
        vec3 p=vec3(x,y,-distance);
        vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp((2.5+2.*position.z)/max(.5,-mv.z),2.,9.);
        fade=smoothstep(0.,.06,travel)*(1.-smoothstep(.55,1.,travel));
      }`,
    fragmentShader:`
      uniform vec3 tint;varying float fade;
      void main(){
        vec2 xy=gl_PointCoord*2.-1.;float r=dot(xy,xy);
        if(r>1.)discard;
        gl_FragColor=vec4(tint*1.8,fade*exp(-3.*r)*(1.-smoothstep(.6,1.,r)));
      }`
  }));
  points.frustumCulled=false;points.visible=false;
  return points;
}
