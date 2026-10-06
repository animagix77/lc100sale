import assert from 'node:assert/strict';
import {drivingMix,createSound} from './sound.mjs';
const tyre={contact:true,omega:6,slip:0,soft:.7};
const dry=drivingMix({speed:3,tyres:[tyre],input:{gas:true},shoreDistance:35});
assert(dry.sand<.05,'Rolling sand remains quiet under the engine');
const wet=drivingMix({speed:3,tyres:[tyre],input:{gas:true},shoreDistance:2});
assert(dry.sand>0&&dry.splash===0);assert(wet.sand===0&&wet.splash>0&&wet.surf>dry.surf);
const spin=drivingMix({tyres:[{...tyre,omega:12,slip:4}],input:{gas:true}});
assert(spin.rpm>dry.rpm&&spin.sand>0,'Wheelspin at rest must drive engine and tire sound');
assert(drivingMix({speed:2,tyres:[tyre],range:'LO'}).rpm>drivingMix({speed:2,tyres:[tyre],range:'HI'}).rpm);
assert.equal(drivingMix({speed:4,tyres:[{...tyre,contact:false}]}).sand,0);
for(const threshold of [2.6,5]){const before=drivingMix({speed:threshold-.01,tyres:[tyre]}),after=drivingMix({speed:threshold+.01,tyres:[tyre]});assert(Math.abs(after.rpm-before.rpm)<10,'No pitch hunting around old gear thresholds')}
assert.equal(drivingMix({speed:-3,tyres:[tyre]}).sand,drivingMix({speed:3,tyres:[tyre]}).sand);
class Param{value=0;setTargetAtTime(v){assert(Number.isFinite(v));this.value=v}}
class Node{gain=new Param();frequency=new Param();Q=new Param();playbackRate=new Param();pan=new Param();threshold=new Param();knee=new Param();ratio=new Param();attack=new Param();release=new Param();connect(){return this}disconnect(){}start(){this.started=true}stop(){this.stopped=true}}
let context,requests=0;
globalThis.AudioContext=class{currentTime=0;destination=new Node();nodes=[];constructor(){context=this}node(){const n=new Node();this.nodes.push(n);return n}createGain(){return this.node()}createDynamicsCompressor(){return this.node()}createBiquadFilter(){return this.node()}createOscillator(){return this.node()}createBufferSource(){return this.node()}createStereoPanner(){return this.node()}async resume(){}async decodeAudioData(){return {duration:5}}async close(){this.closed=true}};
globalThis.fetch=async()=>{requests++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}};
const button={textContent:'',attrs:{},setAttribute(k,v){this.attrs[k]=v},addEventListener(_,f){this.click=f}};
let mix;const sound=createSound(button,()=>{},(...v)=>mix=v);
assert.equal(requests,0,'No unsolicited audio download');await button.click();assert.equal(requests,8);assert.equal(button.textContent,'Sound on');
sound.update({speed:3,tyres:[tyre],input:{gas:true}});assert.equal(mix[0],true);
sound.pause(true);assert.equal(context.nodes[0].gain.value,0);assert.deepEqual(mix,[false,0]);
sound.pause(false);assert.equal(context.nodes[0].gain.value,.72);
context.currentTime=10;sound.update({speed:3,tyres:[tyre],shoreDistance:2,input:{gas:true}});
assert(context.nodes.filter(n=>n.started).length>=7,'Gull and splash one-shots play');
await button.click();assert.equal(context.nodes[0].gain.value,0);assert.equal(button.attrs['aria-pressed'],'false');
await button.click();assert.equal(requests,8,'Re-enable reuses decoded audio');sound.dispose();assert(context.closed);assert(context.nodes.filter(n=>n.started).every(n=>n.stopped));
console.log('Audio tests passed: surface mix, reverse, wheelspin, range, lazy loading, mute, pause, resume, one-shots and disposal.');
