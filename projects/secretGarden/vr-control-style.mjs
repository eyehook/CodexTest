import {PlaneGeometry} from '../../shared/vendor/three-r180/three.module.js';
// Room-panel skin only: existing widgets retain model bindings and input behavior.
export function styleVRControl(widget){
 const d=widget.model.definition(widget.id),toggle=d.kind==='toggle',height=toggle?120:212;
 widget.canvas.width=1024;widget.canvas.height=height;widget.mesh.geometry.dispose();widget.mesh.geometry=new PlaneGeometry(1.65,1.65*height/1024);widget.mesh.scale.set(1,1,1);
 widget.mesh.material.transparent=true;
 widget.draw=()=>{
  const c=widget.canvas.getContext('2d'),value=widget.model.value(widget.id),disabled=widget.model.disabled(d),accent='#dfbd79',text='#edf2e8',muted='#a9beb1';
  c.globalAlpha=1;c.clearRect(0,0,1024,height);c.fillStyle=widget.hover&&!disabled?'#354d40':'#293e35';c.beginPath();c.roundRect(0,0,1024,height,18);c.fill();
  c.globalAlpha=disabled?.4:1;c.textBaseline='middle';c.textAlign='left';c.font='38px system-ui';c.fillStyle=text;
  if(toggle){
   c.strokeStyle=value?accent:muted;c.lineWidth=4;c.beginPath();c.roundRect(54,37,46,46,6);c.stroke();
   if(value){c.strokeStyle=accent;c.lineWidth=5;c.beginPath();c.moveTo(64,60);c.lineTo(74,70);c.lineTo(91,49);c.stroke();}
   c.fillText(widget.model.label(d),132,60);c.textAlign='right';c.font='28px system-ui';c.fillStyle=value?accent:muted;c.fillText(value?'On':'Off',970,60);
  }else{
   c.fillText(widget.model.label(d),54,39);c.textAlign='right';c.fillStyle=accent;c.fillText(widget.model.format(d),970,39);
   const fraction=(value-d.min)/(d.max-d.min),x=100+fraction*824;c.lineWidth=8;c.lineCap='round';c.strokeStyle='#52685b';c.beginPath();c.moveTo(100,106);c.lineTo(924,106);c.stroke();c.strokeStyle=accent;c.beginPath();c.moveTo(100,106);c.lineTo(x,106);c.stroke();
   if(d.stops)for(const stop of d.stops){const sx=100+(stop-d.min)/(d.max-d.min)*824;c.fillStyle=muted;c.beginPath();c.arc(sx,106,5,0,Math.PI*2);c.fill();}
   c.fillStyle=accent;c.beginPath();c.arc(x,106,15,0,Math.PI*2);c.fill();c.font='26px system-ui';c.fillStyle=muted;
   if(disabled){c.textAlign='left';c.fillText('Disabled while Teleport is on',54,170);}
   else if(d.stops){c.textAlign='center';for(const stop of d.stops)c.fillText(d.stopFormat?d.stopFormat(stop):stop+'°',100+(stop-d.min)/(d.max-d.min)*824,170);}
   else {c.textAlign='left';c.fillText(d.min+' '+d.unit,100,170);c.textAlign='right';c.fillText(d.max+' '+d.unit,924,170);}
  }
  c.globalAlpha=1;widget.texture.needsUpdate=true;
 };widget.draw();return widget;
}
