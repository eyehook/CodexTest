import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WeatherParameters,snowParameters} from '../src/parameters.js';
import {createWeatherControls} from '../src/control-model.mjs';

test('shared UI model stays bound to external WeatherParameters edits and releases its subscription',()=>{
 const p=new WeatherParameters();p.register(snowParameters);const model=createWeatherControls(p),events=[];
 assert.equal(p.listeners.size,1);model.subscribe(id=>events.push(id));
 p.set('count',12345);assert.equal(model.value('count'),12345);assert.deepEqual(events,['count']);
 model.set('wind',0.26,{source:'desktop'});assert.ok(Math.abs(p.values.wind-0.3)<1e-9);assert.equal(events.at(-1),'wind');
 model.dispose();assert.equal(p.listeners.size,0);assert.equal(model.listeners.size,0);
});
test('shared toggles retain Weather numeric storage, formatted readouts and canonical increments',()=>{
 const p=new WeatherParameters();p.register([{id:'enabled',kind:'toggle',label:'Enabled',min:0,max:1,step:1,default:1,format:v=>v?'Enabled':'Disabled'}]);
 const model=createWeatherControls(p);model.activate('enabled',{source:'vr'});
 assert.equal(p.values.enabled,0);assert.equal(model.value('enabled'),false);assert.equal(model.format(model.definition('enabled')),'Disabled');
 p.set('enabled',1);assert.equal(model.value('enabled'),true);model.dispose();
});
