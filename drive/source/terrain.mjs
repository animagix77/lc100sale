import {routeSample,riverDistance,riverWidth,riverLevel,volcanoRelief,riverGreenery,VOLCANO} from './expedition.mjs';
// Deterministic infinite coastline. World coordinates remain stable as render tiles recycle.
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const hash=(x,z)=>{const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n)};
export function noise(x,z){const a=Math.floor(x),b=Math.floor(z),u=smooth(0,1,x-a),v=smooth(0,1,z-b);return (hash(a,b)*(1-u)+hash(a+1,b)*u)*(1-v)+(hash(a,b+1)*(1-u)+hash(a+1,b+1)*u)*v}
export const shore=z=>-36+8*Math.sin(z*.006)+3*Math.sin(z*.019);
export function coastalHeight(x,z){
 const d=x-shore(z);if(d<0)return -.4+d*.075;
 const bank=smooth(16,42,d),amplitude=5+26*smooth(24,105,d);
 const ridge=Math.pow(.5+.5*Math.sin(x*.067+Math.sin(z*.026)*1.8+z*.033),1.8);
 // Broad dunes plus crosswise swales put real suspension movement in the driving strip.
 // Fade them out at the waterline so the foreshore remains traversable.
 const swales=(Math.sin(z*.13+Math.sin(x*.08))*.90+Math.sin(z*.29-x*.15)*.40+(noise(x*.14,z*.14)-.5)*.65)*smooth(9,32,d);
 // Uneven 2–7 m hummocks and diagonal ribs exercise individual wheels. The wet
 // foreshore stays flatter; deep inland dunes retain the broad illustrated silhouette.
 const rough=smooth(6,20,d),patch=.45+.55*noise(x*.065,z*.055);
 const hummocks=((noise(x*.36,z*.32)-.5)*.34+Math.sin(z*1.45+x*.72+noise(x*.1,z*.1)*2)*.085+Math.sin(z*.83-x*.61)*.13)*rough*patch;
 return hummocks+-.4+d*.020+bank*(amplitude*(.08+ridge*.92)+noise(x*.041,z*.041)*1.8)+swales+Math.sin(z*.21+x*.32)*.055*smooth(5,25,d);
}
export function baseHeight(x,z){
 const coast=coastalHeight(x,z),d=x-shore(z);
 const ascent=smooth(205,310,x)*(1-smooth(690,850,x))*smooth(370,590,-z)*(1-smooth(900,1050,-z));
 const ridges=58+noise(x*.010,z*.011)*52+Math.pow(.5+.5*Math.sin(x*.028+z*.018),2)*30;
 const mountains=coast*(1-ascent)+ridges*ascent;
 const volcanoDistance=Math.hypot(x-VOLCANO.x,z-VOLCANO.z),volcanic=1-smooth(210,VOLCANO.radius,volcanoDistance);
 const original=volcanic>0?mountains+Math.max(0,volcanoRelief(x,z)-mountains)*volcanic:mountains;
 if(d<25||x>850||z< -1050||z>200)return original;
 const r=routeSample(x,z),regional=(1-smooth(110,210,r.distance))*smooth(25,70,d);
 if(regional<=0)return original;
 const w=r.weights,off=smooth(6,24,r.distance),rolling=(noise(x*.018,z*.018)-.5)*12+Math.sin(x*.048+z*.024)*2.2;
 const micro=(noise(x*.6,z*.6)-.5)*(.16+w.snow*.38+w.mud*.18);
 let ground=r.height+off*(4+rolling*(.65+w.snow*.55))+micro;
 // A narrow, readable trail. Snow remains deep away from the slightly compacted line.
 ground-=w.mud*.09*(1-smooth(.25,.6,Math.abs(r.distance-1.0)));
 ground+=w.snow*(.28+noise(x*.065,z*.055)*.65)*( .55+.45*off);
 const channel=riverDistance(x,z),bank=1-smooth(riverWidth(x)-1,riverWidth(x)+10,channel);
 if(x<515&&x>25)ground=ground*(1-bank)+(riverLevel(x)-.38+noise(x*.7,z*.7)*.12)*bank;
 // In the mountains cut a wide bench into continuous ridges, rather than
 // extending different switchback elevations into abrupt neighbouring plateaus.
 const trailBlend=regional*(1-ascent+ascent*(1-smooth(12,42,r.distance)));
 return original*(1-trailBlend)+ground*trailBlend;
}
export function surfaceAt(x,z){
 const d=x-shore(z),r=routeSample(x,z),inland=smooth(25,70,d)*(1-smooth(110,210,r.distance));
 const w=r.weights,snow=w.snow*inland,mud=w.mud*inland,grass=Math.max(w.grass*inland,riverGreenery(x,z)*.9)*(1-snow)*(1-w.volcanic),volcanic=w.volcanic*inland,river=(1-smooth(riverWidth(x),riverWidth(x)+3,riverDistance(x,z)))*inland;
 const sand=smooth(14,65,d)*(.78+.22*noise(x*.026,z*.026));
 return {biome:inland>.5?r.biome:d>35?'dunes':'beach',snow,mud,grass,trail:1-smooth(4,10,r.distance),volcanic:Math.max(volcanic,smooth(235,165,Math.hypot(x-VOLCANO.x,z-VOLCANO.z))),river,puddle:mud*(1-smooth(2,5,r.distance))*smooth(.48,.75,noise(r.x*.13,r.z*.13)),soft:sand*(1-inland)+inland*(w.dunes*.8+w.beach*.2+grass*.15+snow*(.40+.27*smooth(3,10,r.distance))+mud*(.30+.38*smooth(3,10,r.distance))+river*.12),grip:1-snow*.07-mud*.31-river*.13};
}
export const softnessAt=(x,z)=>surfaceAt(x,z).soft;
// Sparse half-metre deformation field, shared across tile edges and the physics collider.
export class SandField{
 constructor(){this.ruts=new Map();this.dirty=new Set();this.stamps=0;this.deepest=0;this.clock=0}
 gridOffset(i,j){return this.ruts.get(`${i},${j}`)?.depth||0}
 atGrid(i,j){return baseHeight(i*.5,j*.5)+this.gridOffset(i,j)}
 height(x,z){const gx=x*2,gz=z*2,i=Math.floor(gx),j=Math.floor(gz),u=gx-i,v=gz-j;return (this.atGrid(i,j)*(1-u)+this.atGrid(i+1,j)*u)*(1-v)+(this.atGrid(i,j+1)*(1-u)+this.atGrid(i+1,j+1)*u)*v}
 depthAt(x,z){const i=Math.floor(x*2),j=Math.floor(z*2),u=x*2-i,v=z*2-j;const d=(a,b)=>Math.max(0,-(this.ruts.get(a+','+b)?.depth||0));return (d(i,j)*(1-u)+d(i+1,j)*u)*(1-v)+(d(i,j+1)*(1-u)+d(i+1,j+1)*u)*v}
 // The belly compresses powder too: deep wheel channels must not leave an
 // indestructible ridge of snow holding all four wheels in the air.
 compactSnow(x,z,underside){
  const surface=surfaceAt(x,z);if(surface.snow<.15)return;
  const ix=Math.round(x*2),iz=Math.round(z*2);
  for(let j=iz-1;j<=iz+1;j++)for(let i=ix-1;i<=ix+1;i++){
   if(Math.hypot(i*.5-x,j*.5-z)>.68)continue;
   const key=`${i},${j}`,old=this.gridOffset(i,j),desired=Math.max(-.32*surface.snow,underside-baseHeight(i*.5,j*.5));
   if(desired>=old-.005)continue;this.ruts.set(key,{depth:desired,t:++this.clock});this.deepest=Math.min(this.deepest,desired);
   for(const tx of [Math.floor((i*.5-.001)/32),Math.floor((i*.5+.001)/32)])for(const tz of [Math.floor((j*.5-.001)/32),Math.floor((j*.5+.001)/32)])this.dirty.add(`${tx},${tz}`);
  }
 }
 stamp(x,z,load=1,travel=.17,slip=0){this.stamps++;this.clock++;const ix=Math.round(x*2),iz=Math.round(z*2),surface=surfaceAt(x,z),soft=surface.soft;for(let j=iz-2;j<=iz+2;j++)for(let i=ix-2;i<=ix+2;i++){const r=Math.hypot(i*.5-x,j*.5-z);if(r>1.0)continue;const key=`${i},${j}`,old=this.ruts.get(key)?.depth||0;const energy=clamp(travel/.17,.1,2.5),dig=1+soft*Math.min(3,slip)*.50;
 const depression=-.025*(1+surface.snow*.9+surface.mud*.7)*(.35+soft)*clamp(load,.25,1.7)*energy*dig*Math.exp(-r*r/.16);
 const berm=r>.44?.010*(1+surface.snow*2.0)*energy*soft*Math.exp(-Math.pow((r-.76)/.19,2)):0;
 // Rolling compacts a shallow track; sustained wheelspin can excavate a deep hole.
 const looseCap=.06+.16*soft+surface.snow*.32+surface.mud*.12+(.08+.58*soft)*smooth(.35,2,slip);
 const offTrail=smooth(3,10,routeSample(x,z).distance);
 const cap=surface.snow>.1?Math.min(looseCap,.26+.10*offTrail):surface.mud>.1?Math.min(looseCap,.22+.32*offTrail):looseCap;
 const depth=clamp(old+depression+berm,Math.min(old,-cap),.16);this.ruts.set(key,{depth,t:this.clock});this.deepest=Math.min(this.deepest,depth);for(const tx of [Math.floor((i*.5-.001)/32),Math.floor((i*.5+.001)/32)])for(const tz of [Math.floor((j*.5-.001)/32),Math.floor((j*.5+.001)/32)])this.dirty.add(`${tx},${tz}`)}
 // Retain the most recent ~kilometres of tracks without growing memory indefinitely.
 if(this.ruts.size>90000){let n=0;for(const key of this.ruts.keys()){this.ruts.delete(key);if(++n===12000)break}}
 }
}
