import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import { PlayerController } from './player.js?v=shared-r180-1';
import { Environment } from './environment.js?v=shared-r180-1';
import { FrameRateCounter } from './fps.js?v=shared-xr-1';
import { Parameters, cloudScales } from './parameters.js?v=shared-r180-1';
import { DesktopControls, VRControlPanel } from './controls.js?v=shared-r180-1';
import { VolumeRenderer } from './volume-renderer.js?v=shared-r180-1';
class CloudLab {
  constructor(){
    this.renderer=new THREE.WebGLRenderer({
      antialias:false,powerPreference:'high-performance'
    });
    const r=this.renderer;
    r.setPixelRatio(Math.min(devicePixelRatio,2));
    r.setSize(innerWidth,innerHeight);
    r.xr.enabled=true;
    r.xr.setReferenceSpaceType('local-floor');
    r.xr.setFoveation(0);
    r.outputColorSpace=THREE.SRGBColorSpace;
    document.body.prepend(r.domElement);
    this.scene=new THREE.Scene();
    this.environment=new Environment(this.scene);
    this.player=new PlayerController(this.scene,r);
    this.parameters=new Parameters();
    this.columns=new THREE.Group();
    this.scene.add(this.columns);
    const positions=[[-12,-20],[-4,-17],[4,-23],[0,-34],[-2,-7],[12,-18]];
    const colors=[0xff3333,0x33dd55,0x3366ff,0xffdd22,0x22dddd,0xee44ee];
    const geometry=new THREE.BoxGeometry(1,15,1);
    for(let i=0;i<6;i++){
      const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({
        color:colors[i]
      }));
      mesh.position.set(positions[i][0],7.5,positions[i][1]);
      this.columns.add(mesh);
    }
    this.desktop=new DesktopControls(document.querySelector('#parameters'),this.parameters);
    this.panel=new VRControlPanel(this.scene,this.player,this.parameters);
    this.volume=new VolumeRenderer(r,this.parameters);
    this.noisePending=true;
    this.volume.onNoise=pending=>{
      this.noisePending=pending;
    };
    this.volume.onError=message=>{
      document.querySelector('#status').textContent='Noise generation failed: '+message;
    };
    this.counter=new FrameRateCounter();
    this.lastTime=null;
    this.lastFPS=null;
    this.cpuTotal=0;
    this.cpuFrames=0;
    this.parameters.subscribe((id,value)=>{
      if(id==='foveation')r.xr.setFoveation(value);this.updateStats();
    });
    window.addEventListener('resize',()=>{
      this.player.camera.aspect=innerWidth/innerHeight;this.player.camera.updateProjectionMatrix();r.setSize(innerWidth,innerHeight);
    });
    r.xr.addEventListener('sessionstart',()=>{
      document.body.classList.add('xr');this.panel.beginSession();this.resetTiming();this.foveationSupport();
    });
    r.xr.addEventListener('sessionend',()=>{
      document.body.classList.remove('xr');this.panel.update(null);this.resetTiming();this.foveationSupport();
    });
    document.addEventListener('visibilitychange',()=>this.resetTiming());
    this.setupXR();
    r.setAnimationLoop((time,frame)=>this.frame(time,frame));
  }
  resetTiming(){
    this.lastTime=null;
    this.counter.reset();
    this.lastFPS=null;
    this.cpuFrames=this.cpuTotal=0;
  }
  foveationSupport(){
    const layer=this.renderer.xr.getBaseLayer();
    const supported=this.renderer.xr.isPresenting&&layer&&typeof layer.fixedFoveation==='number';
    const d=this.parameters.definitions.find(d=>d.id==='foveation');
    d.disabled=!supported;
    const input=this.desktop.rows.get('foveation').input;
    input.disabled=!supported;
    if(supported)this.renderer.xr.setFoveation(this.parameters.values.foveation);
    this.panel.draw();
  }
  updateStats(){
    const v=this.parameters.values,fps=this.lastFPS,ms=fps?1000/fps:0;
    const cadence=fps?`${fps.toFixed(1)} FPS · ${ms.toFixed(2)} ms`:'FPS — · ms —';
    const cpu=this.cpuFrames?this.cpuTotal/this.cpuFrames:0;
    document.querySelector('#stats').textContent=`${cadence} · CPU submission ${cpu.toFixed(2)} ms · ${v.steps} steps · ${cloudScales[v.cloudResolution]}% · cloud ${v.cloud?'on':'off'}${this.noisePending?' · generating noise…':''}`;
    this.panel.metrics=`${cadence} | ${v.steps} steps | ${cloudScales[v.cloudResolution]}% | ${v.cloud?'ON':'OFF'}`;
    if(this.panel.mesh.visible)this.panel.draw();
  }
  async setupXR(){
    const button=document.querySelector('#vr'),status=document.querySelector('#status');
    try{
      if(!await navigator.xr?.isSessionSupported('immersive-vr')){
        button.textContent='VR unavailable';
        status.textContent='Desktop ready. Quest requires HTTPS or trusted localhost.';
        return;
      }
      button.disabled=false;
      button.textContent='Enter VR';
      button.onclick=async()=>{
        button.disabled=true;
        try{
          const session=await navigator.xr.requestSession('immersive-vr',{
            requiredFeatures:['local-floor']
          });
          session.addEventListener('end',()=>button.disabled=false,{
            once:true
          });
          await this.renderer.xr.setSession(session);
        } catch(e){
          status.textContent=e.message;
          button.disabled=false;
        }
      };
    } catch(e){
      status.textContent=e.message;
    }
  }
  frame(time,frame){
    const session=this.renderer.xr.getSession();
    if(document.hidden||(session&&session.visibilityState!=='visible')){
      this.resetTiming();
      return;
    }
    const dt=this.lastTime===null?0:(time-this.lastTime)/1000;
    this.lastTime=time;
    const start=performance.now();
    const position=this.player.update(Math.min(dt,.05),frame);
    if(!position){
      this.resetTiming();
      return;
    }
    this.environment.update(position);
    this.columns.visible=Boolean(this.parameters.values.columns);
    this.panel.update(session);
    this.volume.render(this.scene,this.player.camera);
    this.cpuTotal+=performance.now()-start;
    this.cpuFrames++;
    const fps=this.counter.sample(dt);
    if(fps!==null){
      this.lastFPS=fps;
      this.updateStats();
      this.cpuTotal=this.cpuFrames=0;
    }
  }
}
try{
  window.cloudLab=new CloudLab();
} catch(e){
  document.querySelector('#status').textContent='Unable to start: '+e.message;
  console.error(e);
}
