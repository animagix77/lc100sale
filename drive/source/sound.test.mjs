import assert from 'node:assert/strict';
import {drivingMix,createSound,engineVoice} from './sound.mjs';
const tyre={contact:true,omega:6,slip:0,soft:.7};
const dry=drivingMix({speed:3,tyres:[tyre],input:{gas:true},shoreDistance:35});
assert(dry.sand<.05,'Rolling sand remains quiet under the engine');
const wet=drivingMix({speed:3,tyres:[tyre],input:{gas:true},shoreDistance:2});
const slowSplash=drivingMix({speed:1,tyres:[tyre],waterContact:1}),fastSplash=drivingMix({speed:10,tyres:[tyre],waterContact:1});
assert(fastSplash.splash>slowSplash.splash&&fastSplash.splashInterval<slowSplash.splashInterval,'Water sound grows louder and more frequent with speed');
assert.equal(drivingMix({speed:10,tyres:[tyre],shoreDistance:0,waterContact:0}).splash,0,'No water contact means no splash, even near shore');
assert.equal(drivingMix({speed:0,tyres:[tyre],waterContact:1}).splash,0,'Parked wheels make no splash');
assert(dry.sand>0&&dry.splash===0);assert(wet.sand===0&&wet.splash>0&&wet.surf>dry.surf);
const spin=drivingMix({tyres:[{...tyre,omega:12,slip:4}],input:{gas:true}});
assert(spin.rpm>dry.rpm&&spin.sand>0,'Wheelspin at rest must drive engine and tire sound');
assert(drivingMix({speed:2,tyres:[tyre],range:'LO'}).rpm>drivingMix({speed:2,tyres:[tyre],range:'HI'}).rpm);
assert.equal(drivingMix({speed:4,tyres:[{...tyre,contact:false}]}).sand,0);
for(const threshold of [2.6,5]){const before=drivingMix({speed:threshold-.01,tyres:[tyre]}),after=drivingMix({speed:threshold+.01,tyres:[tyre]});assert(Math.abs(after.rpm-before.rpm)<10,'No pitch hunting around old gear thresholds')}
assert.equal(drivingMix({speed:-3,tyres:[tyre]}).sand,drivingMix({speed:3,tyres:[tyre]}).sand);
class Param{value=0;setValueAtTime(v){this.value=v}linearRampToValueAtTime(v){this.value=v}setTargetAtTime(v){assert(Number.isFinite(v));this.value=v}}
class Node{gain=new Param();frequency=new Param();Q=new Param();playbackRate=new Param();pan=new Param();threshold=new Param();knee=new Param();ratio=new Param();attack=new Param();release=new Param();connect(){return this}disconnect(){}start(){this.started=true}stop(){this.stopped=true}}
let context,requests=0;const urls=[];
globalThis.AudioContext=class{currentTime=0;destination=new Node();nodes=[];constructor(){context=this}node(){const n=new Node();this.nodes.push(n);return n}createGain(){return this.node()}createDynamicsCompressor(){return this.node()}createBiquadFilter(){return this.node()}createOscillator(){return this.node()}createBufferSource(){return this.node()}createStereoPanner(){return this.node()}async resume(){}async decodeAudioData(){return {duration:5}}async close(){this.closed=true}};
globalThis.fetch=async(url)=>{requests++;urls.push(url);return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}};
class Events{
 handlers=new Map();
 addEventListener(type,fn){this.handlers.set(type,fn)}
 removeEventListener(type,fn){if(this.handlers.get(type)===fn)this.handlers.delete(type)}
 async emit(type,event={}){await this.handlers.get(type)?.({target:{},...event})}
}
function controls(){const gestures=new Events(),button=Object.assign(new Events(),{textContent:'',attrs:{},setAttribute(k,v){this.attrs[k]=v},contains(target){return target===this},click(){return this.emit('click')},ownerDocument:gestures});return {button,gestures}}
const {button,gestures}=controls();
let mix;const sound=createSound(button,()=>{},(...v)=>mix=v);
assert.equal(button.textContent,'Sound on');assert.equal(button.attrs['aria-pressed'],'true');
assert.equal(requests,0,'No audio download until an interaction');
await gestures.emit('keydown',{ctrlKey:true});assert.equal(requests,0,'Browser shortcuts do not unlock audio');
await Promise.all([gestures.emit('pointerdown'),gestures.emit('keydown')]);assert.equal(requests,6);assert.equal(button.textContent,'Sound on');assert(urls.every(url=>!url.includes('v8-')),'Puttering engine recordings are not loaded');
const oscillators=context.nodes.filter(n=>n.type==='sine');assert.equal(oscillators.length,4,'Four continuous harmonic voices replace exhaust pulses');
sound.update({speed:3,tyres:[tyre],input:{gas:true}});assert.equal(mix[0],true);const voice=engineVoice(dry);assert(voice.gains.every(g=>g>0&&g<.2));for(let i=1;i<4;i++)assert(Math.abs(oscillators[i].frequency.value/oscillators[0].frequency.value-(i+1))<1e-9,'Exact harmonics avoid beating');
const stable=oscillators.map(n=>n.frequency.value);sound.update({speed:3,tyres:[tyre],input:{gas:true}});assert.deepEqual(oscillators.map(n=>n.frequency.value),stable,'Steady throttle does not modulate the drone');
sound.pause(true);assert.equal(context.nodes[0].gain.value,0);assert.deepEqual(mix,[false,0]);
sound.pause(false);assert.equal(context.nodes[0].gain.value,.72);
context.currentTime=10;sound.update({speed:3,tyres:[tyre],shoreDistance:2,input:{gas:true}});
assert(context.nodes.filter(n=>n.started).length>=7,'Gull and splash one-shots play');
await button.click();assert.equal(context.nodes[0].gain.value,0);assert.equal(button.attrs['aria-pressed'],'false');
await gestures.emit('keydown');assert.equal(context.nodes[0].gain.value,0,'Driving never overrides mute');
await button.click();assert.equal(requests,6,'Re-enable reuses decoded audio');sound.dispose();assert.equal(gestures.handlers.size,0);assert.equal(button.handlers.size,0);assert(context.closed);assert(context.nodes.filter(n=>n.started).every(n=>n.stopped));
// Muting before the first drive gesture must neither fetch nor create a context.
const early=controls(),earlySound=createSound(early.button,()=>{});const before=requests;
await early.gestures.emit('pointerdown',{target:early.button});await early.button.click();
await early.gestures.emit('keydown');assert.equal(requests,before);assert.equal(early.button.textContent,'Sound off');
earlySound.dispose();
// Pause blocks the initial unlock until a later active-game gesture.
const paused=controls(),pausedSound=createSound(paused.button,()=>{});pausedSound.pause(true);
await paused.gestures.emit('pointerdown');assert.equal(requests,before);
pausedSound.pause(false);await paused.gestures.emit('click');assert.equal(requests,before+6);pausedSound.dispose();
// An in-flight load must not undo a mute, and remains a single setup.
const pending=controls(),pendingSound=createSound(pending.button,()=>{});
const ready=pending.gestures.emit('pointerdown');await pending.button.click();await ready;
assert.equal(pending.button.textContent,'Sound off');assert.equal(context.nodes[0].gain.value,0);pendingSound.dispose();
// A failed unlock exposes a retry without repeated fetches on every keypress.
const realFetch=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('offline')};
const retry=controls(),retrySound=createSound(retry.button,()=>{});await retry.gestures.emit('keydown');
assert.equal(retry.button.textContent,'Retry sound');globalThis.fetch=realFetch;
await retry.gestures.emit('keydown');assert.equal(retry.button.textContent,'Retry sound');
await retry.button.click();assert.equal(retry.button.textContent,'Sound on');retrySound.dispose();
console.log('Audio tests passed: default-on gesture unlock, concurrent activation, early/pending mute, pause, retry, cleanup, engine and coastal mix.');
