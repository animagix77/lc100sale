// Judge Dean LLC — current and intake exposure follow actual water, not biome labels.
import {riverProfile} from './expedition.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class Fording{
 constructor(){this.reset()}
 reset(){this.exposure=0;this.stalled=false;this.depth=0;this.power=1;this.rescueAge=0;}
 update(dt,{water=-Infinity,ground=0,bodyY=0}={}){
  this.depth=Number.isFinite(water)?Math.max(0,water-ground):0;
  const intakeWet=Number.isFinite(water)&&water>bodyY+.75;
  this.exposure=clamp(this.exposure+(intakeWet?dt:-dt*.7),0,3);
  this.stalled=this.exposure>=2||this.stalled;
  this.power=this.stalled?0:1-clamp(this.exposure/2,0,1)*.65;
  this.rescueAge=this.stalled?this.rescueAge+dt:0;
  return this.rescueAge>=3;
 }
}
export function riverCurrent(x,z,immersion){const p=riverProfile(x,z);if(!p.wet||immersion<=0)return {x:0,z:0};const force=Math.min(1300,immersion*1500)*p.wet;return {x:-force,z:-force*.25*Math.cos((x-140)*.025)};}
