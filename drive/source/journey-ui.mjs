// Judge Dean LLC — route planning, saved checkpoints and a placeable camp.
import {ROUTE_FORKS} from './expedition.mjs';
const KEY='com.judgedeanllc.lc100.expedition.v1';
export function readJourney(){try{return JSON.parse(localStorage.getItem(KEY))}catch{return null}}
export function saveJourney(route,camp){try{localStorage.setItem(KEY,JSON.stringify({route:route.snapshot(),camp:camp.snapshot()}));return true}catch{return false}}

// A modal may resume only the drive it paused. Blur/hidden state revokes that intent.
export class JourneyPauseIntent{
 constructor(){this.active=false;this.resume=false;}
 open(paused){if(!this.active){this.active=true;this.resume=!paused;}}
 suspend(){if(this.active)this.resume=false;}
 close(hidden=false){const resume=this.active&&this.resume&&!hidden;this.active=false;this.resume=false;return resume;}
}
// One decision at a time: the first at launch, later choices at their junctions.
export function availableRouteChoice(route){return ROUTE_FORKS.find((f,i)=>i===0?route.next<=f.at:route.next===f.at)||null;}
export class JourneyRoutePrompts{
 constructor(){this.seen=new Set();}
 reset(){this.seen.clear();}
 take(route,{opening=false}={}){const fork=availableRouteChoice(route);if(!fork||(!opening&&fork.id===ROUTE_FORKS[0].id)||this.seen.has(fork.id))return null;this.seen.add(fork.id);return fork;}
}
export function campReadiness({complete=false,distance=Infinity,speed=0,tent=false,fire=false}={}){
 if(!complete)return {ready:false,near:false,objective:'',reason:'Reach Sunset camp to pitch your shelter and light the fire.'};
 if(distance>=30)return {ready:false,near:false,objective:'Return to Sunset camp',reason:'Return to the Sunset camp clearing to set up camp.'};
 if(Math.abs(speed)>1)return {ready:false,near:true,objective:tent?'Park to adjust camp':'Park to set up camp',reason:'Brake in the clearing, then open Set up camp. A little suspension rocking is fine.'};
 if(!tent)return {ready:true,near:true,objective:'Next: Pitch your shelter',reason:'Choose a clear tent spot, then light the campfire.'};
 if(!fire)return {ready:true,near:true,objective:'Next: Light the campfire',reason:'Your shelter is pitched. Light the fire when you are ready.'};
 return {ready:true,near:true,objective:'Camp ready · Explore or relax',reason:'Your shelter is pitched and the fire is lit. Enjoy camp, or keep exploring.'};
}
export function engineReadout(physics){return `${physics.range} · ${physics.lighting?.reversing?'R':physics.powertrain.gear} · ${Math.round(physics.powertrain.rpm/50)*50} RPM`;}
export function createJourneyUI({route,camp,onPause,onResume,onSave,onPlace,onConfirm,onCancel,onRotate,onFire,onCamera,onRestart,onCampView=()=>{},onDrive=()=>{},context=()=>({paused:false,camp:{ready:true,near:true,reason:''}})}){
 const panel=document.createElement('section');panel.id='journey-controls';panel.innerHTML='<button id="journey-plan">Routes & camp</button><button id="hood-camera" aria-pressed="false">Hood view</button><button id="camp-drive">Return to driving</button><span id="engine-readout"></span><span id="ford-status" role="status"></span><span id="camp-objective" role="status"></span>';
 (document.getElementById('driving-hud')||document.getElementById('game')).append(panel);
 const dialog=document.createElement('dialog');dialog.id='journey-dialog';dialog.setAttribute('aria-label','Expedition routes and camp');document.body.append(dialog);
 const placement=document.createElement('section');placement.id='camp-placement';placement.hidden=true;placement.setAttribute('aria-label','Choose your tent spot');placement.innerHTML='<span class="camp-eyebrow">01 / SHELTER</span><strong>Choose your tent spot</strong><p>Tap open ground to move the preview. Fine-tune below.</p><p id="camp-placement-status" role="status"></p><div class="camp-adjust"><button data-move="-1,0" aria-label="Move tent left">← Left</button><button data-move="0,-1" aria-label="Move tent farther">↑ Away</button><button data-move="0,1" aria-label="Move tent nearer">↓ Closer</button><button data-move="1,0" aria-label="Move tent right">Right →</button><button id="camp-rotate">↻ Rotate</button></div><div class="camp-placement-actions"><button id="camp-cancel">Back</button><button id="camp-confirm">Pitch shelter</button></div>';
 document.getElementById('game').append(placement);
 const pauseIntent=new JourneyPauseIntent();let hood=false,focusedFork=null,confirmRestart=false,backdropPress=false;
 const element=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
 const button=(label,fn,disabled=false)=>{const b=element('button',label);b.disabled=disabled;b.addEventListener('click',fn);return b;};
 const primaryButton=(label,fn)=>{const b=button(label,fn);b.className='journey-primary';return b;};
 function close({beginPlacement=false}={}){dialog.close();focusedFork=null;confirmRestart=false;const resume=pauseIntent.close(document.hidden);onResume(!document.hidden&&(beginPlacement||resume));}
 function routes(parent,forks,{heading=true}={}){
  for(const f of forks){if(heading)parent.append(element('h3',f.title));const selected=route.choices[f.id]||f.options[0].id;
   parent.append(element('p',route.next>f.at?'Route travelled':'Select a route below.'));
   for(const o of f.options){const active=selected===o.id;const b=button('',()=>{route.choose(f.id,o.id);onSave();render();dialog.querySelector(`[data-route="${f.id}:${o.id}"]`)?.focus();},route.next>f.at);b.dataset.route=`${f.id}:${o.id}`;b.className='journey-route';b.setAttribute('aria-pressed',String(active));const title=element('strong',o.name),description=element('span',o.description),state=element('span',active?'✓ Selected':'Select');description.className='journey-route-description';state.className='journey-route-state';b.append(title,state,description);parent.append(b);}
  }
 }

 function displayedFork(){return focusedFork?ROUTE_FORKS.find(f=>f.id===focusedFork&&route.next<=f.at):availableRouteChoice(route);}
 function continueSelection(){const fork=displayedFork();if(fork&&!route.choices[fork.id]){route.choose(fork.id,fork.options[0].id);onSave();}close();}
 function render(){
  dialog.replaceChildren();
  dialog.classList.toggle('camp-dialog',route.complete&&!confirmRestart);
  if(confirmRestart){dialog.append(element('h2','Start a new expedition?'),element('p','This resets your saved checkpoints and route choices, removes your tent and campfire, and returns the truck to Base camp.'),button('Keep this expedition',()=>{confirmRestart=false;render();}),button('Reset and start at Base camp',()=>{close();onRestart();}));return;}
  const fork=displayedFork();
  if(fork){dialog.append(element('h2',fork.title),element('p','Choose one of these two paths. They branch apart, then rejoin the main trail. Press Continue or tap outside this box to drive.'));routes(dialog,[fork],{heading:false});dialog.append(primaryButton('Continue',continueSelection));return;}
  dialog.append(element('h2',route.complete?'Sunset camp':'Your expedition'));
  if(route.complete){const readiness=context().camp;
   const steps=element('ol','');steps.className='camp-steps';steps.setAttribute('aria-label','Camp setup progress');
   for(const [label,done,current] of [['Shelter',!!camp.tent,!camp.tent],['Campfire',camp.fire,!!camp.tent&&!camp.fire],['Relax',false,camp.fire]]){const step=element('li',`${done?'✓ ':''}${label}`);step.dataset.state=done?'done':current?'current':'next';if(current)step.setAttribute('aria-current','step');steps.append(step);}
   dialog.append(steps,element('p',!readiness.near?readiness.reason:!readiness.ready?readiness.reason:!camp.tent?'Pick a spot for your Shiftpod-style shelter. A preview lets you check the ground before pitching.':!camp.fire?'Your shelter is ready. Light the fire and settle in.':'Shelter up. Fire glowing. Take in the view—you’ve earned the quiet.'));
   const place=button(camp.tent?'Move shelter':'Choose tent spot',()=>{if(document.hidden)return;close({beginPlacement:true});onPlace();},!readiness.ready);place.className=camp.tent?'journey-secondary':'journey-primary';
   const fire=button(camp.fire?'Extinguish campfire':'Light campfire',()=>{onFire();render();dialog.querySelector('button.journey-primary')?.focus();},!camp.tent||!readiness.near);
   const options=[];
   if(!camp.tent)dialog.append(place);
   else if(!camp.fire){fire.className='journey-primary';dialog.append(fire);options.push(place);}
   else{dialog.append(primaryButton('Relax at camp',()=>{onCampView();close();}));options.push(place,fire);}
   const drive=button('Return to driving',()=>{onDrive();close();});drive.className='journey-secondary';dialog.append(drive);
   const history=document.createElement('details');history.className='camp-more';history.append(element('summary','Camp & expedition options'),...options,element('h3','Routes travelled'));
   for(const f of ROUTE_FORKS){const chosen=f.options.find(o=>o.id===route.choices[f.id])||f.options[0];history.append(element('p',`${f.title} · ${chosen.name}`));}
   history.append(button('Start a new expedition',()=>{confirmRestart=true;render();}));dialog.append(history);
  }else{dialog.append(element('p',route.next<ROUTE_FORKS.at(-1).at?'Keep following the flags. You’ll choose between two paths when you reach the next fork.':'Your route choices are complete. Follow the flags to Sunset camp.'),element('p','Reach Sunset camp to pitch your shelter and light the fire.'),primaryButton('Continue',close));}
 }
 function open({forkId=null}={}){pauseIntent.open(context().paused);if(!dialog.open){focusedFork=forkId;confirmRestart=false;}if(route.complete&&context().camp.near)onCampView();onPause();render();if(!dialog.open)dialog.showModal();}
 // Padding is inside the dialog; only a gesture starting and ending on the backdrop dismisses.
 const outside=e=>{if(e.target!==dialog)return false;const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
 dialog.addEventListener('pointerdown',e=>{backdropPress=outside(e);});
 dialog.addEventListener('pointercancel',()=>{backdropPress=false;});
 dialog.addEventListener('click',e=>{const dismiss=backdropPress&&outside(e);backdropPress=false;if(!dismiss)return;if(confirmRestart){confirmRestart=false;render();}else continueSelection();});
 dialog.addEventListener('cancel',e=>{e.preventDefault();if(confirmRestart){confirmRestart=false;render();}else close();});
 document.getElementById('journey-plan').onclick=()=>open();document.getElementById('camp-drive').onclick=onDrive;
 document.getElementById('hood-camera').onclick=e=>{hood=!hood;onCamera(hood);e.currentTarget.setAttribute('aria-pressed',String(hood));e.currentTarget.textContent=hood?'Chase view':'Hood view';};
 document.getElementById('camp-confirm').onclick=onConfirm;document.getElementById('camp-cancel').onclick=onCancel;document.getElementById('camp-rotate').onclick=onRotate;
 for(const b of placement.querySelectorAll('[data-move]'))b.onclick=()=>{if(camp.candidate){const [x,z]=b.dataset.move.split(',').map(Number);camp.candidate.x+=x;camp.candidate.z+=z;}};
 const text=(id,value)=>{const e=document.getElementById(id);if(e.textContent!==value)e.textContent=value;};
 return {open,dialog,suspendResume:()=>pauseIntent.suspend(),update(physics){
  placement.hidden=!camp.placing;placement.dataset.valid=String(camp.result.ok);
  text('camp-placement-status',camp.result.reason);text('camp-confirm',camp.tent?'Save tent position':'Pitch shelter');
  const confirm=document.getElementById('camp-confirm');if(confirm.disabled===camp.result.ok)confirm.disabled=!camp.result.ok;
  text('journey-plan',route.complete?(camp.tent?'Camp':'Set up camp'):'Routes & camp');
  const state=context();if(typeof state.hood==='boolean'&&state.hood!==hood){hood=state.hood;const b=document.getElementById('hood-camera');b.setAttribute('aria-pressed',String(hood));text('hood-camera',hood?'Chase view':'Hood view');}
  text('engine-readout',engineReadout(physics));text('camp-objective',state.camp.objective||'');
  const f=physics.fording;text('ford-status',f.stalled?'ENGINE STALLED · Recovering to checkpoint':f.exposure>.2?'DEEP WATER · Back out now':f.depth>.15?`WATER ${f.depth.toFixed(2)} m · Slow, steady throttle`:'');
 },dispose(){dialog.remove();panel.remove();placement.remove();}};
}
