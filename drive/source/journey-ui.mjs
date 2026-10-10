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
export function campReadiness({complete=false,distance=Infinity,speed=0,tent=false,fire=false}={}){
 if(!complete)return {ready:false,near:false,objective:'',reason:'Reach Sunset camp to pitch your shelter and light the fire.'};
 if(distance>=30)return {ready:false,near:false,objective:'Return to Sunset camp',reason:'Return to the Sunset camp clearing to set up camp.'};
 if(Math.abs(speed)>1)return {ready:false,near:true,objective:tent?'Park to adjust camp':'Park to set up camp',reason:`Brake to a stop in the clearing, then open Routes & camp to ${tent?'move':'pitch'} your shelter.`};
 if(!tent)return {ready:true,near:true,objective:'Next: Pitch your shelter',reason:'Choose a clear tent spot, then light the campfire.'};
 if(!fire)return {ready:true,near:true,objective:'Next: Light the campfire',reason:'Your shelter is pitched. Light the fire when you are ready.'};
 return {ready:true,near:true,objective:'Camp ready · Explore or relax',reason:'Your shelter is pitched and the fire is lit. Enjoy camp, or keep exploring.'};
}
export function engineReadout(physics){return `${physics.range} · ${physics.lighting?.reversing?'R':physics.powertrain.gear} · ${Math.round(physics.powertrain.rpm/50)*50} RPM`;}
export function createJourneyUI({route,camp,onPause,onResume,onSave,onPlace,onConfirm,onCancel,onRotate,onFire,onCamera,onRestart,context=()=>({paused:false,camp:{ready:true,near:true,reason:''}})}){
 const panel=document.createElement('section');panel.id='journey-controls';panel.innerHTML='<button id="journey-plan">Routes & camp</button><button id="hood-camera" aria-pressed="false">Hood view</button><span id="engine-readout"></span><span id="ford-status" role="status"></span><span id="camp-objective" role="status"></span>';
 document.getElementById('game').append(panel);
 const dialog=document.createElement('dialog');dialog.id='journey-dialog';dialog.setAttribute('aria-label','Expedition routes and camp');document.body.append(dialog);
 const placement=document.createElement('section');placement.id='camp-placement';placement.hidden=true;placement.innerHTML='<strong>Place your shelter</strong><p>Tap the clearing to move the tent. Use the arrows for small adjustments.</p><p id="camp-placement-status" role="status"></p><div><button data-move="-1,0">Left</button><button data-move="0,-1">Farther</button><button data-move="0,1">Nearer</button><button data-move="1,0">Right</button><button id="camp-rotate">Rotate</button></div><div><button id="camp-confirm">Pitch tent</button><button id="camp-cancel">Cancel</button></div>';
 document.getElementById('game').append(placement);
 const pauseIntent=new JourneyPauseIntent();let hood=false,focusedFork=null,confirmRestart=false;
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
 function continueRoutes(){let changed=false;for(const f of ROUTE_FORKS){if(route.next<=f.at&&!route.choices[f.id])changed=route.choose(f.id,f.options[0].id)||changed;}if(changed)onSave();close();}
 function render(){
  dialog.replaceChildren();
  if(confirmRestart){dialog.append(element('h2','Start a new expedition?'),element('p','This resets your saved checkpoints and route choices, removes your tent and campfire, and returns the truck to Base camp.'),button('Keep this expedition',()=>{confirmRestart=false;render();}),button('Reset and start at Base camp',()=>{close();onRestart();}));return;}
  const fork=ROUTE_FORKS.find(f=>f.id===focusedFork&&route.next<=f.at);
  if(fork){const selected=fork.options.find(o=>o.id===route.choices[fork.id])||fork.options[0];dialog.append(element('h2',fork.title),element('p','Both trails reconnect. Select your route, then press Continue.'));routes(dialog,[fork],{heading:false});dialog.append(primaryButton('Continue',()=>{if(!route.choices[fork.id]){route.choose(fork.id,selected.id);onSave();}close();}));return;}
  dialog.append(element('h2',route.complete?'Sunset camp':'Choose your expedition'));
  if(route.complete){const readiness=context().camp;dialog.append(element('p','Expedition complete. Your next stop is a place to rest.'),element('p',readiness.reason));
   const place=button(camp.tent?'Move tent':'Place Shiftpod-style tent',()=>{if(document.hidden)return;close({beginPlacement:true});onPlace();},!readiness.ready);
   const fire=button(camp.fire?'Extinguish campfire':'Light campfire',()=>{onFire();render();},!camp.tent||!readiness.near);
   dialog.append(...(camp.tent&&!camp.fire?[fire,place]:[place,fire]));
   if(!camp.tent)dialog.append(element('p','Pitch your shelter to unlock the campfire.'));
   dialog.append(button(readiness.ready?'Keep exploring':'Back to driving',close));
   const history=document.createElement('details');history.append(element('summary','Routes travelled'));routes(history,ROUTE_FORKS);dialog.append(history,button('Start a new expedition',()=>{confirmRestart=true;render();}));
  }else{dialog.append(element('p','Choose your routes before you drive, then press Continue. Both detours rejoin the main trail. Progress saves at each flag.'));routes(dialog,ROUTE_FORKS);dialog.append(element('p','Reach Sunset camp to pitch your shelter and light the fire.'),primaryButton('Continue',continueRoutes));}
 }
 function open({forkId=null}={}){pauseIntent.open(context().paused);if(!dialog.open){focusedFork=forkId;confirmRestart=false;}onPause();render();if(!dialog.open)dialog.showModal();}
 dialog.addEventListener('cancel',e=>{e.preventDefault();if(confirmRestart){confirmRestart=false;render();}else close();});
 document.getElementById('journey-plan').onclick=()=>open();
 document.getElementById('hood-camera').onclick=e=>{hood=!hood;onCamera(hood);e.currentTarget.setAttribute('aria-pressed',String(hood));e.currentTarget.textContent=hood?'Chase view':'Hood view';};
 document.getElementById('camp-confirm').onclick=onConfirm;document.getElementById('camp-cancel').onclick=onCancel;document.getElementById('camp-rotate').onclick=onRotate;
 for(const b of placement.querySelectorAll('[data-move]'))b.onclick=()=>{if(camp.candidate){const [x,z]=b.dataset.move.split(',').map(Number);camp.candidate.x+=x;camp.candidate.z+=z;}};
 return {open,dialog,suspendResume:()=>pauseIntent.suspend(),update(physics){placement.hidden=!camp.placing;document.getElementById('camp-placement-status').textContent=camp.result.reason;document.getElementById('camp-confirm').disabled=!camp.result.ok;document.getElementById('engine-readout').textContent=engineReadout(physics);document.getElementById('camp-objective').textContent=context().camp.objective||'';const f=physics.fording;document.getElementById('ford-status').textContent=f.stalled?'ENGINE STALLED · Recovering to checkpoint':f.exposure>.2?'DEEP WATER · Back out now':f.depth>.15?`WATER ${f.depth.toFixed(2)} m · Slow, steady throttle`:'';},dispose(){dialog.remove();panel.remove();placement.remove();}};
}
