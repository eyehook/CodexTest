import * as T from '../../shared/vendor/three-r180/three.module.js';
import {XRFrameState} from '../../shared/xr/session.mjs';
import {Loom} from './audio.mjs?v=progressions1';
import {chamber} from './chamber.mjs?v=progressions1';

import {Conductor} from './conductor.mjs?v=holdpointer1';

import {songAt,sequence} from './score.mjs?v=progressions1';

import {songSkipInput} from './song-input.mjs?v=songs1';

const $ = id => document.getElementById(id);
const url = new URL(location.href);
const requestedSeed = url.searchParams.get('seed');
const seed = /^\d{1,10}$/.test(requestedSeed) && Number(requestedSeed) <= 0xffffffff
  ? Number(requestedSeed) : crypto.getRandomValues(new Uint32Array(1))[0];
// Consume explicit seeds once so refreshing always draws a fresh composition.
if (url.searchParams.has('seed')) {
  url.searchParams.delete('seed');
  history.replaceState(null, '', url);
}
$('seed').value = String(seed);
$('seed-form').addEventListener('submit', event => {
  event.preventDefault();
  url.searchParams.set('seed', String($('seed').valueAsNumber));
  location.assign(url);
});
let renderer, music, pending=false;
async function playback(toggle=false) {
  if(pending) return;
  pending=true;
  try {
    music ??= new Loom(seed);
    $('next').disabled=false;
    if(toggle && music.ctx.state==='running' && document.body.classList.contains('live'))
      await music.ctx.suspend();
    else await music.ctx.resume();
    document.body.classList.add('live');
    $('play').textContent=music.ctx.state==='running'?'Pause':'Resume';
  } catch(error) { $('status').textContent=error.message; }
  finally { pending=false; }
}
async function init(){
  renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
  renderer.setClearColor(0x050911);
  renderer.xr.enabled=true;
  renderer.xr.setReferenceSpaceType('local');
  document.body.prepend(renderer.domElement);
  const scene=new T.Scene(), camera=new T.PerspectiveCamera(58,1,.05,60);
  const paint=chamber(scene,seed), frameState=new XRFrameState();
  const skipInput=songSkipInput();
  const conductor=new Conductor(scene,renderer);
  function resize(){
    camera.aspect=innerWidth/innerHeight;
    camera.fov=camera.aspect<1?78:58;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
  }
  let displayedSong;
  const songBeats=sequence(seed).periods*32;
  resize(); window.addEventListener('resize',resize);
  renderer.setAnimationLoop((time,frame)=>{
    const session=renderer.xr.getSession();
    frameState.update(session,frame,renderer.xr.getReferenceSpace(),document.hidden);
    const beat=music?music.beat():0;
    const songNumber=Math.floor(beat/songBeats);
    if(songNumber!==displayedSong){
      displayedSong=songNumber;
      const song=songAt(seed,songNumber);
      $('song-info').textContent=`Song ${songNumber+1} · ${song.progression.label}`;
    }
    if(frameState.active)paint(beat,music?.readResponse());
    const choice=conductor.update(session,frameState,beat,paint.hue);
    if(music)music.setLeadChoice(choice,!!conductor.owner);
    if(!frameState.active)return;
    const sources=session?Array.from(session.inputSources).filter(source=>
      source.targetRaySpace && frameState.isTracked(source.targetRaySpace)):[];
    if(skipInput(sources,frameState.resumed) && music) music.nextSong();
    renderer.render(scene,camera);
  });
  $('play').disabled=false;
  $('play').onclick=()=>playback(true);
  $('next').onclick=()=>music?.nextSong();
  $('status').textContent='';
  if(await navigator.xr?.isSessionSupported('immersive-vr')){
    $('vr').hidden=false;
    $('status').textContent='In VR, trigger pauses/resumes; thumbstick right skips songs; A/X toggles conductor mode.';
    $('vr').onclick=async()=>{
      $('vr').disabled=true;
      try{
        const request=navigator.xr.requestSession('immersive-vr');
        void playback();
        const session=await request;
        session.addEventListener('select',()=>playback(true));
        await renderer.xr.setSession(session);
      }catch(error){$('status').textContent=error.message;}
      finally{$('vr').disabled=false;}
    };
  }
}
init().catch(error=>{$('status').textContent=error.message;});
window.addEventListener('pagehide',event=>{
  if(!event.persisted && music)void music.dispose();
});
