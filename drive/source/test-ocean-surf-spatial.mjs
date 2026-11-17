// Judge Dean LLC — an irregular shoreline cannot restart the audible wave cycle.
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {Ocean} from './ocean.mjs';
import {COASTAL_LANDMARKS,islandBathymetryStats} from './coastal-islands.mjs';
import {shore} from './terrain.mjs';
import {oceanSurfMix} from './ocean-surf-audio.mjs';
import {OCEAN_PRIMARY_WAVE} from './ocean-wave-profile.mjs';

const ocean=new Ocean(new THREE.Scene(),{mobile:true}),point=ocean.surfPoint,target=ocean.surfTarget,record=ocean.surfSample,bedSamples=islandBathymetryStats().samples;
let time=0,previous=null,maxPointStep=0,maxPhaseStep=0,rawTargetJumps=0,targetUpdates=0,frames=0;
try{
 // A real 5 m/s traverse covers the large changes in local bed gradients at
 // each island and sandbar. It previously changed source phase by almost pi
 // at a single 2.5 Hz terrain sample despite smooth truck movement.
 for(let segment=3;segment<COASTAL_LANDMARKS.length;segment++){
  const a=COASTAL_LANDMARKS[segment-1],b=COASTAL_LANDMARKS[segment],length=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.ceil(length/(5/60));
  for(let i=0;i<=steps;i++){
   const p={x:a.x+(b.x-a.x)*i/steps,z:a.z+(b.z-a.z)*i/steps},beforeSample=ocean.surfSample.time;time+=1/60;ocean.updateSurf(p,time);frames++;
   assert(Number.isFinite(ocean.surfDistance)&&ocean.surfDistance>=0&&Number.isFinite(ocean.surfPhase),'All shoreline estimates remain finite');
   if(beforeSample!==ocean.surfSample.time)targetUpdates++;
   if(previous){
    const dt=time-previous.time,step=Math.hypot(point.x-previous.x,point.z-previous.z),phaseStep=ocean.surfPhase-previous.phase+OCEAN_PRIMARY_WAVE.frequency*dt;
    const rawStep=Math.hypot(target.x-previous.targetX,target.z-previous.targetZ);if(rawStep>6)rawTargetJumps++;
    maxPointStep=Math.max(maxPointStep,step);maxPhaseStep=Math.max(maxPhaseStep,Math.abs(phaseStep));
    assert(step<=4*dt+1e-8,'No newly sampled shoreline estimate may jump the active sound source');
    assert(Math.abs(phaseStep)<.020,'Travel cannot abruptly restart or skip the audible breaking-wave cycle');
   }
   previous={x:point.x,z:point.z,time,phase:ocean.surfPhase,targetX:target.x,targetZ:target.z};
  }
 }
 assert(frames>6000&&rawTargetJumps>10,'Exercise actual irregular contours, not only a constant mainland shoreline');
 assert(targetUpdates<=Math.ceil(time/.4)+1,'Terrain contour estimates stay within the fixed 2.5 Hz budget');
 assert.equal(ocean.surfPoint,point);assert.equal(ocean.surfTarget,target);assert.equal(ocean.surfSample,record,'The driving path reuses spatial audio records');
 assert.equal(islandBathymetryStats().samples,bedSamples,'Surf source updates do not lazily build new island terrain');

 const p={x:-195,z:-210};time+=1/60;ocean.updateSurf(p,time);
 assert.deepEqual(point,target,'An explicit large relocation snaps to the destination sound source');
 const atTeleport={...point};ocean.updateSurf(p,0);assert.deepEqual(point,target,'Restarting the game clock initializes the destination without negative-time motion');
 assert.deepEqual(point,atTeleport);
 ocean.update(p,1,{x:0,z:0});const before={phase:ocean.surfPhase,distance:ocean.surfDistance,point:{...point}};
 ocean.update(p,1,{x:512,z:-512});
 assert.equal(ocean.surfPhase,before.phase);assert.equal(ocean.surfDistance,before.distance);assert.deepEqual(point,before.point,'Floating origin cannot move the world-space sound source');

 // Surf is nearby on either side of the mainland, then fades offshore and
 // inland. It must not get louder forever as signed distance becomes negative.
 const attenuation=[];
 for(const [i,d] of [0,15,70,180,300].entries()){
  const z=100,p={x:shore(z)-8+d,z};ocean.updateSurf(p,2+i*.5);
  assert(Math.abs(ocean.surfDistance-d)<1e-8);
  attenuation.push(oceanSurfMix({time:0,distance:ocean.surfDistance,surfPhase:Math.PI/2}).proximity);
 }
 for(let i=1;i<attenuation.length;i++)assert(attenuation[i]<attenuation[i-1],'Surf recedes with mainland distance');
 assert.equal(attenuation.at(-1),0,'Distant inland terrain has no foreground surf');
 ocean.updateSurf({x:shore(100)-8-180,z:100},5);
 assert.equal(oceanSurfMix({distance:ocean.surfDistance}).proximity,attenuation[3],'Offshore and inland distance have equal attenuation');
 console.log('Surf spatial audio: irregular island source smoothing, bounded sampling, teleport/clock reset, origin stability and two-sided distance fade passed.',{frames,targetUpdates,rawTargetJumps,maxPointStep,maxPhaseStep,attenuation});
}finally{ocean.dispose();}
