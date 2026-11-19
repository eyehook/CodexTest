// Optional real WebGL integration: PLAYWRIGHT_MODULE and CHROME_PATH may point to host tools.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto(process.env.AIRHOCKEY_URL||'http://127.0.0.1:8080/projects/airhockey/');await page.waitForFunction(()=>window.airhockey,{},{timeout:15000});await page.waitForTimeout(500);
await page.screenshot({path:process.env.AIRHOCKEY_SCREENSHOT||'/tmp/airhockey.png'});
await page.click('#settings');const paused=await page.evaluate(()=>{airhockey.game.physics.puck.vx=1;return airhockey.game.physics.puck.x;});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>airhockey.game.physics.puck.x),paused);
assert.equal(await page.locator('input[aria-label="Table height"]').count(),0);await page.locator('input[aria-label="Opponent skill"]').fill('82');assert.equal(await page.evaluate(()=>airhockey.game.skill),82);
await page.getByRole('checkbox',{name:'Main Hand',exact:true}).uncheck();assert.equal(await page.evaluate(()=>airhockey.input.mainHand),'left');await page.getByRole('checkbox',{name:'Main Hand',exact:true}).check();assert.equal(await page.evaluate(()=>airhockey.input.mainHand),'right');
await page.getByRole('button',{name:'New game',exact:true}).click();assert.deepEqual(await page.evaluate(()=>airhockey.game.scores),[0,0]);assert.equal(await page.evaluate(()=>airhockey.game.skill),82);assert.equal(await page.locator('#panel').isHidden(),true);
await page.mouse.move(930,600);await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>airhockey.game.player.x>0));
await page.evaluate(()=>{airhockey.game.state='placing';airhockey.game.serve=1;airhockey.game.resetPuck();});await page.waitForTimeout(60);assert.equal(await page.evaluate(()=>airhockey.game.state),'placing');await page.mouse.click(930,600);assert.equal(await page.evaluate(()=>airhockey.game.state),'play');await page.evaluate(()=>airhockey.game.newGame());
const lights=await page.evaluate(async()=>{
 const a=airhockey,T=await import('three');a.renderer.setAnimationLoop(null);const colorValue=new T.Color();
 const pixel=(side,i)=>{a.view.scoreLights.mesh.getColorAt(side*7+i,colorValue);const h=colorValue.getHex();a.view.scoreLights.halos.getColorAt(side*7+i,colorValue);if(colorValue.getHex()!==h)throw new Error('Halo color diverged from sphere');return [h>>16,(h>>8)&255,h&255];};
 const positions=[];for(let i=0;i<14;i++){const m=new T.Matrix4();a.view.scoreLights.mesh.getMatrixAt(i,m);positions.push(new T.Vector3().setFromMatrixPosition(m).toArray());}
 const hemisphere=positions.every(p=>Math.abs(p[1]-.025)<1e-7);
 const direction=positions.every((p,i)=>(i<7?p[0]<0&&p[2]>0:p[0]>0&&p[2]<0))&&positions.slice(1,7).every((p,i)=>p[2]<positions[i][2])&&positions.slice(8).every((p,i)=>p[2]>positions[i+7][2]);
 a.game.scores=[3,2];a.game.state='play';a.view.update(a.game,10,'');
 const partial=[pixel(0,2),pixel(0,3),pixel(1,1),pixel(1,2)];const winners=[];
 for(const side of [0,1]){
  a.game.scores=side===0?[7,2]:[3,7];a.game.state='won';a.view.update(a.game,20+side*10,'');
  const on=pixel(side,6);const color=a.view.celebration.sparks.material.color.getHexString();
  let t=20+side*10;for(let i=0;i<12;i++){t+=.05;a.view.update(a.game,t,'');}
  const off=pixel(side,6);const active=a.view.celebration.sparks.visible&&a.view.celebration.sparks.geometry.drawRange.count>0;
  const elapsed=a.view.celebration.elapsed;a.view.update(a.game,t+.05,'PAUSED');const frozen=a.view.celebration.elapsed===elapsed;
  for(let i=0;i<70;i++){t+=.05;a.view.update(a.game,t,'');}
  winners.push({on,off,color,active,frozen,ended:!a.view.celebration.sparks.visible});
 }
 a.game.newGame();a.view.update(a.game,50,'');const reset=!a.view.celebration.sparks.visible&&a.view.celebration.winner===-1&&pixel(0,0).join()===pixel(1,0).join();
 a.renderer.setAnimationLoop(a.animate);return {partial,winners,reset,direction,hemisphere};
});
assert.deepEqual(lights.partial,[[24,140,232],[0,0,0],[238,81,101],[0,0,0]]);
for(const [i,w] of lights.winners.entries()){assert.deepEqual(w.on,i===0?[24,140,232]:[238,81,101]);assert.deepEqual(w.off,[0,0,0]);assert.equal(w.color,i===0?'188ce8':'ee5165');for(const key of ['active','frozen','ended'])assert.equal(w[key],true,key);}
assert.equal(lights.reset,true);assert.equal(lights.direction,true);assert.equal(lights.hemisphere,true);
const xr=await page.evaluate(async()=>{
const a=airhockey,T=await import('three');a.renderer.setAnimationLoop(null);
a.rig.position.set(2,.25,-3);a.rig.rotation.y=Math.PI/2;a.rig.updateMatrixWorld(true);
const left={handedness:'left',gripSpace:{id:'leftGrip'},targetRaySpace:{id:'leftRay'},gamepad:{buttons:[{pressed:false,value:0}]}},right={handedness:'right',gripSpace:{id:'rightGrip'},targetRaySpace:{id:'rightRay'},gamepad:{buttons:[{pressed:false,value:0}]}};
const xrSources={0:left,1:right,length:2,[Symbol.iterator]:function*(){yield left;yield right;}};const session={inputSources:xrSources},pose={transform:{position:{x:.2,y:1.1,z:.3},orientation:{x:0,y:0,z:0,w:1}}},frame={getPose:()=>pose};a.input.setHand('left');a.input.reset();a.input.sample(session,frame,{},true);left.gamepad.buttons[0]={pressed:true,value:1};a.input.sample(session,frame,{});const point=a.input.point.clone(),selected=a.input.active===left;left.gamepad.buttons[0]={pressed:false,value:0};a.input.sample(session,frame,{});const sticky=a.input.active===left;right.gamepad.buttons[0]={pressed:true,value:1};a.input.sample(session,frame,{});if(a.input.active!==left)throw new Error('Trigger selected hand');a.model.set('hand',true);a.input.sample(session,frame,{});const switched=a.input.active===right&&a.input.discontinuous;const loss=!a.input.sample(session,{getPose:()=>null},{});a.input.sample(session,frame,{});const recovered=a.input.discontinuous;
const savedSession=a.renderer.xr.getSession,savedReference=a.renderer.xr.getReferenceSpace;
let refreshRequests=0,renderedBeforeRequest=false;
const calibrationSession={inputSources:[],visibilityState:'visible',supportedFrameRates:[72,90,120],updateTargetFrameRate:rate=>{if(rate!==120)throw new Error('Wrong refresh request');refreshRequests++;renderedBeforeRequest=rendered;return new Promise(()=>{});}},reference={addEventListener(){},removeEventListener(){}};
a.renderer.xr.getSession=()=>calibrationSession;a.renderer.xr.getReferenceSpace=()=>reference;
let rendered=false;const savedRender=a.renderer.render;a.renderer.render=()=>{rendered=true;};
const heights=[];
for(const eyeHeight of [1.6,1.2,.6,2.8]){
 a.frameState.reset();a.animate(1000,{getViewerPose:()=>({transform:{position:{x:.3,y:eyeHeight,z:.2},orientation:{x:0,y:Math.sin(.3),z:0,w:Math.cos(.3)}}})});heights.push(a.game.height);
}
a.game.height=.913;a.animate(1010,{getViewerPose:()=>({transform:{position:{x:.3,y:1.8,z:.2},orientation:{x:0,y:0,z:0,w:1}}})});const retainedHeight=a.game.height;
a.renderer.xr.getSession=savedSession;a.renderer.xr.getReferenceSpace=savedReference;a.renderer.render=savedRender;
// Exercise the real VR slider's ray, drag and new-game hit paths with a tracked source.
a.rig.position.set(0,0,0);a.rig.quaternion.identity();const c=a.input.controllers[0];c.position.set(0,0,0);c.quaternion.identity();c.visible=true;c.userData.inputSource=left;a.panel.mesh.position.set(0,0,-1);a.panel.mesh.quaternion.identity();a.panel.mesh.visible=true;a.panel.mesh.updateMatrixWorld(true);a.panel.enabled=true;a.panel.seedTriggers=false;a.panel.previousTriggers.clear();a.panel.previousButtons.clear();left.gamepad.buttons[0]={pressed:false,value:0};a.panel.update(session);
function aim(x,y){const local=new T.Vector3((x/1024-.5)*a.panel.width,(.5-y/a.panel.canvas.height)*a.panel.mesh.geometry.parameters.height,0);a.panel.mesh.localToWorld(local);c.lookAt(local);c.rotateY(Math.PI);c.updateMatrix();c.updateMatrixWorld(true);}
aim(944,223);left.gamepad.buttons[0]={pressed:true,value:1};a.panel.update(session);const slider=a.game.skill;left.gamepad.buttons[0]={pressed:false,value:0};a.panel.update(session);aim(700,361);left.gamepad.buttons[0]={pressed:true,value:1};a.panel.update(session);const handToggle=a.input.mainHand==='left';a.panel.update(session);if(a.input.mainHand!=='left')throw new Error('Held trigger toggled twice');left.gamepad.buttons[0]={pressed:false,value:0};a.panel.update(session);aim(700,a.panel.canvas.height-90);a.game.scores[0]=4;left.gamepad.buttons[0]={pressed:true,value:1};a.panel.update(session);const reset=a.game.scores[0]===0&&!a.panel.mesh.visible;const debugHit=a.panel.pointer.cast(c,a.panel.mesh);const hitUV=debugHit?.uv.toArray();
// Exercise grabbing through the full app loop, including pause and table-local mallet projection.
a.renderer.xr.getSession=()=>session;a.renderer.xr.getReferenceSpace=()=>reference;a.renderer.render=()=>{};
session.visibilityState='visible';a.frameState.reset();a.tableGrab.reset();a.input.reset();
const grip=new T.Vector3(1.2,1.3,1.8),viewer={transform:{position:{x:0,y:1.6,z:1.65},orientation:{x:0,y:0,z:0,w:1}}};
const grabFrame={getViewerPose:()=>viewer,getPose:()=>({transform:{position:grip,orientation:{x:0,y:0,z:0,w:1}}})};
left.gamepad.buttons=[{pressed:false,value:0},{pressed:false,value:0}];right.gamepad.buttons=[{pressed:false,value:0}];
a.animate(2000,grabFrame);if(a.panel.mesh.visible)a.panel.toggle();left.gamepad.buttons[0]={pressed:true,value:1};left.gamepad.buttons[1]={pressed:true,value:1};
a.animate(2010,grabFrame);const timer=a.game.timer;grip.add(new T.Vector3(.1,.1,-.1));a.animate(2020,grabFrame);
const moved=a.tableGrab.owner===left&&Math.abs(a.game.tableX-.1)<1e-6&&Math.abs(a.game.tableZ+.1)<1e-6&&Math.abs(a.game.height-.9)<1e-6&&a.game.timer===timer&&a.view.table.position.distanceTo(new T.Vector3(.1,.9,-.1))<1e-6;
left.gamepad.buttons[1]={pressed:false,value:0};a.animate(2040,grabFrame);
const {constrain}=await import('./physics.mjs');const expected={x:grip.x-a.game.tableX,z:grip.z-a.game.tableZ};constrain(expected,1);
const released=!a.tableGrab.owner&&a.game.timer<timer&&Math.abs(a.game.player.z-expected.z)<1e-6&&Math.abs(a.game.player.x-expected.x)<1e-6;
// Full app path: a held off-hand trigger on serve entry cannot drop the puck.
a.input.setHand('left');a.game.state='goal';a.game.serve=1;a.game.timer=0;a.game.resetPuck();
const mainPose={transform:{position:{x:.3,y:1.1,z:.8},orientation:{x:0,y:0,z:0,w:1}}},offPose={transform:{position:{x:-.1,y:1.3,z:.35},orientation:{x:0,y:0,z:0,w:1}}};
const serveFrame={getViewerPose:()=>viewer,getPose:space=>space===right.gripSpace?offPose:mainPose};
left.gamepad.buttons[0]={pressed:false,value:0};right.gamepad.buttons[0]={pressed:true,value:1};
a.animate(2060,serveFrame);const noServePop=a.game.state==='placing'&&!a.view.puck.visible;a.animate(2080,serveFrame);
const preview=a.game.state==='placing'&&a.view.puck.visible&&Math.abs(a.game.physics.puck.x+.2)<1e-6&&Math.abs(a.game.physics.puck.z-.45)<1e-6;
left.gamepad.buttons[0]={pressed:true,value:1};a.animate(2100,serveFrame);const mainIgnored=a.game.state==='placing';
right.gamepad.buttons[0]={pressed:false,value:0};a.animate(2120,serveFrame);right.gamepad.buttons[0]={pressed:true,value:1};a.animate(2140,serveFrame);
const placed=a.game.state==='play'&&Math.abs(a.game.physics.puck.x+.2)<1e-6&&Math.abs(a.game.physics.puck.z-.45)<1e-6&&a.game.physics.puck.vx===0&&a.game.physics.puck.vz===0;
a.renderer.xr.getSession=savedSession;a.renderer.xr.getReferenceSpace=savedReference;a.renderer.render=savedRender;
return {noServePop,preview,mainIgnored,placed,handToggle,refreshRequests,renderedBeforeRequest,moved,released,heights,retainedHeight,point:point.toArray(),selected,sticky,switched,loss,recovered,slider,reset,hitUV,drawCalls:a.renderer.info.render.calls};
});
const botArc=await page.evaluate(()=>{const a=airhockey;a.game.state='serve';a.game.serve=-1;a.game.timer=0;a.game.step(.001);a.game.step(.4);a.view.update(a.game,80,'');a.renderer.render(a.scene,a.camera);return {timer:a.game.timer,visible:a.view.puck.visible,raised:a.view.puck.position.y>.1,matches:a.view.puck.position.x===a.game.botServe.x&&a.view.puck.position.z===a.game.botServe.z};});
assert.equal(botArc.visible,true);assert.equal(botArc.raised,true);assert.equal(botArc.matches,true);
await page.screenshot({path:'/tmp/airhockey-bot-serve.png'});
await page.click('#settings');await page.evaluate(()=>airhockey.animate(5000));assert.equal(await page.evaluate(()=>airhockey.game.timer),botArc.timer);
await page.click('#resume');await page.evaluate(()=>airhockey.animate(5020));assert.ok(await page.evaluate(()=>airhockey.game.timer)<botArc.timer);
const fpsProbe=await page.evaluate(()=>{
 const a=airhockey;a.frameState.reset();a.animate(10000);for(let i=1;i<=61;i++)a.animate(10000+i*1000/120);const fast=a.fps.value;
 a.frameState.reset();a.animate(20000);for(let i=1;i<=6;i++)a.animate(20000+i*100);const slow=a.fps.value;
 const desktop=document.querySelector('#controls').textContent.includes('10 FPS'),vr=a.panel.readout().includes('10 FPS');
 a.frameState.reset();a.animate(21000);return {fast,slow,desktop,vr,reset:a.fps.value===null};
});
assert.ok(Math.abs(fpsProbe.fast-120)<1e-5);assert.ok(Math.abs(fpsProbe.slow-10)<1e-5);assert.equal(fpsProbe.desktop,true);assert.equal(fpsProbe.vr,true);assert.equal(fpsProbe.reset,true);
await page.evaluate(()=>{const a=airhockey;a.game.tableX=a.game.tableZ=0;a.game.height=.8;a.game.scores=[7,4];a.game.state='won';a.game.message='YOU WIN!';a.view.update(a.game,100,'');for(let i=1;i<=24;i++)a.view.update(a.game,100+i*.05,'');a.renderer.render(a.scene,a.camera);});
await page.screenshot({path:'/tmp/airhockey-victory.png'});
const modal=await page.evaluate(async()=>{
 const a=airhockey,T=await import('three');a.animate(101200);for(let i=1;i<=40;i++)a.animate(101200+i*50);const early=a.resultDialog.visible;
 for(let i=41;i<=44;i++)a.animate(101200+i*50);
 const d=a.resultDialog,p=new T.Vector3();d.button.hitMesh.getWorldPosition(p);p.project(a.camera);
 return {early,visible:d.visible,title:d.titleText,x:(p.x+1)*720,y:(1-p.y)*500};
});
assert.equal(modal.early,false);assert.equal(modal.visible,true);assert.equal(modal.title,'You Won!');
await page.screenshot({path:'/tmp/airhockey-result.png'});
await page.mouse.move(modal.x,modal.y);await page.evaluate(()=>airhockey.animate(103450));assert.equal(await page.evaluate(()=>airhockey.resultDialog.button.gesture.hovered.size>0),true);
await page.mouse.down();await page.evaluate(()=>airhockey.animate(103500));assert.ok(await page.evaluate(()=>airhockey.resultDialog.button.face.position.z)<0);assert.equal(await page.evaluate(()=>airhockey.game.state),'won');
await page.mouse.move(0,0);await page.evaluate(()=>airhockey.animate(103550));assert.equal(await page.evaluate(()=>airhockey.resultDialog.button.face.position.z),0);
await page.mouse.move(modal.x,modal.y);await page.evaluate(()=>airhockey.animate(103600));await page.mouse.up();await page.evaluate(()=>airhockey.animate(103650));assert.equal(await page.evaluate(()=>airhockey.game.state),'won');
await page.mouse.down();await page.evaluate(()=>airhockey.animate(103700));await page.mouse.up();await page.evaluate(()=>airhockey.animate(103750));assert.equal(await page.evaluate(()=>airhockey.resultDialog.visible),false);assert.equal(await page.evaluate(()=>airhockey.game.state),'ready');
const vrButton=await page.evaluate(async()=>{
 const a=airhockey,T=await import('three'),d=a.resultDialog,c=a.input.controllers[0];a.rig.position.set(0,0,0);a.rig.quaternion.identity();a.rig.updateMatrixWorld(true);
 const source={gamepad:{buttons:[{pressed:true}]}};c.userData.inputSource=source;c.position.set(0,0,0);c.quaternion.identity();c.updateMatrix();c.updateMatrixWorld(true);c.visible=true;
 a.game.state='won';a.game.scores=[2,7];d.show(false,new T.Vector3(),new T.Quaternion());
 const target=new T.Vector3();d.button.hitMesh.getWorldPosition(target);
 const aim=()=>{c.lookAt(target);c.rotateY(Math.PI);c.updateMatrix();c.updateMatrixWorld(true);};aim();const sources={0:source,length:1,[Symbol.iterator]:function*(){yield source;}};const session={inputSources:sources};d.update(session,true);
 const seeded=d.button.gesture.owner===null,title=d.titleText;
 source.gamepad.buttons[0].pressed=false;d.update(session,true);source.gamepad.buttons[0].pressed=true;d.update(session,true);const depressed=d.button.face.position.z<0;
 c.quaternion.identity();c.rotation.y=Math.PI/2;c.updateMatrix();c.updateMatrixWorld(true);d.update(session,true);const cancelled=d.button.face.position.z===0;
 aim();d.update(session,true);source.gamepad.buttons[0].pressed=false;d.update(session,true);const notActivated=a.game.state==='won';
 source.gamepad.buttons[0].pressed=true;d.update(session,true);source.gamepad.buttons[0].pressed=false;d.update(session,true);
 return {seeded,title,depressed,cancelled,notActivated,restarted:a.game.state==='ready'&&!d.visible,raysHidden:d.lines.every(l=>!l.visible)};
});
assert.equal(vrButton.title,'You Lost!');for(const key of ['seeded','depressed','cancelled','notActivated','restarted','raysHidden'])assert.equal(vrButton[key],true,key);
const xrResultTransition=await page.evaluate(async()=>{
 const a=airhockey,T=await import('three'),savedGetSession=a.renderer.xr.getSession,savedGetReference=a.renderer.xr.getReferenceSpace;
 const source={handedness:'right',gripSpace:{},targetRaySpace:{},gamepad:{buttons:[{pressed:false,value:0}]}},sources={0:source,length:1,[Symbol.iterator]:function*(){yield source;}},session={inputSources:sources,visibilityState:'visible'},reference={addEventListener(){},removeEventListener(){}};
 const pose={transform:{position:{x:.2,y:1.6,z:.3},orientation:{x:0,y:Math.sin(.2),z:0,w:Math.cos(.2)}}},controllerPose={transform:{position:{x:.3,y:1.1,z:.5},orientation:{x:0,y:0,z:0,w:1}}},frame={getViewerPose:()=>pose,getPose:()=>controllerPose};
 a.renderer.xr.getSession=()=>session;a.renderer.xr.getReferenceSpace=()=>reference;a.input.setHand('right');a.input.reset();a.frameState.reset();a.tableGrab.reset();a.resultDialog.hide();a.panel.update(null);a.input.controllers[0].userData.inputSource=source;
 a.game.tableX=.4;a.game.tableZ=-.3;a.view.update(a.game,200,'');a.game.state='won';a.game.scores=[7,2];a.game.message='YOU WIN!';
 a.animate(200000,frame);for(let i=1;i<=70;i++)a.animate(200000+i*50,frame);
 const d=a.resultDialog,expected=new T.Vector3(0,.0508+.4/2,0).applyMatrix4(a.view.table.matrixWorld),actual=d.mesh.getWorldPosition(new T.Vector3()),normal=new T.Vector3(0,0,1).applyQuaternion(d.mesh.getWorldQuaternion(new T.Quaternion()));
 const tableAligned=d.mesh.parent===a.view.table&&actual.distanceTo(expected)<1e-6&&normal.distanceTo(new T.Vector3(0,0,1))<1e-6;
 pose.transform.position.x+=.3;pose.transform.orientation={x:.1,y:0,z:0,w:Math.sqrt(.99)};a.animate(203550,frame);const independentOfHead=d.mesh.getWorldPosition(new T.Vector3()).distanceTo(actual)<1e-6;
 a.game.tableX+=.2;a.game.height+=.1;a.animate(203600,frame);const movedExpected=new T.Vector3(0,.0508+.4/2,0).applyMatrix4(a.view.table.matrixWorld),followsTable=d.mesh.getWorldPosition(new T.Vector3()).distanceTo(movedExpected)<1e-6;
 const result={shown:d.visible,title:d.titleText,finite:d.mesh.position.toArray().every(Number.isFinite),tableAligned,independentOfHead,followsTable,sourcesHaveIncludes:typeof sources.includes==='function'};
 const target=d.button.hitMesh.getWorldPosition(new T.Vector3()),origin=new T.Vector3().copy(controllerPose.transform.position).applyMatrix4(a.rig.matrixWorld),worldOrientation=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(origin,target,new T.Vector3(0,1,0)));
 controllerPose.transform.orientation=a.rig.getWorldQuaternion(new T.Quaternion()).invert().multiply(worldOrientation);
 a.animate(203650,frame);source.gamepad.buttons[0]={pressed:true,value:1};a.animate(203700,frame);const depressed=d.button.face.position.z<0;
 source.gamepad.buttons[0]={pressed:false,value:0};a.animate(203750,frame);result.uprightButtonActivated=depressed&&!d.visible&&a.game.state==='ready';
 a.renderer.xr.getSession=savedGetSession;a.renderer.xr.getReferenceSpace=savedGetReference;a.resultDialog.hide();return result;
});
assert.equal(xrResultTransition.shown,true);assert.equal(xrResultTransition.title,'You Won!');assert.equal(xrResultTransition.finite,true);for(const key of ['tableAligned','independentOfHead','followsTable','uprightButtonActivated'])assert.equal(xrResultTransition[key],true,key);assert.equal(xrResultTransition.sourcesHaveIncludes,false);
assert.equal(xr.refreshRequests,4);assert.equal(xr.renderedBeforeRequest,true);
assert.deepEqual(xr.heights,[.8,.6,.3,1.4]);assert.equal(xr.retainedHeight,.913);assert.ok(Math.abs(xr.point[0]-2.3)<1e-6&&Math.abs(xr.point[1]-1.35)<1e-6&&Math.abs(xr.point[2]+3.2)<1e-6);for(const key of ['selected','sticky','switched','loss','recovered','reset','moved','released','handToggle','preview','mainIgnored','placed','noServePop'])assert.equal(xr[key],true,key);assert.equal(xr.slider,100);assert.deepEqual(errors,[]);console.log('Browser integration passed',xr);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
