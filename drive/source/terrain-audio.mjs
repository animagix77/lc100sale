// Judge Dean LLC — continuous tyre foley driven by real, loaded ground contacts.
import {VEHICLE_SETUP} from './vehicle-spec.mjs';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const TERRAIN_VOICES=['sand','snow','slush','gravel'];
export function terrainContactMix({speed=0,tyres=[],rain=0,waterDepth=0,waterContact=0}={}){
 const result=Object.fromEntries(TERRAIN_VOICES.map(k=>[k,{gain:0,rate:.82,cutoff:0}]));
 let workSum=0,weight=0;
 for(const w of tyres){
  if(!w.contact)continue;
  const surface=w.audioSurface||{sand:1,snow:0,mud:0,gravel:0,wet:w.wet?1:0,compaction:0};
  const normal=clamp((w.audioLoad??6000)/6000,0,1.65);if(normal<=0)continue;
  const travel=Math.abs(w.audioSpeed??speed),tread=Math.abs(w.omega||0)*VEHICLE_SETUP.rollingRadius;
  const shear=Math.max(w.audioSlip??Math.abs(tread-travel),Math.abs(w.sideSlip||0)*.8);
  // A settled suspension can rock a little without continually making noise.
  const work=Math.max(travel,shear*.72),gate=clamp((work-.12)/.45),motion=gate*(1-Math.exp(-work/3))**.65;
  const pressure=Math.sqrt(normal),contact=motion*pressure/4;
  const wet=clamp(Math.max(surface.wet||0,(Number(rain)||0)*.45));
  const immersed=w.wet===true||(!w.audioSurface&&waterContact>0);
  const underwater=immersed?clamp((waterDepth||.18)/.35)*.92:0;
  const exposed=1-underwater,loose=1-clamp(surface.compaction||0)*.32;
  const sand=clamp(surface.sand||0),snow=clamp(surface.snow||0),mud=clamp(surface.mud||0),gravel=clamp(surface.gravel||0);
  result.sand.gain+=contact*sand*.24*loose*(1-wet*.28)*exposed;
  result.snow.gain+=contact*snow*.66*(1-wet*.62)*exposed;
  result.slush.gain+=contact*(snow*(.12+wet*.72)+mud*(.72+wet*.28))*.58*exposed;
  result.gravel.gain+=contact*gravel*.42*(1-wet*.36)*exposed;
  const material=sand+snow+mud+gravel;workSum+=clamp(work,0,20)*contact*material;weight+=contact*material;
 }
 const activity=weight?clamp(workSum/weight/12):0;
 for(const [kind,v] of Object.entries(result)){
  v.gain=clamp(v.gain,0,.68);
  v.rate=(kind==='slush'?.76:.82)+Math.sqrt(activity)*(kind==='slush'?.26:.42);
  v.cutoff=({sand:1050,snow:3200,slush:1050,gravel:2400})[kind]+activity*({sand:350,snow:700,slush:650,gravel:500})[kind];
 }
 return result;
}

// Original granular foley, prepared once while loading. Overlapping irregular
// strokes carry weight and texture without footstep cadence or sharp clicks.
// Sand's recorded bed remains underneath; these are designed effects, not
// claimed field recordings of snow or of this particular vehicle.
export function terrainPCM(kind,sampleRate=48000,channel=0){
 if(!TERRAIN_VOICES.includes(kind))throw new Error('Unknown terrain voice');
 const seconds=4,length=Math.round(sampleRate*seconds),out=new Float32Array(length);
 let seed=13957+TERRAIN_VOICES.indexOf(kind)*4919+channel*2713;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const lowBlend=1-Math.exp(-2*Math.PI*145/sampleRate),midBlend=1-Math.exp(-2*Math.PI*(kind==='slush'?650:1250)/sampleRate),highBlend=1-Math.exp(-2*Math.PI*4300/sampleRate);
 const low=new Float32Array(length),mid=new Float32Array(length),high=new Float32Array(length);let l=0,m=0,h=0;
 for(let i=0;i<length;i++){const n=random()*2-1;l+=(n-l)*lowBlend;m+=(n-m)*midBlend;h+=(n-h)*highBlend;low[i]=l;mid[i]=m;high[i]=h-m;}
 // Variable-width grains wrap into the beginning, then a tiny edge fade
 // guarantees silence at the exact loop seam. Each stereo channel differs.
 const density={sand:24,snow:15,slush:11,gravel:27}[kind];
 for(let at=-.4;at<seconds;at+=.35/density+random()*1.3/density){
  const duration=kind==='slush'?.12+random()*.20:kind==='snow'?.055+random()*.19:kind==='sand'?.045+random()*.14:.025+random()*.075;
  const count=Math.ceil(duration*sampleRate),start=Math.floor(at*sampleRate),amplitude=.45+random()*.65;
  const fracture=.2+random()*.35,fracture2=.55+random()*.22;
  for(let j=0;j<count;j++){
   const i=((start+j)%length+length)%length,u=j/count;
   const attack=clamp(u/(kind==='slush'?.16:.09)),tail=(1-u)**1.8;
   const clusters=kind==='snow'?.32+1.3*Math.exp(-(((u-fracture)/.045)**2))+.8*Math.exp(-(((u-fracture2)/.07)**2)):1;
   const texture=kind==='slush'?low[i]*3.7+mid[i]*1.1:kind==='sand'?low[i]*1.5+mid[i]*.9+high[i]*.25:kind==='snow'?low[i]*1.3+mid[i]*1.6+high[i]*.55:low[i]*1.4+mid[i]*1.2+high[i]*.32;
   out[i]+=texture*attack*tail*amplitude*clusters;
  }
 }
 let power=0;for(let i=0;i<length;i++){out[i]=Math.tanh(out[i]*1.4);power+=out[i]**2;}
 const scale=.19/Math.max(.001,Math.sqrt(power/length));
 for(let i=0;i<length;i++){const edge=Math.min(1,i/(sampleRate*.008),(length-1-i)/(sampleRate*.008));out[i]=clamp(out[i]*scale,-.85,.85)*edge;}
 return out;
}
export function terrainAudioBank(ctx){
 const bank={};for(const kind of TERRAIN_VOICES){const buffer=ctx.createBuffer(2,Math.round(ctx.sampleRate*4),ctx.sampleRate);for(let c=0;c<2;c++)buffer.getChannelData(c).set(terrainPCM(kind,ctx.sampleRate,c));bank['terrain-'+kind]=buffer;}return bank;
}
