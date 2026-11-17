// Judge Dean LLC — one scalar wave model for gameplay samples and GPU displacement.
// The adapter operates on numbers or shader nodes; formulas must stay identical.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
const numberMath={add:(a,b)=>a+b,sub:(a,b)=>a-b,mul:(a,b)=>a*b,sin:Math.sin,cos:Math.cos,smooth,max:Math.max,min:Math.min};
export const OCEAN_MEAN_LEVEL=-.18;
export const OCEAN_PRIMARY_WAVE=Object.freeze({frequency:.82,wavenumber:.24,period:2*Math.PI/.82});
export function buildOceanWavePhase({add,sub,mul,sin},{d,z,time}){return sub(add(sub(mul(d,.24),mul(z,.018)),mul(sin(mul(z,.045)),.55)),mul(time,.82));}
export function oceanWavePhase(d,z,time){return buildOceanWavePhase(numberMath,{d,z,time});}
export function buildOceanWaveProfile(math,{d,z,time,depth,scale=1}){
 const {add,sub,mul,sin,cos,smooth,max,min}=math;
 const water=max(depth,0),strength=max(0,min(scale,1.8));
 const phase=buildOceanWavePhase(math,{d,z,time});
 const secondary=add(sub(add(mul(d,.127),mul(z,.031)),mul(time,.58)),.4);
 const cross=sub(add(mul(d,.53),mul(z,.17)),mul(time,1.43));
 const group=add(.8,mul(sin(sub(mul(time,.16),mul(z,.008))),.2));
 const energy=smooth(.03,1.55,water);
 const shoal=mul(mul(smooth(.28,.9,water),sub(1,smooth(1.5,4.5,water))),.18);
 const primary=mul(sub(sin(phase),mul(cos(mul(phase,2)),.16)),.38);
 const swell=add(mul(add(mul(primary,add(1,shoal)),mul(sin(secondary),.16)),group),mul(sin(cross),.045));
 // Signed mean depth lets a thin film overtake the mean shoreline and then
 // retreat. The 16cm dry shoulder stays untouched; swell still needs water.
 const runup=smooth(-.16,.08,depth);
 const swash=mul(mul(mul(sin(sub(phase,.55)),.085),sub(1,energy)),runup);
 const height=add(OCEAN_MEAN_LEVEL,add(mul(mul(swell,energy),strength),mul(swash,min(strength,1.15))));
 const crest=smooth(.48,.96,sin(phase));
 const breakDepth=mul(smooth(.18,.48,water),sub(1,smooth(1.35,3.1,water)));
 const breaker=mul(mul(crest,breakDepth),add(.72,mul(group,.28)));
 // Phase decreases as time advances. Positive phase offsets therefore trail
 // the crest, retaining broken whitewater after a wave has passed.
 const foamTrail=mul(smooth(-.6,.82,sin(add(phase,.85))),breakDepth);
 const wash=mul(mul(smooth(-.5,.85,sin(add(phase,.55))),sub(1,smooth(.18,.85,water))),runup);
 return {height,phase,crest,breaker,wash,foamTrail,energy};
}
export function oceanWaveProfile(d,z,time,depth,scale=1){return buildOceanWaveProfile(numberMath,{d,z,time,depth,scale});}
