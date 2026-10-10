import {puddleCut,puddleDampness} from './mud-puddles.mjs';
import {lavaCrossingProfile} from './lava-crossing.mjs';
import {canyonHeight,canyonFirmness,canyonRockMask,canyonRiverProfile} from './canyon.mjs';
import {routeSample,riverDistance,riverWidth,riverProfile,riverApproach,volcanoRelief,riverGreenery,VOLCANO,CAMP} from './expedition.mjs';
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
// Judge Dean LLC — a gently graded entry between flags 01 and 02.
// Feather into the untouched dunes outside the 12 m driving corridor.
export function entryTrail(x,z){
 const t=((x+18)*36-(z+60)*50)/3796;
 const distance=Math.abs((x+18)*50+(z+60)*36)/Math.sqrt(3796);
 const blend=smooth(12,22,x-shore(z))*(1-smooth(6,18,distance))*smooth(-.16,0,t)*(1-smooth(1,1.26,t));
 return {blend,height:.61+4.43*smooth(0,1,t)};
}
// Judge Dean LLC — old paired tyre channels follow the dry foreshore. They are
// ground geometry, shared by suspension/colliders, rather than painted tracks.
// No mutable stamps: the same worn beach returns when tiles stream or reload.
export function beachRuts(x,z){
 const d=x-shore(z),band=smooth(10,14,d)*(1-smooth(33,40,d));
 if(band<=0)return 0;
 const riverFade=smooth(20,40,riverDistance(x,z));if(riverFade<=0)return 0;
 let cut=0,rim=0;
 for(let lane=0;lane<4;lane++){
  const seed=lane*37.7,center=15.2+lane*6.4+(noise(z*.014,seed)-.5)*3.4+Math.sin(z*.043+seed)*.36;
  const offset=d-center;if(Math.abs(offset)>2.3)continue;
  const wear=.55+.45*noise(z*.075,seed+9),width=.36+.13*noise(z*.045,seed+4);
  const depth=(.15+.09*noise(z*.027,seed+2))*wear;
  for(const side of [-1,1]){
   const across=Math.abs(offset-side*.87),groove=Math.exp(-Math.pow(across/width,2));
   // Soft irregular shoulders, with shallow longitudinal corrugation from
   // repeated traffic. Avoid a regular washboard or vertical trench walls.
   const chatter=1+Math.sin(z*4.3+seed)*.06+Math.sin(z*7.1+seed)*.025;
   cut=Math.min(cut,-depth*groove*chatter);
   rim+=depth*.32*Math.exp(-Math.pow((across-.72)/.25,2));
  }
 }
 return (cut+rim)*band*riverFade*(1-entryTrail(x,z).blend*.5);
}
function regionalHeight(x,z){
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
 // In the mountains cut a wide bench into continuous ridges, rather than
 // extending different switchback elevations into abrupt neighbouring plateaus.
 const trailBlend=regional*(1-ascent+ascent*(1-smooth(12,42,r.distance)));
 return original*(1-trailBlend)+ground*trailBlend;
}
// The liquid follows the underlying mountain grade, below the causeway surface.
export function lavaSurfaceHeight(x,z){return regionalHeight(x,z)-.58}
function undisturbedHeight(x,z){
 let original=regionalHeight(x,z);
 const entry=entryTrail(x,z);original+=(entry.height-original)*entry.blend;
 const lava=lavaCrossingProfile(x,z);
 if(lava){
  const edge=smooth(lava.width-.5,lava.width+3,Math.abs(lava.u));
  // A recessed molten bed with a dry, continuous driving bench through it.
  const bed=original-1.5+edge*1.85;
  original+=(bed-original)*lava.influence*(1-lava.causeway);
 }
 // Apply after regional blending, including the coast and areas away from the
 // route. Previously the rendered river crossed untouched hills at its mouth.
 if(x< -72||x>538||Math.abs(z+340)>55)return original;
 const profile=riverProfile(x,z);if(profile.influence<=0)return original;
 const ripple=(noise(x*.7,z*.7)-.5)*.06*smooth(0,.20,Math.max(0,profile.depth));
 const channel=profile.ground+ripple;
 // Do not build a dam where the river opens into the sea. Landward of the
 // mouth, both banks use the same elevation profile as the water surface.
 const land=smooth(4,22,x-shore(z)),target=Math.min(original,channel)*(1-land)+channel*land;
 return original+(target-original)*profile.influence;
}
// The same shallow basin is sampled by render geometry, tyres and colliders.
export function baseHeight(x,z){const h=canyonHeight(x,z,undisturbedHeight(x,z)-puddleCut(x,z)+beachRuts(x,z)),pad=1-smooth(15,27,Math.hypot(x-CAMP.x,z-CAMP.z));return h+(CAMP.height-h)*pad;}
export function surfaceAt(x,z){
 const d=x-shore(z),r=routeSample(x,z),inland=smooth(25,70,d)*(1-smooth(110,210,r.distance));
 const w=r.weights,profile=riverProfile(x,z),river=profile.wet,approach=riverApproach(x,z,r,profile);
 const rock=canyonRockMask(x,z),firm=Math.max(canyonFirmness(x,z),rock),snow=w.snow*inland*(1-firm),mud=Math.max(w.mud*inland,approach*.72*(1-river))*(1-firm);
 const grass=Math.max(w.grass*inland,riverGreenery(x,z)*.9)*(1-snow)*(1-w.volcanic)*(1-river)*(1-approach)*(1-rock),volcanic=w.volcanic*inland;
 const sand=smooth(14,65,d)*(.78+.22*noise(x*.026,z*.026));
 return {canyonRock:rock,canyonRiver:rock>0?canyonRiverProfile(x,z).wet*rock:0,riverApproach:approach,biome:inland>.5?r.biome:d>35?'dunes':'beach',snow,mud,grass,trail:1-smooth(4,10,r.distance),volcanic:Math.max(volcanic,smooth(235,165,Math.hypot(x-VOLCANO.x,z-VOLCANO.z))),river,puddle:Math.max(puddleDampness(x,z),mud*(1-smooth(2,5,r.distance))*smooth(.48,.75,noise(r.x*.13,r.z*.13)))*(1-firm),soft:(1-firm)*(r.branch? .45:1)*(1-entryTrail(x,z).blend*.45)*(sand*(1-inland)+inland*(w.dunes*.8+w.beach*.2+grass*.15+snow*(.40+.27*smooth(3,10,r.distance))+mud*(.30+.38*smooth(3,10,r.distance))+river*.12)),grip:1-snow*.07-mud*.31-river*.13};
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
 stamp(x,z,load=1,travel=.17,slip=0,heading=0){this.stamps++;this.clock++;
 const material=surfaceAt(x,z);
 if(material.biome==='beach'&&x-shore(z)<35&&material.snow<.1&&material.mud<.1&&material.river<.1&&material.volcanic<.1){
  this.stampSand(x,z,load,travel,slip,heading,material.soft);this.trim();return;
 }
 const ix=Math.round(x*2),iz=Math.round(z*2),surface=surfaceAt(x,z),soft=surface.soft;for(let j=iz-2;j<=iz+2;j++)for(let i=ix-2;i<=ix+2;i++){const r=Math.hypot(i*.5-x,j*.5-z);if(r>1.0)continue;const key=`${i},${j}`,old=this.ruts.get(key)?.depth||0;const energy=clamp(travel/.17,.1,2.5),dig=1+soft*Math.min(3,slip)*.50;
 const depression=-.025*(1+surface.snow*.9+surface.mud*.7)*(.35+soft)*clamp(load,.25,1.7)*energy*dig*Math.exp(-r*r/.16);
 const berm=r>.44?.010*(1+surface.snow*2.0)*energy*soft*Math.exp(-Math.pow((r-.76)/.19,2)):0;
 // Rolling compacts a shallow track; sustained wheelspin can excavate a deep hole.
 const looseCap=.06+.16*soft+surface.snow*.32+surface.mud*.12+(.08+.58*soft)*smooth(.35,2,slip);
 const offTrail=smooth(3,10,routeSample(x,z).distance);
 const cap=surface.snow>.1?Math.min(looseCap,.26+.10*offTrail):surface.mud>.1?Math.min(looseCap,.22+.32*offTrail):looseCap;
 const depth=clamp(old+depression+berm,Math.min(old,-cap),.16);this.ruts.set(key,{depth,t:this.clock});this.deepest=Math.min(this.deepest,depth);for(const tx of [Math.floor((i*.5-.001)/32),Math.floor((i*.5+.001)/32)])for(const tz of [Math.floor((j*.5-.001)/32),Math.floor((j*.5+.001)/32)])this.dirty.add(`${tx},${tz}`)}
 // Retain the most recent ~kilometres of tracks without growing memory indefinitely.
 this.trim();
 }
 writeOffset(i,j,depth){
  this.ruts.set(`${i},${j}`,{depth,t:this.clock});this.deepest=Math.min(this.deepest,depth);
  for(const tx of [Math.floor((i*.5-.001)/32),Math.floor((i*.5+.001)/32)])for(const tz of [Math.floor((j*.5-.001)/32),Math.floor((j*.5+.001)/32)])this.dirty.add(`${tx},${tz}`);
 }
 stampSand(x,z,load,travel,slip,heading,soft){
  // Firm beach still yields to a 2.5-tonne truck. Deformation is independent
  // of drivetrain softness, so readable ruts do not add artificial drag.
  const exposed=smooth(4,15,x-shore(z)),spin=smooth(.35,2,slip),energy=clamp(travel/.17,.1,2.5),pressure=clamp(load,.25,1.7);
  const cut=(.036+.030*soft)*exposed*pressure*energy*(1+soft*Math.min(3,slip)*.5);
  const cap=(.14+.14*soft+(.04+.52*soft)*spin)*(.35+.65*exposed),rimCap=(.085+.075*soft+.055*spin)*exposed;
  const ix=Math.round(x*2),iz=Math.round(z*2),cs=Math.cos(heading),sn=Math.sin(heading),shoulders=[],sideWeights=[0,0];let removed=0;
  for(let j=iz-2;j<=iz+2;j++)for(let i=ix-2;i<=ix+2;i++){
   const dx=i*.5-x,dz=j*.5-z,across=dx*cs-dz*sn,along=dx*sn+dz*cs;
   if(Math.abs(across)>1.02||Math.abs(along)>1.02)continue;
   const longitudinal=Math.exp(-along*along/.30),old=this.gridOffset(i,j),depth=Math.max(Math.min(old,-cap),old-cut*Math.exp(-across*across/.105)*(1-smooth(.30,.50,Math.abs(across)))*longitudinal);
   if(depth<old-1e-8){removed+=old-depth;this.writeOffset(i,j,depth)}
   if(Math.abs(across)>.38){const weight=Math.exp(-Math.pow((Math.abs(across)-.66)/.23,2))*longitudinal;const side=across<0?0:1;shoulders.push({i,j,weight,side});sideWeights[side]+=weight;}
  }
  // Move a share of the actual excavated volume sideways; the rest compacts.
  // Once a trench reaches its cap, spinning cannot grow an endless sand wall.
  if(removed>0)for(const {i,j,weight,side} of shoulders){const old=this.gridOffset(i,j),depth=Math.max(old,Math.min(rimCap,old+removed*(.70+soft*.12)*.5*weight/sideWeights[side]));if(depth>old+1e-8)this.writeOffset(i,j,depth)}
 }
 trim(){if(this.ruts.size>90000){let n=0;for(const key of this.ruts.keys()){this.ruts.delete(key);if(++n===12000)break}}}
}
