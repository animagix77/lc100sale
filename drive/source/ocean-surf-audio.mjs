// Judge Dean LLC — the surf breathes with the visible breaker, then washes back.
import {oceanWavePhase} from './ocean-wave-profile.mjs';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const finite=(v,fallback)=>Number.isFinite(v)?v:fallback;
const TAU=Math.PI*2;

// A shore-adjacent listener hears a rolling break followed by the longer,
// softer recession. This shapes existing recordings; it does not synthesize
// a hiss or create an audio source each time a wave arrives.
export function oceanSurfMix({time=0,worldZ=0,distance=30,waveScale=1,surfPhase}={}){
 time=finite(time,0);worldZ=finite(worldZ,0);distance=Math.abs(finite(distance,1000));waveScale=clamp(finite(waveScale,1),.2,1.8);
 const phase=finite(surfPhase,oceanWavePhase(-8,worldZ,time));
 const cycle=((Math.PI/2-phase)/TAU%1+1)%1,signed=cycle>.5?cycle-1:cycle;
 const breaker=smooth(-.18,.015,signed)*(1-smooth(.07,.28,signed));
 const wash=smooth(.035,.18,cycle)*(1-smooth(.35,.80,cycle));
 const set=.8+.2*Math.sin(time*.16-worldZ*.008);
 const near=Math.exp(-distance/52)*(1-smooth(170,280,distance));
 const energy=.65+waveScale*.35;
 return {
  coast:(.075+.035*set+.020*breaker)*near,
  breaker:.26*breaker*set*energy*near,
  wash:.19*wash*set*energy*near,
  coastCutoff:850+near*2400,
  breakerCutoff:850+near*1300+breaker*200,
  washCutoff:500+near*1300+wash*400,
  breakerRate:.87+waveScale*.03,
  washRate:.76+waveScale*.025,
  cycle,proximity:near
 };
}
