import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createDriveIntro} from './drive-intro.mjs';
class Element{events={};attributes={};dataset={};style={setProperty:(k,v)=>this.attributes[k]=v};setAttribute(k,v){this.attributes[k]=v}removeAttribute(k){delete this.attributes[k]}addEventListener(t,f){this.events[t]=f}removeEventListener(t){delete this.events[t]}fire(t,e={}){this.events[t]?.(e)}showModal(){this.open=true}close(){this.open=false}}
function fixture(savedCheckpoint=null){
 const quip={mounted:true,remove(){this.mounted=false}};
 const dialog=new Element(),start=new Element(),exit=new Element(),fresh=new Element(),saved=new Element(),status={before(el){this.quip=el}},label={},meter=new Element();
 dialog.ownerDocument={querySelector:selector=>selector==='lc-loading-quip'?quip:null};
 start.querySelector=()=>label;const elements={'[data-intro-exit]':exit,'[data-intro-progress]':meter,'[data-intro-new]':fresh,'[data-intro-saved]':saved,'[data-intro-status]':status};dialog.querySelector=s=>elements[s];
 let starts=0,continues=0,exits=0;const intro=createDriveIntro(dialog,start,{savedCheckpoint,onStart:()=>starts++,onContinue:()=>continues++,onExit:()=>exits++});
 return {dialog,start,exit,fresh,saved,status,label,meter,intro,quip,counts:()=>({starts,continues,exits})};
}
const f=fixture(),{dialog,start,exit,fresh,saved,label,meter,intro}=f;
assert(dialog.open&&start.disabled);start.fire('click');assert.equal(f.counts().starts,0,'Cannot drive before assets are ready');let prevented=false;dialog.fire('cancel',{preventDefault(){prevented=true}});assert(prevented&&dialog.open,'Escape cannot start gameplay behind the briefing');
intro.progress(45,'Loading truck');assert.equal(meter.attributes['aria-valuenow'],'45');assert.equal(start.attributes['--load-progress'],'45%');assert(label.textContent.includes('45%'));intro.progress(12);assert.equal(meter.attributes['aria-valuenow'],'45');intro.progress(100);assert(start.disabled);assert.equal(meter.attributes['aria-valuenow'],'95');intro.busy('Drawing the first frame…','Getting ready');assert(start.disabled);assert.equal(meter.attributes['aria-valuenow'],undefined);assert.equal(start.dataset.loading,'busy');assert.equal(label.textContent,'Drawing the first frame…');intro.ready();assert.equal(start.dataset.loading,'ready');assert.equal(meter.attributes['aria-valuenow'],'100');intro.progress(20);assert.equal(meter.attributes['aria-valuenow'],'100');assert(!start.disabled);assert.equal(label.textContent,'Start new');assert(fresh.hidden&&saved.hidden,'New visitors do not get an empty Continue action');start.fire('click');start.fire('click');assert.equal(f.counts().starts,1);assert(!dialog.open);exit.fire('click');assert.equal(f.counts().exits,1);intro.dispose();assert.equal(Object.keys(start.events).length,0);
for(const action of ['continue','new']){
 const f=fixture('Snow line');assert(!f.fresh.hidden&&!f.saved.hidden);assert(f.saved.textContent.includes('Snow line'));f.start.fire('click');f.fresh.fire('click');assert.deepEqual(f.counts(),{starts:0,continues:0,exits:0},'Both choices stay gated while loading');f.intro.ready();assert.equal(f.label.textContent,'Continue');assert(!f.fresh.disabled);assert(f.status.textContent.includes('replaces your saved expedition'));(action==='continue'?f.start:f.fresh).fire('click');f.start.fire('click');f.fresh.fire('click');assert.deepEqual(f.counts(),action==='continue'?{starts:0,continues:1,exits:0}:{starts:1,continues:0,exits:0},'Choices are mutually exclusive and run once');assert(!f.dialog.open);f.intro.dispose();assert.equal(Object.keys(f.fresh.events).length,0);
}
const failed=fixture('Sunset camp');failed.intro.fail();failed.intro.ready();failed.start.fire('click');failed.fresh.fire('click');assert(failed.start.disabled&&failed.fresh.disabled);assert.deepEqual(failed.counts(),{starts:0,continues:0,exits:0});failed.intro.dispose();
console.log('Briefing: new/continue choices, checkpoint copy, shared load/failure gate, one-shot launch, Escape containment and cleanup passed.');

for(const finish of ['ready','fail','dispose','leave']){
 const f=fixture();
 assert.equal(f.status.quip,f.quip);
 f.intro.progress(40,'Loading the truck');
 assert(f.quip.mounted);
 if(finish==='leave')f.exit.fire('click');else f.intro[finish]();
 assert(!f.quip.mounted,finish+' clears the loading line');
 f.intro.dispose();
}
// The tiny preloader also runs before the game bundle is available.
const script=readFileSync('../loading-quips.js','utf8');
let Quip,tick,stopped=false,animations=0;
const doc={hidden:false};
runInNewContext(script,{
 URLSearchParams,location:{search:''},document:doc,HTMLElement:class{},
 customElements:{define:(_,type)=>{Quip=type}},matchMedia:()=>({matches:false}),queueMicrotask,
 setInterval(fn,ms){assert(ms>=5500);assert(!tick);tick=fn;return 1},
 clearInterval(){stopped=true;tick=null}
});
const q=new Quip();q.isConnected=true;q.animate=()=>animations++;q.connectedCallback();
const deckSize=q.remaining.length+1,first=q.textContent,seen=new Set([first]);
assert(deckSize>=12);
doc.hidden=true;tick();assert.equal(q.textContent,first);doc.hidden=false;
q.disconnectedCallback();q.connectedCallback();await Promise.resolve();
assert.equal(q.textContent,first);assert(!stopped,'Moving into the briefing preserves the timer');
for(let i=1;i<deckSize;i++){tick();seen.add(q.textContent)}
assert.equal(seen.size,deckSize);
const last=q.textContent;tick();assert.notEqual(q.textContent,last);
q.isConnected=false;q.disconnectedCallback();await Promise.resolve();
assert(stopped);assert.equal(animations,0,'Reduced motion disables the fade');
console.log('Loading quotes: shuffle, readable timing, hidden tab, briefing handoff, reduced motion and cleanup passed.');
