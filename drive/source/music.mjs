import {createFrequencyRoll,createTuningSweep,TUNING_MS} from './radio-tuning.mjs';
import {STATIONS} from './stations.mjs';
// One opt-in media element: selecting a preset while off does not download it.
export function createMusic(button,focus,{onPower=()=>{}}={}){
 const $=id=>document.getElementById(id),panel=$('radio-panel'),power=$('radio-power'),volume=$('radio-volume'),presets=$('radio-presets');
 const media=document.createElement('audio');media.id='soundtrack';media.preload='none';media.loop=true;media.hidden=true;document.body.append(media);
 let ctx,gain,on=false,paused=false,disposed=false,version=0,timer,loadTimer,effectsOn=false,engineLoad=0,selected=0,userVolume=.7,needsReload=false,status='POWER OFF';
 const frequency=createFrequencyRoll($('radio-frequency'));
 let sweep,tuning=false;
 const motors=new Set(),listeners=[];
 const listen=(node,event,fn)=>{node.addEventListener(event,fn);listeners.push(()=>node.removeEventListener(event,fn))};
 function render(){
  const station=STATIONS[selected];button.textContent=on?'Radio on':'Radio off';button.title='Open LC FM radio and station presets';
  power.textContent=on?'Power off':'Power on';power.setAttribute('aria-pressed',String(on));
  frequency.set(station.frequency);$('radio-genre').textContent=station.genre;$('radio-title').textContent=station.title;$('radio-tagline').textContent=station.tagline;$('radio-status').textContent=status;
  presetButtons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===selected)));panel.dataset.power=on?'on':'off';
 }
 const presetButtons=STATIONS.map((station,i)=>{const b=document.createElement('button');b.type='button';b.textContent=station.genre;b.title=station.title;b.setAttribute('aria-label',`${station.genre}: ${station.title}`);listen(b,'click',()=>tune(i));presets.append(b);return b});
 function targetGain(){return userVolume*(effectsOn?.51-engineLoad*.11:.74)}
 function ramp(value,seconds=.12){if(!ctx)return;gain.gain.cancelScheduledValues(ctx.currentTime);gain.gain.setTargetAtTime(value,ctx.currentTime,seconds)}
 function stopMotor(){for(const node of motors){try{node.stop()}catch{}node.disconnect()}motors.clear()}
 function motor(){
  if(!ctx||paused)return;stopMotor();const osc=ctx.createOscillator(),g=ctx.createGain(),now=ctx.currentTime;
  osc.type='triangle';osc.frequency.setValueAtTime(155,now);osc.frequency.linearRampToValueAtTime(126,now+1.25);g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(.032*userVolume,now+.045);g.gain.setValueAtTime(.024*userVolume,now+1.22);g.gain.linearRampToValueAtTime(0,now+1.42);osc.connect(g);g.connect(ctx.destination);motors.add(osc);osc.onended=()=>{motors.delete(osc);osc.disconnect();g.disconnect()};osc.start();osc.stop(now+1.45);
 }
 function ensureContext(){if(ctx)return;ctx=new AudioContext();gain=ctx.createGain();gain.gain.value=0;ctx.createMediaElementSource(media).connect(gain);gain.connect(ctx.destination);sweep=createTuningSweep(ctx)}
 function fail(request){if(request!==version||disposed)return;clearTimeout(loadTimer);sweep?.stop();tuning=false;needsReload=true;on=false;status='SIGNAL LOST · TRY POWER AGAIN';media.pause();ramp(0);onPower(false);render()}
 async function play({retune=false,animate=false,direction=1}={}){
  const request=++version;clearTimeout(timer);clearTimeout(loadTimer);sweep?.stop();tuning=retune;const began=performance.now();
  try{
   ensureContext();void ctx.resume();
   if(animate)motor();
   if(retune){status='TUNING…';render();sweep.start(userVolume,direction);ramp(0,.025);await new Promise(resolve=>setTimeout(resolve,120));if(request!==version||!on||paused||disposed)return;}
   const file=STATIONS[selected].file;if(media.getAttribute('src')!==file||needsReload){media.src=file;media.load();needsReload=false}
   status='TUNING…';render();loadTimer=setTimeout(()=>fail(request),15000);
   await Promise.all([ctx.resume(),media.play(),new Promise(resolve=>setTimeout(resolve,retune?Math.max(0,TUNING_MS-(performance.now()-began)):0))]);
   if(request!==version||!on||paused||disposed)return;
   clearTimeout(loadTimer);tuning=false;status='STEREO · ORIGINAL INSTRUMENTAL';render();ramp(targetGain(),animate?.65:.22);
  }catch{fail(request)}
 }
 function turnPower(){if(disposed)return;on=!on;version++;sweep?.stop();tuning=false;clearTimeout(loadTimer);clearTimeout(timer);status=on?'TUNING…':'POWER OFF';onPower(on);render();if(on)open(false);
  if(on&&!paused)void play({animate:true});else{ramp(0,.055);motor();timer=setTimeout(()=>media.pause(),220)}
 }
 function tune(i){if(disposed)return;const next=(i+STATIONS.length)%STATIONS.length;if(next===selected)return;const direction=Number(STATIONS[next].frequency)>=Number(STATIONS[selected].frequency)?1:-1;selected=next;render();if(on&&!paused)void play({retune:true,direction})}
 function open(value){panel.hidden=!value;button.setAttribute('aria-expanded',String(value));if(value)power.focus({preventScroll:true});else focus()}
 button.removeAttribute('aria-pressed');button.setAttribute('aria-controls','radio-panel');button.setAttribute('aria-expanded','false');
 listen(button,'click',()=>open(panel.hidden));listen($('radio-close'),'click',()=>open(false));listen(power,'click',turnPower);
 listen($('radio-prev'),'click',()=>tune(selected-1));listen($('radio-next'),'click',()=>tune(selected+1));
 listen(volume,'input',()=>{userVolume=Number(volume.value)/100;volume.setAttribute('aria-valuetext',`${volume.value} percent`);sweep?.stop();if(on&&!paused&&!tuning)ramp(targetGain())});
 listen(panel,'keydown',e=>{if(e.code==='Escape'){e.preventDefault();e.stopPropagation();open(false)}});
 listen(media,'error',()=>{if(on)fail(version)});render();
 return {get powered(){return on},get station(){return STATIONS[selected]},setEffectsMix(enabled,load){effectsOn=enabled;engineLoad=load;if(ctx&&on&&!paused&&!disposed&&!tuning)ramp(targetGain(),.3)},pause(value){paused=value;version++;sweep?.stop();tuning=false;clearTimeout(timer);clearTimeout(loadTimer);stopMotor();if(value){media.pause();ramp(0);status=on?'PAUSED':'POWER OFF';render()}else if(on)void play()},dispose(){disposed=true;version++;sweep?.stop();frequency.dispose();clearTimeout(timer);clearTimeout(loadTimer);stopMotor();listeners.forEach(off=>off());media.pause();media.removeAttribute('src');media.load();media.remove();ctx?.close().catch(()=>{})}};
}
