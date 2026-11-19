// Optional real WebGL integration: PLAYWRIGHT_MODULE and CHROME_PATH may point to host tools.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto(process.env.AIRHOCKEY_URL||'http://127.0.0.1:8080/projects/airhockey/');await page.waitForFunction(()=>window.airhockey,{},{timeout:15000});await page.waitForTimeout(500);
await page.screenshot({path:process.env.AIRHOCKEY_SCREENSHOT||'/tmp/airhockey.png'});
await page.click('#settings');const paused=await page.evaluate(()=>{airhockey.game.physics.puck.vx=1;return airhockey.game.physics.puck.x;});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>airhockey.game.physics.puck.x),paused);
await page.locator('input[aria-label="Table height"]').fill('103');await page.locator('input[aria-label="Opponent skill"]').fill('82');assert.equal(await page.evaluate(()=>airhockey.game.height),1.03);assert.equal(await page.evaluate(()=>airhockey.game.skill),82);
await page.getByRole('button',{name:'New game',exact:true}).click();assert.deepEqual(await page.evaluate(()=>airhockey.game.scores),[0,0]);assert.equal(await page.evaluate(()=>airhockey.game.skill),82);await page.click('#resume');
await page.mouse.move(930,600);await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>airhockey.game.player.x>0));
const xr=await page.evaluate(async()=>{
const a=airhockey,T=await import('three');a.renderer.setAnimationLoop(null);
a.rig.position.set(2,.25,-3);a.rig.rotation.y=Math.PI/2;a.rig.updateMatrixWorld(true);
const left={gripSpace:{id:'leftGrip'},targetRaySpace:{id:'leftRay'},gamepad:{buttons:[{pressed:false,value:0}]}},right={gripSpace:{id:'rightGrip'},targetRaySpace:{id:'rightRay'},gamepad:{buttons:[{pressed:false,value:0}]}};
const session={inputSources:[left,right]},pose={transform:{position:{x:.2,y:1.1,z:.3},orientation:{x:0,y:0,z:0,w:1}}},frame={getPose:()=>pose};a.input.reset();a.input.sample(session,frame,{},true);left.gamepad.buttons[0]={pressed:true,value:1};a.input.sample(session,frame,{});const point=a.input.point.clone(),selected=a.input.active===left;left.gamepad.buttons[0]={pressed:false,value:0};a.input.sample(session,frame,{});const sticky=a.input.active===left;right.gamepad.buttons[0]={pressed:true,value:1};a.input.sample(session,frame,{});const switched=a.input.active===right&&a.input.discontinuous;const loss=!a.input.sample(session,{getPose:()=>null},{});a.input.sample(session,frame,{});const recovered=a.input.discontinuous;
// Exercise the real VR slider's ray, drag and new-game hit paths with a tracked source.
a.rig.position.set(0,0,0);a.rig.quaternion.identity();const c=a.input.controllers[0];c.position.set(0,0,0);c.quaternion.identity();c.visible=true;c.userData.inputSource=left;a.panel.mesh.position.set(0,0,-1);a.panel.mesh.quaternion.identity();a.panel.mesh.visible=true;a.panel.mesh.updateMatrixWorld(true);a.panel.enabled=true;a.panel.seedTriggers=false;a.panel.previousTriggers.clear();a.panel.previousButtons.clear();left.gamepad.buttons[0]={pressed:false,value:0};a.panel.update(session);
function aim(x,y){const local=new T.Vector3((x/1024-.5)*a.panel.width,(.5-y/a.panel.canvas.height)*a.panel.mesh.geometry.parameters.height,0);a.panel.mesh.localToWorld(local);c.lookAt(local);c.rotateY(Math.PI);c.updateMatrix();c.updateMatrixWorld(true);}
aim(944,223);left.gamepad.buttons[0]={pressed:true,value:1};a.panel.update(session);const slider=a.game.height;left.gamepad.buttons[0]={pressed:false,value:0};a.panel.update(session);aim(700,a.panel.canvas.height-90);a.game.scores[0]=4;left.gamepad.buttons[0]={pressed:true,value:1};a.panel.update(session);const reset=a.game.scores[0]===0;const debugHit=a.panel.pointer.cast(c,a.panel.mesh);const hitUV=debugHit?.uv.toArray();
return {point:point.toArray(),selected,sticky,switched,loss,recovered,slider,reset,hitUV,drawCalls:a.renderer.info.render.calls};
});
assert.ok(Math.abs(xr.point[0]-2.3)<1e-6&&Math.abs(xr.point[1]-1.35)<1e-6&&Math.abs(xr.point[2]+3.2)<1e-6);for(const key of ['selected','sticky','switched','loss','recovered','reset'])assert.equal(xr[key],true,key);assert.equal(xr.slider,1.1);assert.deepEqual(errors,[]);console.log('Browser integration passed',xr);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
