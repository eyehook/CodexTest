import test from 'node:test';
import assert from 'node:assert/strict';
import {flowerHue} from '../flower-colors.mjs';
import {generatePlant} from '../generator.mjs';
import {generateVine} from '../vine-generator.mjs';
test('all generated blossom colors exclude greenish hues across ground plants and ivy',()=>{
 const forms=new Set();let blooms=0;
 for(let seed=0;seed<1200;seed++)for(const p of [generatePlant(seed),generateVine(seed,{minX:-3,maxX:3,minY:-1,maxY:2})])for(const part of p.parts.filter(p=>p.kind==='flower')){const degrees=part.hue*360;assert.ok(degrees<70||degrees>=170);assert.ok(part.hue>=0&&part.hue<1);forms.add(p.parameters.form);blooms++;}
 assert.deepEqual([...forms].sort(),['bush','flower','tree','vine']);assert.ok(blooms>1000);assert.equal(flowerHue(0),0);assert.ok(flowerHue(.99999)>.99);
});
