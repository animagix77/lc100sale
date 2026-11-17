// Judge Dean LLC — stronger surf must preserve the complete scenic driving line.
import assert from 'node:assert/strict';
import {COASTAL_LANDMARKS,archipelagoRegion,islandOceanBed,islandWaveAttenuation,preloadIslandBathymetry} from './coastal-islands.mjs';
import {baseHeight,SandField,shore,smooth} from './terrain.mjs';
import {oceanHeight,waterSurfaceHeight} from './ocean-height.mjs';
import {riverZ,riverMouthBlend,riverHeight,riverProfile} from './expedition.mjs';

preloadIslandBathymetry(baseHeight);
const field=new SandField(),scale=1.5;
// Preserve the pre-upgrade exposure envelope, including intentionally wet
// mainland shoulder depressions. This fixture is the previous shipped model,
// not a second implementation of the new wave-profile formula.
function previousOceanHeight(x,z,time){
 const d=x-shore(z),offshore=1-smooth(-25,2,d);
 const phase=d*.30-z*.025+Math.sin(z*.071)*1.2+Math.sin(z*.13)*.3-time*1.35;
 const swell=Math.sin(phase)*.36+Math.sin(d*.14+z*.046-time*.78)*.20;
 const cross=Math.sin(x*.41+z*.23-time*1.05)*.065;
 const attenuation=archipelagoRegion(x,z)>0?islandWaveAttenuation(x,z,islandOceanBed(x,z,baseHeight)):1;
 return -.18+((swell+cross)*offshore+Math.sin(time*.8-z*.026)*.075*(1-offshore))*scale*attenuation;
}
let laneSamples=0,waterSamples=0,minIslandClearance=Infinity,minDryMargin=Infinity,maxNewFlooding=0;
for(let segment=1;segment<COASTAL_LANDMARKS.length;segment++){
 const a=COASTAL_LANDMARKS[segment-1],b=COASTAL_LANDMARKS[segment],length=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.ceil(length/2),nx=(b.z-a.z)/length,nz=-(b.x-a.x)/length;
 for(let step=0;step<=steps;step++)for(const offset of [-3.4,-.962,.962,3.4]){
  const t=step/steps,x=a.x+(b.x-a.x)*t+nx*offset,z=a.z+(b.z-a.z)*t+nz*offset,ground=field.height(x,z);
  let oldMax=-Infinity,newMax=-Infinity;
  for(let tick=0;tick<=240;tick++){
   const time=tick*.25,water=oceanHeight(x,z,time,scale);assert(Number.isFinite(water));
   oldMax=Math.max(oldMax,previousOceanHeight(x,z,time));newMax=Math.max(newMax,water);waterSamples++;
  }
  const oldMargin=ground-oldMax,newMargin=ground-newMax;
  if(oldMargin>.10){
   minDryMargin=Math.min(minDryMargin,newMargin);
   assert(newMargin>.05,`Previously exposed lane is flooded near ${x.toFixed(1)},${z.toFixed(1)}`);
  }else{
   maxNewFlooding=Math.max(maxNewFlooding,newMax-oldMax);
   assert(newMax-oldMax<.08,'An existing damp shoulder cannot gain a new deep surf crossing');
  }
  if(segment>=3&&x< -32){
   minIslandClearance=Math.min(minIslandClearance,newMargin);
   assert(newMargin>.60,'Both tyre lines and a 6.8 m island corridor remain safely above the strongest weather surf');
  }
  laneSamples++;
 }
}
assert(laneSamples>1200&&waterSamples>300000,'Cover the full scenic route and a complete sixty-second wave-group cycle');

// The real wet beach extends farther inland than the offshore slope formula.
// A mistaken analytic depth clamp at d=2.93 m would freeze this visible swash.
let livingShallows=0;
for(const z of [-60,0,100])for(const d of [4,6,8,10]){
 const x=shore(z)+d,depth=-.18-baseHeight(x,z);if(depth<.08||depth>.30)continue;
 let low=Infinity,high=-Infinity;
 for(let tick=0;tick<=160;tick++){const water=oceanHeight(x,z,tick*.25,scale);low=Math.min(low,water);high=Math.max(high,water);}
 assert(high-low>.025,'Actual wet foreshore retains an advancing and receding swash beyond the offshore slope shortcut');livingShallows++;
}
assert(livingShallows>=5,'Exercise shallow mainland water beyond the offshore analytic depth range');
let movingWaterlines=0;
for(const z of [-60,0,100]){
 for(let d=3;d<=20;d+=.05){
  const x=shore(z)+d,ground=baseHeight(x,z),meanDepth=-.18-ground;
  if(Math.abs(meanDepth)>.02)continue;
  let low=Infinity,high=-Infinity;
  for(let tick=0;tick<=240;tick++){const h=oceanHeight(x,z,tick*.25,scale);low=Math.min(low,h);high=Math.max(high,h);}
  assert(low<ground-.01&&high>ground+.01,'The actual beach waterline exposes sand and then covers it during the wave cycle');
  movingWaterlines++;break;
 }
}
assert(movingWaterlines>=2,'Verify actual shoreline movement on more than one beach contour');


// Stronger crests may evolve quickly, but may not snap the tyre waterline from
// one simulation frame to the next at shore shelves or island-region seams.
const probes=[];
for(const z of [-430,-420,-400,-385,-340,-221,-130,-105,-90,0,100])for(const d of [-40,-18,-8,-1,2,8,18])probes.push([shore(z)+d,z]);
for(const x of [-535,-532,-505,-430,-303,-143,-32,-25])for(const z of [-420,-385,-304,-221,-130,-105])probes.push([x,z]);
let maxFrameChange=0;
for(const [x,z] of probes)for(let tick=0;tick<240;tick++){
 const t=tick*.25,a=oceanHeight(x,z,t,scale),b=oceanHeight(x,z,t+1/60,scale),delta=Math.abs(b-a);
 maxFrameChange=Math.max(maxFrameChange,delta);
 assert(delta<.04,'A wave-group or shallow-depth transition must not jump the gameplay waterline');
}
// This extends estuary coverage through the complete stronger-surf cycle at
// storm scale; it must still meet the existing inland river at both ends.
for(let tick=0;tick<=240;tick++)for(const x of [-48,-44,-40,-36,-32,-28]){
 const t=tick*.25,z=riverZ(x),blend=riverMouthBlend(x),profile=riverProfile(x,z);
 assert(profile.depth>0&&profile.wet>0);
 const expected=oceanHeight(x,z,t,scale)*(1-blend)+riverHeight(x,z,t)*blend;
 assert(Math.abs(waterSurfaceHeight(x,z,t,scale)-expected)<1e-10,'Ocean/river connection remains continuous throughout the storm swell cycle');
}
console.log('Ocean route safety: full 60 s weather cycle, dry lane/shoulder exposure, frame continuity and river-mouth blend passed.',{laneSamples,waterSamples,minIslandClearance,minDryMargin,maxNewFlooding,maxFrameChange,livingShallows,movingWaterlines});
