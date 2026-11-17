// Judge Dean LLC — natural wave timing, spatial falloff and bounded surf mixing.
import assert from 'node:assert/strict';
import {oceanSurfMix} from './ocean-surf-audio.mjs';
import {oceanWavePhase,OCEAN_PRIMARY_WAVE} from './ocean-wave-profile.mjs';
const TAU=Math.PI*2,period=OCEAN_PRIMARY_WAVE.period;
const atCycle=cycle=>((cycle*TAU-Math.PI/2-8*.24)%TAU+TAU)%TAU/.82;
const crest=oceanSurfMix({time:atCycle(.025),distance:0});
const wash=oceanSurfMix({time:atCycle(.25),distance:0});
const retreat=oceanSurfMix({time:atCycle(.70),distance:0});
const gap=oceanSurfMix({time:atCycle(.81),distance:0});
assert(crest.breaker>.18&&crest.breaker>crest.wash*5,'A breaking crest carries the fuller rolling wave');
assert(wash.wash>.10&&wash.wash>wash.breaker*4,'A softer wash follows the crest instead of sounding simultaneously');
assert(retreat.wash>0&&retreat.wash<wash.wash*.3,'Backwash tails off slowly');
assert.equal(gap.breaker,0);assert.equal(gap.wash,0);assert(gap.coast>0,'The long recording maintains ambience between breakers');
assert(period>7&&period<8,'Surf has a plausible long-wave cadence rather than rapid motor-like flutter');

let peak=0,prior=null,firstCycle=null,lastCycle=null;
for(let i=0;i<=120*60;i++){
 const r=oceanSurfMix({time:i/60,worldZ:81,distance:12,waveScale:1.5});
 for(const v of Object.values(r))assert(Number.isFinite(v),'Every live surf control is finite');
 const sum=r.coast+r.breaker+r.wash;peak=Math.max(peak,sum);
 assert(r.breaker>=0&&r.wash>=0&&r.coast>=0&&sum<.65,'Overlapping recorded surf voices retain master headroom');
 if(prior)for(const k of ['coast','breaker','wash'])assert(Math.abs(r[k]-prior[k])<.02,'Cycle wraps and continuous movement never click the gain target');
 if(i===0)firstCycle=r.cycle;if(i===60)lastCycle=r.cycle;prior=r;
}
assert.notEqual(firstCycle,lastCycle,'Stationary listeners still hear waves advance');
const base=oceanSurfMix({time:atCycle(.04),distance:0,worldZ:0});
for(const distance of [5,20,50,100,200,280,500]){
 const far=oceanSurfMix({time:atCycle(.04),distance,worldZ:0});
 assert(far.breaker<base.breaker&&far.coast<base.coast,'Surf falls off as the vehicle leaves the shoreline');
 assert(far.coastCutoff<base.coastCutoff,'Distant surf loses high-frequency detail');
 assert.deepEqual(oceanSurfMix({time:atCycle(.04),distance:-distance}),far,'Signed distance treats offshore and inland separation consistently');
 if(distance>=280)assert.equal(far.coast+far.breaker+far.wash,0,'No permanent ocean hiss follows the truck into inland mountains');
}
const storm=oceanSurfMix({time:atCycle(.04),distance:0,waveScale:1.5});
const calm=oceanSurfMix({time:atCycle(.04),distance:0,waveScale:.8});
assert(storm.breaker>calm.breaker&&storm.breakerRate>calm.breakerRate,'Weather-linked wave energy modestly changes surf body');
assert(Math.abs(storm.breakerRate-calm.breakerRate)<.03,'Wave sound is never pitch-wobbled like an engine');
assert.notEqual(oceanSurfMix({time:4,worldZ:0}).cycle,oceanSurfMix({time:4,worldZ:100}).cycle,'The shoreline phase follows the same world position as visible waves');
const anchored=oceanSurfMix({time:4,worldZ:100,surfPhase:oceanWavePhase(-8,0,4)});
assert.equal(anchored.cycle,oceanSurfMix({time:4,worldZ:0}).cycle,'An island breaker phase overrides mainland timing');
assert.equal(oceanSurfMix({time:3,worldZ:80,surfPhase:NaN}).cycle,oceanSurfMix({time:3,worldZ:80}).cycle,'An invalid phase falls back to the shared coastal wave model');
assert.notEqual(oceanSurfMix({time:4}).coast,oceanSurfMix({time:4+period}).coast,'Slow wave sets avoid identical repeated swells');
for(const args of [{time:NaN,worldZ:Infinity,distance:NaN,waveScale:-100},{time:1e5,worldZ:1e4,distance:Infinity,waveScale:NaN}]){
 const result=oceanSurfMix(args);assert(Object.values(result).every(Number.isFinite),'Invalid optional input cannot poison the audio graph');
}
console.log('Ocean surf audio: crest/wash/recession timing, coast distance, weather, phase continuity, set variation and bounded gain passed.',{period,peak});
