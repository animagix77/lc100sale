// Judge Dean LLC — in-drive restart must never happen through dismissal.
import assert from 'node:assert/strict';
import {createPauseMenu} from './pause-menu.mjs';
import {createKeyboardControls} from './keyboard.mjs';

class Element{
 constructor(){this.listeners={};this.attrs={};this.dataset={};this.hidden=false;this.open=false;this.focuses=0;this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
 setAttribute(name,value){this.attrs[name]=value;}
 focus(){this.focuses++;}
 showModal(){this.open=true;}
 close(){this.open=false;}
 getBoundingClientRect(){return {left:100,right:500,top:100,bottom:500};}
 fire(name,details={}){
  const event={target:this,defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...details};
  for(let node=this;node;node=node.parent){for(const fn of node.listeners[name]||[])fn(event);if(event.stopped)break;}
  return event;
 }
}
function fixture({coarse=false}={}){
 const media=new Element();media.matches=coarse;globalThis.matchMedia=()=>media;
 const window=new Element(),dialog=new Element();dialog.parent=window;
 const overview=[new Element(),new Element(),new Element()],confirmation=new Element(),restart=new Element(),keep=new Element(),confirm=new Element(),resume=new Element(),content=new Element();
 const modes=['keyboard','touch'].map(value=>{const e=new Element();e.dataset.controlsMode=value;return e;});
 const panels=['keyboard','touch'].map(value=>{const e=new Element();e.dataset.controlsPanel=value;return e;});
 for(const e of [confirmation,restart,keep,confirm,resume,content,...modes,...panels])e.parent=dialog;
 const elements={'[data-pause-restart]':confirmation,'#restart-expedition':restart,'#restart-cancel':keep,'#restart-confirm':confirm,'#resume':resume,'.pause-content':content};
 dialog.querySelector=selector=>elements[selector];
 dialog.querySelectorAll=selector=>({'[data-pause-overview]':overview,'[data-controls-mode]':modes,'[data-controls-panel]':panels}[selector]||[]);
 let resumes=0,restarts=0,globalEscapes=0,paused=true,closedBeforeRestart=false;
 const menu=createPauseMenu(dialog,{onResume(){resumes++;paused=false;menu.close();},onRestart(){restarts++;closedBeforeRestart=!dialog.open;}});
 const keyboard=createKeyboardControls({keys:new Set(),state:()=>({loaded:true,paused,preview:false}),focus(){},cancelCruise(){},pause(value){globalEscapes++;paused=value;},range(){},recover(){}});
 window.addEventListener('keydown',keyboard.keydown);
 const escape=(repeat=false)=>keep.fire('keydown',{code:'Escape',repeat});
 const outside=()=>({target:dialog,clientX:20,clientY:20}),inside=()=>({target:dialog,clientX:120,clientY:120});
 return {menu,dialog,overview,confirmation,restart,keep,confirm,resume,content,modes,panels,media,escape,outside,inside,counts:()=>({resumes,restarts,globalEscapes,paused,closedBeforeRestart})};
}

const f=fixture();
f.content.scrollTop=200;f.menu.open();
assert(f.dialog.open&&f.confirmation.hidden&&f.overview.every(e=>!e.hidden));
assert.equal(f.content.scrollTop,0);assert.equal(f.resume.focuses,1);
f.confirm.fire('click');assert.equal(f.counts().restarts,0,'A hidden confirmation action cannot restart');
f.restart.fire('click');
assert(!f.confirmation.hidden&&f.overview.every(e=>e.hidden));
assert(f.dialog.classes.has('confirming-restart'));
assert.equal(f.dialog.attrs['aria-labelledby'],'restart-title');assert.equal(f.dialog.attrs['aria-describedby'],'restart-description');
assert.equal(f.keep.focuses,1,'The safe action receives focus');
assert.equal(f.counts().restarts,0,'Entering confirmation cannot mutate the expedition');
f.menu.open();f.menu.open();
assert(!f.confirmation.hidden&&f.dialog.open,'Repeated pause requests, including window blur, preserve confirmation');
assert.equal(f.keep.focuses,1,'Repeated pause cannot move keyboard focus');
f.keep.fire('click');
assert(f.dialog.open&&f.confirmation.hidden&&f.overview.every(e=>!e.hidden));
assert.equal(f.restart.focuses,1);assert.equal(f.dialog.attrs['aria-labelledby'],'pause-title');assert.equal(f.dialog.attrs['aria-describedby'],'pause-lead');
assert.deepEqual(f.counts(),{resumes:0,restarts:0,globalEscapes:0,paused:true,closedBeforeRestart:false});

f.restart.fire('click');const repeated=f.escape(true);
assert(repeated.defaultPrevented&&repeated.stopped&&!f.confirmation.hidden,'Held Escape cannot dismiss or resume');
const escaped=f.escape();
assert(escaped.defaultPrevented&&escaped.stopped&&f.confirmation.hidden&&f.dialog.open);
assert.equal(f.counts().globalEscapes,0,'Escape never reaches the global drive pause toggle');
assert.equal(f.counts().resumes,0,'First Escape returns to Pause without releasing the vehicle');
f.escape();assert(!f.dialog.open);assert.equal(f.counts().resumes,1,'A separate Escape from the overview resumes normally');

const n=fixture();n.menu.open();n.restart.fire('click');const cancelled=n.dialog.fire('cancel');
assert(cancelled.defaultPrevented&&n.dialog.open&&n.confirmation.hidden,'Native dialog cancellation returns to Pause');
assert.equal(n.counts().restarts,0);assert.equal(n.counts().resumes,0);
n.dialog.fire('cancel');assert.equal(n.counts().resumes,1,'Native cancel still resumes the ordinary pause menu');

const b=fixture();b.menu.open();b.restart.fire('click');
b.dialog.fire('pointerdown',b.inside());b.dialog.fire('click',b.inside());
assert(!b.confirmation.hidden,'Dialog padding does not dismiss confirmation');
b.dialog.fire('pointerdown',b.inside());b.dialog.fire('click',b.outside());
assert(!b.confirmation.hidden,'Dragging from inside to the backdrop does not dismiss');
b.dialog.fire('pointerdown',b.outside());b.dialog.fire('click',b.inside());
assert(!b.confirmation.hidden,'Dragging from backdrop into the dialog does not dismiss');
b.dialog.fire('pointerdown',b.outside());b.dialog.fire('pointercancel');b.dialog.fire('click',b.outside());
assert(!b.confirmation.hidden,'Cancelled pointers cannot retain a stale backdrop press');
b.dialog.fire('pointerdown',b.outside());b.dialog.fire('click',b.outside());
assert(b.confirmation.hidden&&b.dialog.open&&b.counts().paused,'Backdrop dismisses only confirmation and keeps the vehicle paused');
assert.equal(b.counts().restarts,0);assert.equal(b.counts().resumes,0);
b.dialog.fire('pointerdown',b.outside());b.dialog.fire('click',b.outside());
assert(b.dialog.open,'Outside the ordinary pause menu does not accidentally resume');

const c=fixture();c.menu.open();c.restart.fire('click');c.confirm.fire('click');c.confirm.fire('click');
assert.equal(c.counts().restarts,1,'Double activation launches exactly one restart');
assert(c.counts().closedBeforeRestart,'The old dialog must close before the intro opens');
assert.equal(c.counts().resumes,0,'Restart owns the launch and cannot trigger an extra resume');
c.restart.fire('click');assert(c.confirmation.hidden,'A closed menu cannot enter confirmation');
c.menu.open();assert(c.confirmation.hidden&&c.dialog.open&&c.overview.every(e=>!e.hidden));
c.restart.fire('click');c.menu.close();c.menu.close();c.confirm.fire('click');
assert.equal(c.counts().restarts,1,'External closing invalidates confirmation');
c.menu.open();assert(c.confirmation.hidden&&!c.dialog.classes.has('confirming-restart'),'Reopening begins with a fresh overview');

for(const coarse of [false,true]){
 const m=fixture({coarse});
 assert.equal(m.modes[coarse?1:0].attrs['aria-pressed'],'true');assert.equal(m.panels[coarse?1:0].hidden,false);
 m.media.matches=!coarse;m.media.fire('change');
 assert.equal(m.modes[coarse?0:1].attrs['aria-pressed'],'true','Untouched controls follow input-device changes');
 m.modes[1].fire('click');m.media.matches=false;m.media.fire('change');
 assert.equal(m.modes[1].attrs['aria-pressed'],'true');assert.equal(m.modes[0].attrs['aria-pressed'],'false');
 assert(!m.panels[1].hidden&&m.panels[0].hidden,'Explicit control-mode choice survives later media changes');
 m.menu.open();m.restart.fire('click');m.keep.fire('click');
 assert(!m.panels[1].hidden&&m.panels[0].hidden,'Restart confirmation preserves the chosen instructions');
}
delete globalThis.matchMedia;
console.log('Pause menu: deliberate one-shot restart, safe focus, Escape/global-key isolation, native/backdrop cancellation, drag-out safety, repeated pause and responsive control modes passed.');
