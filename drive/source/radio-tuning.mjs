export const TUNING_MS=760;
// Fixed-width reels keep the LCD steady when tuning between two/three-digit stations.
export function createFrequencyRoll(element,{reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')}={}){
 let current='',animations=[];
 const cancel=()=>{animations.forEach(a=>a.cancel());animations=[]};
 function set(value,instant=false){
  if(value===current&&!instant)return;
  const previous=current.padStart(5,' '),next=value.padStart(5,' '),direction=Number(value)>=Number(current)?1:-1;
  cancel();element.replaceChildren();element.setAttribute('aria-label',`${value} FM`);element.setAttribute('role','img');
  for(let i=0;i<next.length;i++){
   const slot=document.createElement('span');slot.className='frequency-slot';slot.setAttribute('aria-hidden','true');
   if(!current||instant||reducedMotion?.matches||!/\d/.test(next[i])||previous[i]===next[i])slot.textContent=next[i]===' '?'\u00a0':next[i];
   else{
    const reel=document.createElement('span');reel.className='frequency-reel';
    const start=/\d/.test(previous[i])?Number(previous[i]):0,end=Number(next[i]);
    const steps=10+((direction*(end-start)+10)%10),values=Array.from({length:steps+1},(_,n)=>(start+direction*n+30)%10);
    if(direction<0)values.reverse();
    values.forEach(value=>{const digit=document.createElement('span');digit.textContent=String(value);reel.append(digit)});slot.append(reel);
    const from=direction>0?0:-steps,to=direction>0?-steps:0;
    reel.style.transform=`translateY(${to}em)`;
    if(reel.animate)animations.push(reel.animate([{transform:`translateY(${from}em)`},{transform:`translateY(${to}em)`}],{duration:TUNING_MS-100,delay:i*25,easing:'cubic-bezier(.16,.7,.15,1)',fill:'backwards'}));
   }
   element.append(slot);
  }
  current=value;
 }
 const reduce=()=>{if(reducedMotion.matches)set(current,true)};reducedMotion?.addEventListener?.('change',reduce);
 return {set,dispose(){cancel();reducedMotion?.removeEventListener?.('change',reduce)}};
}
// Original synthesized tuning texture: band-limited static, soft distortion and
// an uneven, frequency-modulated heterodyne warble. A single replaceable voice prevents rapid-click buildup.
export function createTuningSweep(ctx){
 const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.8),ctx.sampleRate),data=buffer.getChannelData(0);
 let seed=1979;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed/4294967296*2-1)*(.55+.45*Math.sin(i/ctx.sampleRate*61)**2);}
 const curve=new Float32Array(512);for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1;curve[i]=Math.tanh(x*2.5)/Math.tanh(2.5);}
 let active=null;
 function stop(){if(!active)return;const voice=active;active=null;for(const node of voice.sources){try{node.stop()}catch{}}voice.nodes.forEach(n=>n.disconnect())}
 function start(volume,direction=1){
  stop();if(volume<=0)return;
  const now=ctx.currentTime,noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),distort=ctx.createWaveShaper(),output=ctx.createGain(),whistle=ctx.createOscillator(),whistleGain=ctx.createGain(),warble=ctx.createOscillator(),warbleDepth=ctx.createGain();
  noise.buffer=buffer;filter.type='bandpass';filter.Q.value=2.3;distort.curve=curve;
  filter.frequency.setValueAtTime(direction>0?450:3200,now);filter.frequency.exponentialRampToValueAtTime(direction>0?3600:280,now+.32);filter.frequency.exponentialRampToValueAtTime(1100,now+.69);
  output.gain.setValueAtTime(0,now);output.gain.linearRampToValueAtTime(volume*.16,now+.035);output.gain.linearRampToValueAtTime(volume*.075,now+.23);output.gain.linearRampToValueAtTime(volume*.14,now+.37);output.gain.linearRampToValueAtTime(volume*.065,now+.57);output.gain.linearRampToValueAtTime(0,now+.74);
  whistle.type='sine';
  // Dial hunting: uneven carrier catches plus fast FM wobble, not an engine-like pulse.
  const catches=[640,1700,920,2400,1150,1850,760];
  if(direction<0)catches.reverse();
  whistle.frequency.setValueAtTime(catches[0],now);
  catches.slice(1).forEach((hz,i)=>whistle.frequency.exponentialRampToValueAtTime(hz,now+.09+i*.105));
  whistleGain.gain.value=.30;
  warble.type='sine';warble.frequency.setValueAtTime(11,now);warble.frequency.linearRampToValueAtTime(29,now+.30);warble.frequency.linearRampToValueAtTime(8,now+.70);
  warbleDepth.gain.setValueAtTime(100,now);warbleDepth.gain.linearRampToValueAtTime(430,now+.29);warbleDepth.gain.linearRampToValueAtTime(45,now+.72);
  warble.connect(warbleDepth);warbleDepth.connect(whistle.frequency);
  noise.connect(filter);filter.connect(distort);distort.connect(output);whistle.connect(whistleGain);whistleGain.connect(output);output.connect(ctx.destination);
  const voice={sources:[noise,whistle,warble],nodes:[noise,filter,distort,output,whistle,whistleGain,warble,warbleDepth]};active=voice;
  noise.onended=()=>{voice.nodes.forEach(n=>n.disconnect());if(active===voice)active=null};noise.start();whistle.start();warble.start();noise.stop(now+.76);whistle.stop(now+.76);warble.stop(now+.76);
 }
 return {start,stop};
}
