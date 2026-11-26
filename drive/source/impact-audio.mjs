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
// Judge Dean LLC — padded body impact, short metal crumple and loose trim tail.
// Original synthesis; no explosion, glass breaking or repeating collision loop.
export function crashPCM(sampleRate=48000,variant=0){
 const data=new Float32Array(Math.ceil(.72*sampleRate));let seed=48271+variant*1723,low=0,crunch=0;
 const bodyBlend=1-Math.exp(-2*Math.PI*140/sampleRate),crunchBlend=1-Math.exp(-2*Math.PI*1450/sampleRate);
 for(let i=0;i<data.length;i++){
  const t=i/sampleRate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1;
  low+=(noise-low)*bodyBlend;crunch+=(noise-crunch)*crunchBlend;
  const attack=.5-.5*Math.cos(Math.PI*Math.min(1,t/.006));
  const weight=Math.sin(2*Math.PI*(64+variant*3)*t)*.6*Math.exp(-t/.065)+low*2.4*Math.exp(-t/.11);
  const buckle=crunch*(.36+.28*Math.sin(t*147+variant)**2)*Math.exp(-t/.10);
  const rattle=crunch*.13*Math.exp(-t/.19)*Math.sin(t*63)**6;
  const edge=Math.max(0,Math.min(1,(data.length-1-i)/(sampleRate*.025)));
  data[i]=Math.tanh((weight+buckle+rattle)*attack)*edge;
 }return data;
}
export function impactPCM(kind,sampleRate=48000,variant=0){
 if(kind==='crash')return crashPCM(sampleRate,variant);
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
// Each stroke excites two damped modes and a band of material noise.
// Timing separates a lever detent, a relay engaging, and two boards settling.
const gestures = {
 panelStop: {length:.19, pitch:134, overtone:2.34, decay:.030, grit:860, texture:.20, strokes:[[0,.82],[.027,.21]]},
 range: {length:.27, pitch:112, overtone:2.75, decay:.038, grit:720, texture:.16, strokes:[[0,.4],[.082,1]]},
 lock: {length:.18, pitch:312, overtone:2.1, decay:.015, grit:1650, texture:.20, strokes:[[0,.54],[.052,.8]]},
 boardsDown: {length:.38, pitch:157, overtone:1.73, decay:.058, grit:1100, texture:.40, strokes:[[0,.86],[.097,.62],[.141,.20]]},
 boardsPacked: {length:.32, pitch:238, overtone:2.86, decay:.024, grit:1750, texture:.30, strokes:[[0,.38],[.062,.25],[.171,.98]]},
 crush: {length:.72, pitch:177, overtone:1.48, decay:.065, grit:1850, texture:.92, strokes:[[.052,.84],[.136,1],[.245,.64]]}
};

export function mechanicalPCM(kind,sampleRate=48000,variant=0){
 const voice=gestures[kind];
 const data=kind==='crush'?crashPCM(sampleRate,variant):new Float32Array(Math.ceil(sampleRate*voice.length));
 const blend=1-Math.exp(-2*Math.PI*voice.grit/sampleRate);
 let seed=31721+variant*779;
 for(const [offset,weight] of voice.strokes){
  const start=Math.round(offset*sampleRate),end=Math.min(data.length,start+Math.ceil(voice.decay*8*sampleRate));
  let noiseBand=0,phase=0;
  for(let i=start;i<end;i++){
   const t=(i-start)/sampleRate;
   seed=(Math.imul(seed,1664525)+1013904223)>>>0;
   noiseBand+=((seed/2147483648-1)-noiseBand)*blend;
   const decay=Math.exp(-t/voice.decay);
   // Bent steel drops in pitch as the sheet gives way. Small fittings die out quickly.
   phase+=2*Math.PI*voice.pitch*(.96+weight*.06+variant*.018)*(1+(kind==='crush'?.56:.09)*decay)/sampleRate;
   const body=.34*Math.sin(phase)+.21*Math.sin(phase*voice.overtone)*decay;
   const attack=Math.min(1,t/.0035), edge=Math.min(1,(end-1-i)/(.008*sampleRate));
   data[i]+=weight*attack*edge*decay*(body+noiseBand*voice.texture);
  }
 }
 for(let i=0;i<data.length;i++)data[i]=Math.tanh(data[i]);
 return data;
}

export function impactBank(ctx){
 const bank={};
 function store(name,data){
  const buffer=ctx.createBuffer(1,data.length,ctx.sampleRate);
  buffer.getChannelData(0).set(data);bank[name]=buffer;
 }
 for(const kind of ['wood','rock','suspension','volcano','crash']){
  for(let i=0;i<3;i++)store(kind+i,impactPCM(kind,ctx.sampleRate,i));
 }
 for(const kind of Object.keys(gestures)){
  if(kind==='crush'){for(let i=0;i<3;i++)store(kind+i,mechanicalPCM(kind,ctx.sampleRate,i));}
  else store(kind,mechanicalPCM(kind,ctx.sampleRate));
 }
 return bank;
}
