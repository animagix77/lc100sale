// Judge Dean LLC — audible material response without phantom contacts or unbounded voices.
import assert from 'node:assert/strict';
import {terrainContactMix,terrainPCM,terrainAudioBank,TERRAIN_VOICES} from './terrain-audio.mjs';
import {VEHICLE_SETUP} from './vehicle-spec.mjs';

const zero={sand:0,snow:0,mud:0,gravel:0,wet:0,compaction:0};
const wheel=(material='sand',options={})=>({contact:true,omega:3/VEHICLE_SETUP.rollingRadius,audioLoad:6000,audioSpeed:3,audioSlip:0,sideSlip:0,wet:false,...options,audioSurface:{...zero,[material]:1,...options.audioSurface}});
const four=(material='sand',options={})=>Array.from({length:4},()=>wheel(material,options));
const mix=(tyres,options={})=>terrainContactMix({speed:3,tyres,...options});
const silent=(result,label)=>{for(const voice of Object.values(result))assert.equal(voice.gain,0,label);};
const near=(a,b,label)=>assert(Math.abs(a-b)<1e-10,`${label}: ${a} vs ${b}`);
const gains=result=>Object.fromEntries(Object.entries(result).map(([kind,voice])=>[kind,voice.gain]));

silent(terrainContactMix(),'No wheels means no terrain noise');
silent(mix(four('sand',{audioSpeed:0,audioSlip:0,omega:0})),'A parked truck is silent');
silent(mix(four('snow',{audioSpeed:.08,audioSlip:.06,sideSlip:.03,omega:.1})),'Small suspension rocking stays below the contact deadband');
silent(mix(four('sand',{contact:false,audioSpeed:12,audioSlip:9,omega:60})),'Freely spinning airborne tyres cannot shuffle terrain');
silent(mix(four('gravel',{audioLoad:0,audioSpeed:9,audioSlip:4})),'An unloaded tyre produces no grit');
silent(mix(four('sand',{audioSurface:zero,audioSpeed:7,audioSlip:4})),'Boards and solid decks suppress loose material beneath their contacts');

const sand=mix(four()),snow=mix(four('snow')),mud=mix(four('mud')),gravel=mix(four('gravel'));
assert(sand.sand.gain>.15&&sand.sand.gain<.20,'Normal sand travel has an audible, bounded shuffle bed');
assert(snow.snow.gain>0&&snow.slush.gain>0,'Snow carries a crunch with a smaller compressed body');
assert(snow.slush.gain<snow.snow.gain*.3,'Dry snow remains predominantly crunchy');
assert.equal(snow.sand.gain,0,'Soft snow never inherits the sand voice');
assert.equal(mud.sand.gain,0,'Mud never inherits the sand voice');
assert(mud.slush.gain>0&&gravel.gravel.gain>0,'Mud and loose mineral surfaces have independent voices');
for(const kind of ['snow','slush','gravel'])assert.equal(sand[kind].gain,0,'Pure sand does not layer unrelated materials');

const fast=mix(four('sand',{audioSpeed:9,omega:9/VEHICLE_SETUP.rollingRadius}));
const light=mix(four('sand',{audioLoad:1500})),heavy=mix(four('sand',{audioLoad:10000}));
assert(sand.sand.cutoff<1200&&fast.sand.cutoff<=1400,'Even at speed the sand texture stays muffled');
assert(fast.sand.gain>sand.sand.gain&&fast.sand.rate>sand.sand.rate,'Faster travel increases texture activity without discrete gear thresholds');
assert(light.sand.gain<sand.sand.gain&&heavy.sand.gain>sand.sand.gain,'Real contact load changes material intensity');
assert(mix(four('sand',{audioSurface:{compaction:1}})).sand.gain<sand.sand.gain,'Compacted wheel tracks shuffle less than loose shoulders');
const spin=mix(four('sand',{audioSpeed:0,omega:12,audioSlip:4}),{speed:0});
const lateral=mix(four('sand',{audioSpeed:0,omega:0,audioSlip:0,sideSlip:3}),{speed:0});
assert(spin.sand.gain>.1,'Grounded wheelspin agitates sand even with zero chassis speed');
assert(lateral.sand.gain>.1,'Sideways tyre scrub moves sand without throttle');
assert.deepEqual(mix(four('sand',{audioSpeed:-3,omega:-3/VEHICLE_SETUP.rollingRadius}),{speed:-3}),sand,'Reverse travel has the same contact response');
assert(mix(four('sand',{audioSpeed:0,omega:0}),{speed:18}).sand.gain===0,'Contact-relative speed overrides body speed, including riding a moving support');

const mixed=mix([...four().slice(0,2),...four('snow').slice(0,2)]);
near(mixed.sand.gain,sand.sand.gain/2,'Two sand tyres preserve half the sand bed');
near(mixed.snow.gain,snow.snow.gain/2,'Two snow tyres preserve half the snow bed');
near(mixed.slush.gain,snow.slush.gain/2,'Snow body follows its actual contact fraction');
near(mix([wheel()]).sand.gain,sand.sand.gain/4,'One loaded contact cannot impersonate four');
let prior=sand.sand.gain;
for(let step=1;step<=20;step++){
 const blend=step/20,r=mix(four('sand',{audioSurface:{sand:1-blend,snow:blend}}));
 near(r.sand.gain,sand.sand.gain*(1-blend),'Material boundaries blend continuously');
 near(r.snow.gain,snow.snow.gain*blend,'Snow grows with coverage');
 assert(r.sand.gain<=prior);prior=r.sand.gain;
}

const wetSnow=mix(four('snow',{audioSurface:{wet:1}}));
assert(wetSnow.snow.gain<snow.snow.gain&&wetSnow.slush.gain>snow.slush.gain*4,'Wet snow shifts from brittle crunch toward slush');
const rainySnow=mix(four('snow'),{rain:1});
assert(rainySnow.slush.gain>snow.slush.gain&&rainySnow.snow.gain<snow.snow.gain,'Live precipitation softens the snow texture');
const shallow=mix(four('sand',{wet:true,audioSurface:{wet:1}}),{waterContact:1,waterDepth:.04});
const deep=mix(four('sand',{wet:true,audioSurface:{wet:1}}),{waterContact:1,waterDepth:.8});
assert(deep.sand.gain<shallow.sand.gain*.2,'Immersion yields to the existing water wash');
assert.deepEqual(mix(four(),{waterContact:1,waterDepth:.8}),sand,'A global water fraction cannot mute explicitly dry tyre contacts');
const threeDry=mix([...four().slice(0,3),wheel('sand',{wet:true,audioSurface:{wet:1}})],{waterContact:.25,waterDepth:.8});
assert(threeDry.sand.gain>sand.sand.gain*.75&&threeDry.sand.gain<sand.sand.gain,'One wet tyre only attenuates its own contribution');

const immutable=four('snow').map(w=>Object.freeze({...w,audioSurface:Object.freeze(w.audioSurface)}));
assert.deepEqual(gains(mix(Object.freeze(immutable))),gains(snow),'Mixing never changes simulation records');
for(const material of ['sand','snow','mud','gravel'])for(const speed of [0,.1,.5,3,12,50]){
 const result=mix(four(material,{audioSpeed:speed,audioSlip:speed,sideSlip:speed,audioLoad:1e6}));
 for(const voice of Object.values(result)){
  assert(Number.isFinite(voice.gain)&&voice.gain>=0&&voice.gain<=.68,'High loads and speeds cannot produce runaway levels');
  assert(Number.isFinite(voice.rate)&&voice.rate>=.7&&voice.rate<=1.25,'Pitch/activity remains restrained');
  assert(Number.isFinite(voice.cutoff)&&voice.cutoff>=1000&&voice.cutoff<=4000,'Material filters avoid harsh unbounded brightness');
 }
}

function measure(pcm,rate){
 let power=0,low=0,lowPower=0,highPower=0,peak=0,mean=0;const blend=1-Math.exp(-2*Math.PI*500/rate);
 for(const sample of pcm){assert(Number.isFinite(sample),'PCM contains no invalid samples');mean+=sample;power+=sample*sample;peak=Math.max(peak,Math.abs(sample));low+=(sample-low)*blend;lowPower+=low*low;highPower+=(sample-low)**2;}
 return {rms:Math.sqrt(power/pcm.length),peak,mean:mean/pcm.length,highFraction:highPower/(lowPower+highPower)};
}
const spectra={};
for(const rate of [24000,48000])for(const kind of TERRAIN_VOICES){
 const left=terrainPCM(kind,rate,0),right=terrainPCM(kind,rate,1),stats=measure(left,rate),other=measure(right,rate);
 assert.equal(left.length,rate*4,'Prepared loops retain a fixed four-second memory footprint');
 for(const channel of [left,right]){assert.equal(Math.abs(channel[0]),0);assert.equal(Math.abs(channel.at(-1)),0,'The loop seam has no waveform discontinuity');}
 assert(stats.rms>.15&&stats.rms<.22&&other.rms>.15&&other.rms<.22,'All materials have controlled usable energy');
 assert(stats.peak<=.850001&&other.peak<=.850001,'PCM retains headroom before engine and effects mixing');
 assert(Math.abs(stats.mean)<.01&&Math.abs(other.mean)<.01,'Continuous loops carry no meaningful DC offset');
 assert.deepEqual(terrainPCM(kind,rate,0),left,'Prepared textures are deterministic');
 let dot=0,powerL=0,powerR=0;for(let i=0;i<left.length;i++){dot+=left[i]*right[i];powerL+=left[i]**2;powerR+=right[i]**2;}
 assert(Math.abs(dot/Math.sqrt(powerL*powerR))<.15,'Independent channels create diffuse contact texture');
 spectra[`${rate}:${kind}`]=stats;
}
for(const rate of [24000,48000]){
 assert(spectra[`${rate}:snow`].highFraction>spectra[`${rate}:slush`].highFraction*1.7,'Snow fractures are brighter than muffled wet slush');
 assert(spectra[`${rate}:sand`].highFraction<spectra[`${rate}:snow`].highFraction,'Sand shuffle stays softer than crystalline snow');
}
assert.throws(()=>terrainPCM('wood',24000),/Unknown terrain voice/,'Unsupported solid contacts never silently become dirt');

let buffers=0,bytes=0;
const ctx={sampleRate:48000,createBuffer(channels,length,sampleRate){buffers++;bytes+=channels*length*4;assert.equal(channels,2);assert.equal(sampleRate,this.sampleRate);const data=Array.from({length:channels},()=>new Float32Array(length));return {numberOfChannels:channels,length,sampleRate,getChannelData:c=>data[c]};}};
const bank=terrainAudioBank(ctx);
assert.equal(buffers,4,'One fixed stereo loop per material is prepared');
assert.deepEqual(Object.keys(bank),TERRAIN_VOICES.map(kind=>`terrain-${kind}`));
assert(bytes<=8*1024*1024,'The complete terrain bank stays below eight MiB');
for(let i=0;i<1200;i++)mix(four('sand'),{speed:i%15});
assert.equal(buffers,4,'Driving mix never synthesizes another buffer');
console.log('Terrain foley: load, contact, wheelspin, side scrub, mixed materials, wetness, immersion, reverse, stationary deadband, PCM seams/levels/stereo and bounded preparation passed.',{bytes,spectra});
