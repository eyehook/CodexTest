import * as T from '../../shared/vendor/three-r180/three.module.js';

// Independent damped particle trajectories, kept in one small point draw.
export class NoteSwirl {
  constructor(panel) {
    const seeds=new Float32Array(72*3);
    for(let i=0;i<72;i++)seeds.set([i/72,(i*.61803398875)%1,(i*.41421356237)%1],i*3);
    this.seeds=seeds;
    this.positions=new Float32Array(seeds.length);
    this.velocities=new Float64Array(seeds.length);
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.BufferAttribute(this.positions,3).setUsage(T.DynamicDrawUsage));
    geometry.setAttribute('seed',new T.BufferAttribute(seeds,3));
    this.uniforms={clock:{value:0},alpha:{value:0},tint:{value:new T.Color()}};
    this.points=new T.Points(geometry,new T.ShaderMaterial({
      uniforms:this.uniforms,transparent:true,depthWrite:false,blending:T.AdditiveBlending,
      vertexShader:`
        uniform float clock;
        attribute vec3 seed;
        varying float sparkle;
        void main(){
          vec3 p=position;
          vec4 mv=modelViewMatrix*vec4(p,1.);
          gl_Position=projectionMatrix*mv;
          gl_PointSize=clamp((5.25+3.75*seed.y)/max(.6,-mv.z),2.25,12.);
          sparkle=.65+.35*sin(clock*2.+seed.z*6.283185);
        }`,
      fragmentShader:`
        uniform vec3 tint;uniform float alpha;
        varying float sparkle;
        void main(){
          vec2 xy=gl_PointCoord*2.-1.;float r=dot(xy,xy);
          if(r>1.)discard;
          gl_FragColor=vec4(tint*2.1,alpha*sparkle*exp(-2.5*r)*(1.-smoothstep(.6,1.,r)));
        }`
    }));
    this.points.frustumCulled=false;this.points.visible=false;panel.add(this.points);
    this.previous=undefined;this.started=false;
  }
  reset(){this.previous=undefined;this.started=false;this.uniforms.alpha.value=0;this.points.visible=false;}
  update(choice,color,seconds) {
    const dt=this.previous===undefined?0:Math.max(0,seconds-this.previous);this.previous=seconds;
    const selected=Number.isInteger(choice) && choice>=0 && choice<5;
    if(selected)this.targetY=(choice-2)*.18;
    if(selected && !this.started){
      for(let i=0;i<72;i++){
        const angle=this.seeds[i*3]*Math.PI*2;
        this.positions[i*3]=.10*Math.cos(angle);
        this.positions[i*3+1]=this.targetY+.10*Math.sin(angle);
        this.positions[i*3+2]=.02;
      }
      this.velocities.fill(0);this.started=true;
    }
    if(this.started){
      // Bound simulation work after a stall. Small substeps keep even the fastest
      // followers stable; a target change never resets position or momentum.
      const elapsed=Math.min(dt,.12),steps=Math.ceil(elapsed*120);
      const h=steps?elapsed/steps:0;
      for(let step=0;step<steps;step++){
        const time=seconds-elapsed+(step+1)*h;
        for(let i=0;i<72;i++){
          const j=i*3,speed=this.seeds[j+1],phase=this.seeds[j]*Math.PI*2;
          const angle=phase+time*(1.8+.7*speed);
          const radius=.103+.016*Math.sin(time+this.seeds[j+2]*6.283)
            +(selected?0:.035);
          // Fast leaders and slower followers form a twisting trail. Mildly
          // underdamped attraction allows a soft overshoot into the new orbit.
          const omega=(4+9*speed)*(selected?1:.4);
          for(let axis=0;axis<3;axis++){
            const target=axis===0?radius*Math.cos(angle):axis===1?
              this.targetY+radius*Math.sin(angle):.02+.028*Math.sin(angle*2.+phase);
            const k=j+axis;
            this.velocities[k]+=((target-this.positions[k])*omega*omega
              -1.25*omega*this.velocities[k])*h;
            this.positions[k]+=this.velocities[k]*h;
          }
        }
      }
      this.points.geometry.attributes.position.needsUpdate=true;
    }
    // Fast reveal, slower fade while continuing to orbit the last selected note.
    this.uniforms.alpha.value+=((selected?1:0)-this.uniforms.alpha.value)*(1-Math.exp(-dt*(selected?8:1.6)));
    this.uniforms.clock.value=seconds;
    this.uniforms.tint.value.copy(color);
    this.points.visible=this.uniforms.alpha.value>.003;
  }
}
