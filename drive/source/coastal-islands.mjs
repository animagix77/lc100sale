// Judge Dean LLC — persistent low-tide archipelago. These elevations are shared
// by the rendered ground, streamed collision meshes, route and ocean bathymetry.
// Metres in world coordinates; sandbar width is its full intertidal shelf width.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
const hash=(x,z)=>{const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n)};
const noise=(x,z)=>{const i=Math.floor(x),j=Math.floor(z),u=smooth(0,1,x-i),v=smooth(0,1,z-j);return (hash(i,j)*(1-u)+hash(i+1,j)*u)*(1-v)+(hash(i,j+1)*(1-u)+hash(i+1,j+1)*u)*v};
export const ISLANDS=Object.freeze([
 {name:'Palm cay',x:-143,z:-221,rx:65,rz:50,height:5.2},
 {name:'Driftwood island',x:-303,z:-304,rx:65,rz:55,height:6.5},
 {name:'Sunset island',x:-426,z:-245,rx:55,rz:50,height:4.7}
].map(Object.freeze));
export const COASTAL_CAMP=Object.freeze({x:-421,z:-246,height:2.3,radius:18,name:'Island sunset camp'});
export const BARGE_SITE=Object.freeze({x:-190,z:-188,yaw:-.55,length:25,width:10});
export const COASTAL_LANDMARKS=Object.freeze([
 {x:-14,z:0,height:.36,name:'Base camp'},
 {x:-18,z:-60,height:.61,name:'The shoreline'},
 {x:-21,z:-130,height:1.32,name:'Coastal sands'},
 {x:-60,z:-186,height:.72,name:'Low-tide crossing'},
 {x:-137,z:-226,height:1.5,name:'Palm cay'},
 {x:-195,z:-210,height:1.15,name:'Barge bay'},
 {x:-239,z:-251,height:.70,name:'Lagoon sandbar'},
 {x:-300,z:-303,height:1.8,name:'Driftwood island'},
 {x:-345,z:-338,height:2.1,name:'Ocean lookout'},
 {x:-380,z:-288,height:.75,name:'Sunset sandbar'},
 {x:-421,z:-246,height:COASTAL_CAMP.height,name:COASTAL_CAMP.name}
].map((point,index)=>Object.freeze({...point,index,biome:index===4||index===7||index===8?'dunes':'beach'})));
// All three crossings stay exposed. There is deliberately no changing tide
// timer: sightseeing cannot strand the player away from the return crossing.
export const SANDBARS=Object.freeze([
 {name:'Palm cay crossing',width:28,height:.72,points:[{x:-25,z:-136},{x:-60,z:-186},{x:-101,z:-207},{x:-137,z:-226}]},
 {name:'Lagoon crossing',width:28,height:.70,points:[{x:-195,z:-210},{x:-239,z:-251},{x:-300,z:-303}]},
 {name:'Sunset crossing',width:30,height:.75,points:[{x:-345,z:-338},{x:-380,z:-288},{x:-421,z:-246}]}
].map(bar=>Object.freeze({...bar,points:Object.freeze(bar.points.map(Object.freeze))})));
const segment=(a,b,extra={})=>({...extra,a,b,dx:b.x-a.x,dz:b.z-a.z,length2:(b.x-a.x)**2+(b.z-a.z)**2});
const routeSegments=COASTAL_LANDMARKS.slice(1).map((point,i)=>segment(COASTAL_LANDMARKS[i],point,{index:i}));
const barSegments=SANDBARS.flatMap(bar=>bar.points.slice(1).map((point,i)=>segment(bar.points[i],point,{bar})));
function closest(x,z,segments){
 let distance2=Infinity,found=null,along=0,px=0,pz=0;
 for(const s of segments){const t=clamp(((x-s.a.x)*s.dx+(z-s.a.z)*s.dz)/s.length2,0,1),qx=s.a.x+t*s.dx,qz=s.a.z+t*s.dz,d2=(x-qx)**2+(z-qz)**2;if(d2<distance2){distance2=d2;found=s;along=t;px=qx;pz=qz}}
 return {distance:Math.sqrt(distance2),segment:found,t:along,x:px,z:pz};
}
export function coastalRouteSample(x,z){const q=closest(x,z,routeSegments),s=q.segment;return {...q,signedDistance:((x-q.x)*s.dz-(z-q.z)*s.dx)/Math.sqrt(s.length2),height:s.a.height+(s.b.height-s.a.height)*q.t,index:s.index}}
export function coastalRouteDistance(x,z){return closest(x,z,routeSegments).distance}
// Judge Dean LLC — weathered paired traffic lines on the complete coastal route.
// The primary line is shallow and compacted; older parallel passes sit farther
// out in the softer shoulders. Shared by ground geometry and rut shading.
const COASTAL_RUT_BANDS=[[.96,.10,.54],[2.65,.14,.49],[4.57,.14,.49]];
export function coastalWornRuts(x,z,route=null){
 if(x> -7||x< -480||z>12||z< -380)return 0;
 const q=route||coastalRouteSample(x,z);if(q.distance>7.4)return 0;
 const fade=(1-smooth(5.5,7.4,q.distance))*(1-smooth(-2,12,z))*smooth(18,27,Math.hypot(x-COASTAL_CAMP.x,z-COASTAL_CAMP.z));
 if(!fade)return 0;
 // Slow lateral wander follows old drivers' lines, independently of the
 // broader tidal bank. It fades on the shared mainland approach.
 const wander=(noise(x*.025+41,z*.025-17)-.5)*3.2*smooth(-25,-60,x);
 const wear=.60+.40*noise(x*.045+12,z*.045),d=Math.abs(q.signedDistance-wander);
 let cut=0,rim=0;
 for(const [center,depth,width] of COASTAL_RUT_BANDS){
  const across=Math.abs(d-center),strength=center<2?1:(.40+.60*noise(x*.027+center,z*.035));
  cut=Math.min(cut,-depth*wear*strength*Math.exp(-((across/width)**2)));
  rim+=depth*.16*wear*strength*Math.exp(-(((across-.83)/.34)**2));
 }
 return (cut+rim)*fade;
}
export function coastalLaneHeight(x,z,route=coastalRouteSample(x,z),wornRut=coastalWornRuts(x,z,route)){
 return route.height+Math.sin(x*.065+z*.054)*.016+wornRut;
}
// The original approach inherited metre-scale dunes and submerged swales.
// Grade this narrow shared beach lane separately from offshore island support,
// keeping mainland mountains and the rest of the original beach untouched.
export function coastalEntryProfile(x,z){
 if(x< -44||x> -7||z< -166||z>12)return {blend:0,height:0};
 const route=coastalRouteSample(x,z),blend=(1-smooth(4.5,11,route.distance))*(1-smooth(-2,12,z))*smooth(-44,-32,x);
 return {blend,height:blend?coastalLaneHeight(x,z,route):0};
}
export function coastalLaneCompaction(x,z,route=null){
 if(x> -7||x< -480||z>12||z< -380)return 0;
 const q=route||coastalRouteSample(x,z);
 return (1-smooth(3.6,7,q.distance))*(1-smooth(-2,12,z));
}
// A cheap spatial gate protects the entire mainland (x >= -25) exactly and
// prevents island noise/route work from running across the rest of the world.
export function archipelagoRegion(x,z){
 if(x>=-25||x<=-535||z>=-105||z<=-420)return 0;
 return smooth(-25,-32,x)*smooth(-535,-505,x)*smooth(-420,-385,z)*(1-smooth(-130,-105,z));
}
const OUTSIDE=Object.freeze({influence:0,height:0,land:0,beach:0,beachDry:0,grass:0,rock:0,trail:0,sandbar:0,island:0});
export function islandProfile(x,z){
 const region=archipelagoRegion(x,z);if(region===0)return OUTSIDE;
 let h=-Infinity,influence=0,interior=0,rock=0;
 for(let i=0;i<ISLANDS.length;i++){
  const island=ISLANDS[i],dx=(x-island.x)/island.rx,dz=(z-island.z)/island.rz;
  if(Math.abs(dx)>1.65||Math.abs(dz)>1.65)continue;
  // Lobed coastlines and several noise scales avoid regular oval sand discs.
  const angle=Math.atan2(dz,dx),r=Math.hypot(dx,dz)/(1+.105*Math.sin(angle*3+i*1.7)+.06*Math.sin(angle*5-i)+.024*Math.sin(angle*9+i)+.035*(noise(x*.035,z*.035)-.5));
  if(r>=1.55)continue;
  const support=1-smooth(1.22,1.55,r),core=1-smooth(.50,.88,r);
  const beach=-3.2+4.15*(1-smooth(.92,1.25,r));
  const dune=island.height*(1-smooth(.24,.83,r))*(.58+.42*noise(x*.035+i,z*.04));
  const headland=smooth(.22,.72,dx)*smooth(-.05,-.68,dz)*(1-smooth(.80,1.02,r));
  const relief=beach+dune+headland*(2.7+noise(x*.10,z*.11)*2.4)+(noise(x*.27,z*.25)-.5)*.16*(1-smooth(.85,1.20,r));
  if(relief>h){h=relief;interior=core;rock=headland}
  influence=Math.max(influence,support);
 }
 const crossing=closest(x,z,barSegments),bar=crossing.segment.bar;
 // Tidal shelves widen into lobes and narrow into shallow scallops. Sample
 // world space so both banks differ and adjoining segments share their shape.
 // All relief starts outside the protected driving corridor: irregular banks
 // must not reintroduce bumps or submerged dips in the scenic lane.
 const bankNoise=noise(x*.032+71,z*.032-29),detail=noise(x*.085-19,z*.085+37);
 const half=bar.width*.5+3+(bankNoise-.5)*13+(detail-.5)*2.4;
 const bankDistance=crossing.distance;
 const barSupport=1-smooth(half+18,half+36,bankDistance);
 if(barSupport>0){
  const crest=6.5+(noise(x*.042-3,z*.042+19)-.5)*2;
  const shelf=bar.height-smooth(crest,half,bankDistance)*(bar.height+.45)-smooth(half,half+18,bankDistance)*3;
  h=Math.max(h,shelf);influence=Math.max(influence,barSupport);
 }
 if(influence<=0)return OUTSIDE;
 const route=coastalRouteSample(x,z),shoulder=18+(noise(x*.035+33,z*.035-51)-.5)*16,trail=1-smooth(4.5,shoulder,route.distance);
 // Gentle undulation and shallow old tyre channels keep the traversable line
 // tactile without adding a sharp berm or a deep trench at island boundaries.
 const wornRut=coastalWornRuts(x,z,route),laneHeight=coastalLaneHeight(x,z,route,wornRut);
 h+=(laneHeight-h)*trail;
 const camp=1-smooth(COASTAL_CAMP.radius,COASTAL_CAMP.radius+10,Math.hypot(x-COASTAL_CAMP.x,z-COASTAL_CAMP.z));
 h+=(COASTAL_CAMP.height-h)*camp;
 const land=smooth(-.10,.75,h),grass=land*interior*(1-trail*.96)*(1-rock)*(1-camp)*(.50+.50*noise(x*.07,z*.065));
 return {influence:influence*region,height:h,land,beach:land*(1-grass)*(1-rock),beachDry:smooth(.03,.68,h),grass,rock:rock*(1-trail)*(1-camp),trail,compaction:coastalLaneCompaction(x,z,route),wornRut:wornRut*(1-camp),sandbar:barSupport*(1-interior),island:region};
}
export function islandTerrainHeight(x,z,original){const p=islandProfile(x,z);return original+(p.height-original)*p.influence}
// Match the ocean shader: an offshore swell loses energy over the same shallow
// shelf that tyres collide with. Deep channels retain the open-ocean motion.
export function islandWaveAttenuation(x,z,bed){return 1-archipelagoRegion(x,z)*(1-smooth(.05,2.6,-.18-bed))}

// A bounded one-metre bathymetry grid is prepared during initial loading.
// Water needs the shape of shallow shelves, not the dry dune's centimetre
// grains. CPU water contacts and GPU water vertices use this identical sample;
// tyres and rendered terrain keep their existing exact half-metre geometry.
const BED_X=-535,BED_Z=-420,BED_NX=511,BED_NZ=316;
const bathymetry=new Float32Array(BED_NX*BED_NZ).fill(NaN);
let bedSamples=0,bedReady=false;
function bedAt(i,j,sampleHeight){const key=j*BED_NX+i;let h=bathymetry[key];if(Number.isNaN(h)){bathymetry[key]=sampleHeight(BED_X+i,BED_Z+j);h=bathymetry[key];bedSamples++;}return h}
export function preloadIslandBathymetry(sampleHeight){
 if(bedReady)return;
 for(let j=0;j<BED_NZ;j++)for(let i=0;i<BED_NX;i++)bedAt(i,j,sampleHeight);
 bedReady=true;
}
export function islandOceanBed(x,z,sampleHeight){
 const gx=clamp(x-BED_X,0,BED_NX-1),gz=clamp(z-BED_Z,0,BED_NZ-1),i=Math.min(BED_NX-2,Math.floor(gx)),j=Math.min(BED_NZ-2,Math.floor(gz)),u=gx-i,v=gz-j;
 return (bedAt(i,j,sampleHeight)*(1-u)+bedAt(i+1,j,sampleHeight)*u)*(1-v)+(bedAt(i,j+1,sampleHeight)*(1-u)+bedAt(i+1,j+1,sampleHeight)*u)*v;
}
export function islandBathymetryStats(){return {ready:bedReady,samples:bedSamples,capacity:bathymetry.length,bytes:bathymetry.byteLength,spacing:1}}
// The renderer packs this immutable, preloaded grid once into its GPU texture.
// Returning the same storage avoids duplicating or regenerating terrain data.
export function islandBathymetryGrid(sampleHeight){preloadIslandBathymetry(sampleHeight);return {x:BED_X,z:BED_Z,width:BED_NX,height:BED_NZ,spacing:1,data:bathymetry}}
