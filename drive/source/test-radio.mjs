import assert from 'node:assert/strict';
import {createMusic} from './music.mjs';
import {STATIONS} from './stations.mjs';
class Element {
 constructor(){this.attrs={};this.events={};this.hidden=true;this.dataset={};this.value=70;this.children=[];this.paused=true;this.loads=0;this.requests=[];}
 addEventListener(name,fn){(this.events[name]??=[]).push(fn)}removeEventListener(name,fn){this.events[name]=this.events[name].filter(x=>x!==fn)}
 fire(name,e={}){for(const fn of this.events[name]??[])fn(e)}
 setAttribute(k,v){this.attrs[k]=v}getAttribute(k){return this.attrs[k]??null}removeAttribute(k){delete this.attrs[k]}
 append(child){this.children.push(child)}focus(){}remove(){this.removed=true}
 set src(value){this.attrs.src=value;this.requests.push(value)}get src(){return this.attrs.src}
 load(){this.loads++}async play(){if(this.reject)throw Error('Offline');this.paused=false}pause(){this.paused=true}
}
class Param{value=0;cancelScheduledValues(){}setValueAtTime(v){this.value=v}linearRampToValueAtTime(v){this.value=v}setTargetAtTime(v){assert(Number.isFinite(v));this.value=v}}
class Node{gain=new Param();frequency=new Param();connect(){return this}disconnect(){}start(){}stop(){}}
let context,media;
globalThis.AudioContext=class{currentTime=0;destination=new Node();constructor(){context=this}createGain(){return new Node()}createOscillator(){return new Node()}createMediaElementSource(){return new Node()}async resume(){}async close(){this.closed=true}};
const ids=['radio-panel','radio-power','radio-volume','radio-presets','radio-frequency','radio-genre','radio-title','radio-tagline','radio-status','radio-close','radio-prev','radio-next'];const els=Object.fromEntries(ids.map(id=>[id,new Element()]));
globalThis.document={body:new Element(),getElementById:id=>els[id],createElement:tag=>{const e=new Element();if(tag==='audio')media=e;return e}};
const button=new Element(),powerEvents=[];let focus=0;const radio=createMusic(button,()=>focus++,{onPower:on=>powerEvents.push(on)});
const flush=async()=>{await new Promise(r=>setTimeout(r,160))};
assert.equal(STATIONS.length,6);assert.equal(media.requests.length,0,'no audio before user opts in');
button.fire('click');assert(!els['radio-panel'].hidden);els['radio-presets'].children[1].fire('click');assert.equal(media.requests.length,0,'select while off stays lazy');
els['radio-power'].fire('click');await flush();assert(radio.powered);assert(!media.paused);assert.equal(media.src,STATIONS[1].file);assert.deepEqual(powerEvents,[true]);assert(els['radio-panel'].hidden,'power-on clears the antenna shot');
for(let i=0;i<6;i++){els['radio-presets'].children[i].fire('click');await flush();assert.equal(media.src,STATIONS[i].file);assert(!media.paused);assert.equal(radio.station.id,STATIONS[i].id)}
assert.deepEqual(powerEvents,[true],'tuning does not repeat the antenna cut');
els['radio-prev'].fire('click');els['radio-next'].fire('click');els['radio-presets'].children[2].fire('click');await flush();assert.equal(media.src,STATIONS[2].file,'last rapid station selection wins');
els['radio-volume'].value=0;els['radio-volume'].fire('input');radio.setEffectsMix(true,.5);assert.equal(els['radio-volume'].attrs['aria-valuetext'],'0 percent');
radio.pause(true);assert(media.paused);radio.pause(false);await flush();assert(!media.paused);
els['radio-power'].fire('click');await new Promise(r=>setTimeout(r,240));assert(!radio.powered&&media.paused);assert.deepEqual(powerEvents,[true,false]);
media.reject=true;els['radio-power'].fire('click');await flush();assert(!radio.powered);assert(els['radio-status'].textContent.includes('SIGNAL LOST'));
const previousLoads=media.loads;media.reject=false;els['radio-power'].fire('click');await flush();assert(radio.powered&&!media.paused);assert(media.loads>previousLoads,'retry reloads the failed media file');
els['radio-next'].fire('click');radio.dispose();await flush();assert(media.paused&&media.removed&&context.closed);assert(focus>0);assert.equal(media.getAttribute('src'),null);
console.log('Radio: lazy loading, six presets, rapid retune, power/antenna events, volume, pause/resume, failure/retry and disposal passed.');
