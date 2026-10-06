import assert from 'node:assert/strict';
import {createFrequencyRoll,createTuningSweep,TUNING_MS} from './radio-tuning.mjs';
const animations=[];
class Element{style={};children=[];attrs={};append(e){this.children.push(e)}replaceChildren(){this.children=[]}setAttribute(k,v){this.attrs[k]=v}animate(frames,options){const a={frames,options,cancelled:false,cancel(){this.cancelled=true}};animations.push(a);return a}}
globalThis.document={createElement:()=>new Element()};
const reduced={matches:false,addEventListener(_,fn){this.change=fn},removeEventListener(){this.removed=true}},el=new Element(),roll=createFrequencyRoll(el,{reducedMotion:reduced});
roll.set('100.0');assert.equal(animations.length,0);roll.set('88.1');assert.equal(el.children.length,5);assert.equal(el.attrs['aria-label'],'88.1 FM');assert(animations.length>0);assert(animations.every(a=>a.options.duration+a.options.delay<=TUNING_MS));
const old=animations.slice();roll.set('108.0');assert(old.every(a=>a.cancelled),'Rapid changes cancel old reels');
const before=animations.length;roll.set('108.0');assert.equal(animations.length,before,'Unrelated renders do not restart digits');
reduced.matches=true;reduced.change();assert(animations.every(a=>a.cancelled));roll.set('99.1');assert.equal(animations.length,before,'Reduced motion uses static digits');roll.dispose();assert(reduced.removed);
const nodes=[];class Param{value=0;setValueAtTime(v){this.value=v}linearRampToValueAtTime(v){this.value=v}exponentialRampToValueAtTime(v){assert(v>0)}}
class Node{gain=new Param();frequency=new Param();Q=new Param();constructor(){nodes.push(this)}connect(){return this}disconnect(){this.disconnected=true}start(){this.started=true}stop(){this.stops=(this.stops||0)+1}}
const ctx={currentTime:0,sampleRate:48000,destination:{},createBuffer:(c,n)=>({getChannelData:()=>new Float32Array(n)}),createBufferSource:()=>new Node(),createBiquadFilter:()=>new Node(),createWaveShaper:()=>new Node(),createGain:()=>new Node(),createOscillator:()=>new Node()};
const sweep=createTuningSweep(ctx);sweep.start(0);assert.equal(nodes.length,0,'Muted tuning creates no sound nodes');sweep.start(.7,1);const first=nodes.slice();assert.equal(first.filter(n=>n.started).length,2);sweep.start(.7,-1);assert(first.every(n=>n.disconnected),'Retuning disconnects the preceding voice');sweep.stop();assert(nodes.every(n=>n.disconnected),'Pause/disposal can release the complete audio graph');sweep.stop();
console.log('Frequency reels: timing, replacement, reduced motion; tuning audio: mute, rapid retune and cleanup passed.');
