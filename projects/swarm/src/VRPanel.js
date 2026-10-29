import * as T from '../../../shared/vendor/three-r180/three.module.js';

// A single canvas texture and plane; redraw only when a value or hover changes.
export class VRPanel {
  constructor(scene,rig,renderer,c,onChange) {
    this.config=c;this.onChange=onChange;
    this.playerPosition=new T.Vector3();this.panelOffset=new T.Vector3();
    this.rows=[
      ['Bees',c,'beeCount',10,1000,10],['Bee speed',c,'maxSpeed',.5,8,.25],
      ['Steering limit',c,'maxForce',.5,12,.5],['Neighbor radius',c,'neighborRadius',.2,6,.2],
      ['Separation radius',c,'separationRadius',.1,2,.1],
      ...['cohesion','alignment','separation','attraction','boundary'].map(k=>[k[0].toUpperCase()+k.slice(1),c,k,0,4,.1]),
      ['Wasp speed',c,'waspSpeed',.2,6,.2],['Flight width ±X',c.bounds,'x',4,20,1],
      ['Flight depth ±Z',c.bounds,'z',4,20,1],['Minimum altitude',c.bounds,'minY',3,6,.5],
      ['Maximum altitude',c.bounds,'maxY',8,14,.5],
    ];
    this.canvas=document.createElement('canvas');this.canvas.width=1024;this.canvas.height=1280;
    this.ctx=this.canvas.getContext('2d');this.texture=new T.CanvasTexture(this.canvas);this.texture.colorSpace=T.SRGBColorSpace;
    this.mesh=new T.Mesh(new T.PlaneGeometry(1.45,1.8125),new T.MeshBasicMaterial({map:this.texture}));
    scene.add(this.mesh);this.mesh.visible=false;
    this.ray=new T.Raycaster();this.rotation=new T.Matrix4();this.hover=-1;
    this.controllers=[];
    for(let i=0;i<2;i++) {
      const controller=renderer.xr.getController(i);rig.add(controller);
      const line=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3(0,0,-1)]),new T.LineBasicMaterial({color:0xffb56a}));
      line.scale.z=4;line.visible=false;controller.add(line);controller.userData.line=line;
      controller.userData.connected=false;
      controller.addEventListener('connected',()=>controller.userData.connected=true);
      controller.addEventListener('disconnected',()=>{controller.userData.connected=false;line.visible=false;});
      controller.addEventListener('selectstart',()=>{if(this.mesh.visible && controller.userData.connected)this.activate(this.hit(controller));});
      this.controllers.push(controller);
    }
    this.draw();
  }
  follow(position, heading) {
    // Follow player translation and thumbstick yaw, not head-look rotation:
    // the player can turn their head toward the panel without it moving away.
    this.panelOffset.set(3/Math.sqrt(2),0,-3/Math.sqrt(2)).applyQuaternion(heading);
    this.mesh.position.copy(position).add(this.panelOffset);
    this.mesh.lookAt(position);
    this.mesh.updateMatrixWorld(true);
  }
  place(distance) {
    this.playerPosition.set(0,1.6,distance);
    this.follow(this.playerPosition,new T.Quaternion());
    this.mesh.visible=true;
  }
  toggle() {
    this.mesh.visible=!this.mesh.visible;
    this.hover=-1;
    if(this.mesh.visible)this.draw();
    else for(const controller of this.controllers)controller.userData.line.visible=false;
  }
  hit(controller) {
    this.rotation.extractRotation(controller.matrixWorld);
    this.ray.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.ray.ray.direction.set(0,0,-1).applyMatrix4(this.rotation);
    const hit=this.ray.intersectObject(this.mesh,false)[0];
    if(!hit)return null;
    const x=hit.uv.x*1024,y=(1-hit.uv.y)*1280;
    const row=Math.floor((y-150)/70);
    if(row<0||row>=this.rows.length||y>150+row*70+56)return null;
    const sign=x>=758&&x<=842?-1:x>=878&&x<=962?1:0;
    return sign?{row,sign,distance:hit.distance}:null;
  }
  activate(hit) {
    if(!hit)return;
    const [,object,key,min,max,step]=this.rows[hit.row];
    const next=T.MathUtils.clamp(Number((object[key]+hit.sign*step).toFixed(2)),min,max);
    if(next===object[key])return;
    object[key]=next;this.onChange(key);this.draw();
  }
  update() {
    if(!this.mesh.visible){for(const controller of this.controllers)controller.userData.line.visible=false;return;}
    let hover=-1;
    for(const controller of this.controllers){
      const line=controller.userData.line;line.visible=controller.userData.connected;
      if(!line.visible)continue;
      const hit=this.hit(controller);line.scale.z=hit?hit.distance:4;
      if(hit)hover=hit.row*2+(hit.sign>0?1:0);
    }
    if(hover!==this.hover){this.hover=hover;this.draw();}
  }
  draw() {
    const ctx=this.ctx;ctx.fillStyle='#24282c';ctx.fillRect(0,0,1024,1280);
    ctx.fillStyle='#fff';ctx.font='bold 44px system-ui';ctx.fillText('SWARM / TUNING',52,70);
    ctx.font='25px system-ui';ctx.fillStyle='#c6ccd2';ctx.fillText('Point either controller · Trigger − / +',52,116);
    this.rows.forEach(([label,obj,key],i)=>{
      const y=150+i*70;ctx.fillStyle=i%2?'#30353b':'#292e33';ctx.fillRect(30,y,964,60);
      ctx.fillStyle='#fff';ctx.font='29px system-ui';ctx.fillText(label,52,y+40);
      ctx.fillStyle='#ffb56a';ctx.fillText(Number(obj[key].toFixed(2)).toString(),590,y+40);
      for(let side=0;side<2;side++){const x=758+side*120;ctx.fillStyle=this.hover===i*2+side?'#bc7139':'#49515a';ctx.fillRect(x,y+2,84,54);ctx.fillStyle='#fff';ctx.font='36px system-ui';ctx.fillText(side?'+':'−',x+27,y+40);}
    });
    ctx.fillStyle='#b9c1c8';ctx.font='23px system-ui';ctx.fillText('Bees respawn on count change. Bounds shape new path segments.',35,1250);
    this.texture.needsUpdate=true;
  }
}
