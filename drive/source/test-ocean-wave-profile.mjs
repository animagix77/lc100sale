// Judge Dean LLC — shared sea motion, shallow-water safety and directional surf.
import assert from 'node:assert/strict';
import {oceanWaveProfile,buildOceanWaveProfile,oceanWavePhase,buildOceanWavePhase,OCEAN_MEAN_LEVEL,OCEAN_PRIMARY_WAVE} from './ocean-wave-profile.mjs';
import {oceanHeight,coastalWaterHeight,waterSurfaceHeight,riverWakeOffset} from './ocean-height.mjs';
import {shore,baseHeight} from './terrain.mjs';
import {archipelagoRegion,islandOceanBed,preloadIslandBathymetry} from './coastal-islands.mjs';
import {riverZ,riverHeight,riverProfile} from './expedition.mjs';
const near=(a,b,epsilon=1e-10,label='')=>assert(Math.abs(a-b)<=epsilon,`${label}: ${a} / ${b}`);

// The generic adapter is the renderer contract; number and node-shaped
// arithmetic must not diverge into separately maintained wave equations.
class Scalar{constructor(value){this.value=value;}}
const v=x=>x instanceof Scalar?x.value:x,nodeMath={};
for(const [name,operation] of Object.entries({add:(a,b)=>a+b,sub:(a,b)=>a-b,mul:(a,b)=>a*b,min:Math.min,max:Math.max}))nodeMath[name]=(a,b)=>new Scalar(operation(v(a),v(b)));
nodeMath.sin=x=>new Scalar(Math.sin(v(x)));nodeMath.cos=x=>new Scalar(Math.cos(v(x)));
nodeMath.smooth=(a,b,x)=>{const k=Math.max(0,Math.min(1,(v(x)-v(a))/(v(b)-v(a))));return new Scalar(k*k*(3-2*k));};
for(const d of [-100,-25,-8,4,15])for(const depth of [-.2,-.08,0,.01,.2,.8,3,20])for(const time of [0,.7,8,55]){
 const args={d:new Scalar(d),z:new Scalar(-180),time:new Scalar(time),depth:new Scalar(depth),scale:new Scalar(1.5)},numeric=oceanWaveProfile(d,-180,time,depth,1.5),nodes=buildOceanWaveProfile(nodeMath,args);
 for(const key of Object.keys(numeric))near(numeric[key],v(nodes[key]),1e-12,`Shared numeric/node ${key}`);
 near(v(buildOceanWavePhase(nodeMath,args)),oceanWavePhase(d,-180,time),1e-12);
}

near(OCEAN_PRIMARY_WAVE.period,2*Math.PI/.82);
for(const z of [-400,-180,0,500])for(const dt of [.01,.5,3]){
 near(oceanWavePhase(-10+(.82/.24)*dt,z,4+dt),oceanWavePhase(-10,z,4),1e-12,'Primary crests propagate toward increasing d / shore');
 near(oceanWavePhase(-10,z,4+OCEAN_PRIMARY_WAVE.period),oceanWavePhase(-10,z,4)-2*Math.PI,1e-12);
}
let lowest=0,highest=0,minWaterFraction=1,maxTimeStep=0,maxSpaceStep=0,dryingSamples=0;
for(const depth of [.0001,.001,.01,.03,.05,.1,.2,.3,.5,.8,1,1.5,2,3,5,20])for(const scale of [0,.8,1,1.5,1.8])for(let time=0;time<90;time+=.3)for(const z of [-310,-180,0]){
 const a=oceanWaveProfile(-8,z,time,depth,scale),displacement=a.height-OCEAN_MEAN_LEVEL;
 for(const [key,value]of Object.entries(a))assert(Number.isFinite(value),`Finite ${key}`);
 for(const key of ['crest','breaker','wash','foamTrail','energy'])assert(a[key]>=0&&a[key]<=1,`Bounded ${key}`);
 lowest=Math.min(lowest,displacement);highest=Math.max(highest,displacement);
 if(depth>.12){minWaterFraction=Math.min(minWaterFraction,(depth+displacement)/depth);assert(depth+displacement>depth*.15,'Troughs preserve a water column beyond the intertidal film');}
 else if(depth+displacement<0)dryingSamples++;
 assert(Math.abs(displacement)<1.25,'Extreme wind remains within the existing coastal gameplay scale');
 if(scale===1)assert(Math.abs(displacement)<.70,'Normal offshore swell remains below a 70cm crest/trough budget');
 if(scale===1.5)assert(Math.abs(displacement)<1.05,'Weather storm range remains below a 1.05m displacement budget');
 maxTimeStep=Math.max(maxTimeStep,Math.abs(a.height-oceanWaveProfile(-8,z,time+.001,depth,scale).height));
 maxSpaceStep=Math.max(maxSpaceStep,Math.abs(a.height-oceanWaveProfile(-7.999,z,time,depth,scale).height));
 if(scale===0)assert.equal(a.height,OCEAN_MEAN_LEVEL,'Zero strength restores exact mean sea');
}
assert(maxTimeStep<.002&&maxSpaceStep<.001,'Water height has no temporal snaps or horizontal steps');
for(const depth of [-1,-.2,-.16])for(let time=0;time<90;time+=.1){const a=oceanWaveProfile(-8,-250,time,depth,1.8);assert.equal(a.height,OCEAN_MEAN_LEVEL,'Shoulders at least16cm above mean sea remain untouched');assert.equal(a.wash,0);assert.equal(a.breaker,0);}
assert(dryingSamples>100,'The shallow intertidal film can legitimately dry during recession');
for(const depth of [-.03,-.01,0,.03]){
 const waterColumns=Array.from({length:180},(_,i)=>depth+oceanWaveProfile(5,-60,i/10,depth,1.5).height-OCEAN_MEAN_LEVEL);
 assert(Math.min(...waterColumns)<-.005&&Math.max(...waterColumns)>.005,'A thin film advances past and retreats behind the mean shoreline');
}
for(const edge of [-.16,0,.08])for(let time=0;time<15;time+=.2){
 const a=oceanWaveProfile(5,-60,time,edge-.00001,1.5),b=oceanWaveProfile(5,-60,time,edge+.00001,1.5);
 assert(Math.abs(a.height-b.height)<.0001,'Signed-depth runup has no seam at its dry/mean/wet boundaries');
}
assert.equal(oceanWaveProfile(-8,0,1,20).breaker,0,'Whitewater cannot break in deep sea');
const crestTime=4,z=-50,d=(Math.PI/2+z*.018-Math.sin(z*.045)*.55+crestTime*.82)/.24;
const before=oceanWaveProfile(d,z,crestTime-2,.8),crest=oceanWaveProfile(d,z,crestTime,.8),after=oceanWaveProfile(d,z,crestTime+1,.8);
assert(crest.breaker>.9&&crest.crest>.99,'Primary wave crest owns the breaker');
assert(after.foamTrail>before.foamTrail+.8&&after.foamTrail>after.breaker,'Whitewater remains after the crest passes');
assert(oceanWaveProfile(d,z,crestTime+.6,.12).wash>0,'Shallow swash follows the same crest phase');

preloadIslandBathymetry(baseHeight);
for(const [x,z] of [[shore(0)-30,0],[shore(100)+10,100],[-31,-340],[-137,-226],[-239,-251],[-420,-245]])for(const time of [0,.5,3,7,12]){
 const bed=archipelagoRegion(x,z)>0?islandOceanBed(x,z,baseHeight):baseHeight(x,z);
 near(oceanHeight(x,z,time,1.5),oceanWaveProfile(x-shore(z),z,time,-.18-bed,1.5).height,1e-12,'CPU water uses actual matching ocean/estuary bed');
 assert.equal(coastalWaterHeight(x,z,time,1.5,0),oceanHeight(x,z,time,1.5),'No wake has no independent displacement');
}
let movingForeshore=0;
for(const z of [-100,-60,100])for(let d=6;d<22;d+=.5){const x=shore(z)+d,bed=baseHeight(x,z);if(bed<-.20){const values=Array.from({length:16},(_,i)=>oceanHeight(x,z,i));if(Math.max(...values)-Math.min(...values)>.01)movingForeshore++;}}
assert(movingForeshore>5,'Far wet foreshore depressions retain moving swash rather than a frozen mean-sea sheet');
for(const time of [0,1.3,4,9])for(const wake of [-.1,0,.3]){
 const seaX=-48,seaZ=riverZ(seaX),landX=-28,landZ=riverZ(landX),profile=riverProfile(landX,landZ);
 near(waterSurfaceHeight(seaX,seaZ,time,1,wake),coastalWaterHeight(seaX,seaZ,time,1,wake),1e-12,'Estuary starts on exact sea');
 near(waterSurfaceHeight(landX,landZ,time,1,wake),riverHeight(landX,landZ,time)+riverWakeOffset(profile.depth,wake),1e-12,'Estuary ends on existing river');
 for(const edge of [seaX,landX])assert(Math.abs(waterSurfaceHeight(edge-.001,riverZ(edge-.001),time)-waterSurfaceHeight(edge+.001,riverZ(edge+.001),time))<.002,'Estuary boundary remains continuous');
}
console.log('Ocean shared wave profile: adapter parity, shoreward motion, breaker/wash timing, shallow-water safety, bounded weather, actual-bed swash and estuary continuity passed.',{lowest,highest,minWaterFraction,maxTimeStep,maxSpaceStep,movingForeshore,dryingSamples});
