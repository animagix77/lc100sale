import {waterExists,riverProfile,riverHeight,riverMouthBlend} from './expedition.mjs';
import {shore,smooth,baseHeight} from './terrain.mjs';
import {archipelagoRegion,islandOceanBed} from './coastal-islands.mjs';
import {oceanWaveProfile} from './ocean-wave-profile.mjs';
// CPU counterpart to Ocean's displacement, for tire/water interaction positions.
export function oceanHeight(x,z,time,scale=1){
 const d=x-shore(z),bed=archipelagoRegion(x,z)>0?islandOceanBed(x,z,baseHeight):baseHeight(x,z),depth=-.18-bed;
 return oceanWaveProfile(d,z,time,depth,scale).height;
}

// Coastal tyre wakes must not excavate the foreshore. A smooth saturation
// keeps both shoulders and troughs rounded; even extreme inputs leave at least
// 76% of the original water column. Natural swells are unchanged.
export const COASTAL_WAKE_LIMITS=Object.freeze({crest:.34,trough:.14,crestDepth:.70,troughDepth:.24,edgeDepth:.35});
export function coastalWakeOffset(depth,wake){
 const d=Math.max(0,depth),limit=wake>=0?Math.min(COASTAL_WAKE_LIMITS.crest,d*COASTAL_WAKE_LIMITS.crestDepth):Math.min(COASTAL_WAKE_LIMITS.trough,d*COASTAL_WAKE_LIMITS.troughDepth);
 return limit>0?wake*limit/(limit+Math.abs(wake))*smooth(0,COASTAL_WAKE_LIMITS.edgeDepth,d):0;
}
export function coastalWaterHeight(x,z,time=0,scale=1,wake=0){const surface=oceanHeight(x,z,time,scale);return wake===0?surface:surface+coastalWakeOffset(surface-(archipelagoRegion(x,z)>0?islandOceanBed(x,z,baseHeight):baseHeight(x,z)),wake)}

// Shared gameplay counterpart of the river shader: wave energy tapers with
// available depth, and troughs cannot pass through the shallow riverbed.
export const RIVER_WAKE_LIMITS=Object.freeze({crest:1.05,crestDepth:2.8,troughDepth:.70,edgeDepth:.25});
export function riverWakeOffset(depth,wake){const d=Math.max(0,depth);return Math.max(-d*RIVER_WAKE_LIMITS.troughDepth,Math.min(Math.min(RIVER_WAKE_LIMITS.crest,d*RIVER_WAKE_LIMITS.crestDepth),wake))*smooth(0,RIVER_WAKE_LIMITS.edgeDepth,d)}
export function waterSurfaceHeight(x,z,time=0,scale=1,wake=0){
 const profile=riverProfile(x,z),river=profile.depth>0&&profile.wet>0;
 if(!river)return waterExists(x,z)?coastalWaterHeight(x,z,time,scale,wake):-Infinity;
 const blend=riverMouthBlend(x),coastal=coastalWaterHeight(x,z,time,scale,wake);
 const inland=riverHeight(x,z,time)+riverWakeOffset(profile.depth,wake);
 return coastal*(1-blend)+inland*blend;
}
export function surfaceProfile(mark,speed,ground,time,water=waterSurfaceHeight(mark.x,mark.z,time)){
 const activity=Math.abs(speed)+Math.max(0,mark.slip);
 const wet=waterExists(mark.x,mark.z)&&water>ground+.025;
 return {wet,water,activity,emit:activity>.35,dust:!wet&&(mark.x-shore(mark.z)>10||(ground>.05&&archipelagoRegion(mark.x,mark.z)>0))};
}
