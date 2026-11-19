import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../../shared/vendor/three-r180/three.module.js';
import {C} from '../physics.mjs';
import {Game,BOT_SERVE_DURATION} from '../game.mjs';
import {ServeInput} from '../serve-input.mjs';
function playerServe(){const g=new Game();g.state='goal';g.serve=1;g.timer=.01;g.resetPuck();g.step(.02);return g;}
test('player waits for placement after conceding; bot places its puck at rest automatically',()=>{
 const g=playerServe();assert.equal(g.state,'placing');for(let i=0;i<1000;i++)g.step(C.step);assert.equal(g.state,'placing');assert.equal(g.physics.puck.vz,0);
 assert.ok(g.previewServe(.2,.5));assert.ok(g.placeServe());assert.equal(g.state,'play');assert.equal(g.physics.puck.vz,0);assert.equal(g.physics.puck.x,.2);assert.equal(g.placeServe(),false);
 g.random=()=>.75;g.newGame();assert.equal(g.serve,-1);g.step(1.1);assert.equal(g.state,'botplacing');g.step(BOT_SERVE_DURATION);assert.equal(g.state,'play');assert.equal(g.physics.puck.vz,0);assert.ok(g.physics.puck.z<0);
 g.state='goal';g.serve=-1;g.timer=0;g.step(C.step);assert.equal(g.state,'botplacing');g.step(BOT_SERVE_DURATION);assert.equal(g.state,'play');assert.equal(g.physics.puck.vz,0);assert.ok(g.physics.puck.z<0);
});
test('serve preview clamps the full puck to own half and rounded board, avoiding the mallet',()=>{
 const g=playerServe();
 for(const [x,z] of [[9,9],[-9,9],[0,-9],[0,9],[0,.88],[.55,1.15]]){
  g.previewServe(x,z);const p=g.physics.puck;assert.ok(Math.abs(p.x)<=C.width/2-C.puck+1e-9);assert.ok(p.z>=C.puck&&p.z<=C.length/2-C.puck+1e-9);
  const dx=Math.abs(p.x)-(C.width/2-C.corner),dz=p.z-(C.length/2-C.corner);if(dx>0&&dz>0)assert.ok(Math.hypot(dx,dz)<=C.corner-C.puck+1e-9);
  assert.ok(Math.hypot(p.x-g.player.x,p.z-g.player.z)>=C.puck+C.mallet);assert.equal(p.vx,0);assert.equal(p.vz,0);
 }
 const before={...g.physics.puck};assert.equal(g.previewServe(NaN,1),false);assert.deepEqual(g.physics.puck,before);
});
test('off-hand composes rig and table offset once; entry/resume/recovery require fresh off-hand trigger',()=>{
 const g=playerServe(),rig=new T.Group();rig.position.set(2,.3,-3);rig.rotation.y=Math.PI/2;rig.updateMatrixWorld(true);g.tableX=2;g.tableZ=-3;
 const left={handedness:'left',gripSpace:{},gamepad:{buttons:[{pressed:true}]}},right={handedness:'right',gripSpace:{},gamepad:{buttons:[{pressed:true}]}};
 const session={inputSources:[left,right]},world=new T.Vector3(2.2,1,-2.5);let lost=false;
 const frame={getPose:()=>lost?null:{transform:{position:world.clone().applyMatrix4(rig.matrixWorld.clone().invert())}}},input=new ServeInput(rig,g),sample=enabled=>input.update(session,frame,{},'right',enabled);
 assert.equal(sample(true),false);assert.ok(Math.abs(g.physics.puck.x-.2)<1e-9);assert.ok(Math.abs(g.physics.puck.z-.5)<1e-9);
 left.gamepad.buttons[0].pressed=false;sample(true);right.gamepad.buttons[0].pressed=false;sample(true);right.gamepad.buttons[0].pressed=true;assert.equal(sample(true),false);
 sample(false);left.gamepad.buttons[0].pressed=true;assert.equal(sample(true),false);
 lost=true;sample(true);lost=false;assert.equal(sample(true),false);
 left.gamepad.buttons[0].pressed=false;sample(true);left.gamepad.buttons[0].pressed=true;assert.equal(sample(true),true);assert.equal(g.state,'play');assert.equal(g.physics.puck.vx,0);
});
test('Main Hand swap changes placement hand and absorbs a trigger already held on the new off-hand',()=>{
 const g=playerServe(),rig=new T.Group(),input=new ServeInput(rig,g),left={handedness:'left',gripSpace:{},gamepad:{buttons:[{pressed:false}]}},right={handedness:'right',gripSpace:{},gamepad:{buttons:[{pressed:true}]}};
 const session={inputSources:[left,right]},frame={getPose:()=>({transform:{position:{x:.1,y:1,z:.4}}})};
 input.update(session,frame,{},'right',true);assert.equal(input.update(session,frame,{},'left',true),false);
 right.gamepad.buttons[0].pressed=false;input.update(session,frame,{},'left',true);right.gamepad.buttons[0].pressed=true;assert.equal(input.update(session,frame,{},'left',true),true);
});

test('each new match randomly awards first serve to player or bot and follows their placement flow',()=>{
 const g=new Game(()=>{},()=>.1);assert.equal(g.serve,1);g.step(1.1);assert.equal(g.state,'placing');assert.equal(g.physics.puck.vz,0);
 g.random=()=>.9;g.newGame();assert.equal(g.serve,-1);g.step(1.1);assert.equal(g.state,'botplacing');g.step(BOT_SERVE_DURATION);assert.equal(g.state,'play');assert.ok(g.physics.puck.z<0);assert.equal(g.physics.puck.vz,0);
 g.random=()=>.1;g.newGame();assert.equal(g.serve,1);g.step(1.1);assert.equal(g.state,'placing');
});
test('bot serve placements vary, stay inside its half and clear its mallet, even with constant random values',()=>{
 let seed=987;const rng=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32),g=new Game(()=>{},rng),positions=new Set();
 for(let i=0;i<100;i++){
  g.state='serve';g.serve=-1;g.timer=0;g.enemy.x=Math.sin(i)*.4;g.enemy.z=-.25-(i%7)*.1;g.step(C.step);g.step(BOT_SERVE_DURATION);
  const p=g.physics.puck;assert.equal(g.state,'play');assert.ok(p.z<=-C.puck&&p.z>=-C.length/2+C.puck);assert.ok(Math.abs(p.x)<=C.width/2-C.puck);
  assert.ok(Math.hypot(p.x-g.enemy.x,p.z-g.enemy.z)>=C.puck+C.mallet);assert.equal(p.vx,0);assert.equal(p.vz,0);positions.add(`${p.x.toFixed(3)},${p.z.toFixed(3)}`);
 }
 assert.ok(positions.size>90);
 g.random=()=>.5;g.enemy.x=0;g.enemy.z=-.55;g.placeBotServe();assert.ok(Math.hypot(g.physics.puck.x-g.enemy.x,g.physics.puck.z-g.enemy.z)>=C.puck+C.mallet);
});

test('bot serve travels from behind/below its goal to the chosen resting spot before physics starts',()=>{
 const g=new Game(()=>{},()=>.75);g.step(1.1);assert.equal(g.state,'botplacing');assert.deepEqual(g.botServe,{x:0,y:-.18,z:-1.52});
 const target={...g.physics.puck},enemy={...g.enemy};let maxHeight=-Infinity,previousZ=g.botServe.z;
 for(let i=0;i<132;i++){
  g.step(BOT_SERVE_DURATION/132);const q=g.botServe;maxHeight=Math.max(maxHeight,q.y);assert.ok(q.z>=previousZ-1e-9);previousZ=q.z;
  assert.deepEqual(g.physics.puck,target);assert.deepEqual(g.enemy,enemy);assert.equal(g.stall,0);
  if(q.z>-1.4&&q.z< -1.2)assert.ok(q.y>.075,'clears goal and end rail');
 }
 g.step(1e-8);assert.equal(g.state,'play');assert.ok(maxHeight>.3);assert.ok(Math.abs(g.botServe.x-target.x)<1e-9);assert.ok(Math.abs(g.botServe.z-target.z)<1e-9);assert.ok(Math.abs(g.botServe.y-.008)<1e-9);assert.equal(g.physics.puck.vz,0);
 g.newGame();assert.equal(g.state,'ready');
});

test('player serve stays unready until a valid preview, and every reset clears the previous preview',()=>{
 const g=playerServe();assert.equal(g.servePreviewReady,false);assert.equal(g.placeServe(),false);
 assert.equal(g.previewServe(NaN,.5),false);assert.equal(g.servePreviewReady,false);
 g.previewServe(.2,.4);assert.equal(g.servePreviewReady,true);g.newGame();assert.equal(g.servePreviewReady,false);
 g.state='placing';assert.equal(g.placeServe(),false);g.previewServe(-.2,.5);g.resetPuck();assert.equal(g.servePreviewReady,false);
});

test('a freshly placed player serve can wait indefinitely, then a mallet strike restores normal stall rules',()=>{
 const g=playerServe();g.previewServe(.2,.5);g.placeServe();
 for(let i=0;i<240*60;i++)g.step(C.step);
 assert.equal(g.state,'play');assert.equal(g.physics.puck.x,.2);assert.equal(g.physics.puck.z,.5);assert.equal(g.possession,0);assert.equal(g.stall,0);
 g.setTarget(.2,.65,true);g.setTarget(.2,.46);g.step(.04);assert.ok(g.physics.puck.vz<0);assert.equal(g.waitingForServeHit,false);
 g.setTarget(0,.95,true);Object.assign(g.physics.puck,{x:.3,z:.4,vx:0,vz:0});
 for(let i=0;i<240*3+2;i++)g.step(C.step);assert.equal(g.state,'serve');assert.equal(g.serve,-1);
});
test('bot touchdown is also exempt; a gentle first movement below the stall threshold removes the exemption',()=>{
 const g=new Game(()=>{},()=>.75);g.step(1.1);g.step(BOT_SERVE_DURATION);g.ai.update=()=>{};
 for(let i=0;i<240*30;i++)g.step(C.step);
 assert.equal(g.state,'play');assert.equal(g.possession,0);assert.equal(g.stall,0);assert.equal(g.waitingForServeHit,true);
 g.physics.puck.vx=.01;g.step(C.step);assert.equal(g.waitingForServeHit,false);
 for(let i=0;i<240*3+2;i++)g.step(C.step);assert.equal(g.state,'serve');assert.equal(g.serve,1);
 g.newGame();assert.equal(g.waitingForServeHit,false);
});
