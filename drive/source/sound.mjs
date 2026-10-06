const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Audio follows wheel rotation and load, including wheelspin at zero road speed.
export function drivingMix({speed=0,tyres=[],range='HI',input={},shoreDistance=30,waterContact}){
 const moving=Math.abs(speed),ground=tyres.filter(w=>w.contact),wheel=tyres.length?tyres.reduce((sum,w)=>sum+Math.abs(w.omega||0),0)/tyres.length:0;
 const slip=Math.max(0,...ground.map(w=>w.slip||0)),soft=ground.length?ground.reduce((s,w)=>s+(w.soft||0),0)/ground.length:0;
 const throttle=input.brake?0:input.gas||input.reverse?1:input.cruise?.38:0;
 // Continuous cruising curve avoids hunting at artificial speed-based gear boundaries.
 const rolling=range==='LO'?wheel*9.5493*22:moving*155;
 const wheelspin=Math.max(0,wheel*.45-moving);
 const rpm=clamp(720+rolling+Math.sqrt(wheelspin)*260+throttle*260,720,4200);
 const load=clamp(throttle*.72+slip*.06,0,1),wet=clamp(waterContact??(7-shoreDistance)/5,0,1);
 const work=ground.length?clamp(moving*.12+slip*.13,0,1):0;
 return {rpm,load,wet,sand:work*(1-wet)*(.055+soft*.055),splash:ground.length?wet*clamp(moving/11.2,0,1)**.7*.58:0,splashInterval:1.35-clamp(moving/11.2,0,1)*.87,surf:.12+.24*Math.exp(-Math.max(0,shoreDistance)/35)};
}
// Stylized muted petrol V8: four firing events per revolution, with a restrained
// upper harmonic spectrum. All partials share an exact harmonic relationship.
export function engineVoice({rpm,load}){
 const rev=clamp((rpm-720)/3480,0,1),work=clamp(load,0,1);
 return {fundamental:clamp(rpm,720,4200)/15,cutoff:520+rev*500+work*180,gains:[.105+work*.045,.034+work*.023,.010+work*.010,.004+work*.005]};
}
export function createSound(button,focus,onMix=()=>{},gestures=button.ownerDocument){
 let ctx,master,compressor,buffers,loading,on=true,paused=false,disposed=false,engineFilter,engine=[],sand,coast,splash;
 let nextGull=0,nextSplash=0;const sources=new Set(),controller=new AbortController();
 const label=()=>{button.textContent=on?'Sound on':'Sound off';button.setAttribute('aria-pressed',String(on));};
 const smooth=(param,value,seconds=.12)=>param.setTargetAtTime(value,ctx.currentTime,seconds);
 function gain(value){const n=ctx.createGain();n.gain.value=value;return n;}
 function loop(name,destination,volume=0){const source=ctx.createBufferSource(),g=gain(volume);source.buffer=buffers[name];source.loop=true;source.connect(g);g.connect(destination);source.start();sources.add(source);return {source,g};}
 async function setup(){
  ctx=new AudioContext();master=gain(0);compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-8;compressor.knee.value=8;compressor.ratio.value=4;compressor.attack.value=.006;compressor.release.value=.18;master.connect(compressor);compressor.connect(ctx.destination);
  await ctx.resume();
  const names=['sand','coast','gull1','gull2','wave1','wave2'];
  buffers=Object.fromEntries(await Promise.all(names.map(async name=>{const response=await fetch(`audio/${name}.m4a?v=steady-2`,{signal:controller.signal});if(!response.ok)throw new Error(name);return [name,await ctx.decodeAudioData(await response.arrayBuffer())];})));
  if(disposed)return;
  engineFilter=ctx.createBiquadFilter();engineFilter.type='lowpass';engineFilter.frequency.value=1000;engineFilter.Q.value=.5;engineFilter.connect(master);
  // A phase-aligned harmonic drone replaces the pulsed exhaust recordings.
  // No random detuning, firing bursts or amplitude LFOs: throttle changes tone,
  // not a repeating chug. RPM still follows load, wheelspin and range.
  engine=[];const start=ctx.currentTime;
  for(const order of [1,2,3,4]){const source=ctx.createOscillator(),g=gain(0);source.type='sine';source.frequency.value=48*order;source.connect(g);g.connect(engineFilter);source.start(start);sources.add(source);engine.push({source,g,order})}
  const sandFilter=ctx.createBiquadFilter();sandFilter.type='highpass';sandFilter.frequency.value=550;const gritLow=ctx.createBiquadFilter();gritLow.type='lowpass';gritLow.frequency.value=2200;sandFilter.connect(gritLow);gritLow.connect(master);sand=loop('sand',sandFilter);
  coast=loop('coast',master,.2);
  nextGull=ctx.currentTime+4;apply();
 }
 function apply(){if(master)smooth(master.gain,on&&!paused?.72:0,.14);if(!on||paused)onMix(false,0);}
 function shot(name,volume,pan=0,rate=1,duration=0){const s=ctx.createBufferSource(),g=gain(volume),p=ctx.createStereoPanner();s.buffer=buffers[name];s.playbackRate.value=rate;p.pan.value=pan;s.connect(g);g.connect(p);p.connect(master);sources.add(s);s.onended=()=>{sources.delete(s);s.disconnect();g.disconnect();p.disconnect();};
  if(duration){const now=ctx.currentTime;g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(volume,now+.035);g.gain.setValueAtTime(volume,now+duration*.55);g.gain.linearRampToValueAtTime(0,now+duration);s.start(now,.25,duration*rate);s.stop(now+duration+.02);}else s.start();
 }
 // Enabled by default; the first in-game gesture unlocks browser audio.
 // A deliberate mute is never undone by subsequent driving input.
 let starting;
 async function start(){
  if(disposed||!on||paused)return;
  if(starting)return starting;
  starting=(async()=>{
   try{if(!loading){button.textContent='Loading sound…';loading=setup();}else if(ctx?.state==='suspended')await ctx.resume();await loading;if(!disposed){label();apply();}}
   catch{if(disposed)return;on=false;loading=null;ctx?.close().catch(()=>{});sources.clear();ctx=master=buffers=null;engine=[];label();button.textContent='Retry sound';onMix(false,0);}
  })();
  await starting;starting=null;
 }
 function activate(event){
  if(button.contains(event.target)||event.repeat||event.metaKey||event.ctrlKey||event.altKey)return;
  return start();
 }
 async function toggle(){
  if(disposed)return;on=!on;label();focus();apply();
  if(on)await start();
 }
 button.addEventListener('click',toggle);
 for(const type of ['pointerdown','click','keydown'])gestures.addEventListener(type,activate);
 label();
 return {
  pause(value){paused=value;apply();},
  update(state){
   if(!buffers||!engine.length||!on||paused||disposed)return;
   const m=drivingMix(state),now=ctx.currentTime;
   const voice=engineVoice(m);
   engine.forEach(({source,g,order},i)=>{smooth(source.frequency,voice.fundamental*order,.45);smooth(g.gain,voice.gains[i],.35)});
   smooth(engineFilter.frequency,voice.cutoff,.4);
   smooth(sand.g.gain,m.sand);smooth(sand.source.playbackRate,.78+Math.min(Math.abs(state.speed)*.055,.5));smooth(coast.g.gain,m.surf,.7);
   if(now>nextGull){shot(Math.random()<.5?'gull1':'gull2',.14+Math.random()*.1,(Math.random()-.5)*1.6,.94+Math.random()*.12);nextGull=now+12+Math.random()*18;}
   if(m.splash>.025&&now>nextSplash){shot(Math.random()<.5?'wave1':'wave2',m.splash, (Math.random()-.5)*.7,1.04+Math.min(Math.abs(state.speed)/11.2,1)*.22,.70);nextSplash=now+m.splashInterval+Math.random()*.12;}
   onMix(true,m.load);
  },
  dispose(){button.removeEventListener('click',toggle);for(const type of ['pointerdown','click','keydown'])gestures.removeEventListener(type,activate);disposed=true;on=false;controller.abort();for(const source of sources){try{source.stop();source.disconnect();}catch{}}sources.clear();ctx?.close().catch(()=>{});onMix(false,0);}
 };
}
