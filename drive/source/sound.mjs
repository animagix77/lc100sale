import {impactBank} from './impact-audio.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Audio follows wheel rotation and load, including wheelspin at zero road speed.
export function drivingMix({speed=0,tyres=[],range='HI',input={},shoreDistance=30,waterContact,waterDepth,rain=0}){
 const moving=Math.abs(speed),ground=tyres.filter(w=>w.contact),wheel=tyres.length?tyres.reduce((sum,w)=>sum+Math.abs(w.omega||0),0)/tyres.length:0;
 const slip=Math.max(0,...ground.map(w=>w.slip||0)),soft=ground.length?ground.reduce((s,w)=>s+(w.soft||0),0)/ground.length:0;
 const throttle=input.brake||input.handbrake?0:clamp(Number(input.gas)||Number(input.reverse)|| (input.cruise?.38:0),0,1);
 // Continuous cruising curve avoids hunting at artificial speed-based gear boundaries.
 const rolling=range==='LO'?wheel*9.5493*22:moving*155;
 const wheelspin=Math.max(0,wheel*.45-moving);
 const rpm=clamp(720+rolling+Math.sqrt(wheelspin)*260+throttle*260,720,4200);
 const load=clamp(throttle*.72+slip*.06,0,1),wet=clamp(waterContact??(7-shoreDistance)/5,0,1);
 const grass=ground.reduce((sum,w)=>sum+(w.grass||0),0)/4;
 const wetRock=ground.reduce((sum,w)=>sum+(w.rock||0)*Math.max(w.wet?1:0,clamp(rain,0,1)*.7)*clamp((Math.max(w.slip||0,w.sideSlip||0)-.35)/3,0,1),0)/4;
 const work=ground.length?clamp(moving*.12+slip*.13,0,1):0;
 // Fifty mph still moves more water than twenty-five. Depth controls body and
 // volume; the narrow deadband keeps a parked truck from endlessly hissing.
 const velocity=clamp((moving-.15)/22.2,0,1),depth=clamp(waterDepth??.18,0,.8),immersion=.55+.55*Math.sqrt(depth/.8);
 const splash=ground.length?wet*velocity**.7*immersion:0,precipitation=clamp(Number(rain)||0,0,1);
 return {rpm,load,wet,grass:grass*clamp((moving-.1)/3,0,1)*.32,skid:wetRock*.22,skidRate:.85+clamp(slip/8,0,1)*.4,sand:work*(1-wet)*(.055+soft*.055),splash,splashRate:.85+velocity*.35,splashCutoff:750+velocity*3800,
  splashEntry:(.22+velocity*.94)*Math.sqrt(wet)*immersion,splashDuration:.55+velocity*.65,
  rain:precipitation**.7*.24,rainCutoff:1400+precipitation*1800,surf:.12+.24*Math.exp(-Math.max(0,shoreDistance)/35)};
}
// Hazard energy already includes distance falloff. Size gives larger landings
// more weight; distant landings also lose the bright crumble above the thud.
export function volcanicImpactMix(hit){
 if(hit.source!=='volcano'||hit.ground!==true)return null;
 const energy=clamp(Number(hit.energy)||0,0,1),size=clamp(((Number(hit.radius)||.32)-.30)/.38,0,1);
 const distance=clamp(Number(hit.distance)||0,0,60),velocity=Number.isFinite(hit.velocity)?hit.velocity:energy*24;
 const force=clamp((velocity-1.3)/8,0,1);
 return {volume:(.10+energy*.54)*(.48+size*.52)*(.2+force*.8),pan:clamp(Number(hit.pan)||0,-1,1),
  rate:1.12-size*.27,cutoff:clamp(1450-distance*23-size*300,400,1450)};
}
// Stylized muted petrol V8: four firing events per revolution, with a restrained
// upper harmonic spectrum. All partials share an exact harmonic relationship.
export function engineVoice({rpm,load}){
 const rev=clamp((rpm-720)/3480,0,1),work=clamp(load,0,1);
 return {fundamental:clamp(rpm,720,4200)/15,cutoff:520+rev*500+work*180,gains:[.105+work*.045,.034+work*.023,.010+work*.010,.004+work*.005]};
}
// Bounded, repeatable stereo texture: rain has small irregular wet impacts;
// spray has a softer turbulent body. Recorded waves supply the water wash.
// No oscillating envelope or regularly spaced bursts that resemble an engine.
export function wetPCM(kind,sampleRate=48000,seed=9271){
 const data=new Float32Array(Math.ceil(sampleRate*6)),rain=kind==='rain';let low=0,mid=0,drop=0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const lowBlend=1-Math.exp(-2*Math.PI*180/sampleRate),midBlend=1-Math.exp(-2*Math.PI*1500/sampleRate),decay=Math.exp(-1/(sampleRate*.009));
 for(let i=0;i<data.length;i++){
  const noise=random()*2-1;low+=(noise-low)*lowBlend;mid+=(noise-mid)*midBlend;
  drop*=decay;if(rain&&random()<95/sampleRate)drop=Math.min(1.8,drop+.35+random()*.7);
  const value=rain?(noise-low)*.24+mid*.4+drop*((noise-mid)*.5+mid*.6):(noise-mid)*.15+mid*.85+low*.8;
  const edge=Math.min(1,i/(sampleRate*.005),(data.length-1-i)/(sampleRate*.005));
  data[i]=Math.tanh(value)*edge;
 }return data;
}
// Six seconds of irregular foliage strokes / rubber stick-slip, with soft loop edges.
export function contactPCM(kind,sampleRate=48000){
 const data=new Float32Array(sampleRate*6);let seed=42891,low=0,envelope=0,phase=0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 for(let i=0;i<data.length;i++){
  const n=random()*2-1;low+=(n-low)*(1-Math.exp(-2*Math.PI*900/sampleRate));
  envelope*=Math.exp(-1/(sampleRate*(kind==='grass'?.065:.12)));
  if(random()<(kind==='grass'?24:13)/sampleRate)envelope=.25+random()*.75;
  phase+=2*Math.PI*(760+140*Math.sin(i/sampleRate*17)+low*110)/sampleRate;
  const value=kind==='grass'?(n-low)*envelope*.7:(Math.sin(phase)*.42+Math.sin(phase*2.07)*.13+low*.6)*(.2+envelope*.8);
  data[i]=Math.tanh(value)*Math.min(1,i/(sampleRate*.02),(data.length-1-i)/(sampleRate*.02));
 }return data;
}
function wetBank(ctx){
 const bank={};for(const kind of ['rain','spray']){const buffer=ctx.createBuffer(2,Math.ceil(ctx.sampleRate*6),ctx.sampleRate);for(let channel=0;channel<2;channel++)buffer.getChannelData(channel).set(wetPCM(kind,ctx.sampleRate,9271+channel*731));bank[kind]=buffer}for(const kind of ['grass','skid']){const buffer=ctx.createBuffer(1,ctx.sampleRate*6,ctx.sampleRate);buffer.getChannelData(0).set(contactPCM(kind,ctx.sampleRate));bank[kind]=buffer}return bank;
}
export function createSound(button,focus,onMix=()=>{},gestures=button.ownerDocument){
 let ctx,master,compressor,buffers,loading,on=true,paused=false,disposed=false,engineFilter,engine=[],sand,coast,splash,waterWash,waterSpray,waterFilter,rainBed,rainFilter,grassBed,skidBed;
 let nextGull=0,nextSplash=0,nextImpact=0,nextVolcanoImpact=0,impactVariant=0,lastWet=0;const sources=new Set(),controller=new AbortController();
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
  Object.assign(buffers,impactBank(ctx),wetBank(ctx));
  engineFilter=ctx.createBiquadFilter();engineFilter.type='lowpass';engineFilter.frequency.value=1000;engineFilter.Q.value=.5;engineFilter.connect(master);
  // A phase-aligned harmonic drone replaces the pulsed exhaust recordings.
  // No random detuning, firing bursts or amplitude LFOs: throttle changes tone,
  // not a repeating chug. RPM still follows load, wheelspin and range.
  engine=[];const start=ctx.currentTime;
  for(const order of [1,2,3,4]){const source=ctx.createOscillator(),g=gain(0);source.type='sine';source.frequency.value=48*order;source.connect(g);g.connect(engineFilter);source.start(start);sources.add(source);engine.push({source,g,order})}
  const sandFilter=ctx.createBiquadFilter();sandFilter.type='highpass';sandFilter.frequency.value=550;const gritLow=ctx.createBiquadFilter();gritLow.type='lowpass';gritLow.frequency.value=2200;sandFilter.connect(gritLow);gritLow.connect(master);sand=loop('sand',sandFilter);
  grassBed=loop('grass',master);skidBed=loop('skid',master);
  coast=loop('coast',master,.2);
  const washFilter=ctx.createBiquadFilter();washFilter.type='lowpass';washFilter.frequency.value=1700;washFilter.Q.value=.4;washFilter.connect(master);waterWash=loop('wave2',washFilter);
  waterFilter=ctx.createBiquadFilter();waterFilter.type='lowpass';waterFilter.frequency.value=750;waterFilter.Q.value=.4;waterFilter.connect(master);waterSpray=loop('spray',waterFilter);
  rainFilter=ctx.createBiquadFilter();rainFilter.type='lowpass';rainFilter.frequency.value=1800;rainFilter.Q.value=.4;rainFilter.connect(master);rainBed=loop('rain',rainFilter);
  nextGull=ctx.currentTime+4;apply();
 }
 function stopSplash(){if(!splash)return;smooth(splash.g.gain,0,.025);try{splash.source.stop(ctx.currentTime+.12)}catch{}splash=null;}
 function quietWeather(){if(waterWash)smooth(waterWash.g.gain,0,.05);if(waterSpray)smooth(waterSpray.g.gain,0,.05);if(rainBed)smooth(rainBed.g.gain,0,.12);stopSplash();}
 function apply(){if(master)smooth(master.gain,on&&!paused?.72:0,.14);if(!on||paused){quietWeather();onMix(false,0);}}
 function shot(name,volume,pan=0,rate=1,duration=0,cutoff=0){const s=ctx.createBufferSource(),g=gain(volume),p=ctx.createStereoPanner(),filter=cutoff?ctx.createBiquadFilter():null;s.buffer=buffers[name];s.playbackRate.value=rate;p.pan.value=pan;s.connect(g);if(filter){filter.type='lowpass';filter.frequency.value=cutoff;filter.Q.value=.45;g.connect(filter);filter.connect(p)}else g.connect(p);p.connect(master);sources.add(s);s.onended=()=>{sources.delete(s);s.disconnect();g.disconnect();filter?.disconnect();p.disconnect();if(splash?.source===s)splash=null;};
  if(duration){const now=ctx.currentTime;g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(volume,now+.035);g.gain.setValueAtTime(volume,now+duration*.55);g.gain.linearRampToValueAtTime(0,now+duration);s.start(now,.25,duration*rate);s.stop(now+duration+.02);}else s.start();
  return {source:s,g};
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
   smooth(grassBed.g.gain,m.grass,.09);smooth(skidBed.g.gain,m.skid,.06);smooth(skidBed.source.playbackRate,m.skidRate,.15);
   smooth(sand.g.gain,m.sand);smooth(sand.source.playbackRate,.78+Math.min(Math.abs(state.speed)*.055,.5));smooth(coast.g.gain,m.surf,.7);
   if(state.shoreDistance<100&&now>nextGull){shot(Math.random()<.5?'gull1':'gull2',.14+Math.random()*.1,(Math.random()-.5)*1.6,.94+Math.random()*.12);nextGull=now+12+Math.random()*18;}
   // Both layers stay running at zero gain on land, so a long river crossing
   // stays continuous and does not allocate a new voice every few frames.
   smooth(waterWash.g.gain,m.splash*.72,m.splash? .16:.05);smooth(waterWash.source.playbackRate,m.splashRate,.3);
   smooth(waterSpray.g.gain,m.splash*.7,m.splash? .13:.05);smooth(waterFilter.frequency,m.splashCutoff,.18);
   smooth(rainBed.g.gain,m.rain,1.2);smooth(rainFilter.frequency,m.rainCutoff,1);
   if(!m.splash)stopSplash();
   else if(m.wet-lastWet>.18&&now>=nextSplash){stopSplash();splash=shot('wave1',m.splashEntry,(Math.random()-.5)*.45,m.splashRate,m.splashDuration);nextSplash=now+.65;}
   lastWet=m.wet;
   if(state.impacts?.length){
    const contacts=state.impacts.filter(hit=>hit.source!=='volcano'||hit.ground!==true);
    if(contacts.length&&now>=nextImpact){const hit=contacts.reduce((a,b)=>a.energy>b.energy?a:b);const kind=['wood','rock','suspension'].includes(hit.kind)?hit.kind:'suspension';shot(kind+(impactVariant++%3),.14+clamp(hit.energy,0,1)*.46,hit.pan||0,.94+Math.random()*.12);nextImpact=now+.07;}
    // Landings have their own short throttle, so a rockfall cannot suppress the
    // truck's contact sounds or pile up a new bass voice on every contact frame.
    if(now>=nextVolcanoImpact){
     let landing;for(const hit of state.impacts){const voice=volcanicImpactMix(hit);if(voice&&voice.volume>(landing?.volume??.025))landing=voice;}
     if(landing){shot('volcano'+(impactVariant++%3),landing.volume,landing.pan,landing.rate*(.97+Math.random()*.06),0,landing.cutoff);nextVolcanoImpact=now+.26;}
    }
   }
   onMix(true,m.load);
  },
  dispose(){button.removeEventListener('click',toggle);for(const type of ['pointerdown','click','keydown'])gestures.removeEventListener(type,activate);disposed=true;on=false;controller.abort();for(const source of sources){try{source.stop();source.disconnect();}catch{}}sources.clear();ctx?.close().catch(()=>{});onMix(false,0);}
 };
}
