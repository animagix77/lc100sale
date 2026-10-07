// Original short foley voices: rubber/body thump, dry wood knock, gritty stone hit.
export function impactPCM(kind,sampleRate=48000,variant=0){
 const duration=kind==='rock'?.34:kind==='wood'?.24:.20,data=new Float32Array(Math.ceil(duration*sampleRate));let seed=9187+variant*731,low=0;
 for(let i=0;i<data.length;i++){const t=i/sampleRate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1;low+=(noise-low)*.12;const attack=Math.min(1,t/.002),fall=Math.exp(-t/(kind==='rock'?.085:.045));
  const bass=Math.sin(2*Math.PI*(kind==='wood'?145:kind==='rock'?86:59)*t-30*t*t)*Math.exp(-t/.055);
  const texture=kind==='wood'?Math.sin(2*Math.PI*(460+variant*32)*t)*Math.exp(-t/.025)*.22+low*.8:kind==='rock'?(noise-low)*.32+low*.35:low*.35;
  data[i]=Math.max(-.9,Math.min(.9,(bass*.62+texture*fall)*attack*Math.min(1,(duration-t)/.015)));
 }return data;
}
export function impactBank(ctx){const bank={};for(const kind of ['wood','rock','suspension'])for(let i=0;i<3;i++){const data=impactPCM(kind,ctx.sampleRate,i),buffer=ctx.createBuffer(1,data.length,ctx.sampleRate);buffer.getChannelData(0).set(data);bank[`${kind}${i}`]=buffer}return bank}
