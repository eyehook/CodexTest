import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ButtonEdges, buttonValue} from '../../shared/xr/input.mjs';
const source = () => ({gamepad: {buttons: [{pressed: false, value: 0}]}});
test('button edges are per source and survive holds without repeating', () => {
  const edges = new ButtonEdges(), left = source(), right = source();
  assert.equal(edges.sample(left, 0).pressed, false);
  left.gamepad.buttons[0] = {pressed: true, value: 0.8};
  assert.equal(edges.sample(left, 0).pressed, true);
  assert.equal(edges.sample(left, 0).pressed, false);
  assert.equal(edges.sample(right, 0).down, false);
  left.gamepad.buttons[0].pressed = false;
  assert.equal(edges.sample(left, 0).released, true);
  assert.equal(edges.sample(left, 0).released, false);
});
test('seeding held entry buttons prevents phantom clicks; disconnect state is pruned', () => {
  const edges = new ButtonEdges(), left = source(), right = source();
  left.gamepad.buttons[0].pressed = true;
  assert.equal(edges.sample(left, 0, true).pressed, false);
  assert.equal(edges.sample(left, 0).pressed, false);
  edges.sample(right, 0); edges.retain([right]);
  assert.equal(edges.sources.has(left), false);
  edges.reset(right); assert.equal(edges.sources.size, 0);
  edges.sample(left, 0); edges.reset(); assert.equal(edges.sources.size, 0);
});
test('trigger values retain analog pressure and handle missing/invalid buttons', () => {
  const s = source(); s.gamepad.buttons[0] = {value: 0.3, pressed: false};
  assert.equal(buttonValue(s), 0.3);
  for (const [value, expected] of [[2,1],[-1,0],[NaN,0],[Infinity,0]]) {
    s.gamepad.buttons[0].value=value; assert.equal(buttonValue(s), expected);
  }
  assert.equal(buttonValue({gamepad: {}}),0);
  assert.equal(buttonValue(null),0);
  assert.equal(buttonValue({gamepad:{buttons:[{pressed:true}]}}),1);
});
