// Judge Dean LLC — soft body, timber and stone contact thumps.
// The volcanic landing voice adds a low body with enough upper bass to read on
// small speakers, followed by a quiet, filtered crumble rather than a sharp blast.
export function volcanicThudPCM(sampleRate=48000,variant=0){
 const duration=.62,data=new Float32Array(Math.ceil(duration*sampleRate));let seed=16493+variant*977,grit=0,rumble=0;
 const gritBlend=1-Math.exp(-2*Math.PI*920/sampleRate),rumbleBlend=1-Math.exp(-2*Math.PI*85/sampleRate),pitch=1+(variant-1)*.035;
 for(let i=0;i<data.length;i++){
  const t=i/sampleRate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1;
  grit+=(noise-grit)*gritBlend;rumble+=(noise-rumble)*rumbleBlend;
  const phase=2*Math.PI*pitch*(47*t+14*.055*(1-Math.exp(-t/.055)));
  const body=Math.sin(phase)*.60*Math.exp(-t/.125)+Math.sin(phase*2.04)*.20*Math.exp(-t/.065);
  const debris=grit*.20*Math.exp(-t/.13)+rumble*.44*Math.exp(-t/.21);
  const edge=Math.min(1,t/.003,(data.length-1-i)/(sampleRate*.025));
  data[i]=(body+debris)*Math.max(0,edge);
 }return data;
}
export function impactPCM(kind,sampleRate=48000,variant=0){
 if(kind==='volcano')return volcanicThudPCM(sampleRate,variant);
 // Judge Dean LLC — damped material movement, with no pitched ringing tail.
 // Two low-pass stages remove the bright snap; a rounded 9–12ms attack keeps
 // adjacent timber contacts from sounding like clicks or a percussion loop.
 const wood=kind==='wood',rock=kind==='rock',duration=rock?.34:wood?.28:.24;
 const data=new Float32Array(Math.ceil(duration*sampleRate)),cutoff=rock?390:wood?340:245;
 const blend=1-Math.exp(-2*Math.PI*cutoff/sampleRate),bodyBlend=1-Math.exp(-2*Math.PI*105/sampleRate);
 let seed=9187+variant*731,low=0,filtered=0,body=0;
 for(let i=0;i<data.length;i++){
  const t=i/sampleRate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1;
  low+=(noise-low)*blend;filtered+=(low-filtered)*blend;body+=(noise-body)*bodyBlend;
  const attackTime=rock?.009:wood?.010:.012,attack=.5-.5*Math.cos(Math.PI*Math.min(1,t/attackTime));
  const fall=Math.exp(-t/(rock?.064:wood?.047:.040));
  // A short, non-sweeping compression pulse adds weight, then filtered,
  // irregular fibers/grit carry the tail. No resonant wood-note oscillator.
  const pulse=Math.sin(2*Math.PI*(rock?70:wood?92:57)*t)*.13*Math.exp(-t/.019);
  const texture=filtered*(wood?3.0:rock?2.5:2.3)+body*.8;
  const edge=Math.min(1,(data.length-1-i)/(sampleRate*.020));
  data[i]=Math.tanh((pulse+texture*fall)*attack)*Math.max(0,edge);
 }return data;
}
export function impactBank(ctx){const bank={};for(const kind of ['wood','rock','suspension','volcano'])for(let i=0;i<3;i++){const data=impactPCM(kind,ctx.sampleRate,i),buffer=ctx.createBuffer(1,data.length,ctx.sampleRate);buffer.getChannelData(0).set(data);bank[`${kind}${i}`]=buffer}return bank}
