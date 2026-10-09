import assert from 'node:assert/strict';
import {drivingMix,createSound,engineVoice,wetPCM,volcanicImpactMix} from './sound.mjs';
import {volcanicThudPCM} from './impact-audio.mjs';
const tyre={contact:true,omega:6,slip:0,soft:.7};
const dry=drivingMix({speed:3,tyres:[tyre],input:{gas:true},shoreDistance:35});
assert(dry.sand<.05,'Rolling sand remains quiet under the engine');
const gentle=drivingMix({speed:3,tyres:[tyre],input:{gas:.25}});
assert(gentle.load<dry.load&&gentle.rpm<dry.rpm,'The engine follows proportional joystick throttle');
assert.equal(drivingMix({input:{gas:1,handbrake:true}}).load,0,'Holding the handbrake cuts engine load');
const wet=drivingMix({speed:3,tyres:[tyre],input:{gas:true},shoreDistance:2});
const slowSplash=drivingMix({speed:1,tyres:[tyre],waterContact:1}),fastSplash=drivingMix({speed:10,tyres:[tyre],waterContact:1});
assert(fastSplash.splash>slowSplash.splash&&fastSplash.splashCutoff>slowSplash.splashCutoff,'Water sound grows louder and brighter with speed');
const highwaySplash=drivingMix({speed:22.35,tyres:[tyre],waterContact:1,waterDepth:.45});
const halfSpeedSplash=drivingMix({speed:11.2,tyres:[tyre],waterContact:1,waterDepth:.45});
assert(highwaySplash.splash>halfSpeedSplash.splash*1.5,'A fifty mph crossing keeps building beyond twenty-five mph');
assert(highwaySplash.splashEntry>halfSpeedSplash.splashEntry&&highwaySplash.splashDuration>halfSpeedSplash.splashDuration,'Fast entries make a bigger, longer initial splash');
assert(highwaySplash.splash>drivingMix({speed:22.35,tyres:[tyre],waterContact:1,waterDepth:.04}).splash,'Deeper water produces a fuller rushing wash');
assert.equal(drivingMix({speed:.1,tyres:[tyre],waterContact:1}).splash,0,'Stationary drift does not generate a constant hiss');
assert.equal(drivingMix({speed:22,tyres:[{...tyre,contact:false}],waterContact:1}).splash,0,'Airborne wheels do not create a continuing wash');
assert.equal(drivingMix({speed:-22.35,tyres:[tyre],waterContact:1,waterDepth:.45}).splash,highwaySplash.splash,'Reverse crossings use the same water response');
const drizzle=drivingMix({rain:.15}),storm=drivingMix({rain:1});
assert(drizzle.rain>0&&storm.rain>drizzle.rain&&storm.rainCutoff>drizzle.rainCutoff,'Live precipitation changes rain volume and brightness even while parked');
assert.equal(drivingMix({rain:0}).rain,0);assert.equal(drivingMix({rain:-1}).rain,0);assert.equal(drivingMix({rain:5}).rain,storm.rain);
for(const kind of ['rain','spray']){
 const pcm=wetPCM(kind,24000),otherChannel=wetPCM(kind,24000,10002);let power=0,correlation=0,otherPower=0;
 assert.equal(pcm.length,6*24000,'Ambient texture memory remains bounded');assert.equal(pcm[0],0);assert.equal(Math.abs(pcm.at(-1)),0,'Loop boundaries do not click');
 for(let i=0;i<pcm.length;i++){assert(Number.isFinite(pcm[i])&&Math.abs(pcm[i])<1,'Generated audio never clips or contains invalid samples');power+=pcm[i]**2;otherPower+=otherChannel[i]**2;correlation+=pcm[i]*otherChannel[i]}
 assert(Math.sqrt(power/pcm.length)>.08,'The sound texture contains audible energy');
 assert(Math.abs(correlation/Math.sqrt(power*otherPower))<.1,'Independent stereo rain and spray channels avoid a centered mono hiss');
}
// A landing is a short bass-heavy impact, with a quiet finite tail and no
// clipping or sample-rate-dependent pitch. It is not another bright stone click.
for(const sampleRate of [24000,48000])for(let variant=0;variant<3;variant++){
 const pcm=volcanicThudPCM(sampleRate,variant),blend=1-Math.exp(-2*Math.PI*180/sampleRate);let low=0,lowPower=0,highPower=0,early=0,late=0;
 assert.equal(pcm.length,Math.ceil(sampleRate*.62));assert.equal(Math.abs(pcm[0]),0);assert.equal(Math.abs(pcm.at(-1)),0);
 for(let i=0;i<pcm.length;i++){
  const x=pcm[i],t=i/sampleRate;assert(Number.isFinite(x)&&Math.abs(x)<.9,'Landing PCM stays finite without clipping');
  low+=(x-low)*blend;lowPower+=low*low;highPower+=(x-low)**2;if(t>=.015&&t<.095)early+=x*x;if(t>=.45&&t<.60)late+=x*x;
 }
 assert(lowPower>highPower*7,'The thud carries much more low-frequency weight than gritty hiss');
 assert(Math.sqrt(early/(sampleRate*.08))>.24,'The initial hit has audible body');
 assert(late/(sampleRate*.15)<early/(sampleRate*.08)*.005,'The crumble fades promptly instead of forming a continuous rumble');
}
const landing={kind:'rock',source:'volcano',ground:true,energy:.7,radius:.66,distance:7,velocity:19,pan:-.5};
const landingMix=volcanicImpactMix(landing),smallLandingMix=volcanicImpactMix({...landing,radius:.32}),distantLandingMix=volcanicImpactMix({...landing,energy:.12,distance:32});
assert(landingMix.volume>smallLandingMix.volume*1.8&&landingMix.rate<smallLandingMix.rate,'Large rocks sound heavier and deeper than small ones');
assert(distantLandingMix.volume<landingMix.volume*.4&&distantLandingMix.cutoff<landingMix.cutoff,'Distance-attenuated events become quieter and less sharp');
assert(volcanicImpactMix({...landing,velocity:1.4}).volume<landingMix.volume*.25,'Tiny settling contacts stay quiet');
assert.equal(volcanicImpactMix({...landing,ground:false}),null,'A falling rock hitting the chassis keeps ordinary rock-contact foley');
assert.equal(volcanicImpactMix({kind:'suspension',energy:1}),null,'Suspension hits never route into volcanic bass');
assert.equal(drivingMix({speed:10,tyres:[tyre],shoreDistance:0,waterContact:0}).splash,0,'No water contact means no splash, even near shore');
assert.equal(drivingMix({speed:0,tyres:[tyre],waterContact:1}).splash,0,'Parked wheels make no splash');
assert(dry.sand>0&&dry.splash===0);assert(wet.sand===0&&wet.splash>0&&wet.surf>dry.surf);
const spin=drivingMix({tyres:[{...tyre,omega:12,slip:4}],input:{gas:true}});
assert(spin.rpm>dry.rpm&&spin.sand>0,'Wheelspin at rest must drive engine and tire sound');
assert(drivingMix({speed:2,tyres:[tyre],range:'LO'}).rpm>drivingMix({speed:2,tyres:[tyre],range:'HI'}).rpm);
assert.equal(drivingMix({speed:4,tyres:[{...tyre,contact:false}]}).sand,0);
for(const threshold of [2.6,5]){const before=drivingMix({speed:threshold-.01,tyres:[tyre]}),after=drivingMix({speed:threshold+.01,tyres:[tyre]});assert(Math.abs(after.rpm-before.rpm)<10,'No pitch hunting around old gear thresholds')}
assert.equal(drivingMix({speed:-3,tyres:[tyre]}).sand,drivingMix({speed:3,tyres:[tyre]}).sand);
class Param{value=0;automation=[];setValueAtTime(v,time){this.value=v;this.automation.push({kind:'set',value:v,time})}linearRampToValueAtTime(v,time){this.value=v;this.automation.push({kind:'ramp',value:v,time})}setTargetAtTime(v,time,seconds){assert(Number.isFinite(v));this.value=v;this.automation.push({kind:'target',value:v,time,seconds})}}
class Node{gain=new Param();frequency=new Param();Q=new Param();playbackRate=new Param();pan=new Param();threshold=new Param();knee=new Param();ratio=new Param();attack=new Param();release=new Param();connections=[];connect(node){this.connections.push(node);return node}disconnect(){this.disconnected=true}start(...args){this.started=true;this.startArgs=args}stop(time){this.stopped=true;this.stopTime=time}}
let context,requests=0,contexts=0;const urls=[];
globalThis.AudioContext=class{currentTime=0;sampleRate=48000;createBuffer(channels,length){const data=Array.from({length:channels},()=>new Float32Array(length));return {duration:length/this.sampleRate,numberOfChannels:channels,getChannelData:channel=>data[channel]}}destination=new Node();nodes=[];constructor(){context=this;contexts++}node(){const n=new Node();this.nodes.push(n);return n}createGain(){return this.node()}createDynamicsCompressor(){return this.node()}createBiquadFilter(){return this.node()}createOscillator(){return this.node()}createBufferSource(){return this.node()}createStereoPanner(){return this.node()}async resume(){}async decodeAudioData(data){return {duration:5,name:data.name}}async close(){this.closed=true}};
globalThis.fetch=async(url)=>{requests++;urls.push(url);return {ok:true,arrayBuffer:async()=>({name:url.match(/audio\/([^/]+)\.m4a/)[1]})}};
class Events{
 handlers=new Map();
 addEventListener(type,fn){this.handlers.set(type,fn)}
 removeEventListener(type,fn){if(this.handlers.get(type)===fn)this.handlers.delete(type)}
 async emit(type,event={}){await this.handlers.get(type)?.({target:{},...event})}
}
function controls(){const gestures=new Events(),button=Object.assign(new Events(),{textContent:'',attrs:{},setAttribute(k,v){this.attrs[k]=v},contains(target){return target===this},click(){return this.emit('click')},ownerDocument:gestures});return {button,gestures}}
const {button,gestures}=controls();
let mix;const sound=createSound(button,()=>{},(...v)=>mix=v);
assert.equal(button.textContent,'Sound on');assert.equal(button.attrs['aria-pressed'],'true');
sound.update({speed:0,impacts:[landing]});assert.equal(requests,0,'Volcanic events do not unlock or download audio');
assert.equal(requests,0,'No audio download until an interaction');assert.equal(contexts,0,'Rain and water do not create an audio context before a user gesture');
await gestures.emit('keydown',{ctrlKey:true});assert.equal(requests,0,'Browser shortcuts do not unlock audio');
await Promise.all([gestures.emit('pointerdown'),gestures.emit('keydown')]);assert.equal(requests,6);assert.equal(button.textContent,'Sound on');assert(urls.every(url=>!url.includes('v8-')),'Puttering engine recordings are not loaded');
const loops=context.nodes.filter(node=>node.loop),wash=loops.find(node=>node.buffer.name==='wave2'),spray=loops.find(node=>node.buffer.numberOfChannels===2&&node.connections[0].connections[0].frequency.value===750),rain=loops.find(node=>node.buffer.numberOfChannels===2&&node.connections[0].connections[0].frequency.value===4000);
assert(wash&&spray&&rain,'Water wash, stereo spray, and stereo rain have persistent voices');
const washGain=wash.connections[0].gain,sprayGain=spray.connections[0].gain,rainGain=rain.connections[0].gain;
assert.equal(washGain.value,0);assert.equal(sprayGain.value,0);assert.equal(rainGain.value,0,'Weather is silent until actual game state arrives');
const oscillators=context.nodes.filter(n=>n.type==='sine');assert.equal(oscillators.length,4,'Four continuous harmonic voices replace exhaust pulses');
sound.update({speed:3,tyres:[tyre],input:{gas:true}});assert.equal(mix[0],true);const voice=engineVoice(dry);assert(voice.gains.every(g=>g>0&&g<.2));for(let i=1;i<4;i++)assert(Math.abs(oscillators[i].frequency.value/oscillators[0].frequency.value-(i+1))<1e-9,'Exact harmonics avoid beating');
const stable=oscillators.map(n=>n.frequency.value);sound.update({speed:3,tyres:[tyre],input:{gas:true}});assert.deepEqual(oscillators.map(n=>n.frequency.value),stable,'Steady throttle does not modulate the drone');
context.currentTime=1;
const river={speed:11.2,tyres:[tyre],waterContact:1,waterDepth:.45,shoreDistance:200,rain:.2};sound.update(river);
const slowWash=washGain.value,slowSpray=sprayGain.value,lightRain=rainGain.value;
assert(slowWash>0&&slowSpray>0&&lightRain>0,'Moving through water produces continuous wash and spray during rain');
let entry=context.nodes.filter(node=>node.started&&!node.loop&&node.buffer?.name==='wave1').at(-1);
assert(entry,'Crossing the wet edge triggers an entry splash');
const sourcesAfterEntry=context.nodes.filter(node=>node.started).length;
for(let frame=0;frame<120;frame++){context.currentTime+=1/60;sound.update({...river,speed:22.35,rain:1})}
assert(washGain.value>slowWash*1.5&&sprayGain.value>slowSpray*1.5,'Both continuous water layers grow through fifty mph');
assert(rainGain.value>lightRain,'A live weather change increases rain');
assert.equal(context.nodes.filter(node=>node.started).length,sourcesAfterEntry,'A sustained river crossing does not keep spawning splash snippets');
sound.update({...river,speed:0});assert.equal(washGain.value,0);assert.equal(sprayGain.value,0);assert(entry.stopTime<=context.currentTime+.121,'Stopping fades and ends any splash tail');
sound.update({...river,waterContact:0,rain:0});assert.equal(washGain.value,0);assert.equal(sprayGain.value,0);assert.equal(rainGain.value,0);
assert(rainGain.automation.at(-1).seconds>=.5,'Rain fades smoothly when precipitation stops');
assert(washGain.automation.at(-1).seconds<=.1,'Water clears promptly after driving onto land');
context.currentTime+=1;sound.update({...river,speed:22.35,rain:1});
entry=context.nodes.filter(node=>node.started&&!node.loop&&node.buffer?.name==='wave1').at(-1);
const volcanicShots=()=>context.nodes.filter(node=>node.started&&!node.loop&&node.buffer?.duration===.62);
const ordinaryShots=()=>context.nodes.filter(node=>node.started&&!node.loop&&Math.abs((node.buffer?.duration??0)-.34)<.0001);
const ordinaryBefore=ordinaryShots().length;
sound.update({speed:3,tyres:[tyre],impacts:[{...landing,radius:.32,energy:.2},landing,{kind:'rock',energy:.6,pan:.5}]});
assert.equal(volcanicShots().length,1,'A burst of falling rocks selects a single strongest landing');
assert.equal(ordinaryShots().length,ordinaryBefore+1,'A simultaneous truck collision is heard independently of the ground thud');
const firstThud=volcanicShots()[0],thudGain=firstThud.connections[0],thudFilter=thudGain.connections[0],thudPan=thudFilter.connections[0];
assert.equal(thudGain.gain.value,landingMix.volume);assert.equal(thudFilter.type,'lowpass');assert.equal(thudFilter.frequency.value,landingMix.cutoff);assert.equal(thudPan.pan.value,-.5);assert.equal(thudPan.connections[0],context.nodes[0],'Volcanic shots use the normal master mute and compressor path');
for(let frame=0;frame<12;frame++){context.currentTime+=1/60;sound.update({speed:0,impacts:[landing]});}
assert.equal(volcanicShots().length,1,'Repeated contacts cannot allocate a thud every frame');
context.currentTime+=.08;sound.update({speed:0,impacts:[{...landing,energy:.12,distance:32}]});
assert.equal(volcanicShots().length,2,'A later landing can be heard after the bounded cooldown');
assert(volcanicShots()[1].connections[0].gain.value<thudGain.gain.value*.4);
firstThud.onended();assert(firstThud.disconnected&&thudGain.disconnected&&thudFilter.disconnected&&thudPan.disconnected,'Completed landing voices release every transient node');
const beforeImpact=context.nodes.length;sound.update({speed:3,tyres:[tyre],impacts:[{kind:'wood',energy:.8,pan:-.6}]});assert(context.nodes.length>beforeImpact,'Obstacle contact plays its own one-shot');sound.pause(true);assert.equal(context.nodes[0].gain.value,0);assert.deepEqual(mix,[false,0]);
assert.equal(washGain.value,0);assert.equal(sprayGain.value,0);assert.equal(rainGain.value,0,'Pause also clears weather gains');
const voicesBeforePause=context.nodes.length;sound.update({...river,rain:1,impacts:[landing]});assert.equal(context.nodes.length,voicesBeforePause,'Paused updates do not play water or volcanic impacts');assert.equal(rainGain.value,0);
sound.pause(false);assert.equal(context.nodes[0].gain.value,.72);assert.equal(rainGain.value,0,'Resume waits for current weather instead of replaying stale rain');
context.currentTime=10;sound.update({speed:3,tyres:[tyre],shoreDistance:2,input:{gas:true},rain:1});
assert(context.nodes.filter(n=>n.started).length>=7,'Gull and splash one-shots play');
await button.click();assert.equal(context.nodes[0].gain.value,0);assert.equal(button.attrs['aria-pressed'],'false');assert.equal(rainGain.value,0);assert.equal(washGain.value,0);assert.equal(sprayGain.value,0);const mutedVoices=context.nodes.length;sound.update({...river,rain:1,impacts:[landing]});assert.equal(context.nodes.length,mutedVoices,'Muted rockfalls allocate no voices');assert.equal(rainGain.value,0,'Live rain never overrides mute');
await gestures.emit('keydown');assert.equal(context.nodes[0].gain.value,0,'Driving never overrides mute');
await button.click();assert.equal(requests,6,'Re-enable reuses decoded audio');sound.dispose();assert.equal(gestures.handlers.size,0);assert.equal(button.handlers.size,0);assert(context.closed);assert(context.nodes.filter(n=>n.started).every(n=>n.stopped||n.disconnected));
// Muting before the first drive gesture must neither fetch nor create a context.
const early=controls(),earlySound=createSound(early.button,()=>{});const before=requests;
await early.gestures.emit('pointerdown',{target:early.button});await early.button.click();
await early.gestures.emit('keydown');assert.equal(requests,before);assert.equal(early.button.textContent,'Sound off');
earlySound.dispose();
// Pause blocks the initial unlock until a later active-game gesture.
const paused=controls(),pausedSound=createSound(paused.button,()=>{});pausedSound.pause(true);
await paused.gestures.emit('pointerdown');assert.equal(requests,before);
pausedSound.pause(false);await paused.gestures.emit('click');assert.equal(requests,before+6);pausedSound.dispose();
// An in-flight load must not undo a mute, and remains a single setup.
const pending=controls(),pendingSound=createSound(pending.button,()=>{});
const ready=pending.gestures.emit('pointerdown');await pending.button.click();await ready;
assert.equal(pending.button.textContent,'Sound off');assert.equal(context.nodes[0].gain.value,0);pendingSound.dispose();
// A failed unlock exposes a retry without repeated fetches on every keypress.
const realFetch=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('offline')};
const retry=controls(),retrySound=createSound(retry.button,()=>{});await retry.gestures.emit('keydown');
assert.equal(retry.button.textContent,'Retry sound');globalThis.fetch=realFetch;
await retry.gestures.emit('keydown');assert.equal(retry.button.textContent,'Retry sound');
await retry.button.click();assert.equal(retry.button.textContent,'Sound on');retrySound.dispose();
console.log('Audio tests passed: default-on gesture unlock, concurrent activation, early/pending mute, pause, retry, cleanup, unchanged engine, continuous speed/depth water, entry splashes, live stereo rain, and bounded size/distance-aware volcanic landing thuds.');
