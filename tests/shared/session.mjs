import {test} from 'node:test';
import assert from 'node:assert/strict';
import {XRFrameState} from '../../shared/xr/session.mjs';
test('first tracked frame occurs once per session, with resume distinct from entry', () => {
  const state = new XRFrameState(), session = {visibilityState:'visible'}, ref = {};
  let pose = null;
  const frame = {getViewerPose: space => {assert.equal(space,ref); return pose;},getPose:()=>({})};
  state.update(session,frame,ref); assert.equal(state.active,false); assert.equal(state.changed,true);
  pose = {transform:{}}; state.update(session,frame,ref);
  assert.equal(state.firstTracked,true); assert.equal(state.resumed,true);
  state.update(session,frame,ref); assert.equal(state.firstTracked,false); assert.equal(state.resumed,false);
  assert.equal(state.isTracked({}),true);
  pose=null; state.update(session,frame,ref); assert.equal(state.active,false); assert.equal(state.isTracked({}),false);
  pose={}; state.update(session,frame,ref); assert.equal(state.firstTracked,false); assert.equal(state.resumed,true);
  state.update(null,null,null); assert.equal(state.active,true); assert.equal(state.pose,null);
  state.update(session,frame,ref); assert.equal(state.firstTracked,true);
});
test('hidden/unfocused/missing frames and missing reference spaces never read stale poses', () => {
  const state=new XRFrameState(), session={visibilityState:'visible'}, ref={};
  const forbidden={getViewerPose(){throw Error('must not query inactive tracking')}};
  state.update(session,forbidden,ref,true); assert.equal(state.active,false);
  session.visibilityState='visible-blurred'; state.update(session,forbidden,ref); assert.equal(state.active,false);
  session.visibilityState='visible'; state.update(session,null,ref); assert.equal(state.active,false);
  state.update(session,forbidden,null); assert.equal(state.active,false);
  state.update(null,null,null,true); assert.equal(state.active,false);
  state.reset(); assert.equal(state.session,null); assert.equal(state.hasTracked,false);
});
