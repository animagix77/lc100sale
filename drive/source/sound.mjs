const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Audio follows wheel rotation and load, including wheelspin at zero road speed.
export function drivingMix({speed=0,tyres=[],range='HI',input={},shoreDistance=30}){
 const moving=Math.abs(speed),ground=tyres.filter(w=>w.contact),wheel=tyres.length?tyres.reduce((sum,w)=>sum+Math.abs(w.omega||0),0)/tyres.length:0;
 const slip=Math.max(0,...ground.map(w=>w.slip||0)),soft=ground.length?ground.reduce((s,w)=>s+(w.soft||0),0)/ground.length:0;
 const throttle=input.brake?0:input.gas||input.reverse?1:input.cruise?.38:0;
 // Continuous cruising curve avoids hunting at artificial speed-based gear boundaries.
 const rolling=range==='LO'?wheel*9.5493*22:moving*155;
 const wheelspin=Math.max(0,wheel*.45-moving);
 const rpm=clamp(720+rolling+Math.sqrt(wheelspin)*260+throttle*260,720,4200);
 const load=clamp(throttle*.72+slip*.06,0,1),wet=clamp((7-shoreDistance)/5,0,1);
 const work=ground.length?clamp(moving*.12+slip*.13,0,1):0;
 return {rpm,load,wet,sand:work*(1-wet)*(.25+soft*.23),splash:work*wet*.42,surf:.12+.24*Math.exp(-Math.max(0,shoreDistance)/35)};
}
export function createSound(button,focus,onMix=()=>{}){
 let ctx,master,compressor,buffers,loading,on=false,paused=false,disposed=false,engineFilter,idle,loaded,rumble,sand,coast,splash;
 let nextGull=0,nextSplash=0;const sources=new Set(),controller=new AbortController();
 const label=()=>{button.textContent=on?'Sound on':'Sound off';button.setAttribute('aria-pressed',String(on));};
 const smooth=(param,value,seconds=.12)=>param.setTargetAtTime(value,ctx.currentTime,seconds);
 function gain(value){const n=ctx.createGain();n.gain.value=value;return n;}
 function loop(name,destination,volume=0){const source=ctx.createBufferSource(),g=gain(volume);source.buffer=buffers[name];source.loop=true;source.connect(g);g.connect(destination);source.start();sources.add(source);return {source,g};}
 async function setup(){
  ctx=new AudioContext();master=gain(0);compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-8;compressor.knee.value=8;compressor.ratio.value=4;compressor.attack.value=.006;compressor.release.value=.18;master.connect(compressor);compressor.connect(ctx.destination);
  await ctx.resume();
  const names=['v8-idle','v8-load','sand','coast','gull1','gull2','wave1','wave2'];
  buffers=Object.fromEntries(await Promise.all(names.map(async name=>{const response=await fetch(`audio/${name}.m4a?v=steady-2`,{signal:controller.signal});if(!response.ok)throw new Error(name);return [name,await ctx.decodeAudioData(await response.arrayBuffer())];})));
  if(disposed)return;
  engineFilter=ctx.createBiquadFilter();engineFilter.type='lowpass';engineFilter.frequency.value=1000;engineFilter.Q.value=.5;engineFilter.connect(master);
  idle=loop('v8-idle',engineFilter,.58);loaded=loop('v8-load',engineFilter,0);
  const osc=ctx.createOscillator();osc.type='sine';osc.frequency.value=45;const g=gain(.025);osc.connect(g);g.connect(master);osc.start();sources.add(osc);rumble={source:osc,g};
  const sandFilter=ctx.createBiquadFilter();sandFilter.type='highpass';sandFilter.frequency.value=350;sandFilter.connect(master);sand=loop('sand',sandFilter);
  coast=loop('coast',master,.2);
  nextGull=ctx.currentTime+4;apply();
 }
 function apply(){if(master)smooth(master.gain,on&&!paused?.72:0,.14);if(!on||paused)onMix(false,0);}
 function shot(name,volume,pan=0,rate=1){const s=ctx.createBufferSource(),g=gain(volume),p=ctx.createStereoPanner();s.buffer=buffers[name];s.playbackRate.value=rate;p.pan.value=pan;s.connect(g);g.connect(p);p.connect(master);sources.add(s);s.onended=()=>{sources.delete(s);s.disconnect();g.disconnect();p.disconnect();};s.start();}
 button.addEventListener('click',async()=>{
  if(disposed)return;on=!on;label();focus();apply();
  if(!on)return;
  try{if(!loading){button.textContent='Loading sound…';loading=setup();}else await ctx.resume();await loading;if(!disposed){label();apply();}}
  catch{if(disposed)return;on=false;loading=null;ctx?.close().catch(()=>{});sources.clear();ctx=master=buffers=null;label();button.textContent='Retry sound';onMix(false,0);}
 });label();
 return {
  pause(value){paused=value;apply();},
  update(state){
   if(!buffers||!idle||!on||paused||disposed)return;
   const m=drivingMix(state),rev=clamp((m.rpm-680)/2500,0,1),now=ctx.currentTime;
   smooth(idle.source.playbackRate,clamp(m.rpm/900,.76,2.1),.45);
   smooth(loaded.source.playbackRate,clamp(m.rpm/1700,.65,1.8),.45);
   const blend=clamp(rev*1.5+m.load*.5,0,1);
   smooth(idle.g.gain,.60*Math.sqrt(1-blend),.4);smooth(loaded.g.gain,.66*Math.sqrt(blend),.4);
   smooth(engineFilter.frequency,900+rev*1800+m.load*800);smooth(rumble.source.frequency,m.rpm/15,.18);smooth(rumble.g.gain,.006+m.load*.005,.4);
   smooth(sand.g.gain,m.sand);smooth(sand.source.playbackRate,.78+Math.min(Math.abs(state.speed)*.055,.5));smooth(coast.g.gain,m.surf,.7);
   if(now>nextGull){shot(Math.random()<.5?'gull1':'gull2',.14+Math.random()*.1,(Math.random()-.5)*1.6,.94+Math.random()*.12);nextGull=now+12+Math.random()*18;}
   if(m.splash>.025&&now>nextSplash){shot(Math.random()<.5?'wave1':'wave2',m.splash, (Math.random()-.5)*.7,1.1+Math.random()*.25);nextSplash=now+.75+Math.random()*.6;}
   onMix(true,m.load);
  },
  dispose(){disposed=true;on=false;controller.abort();for(const source of sources){try{source.stop();source.disconnect();}catch{}}sources.clear();ctx?.close().catch(()=>{});onMix(false,0);}
 };
}
