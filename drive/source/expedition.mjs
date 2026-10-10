// One continuous world. These landmarks guide the route; terrain and weather are spatial,
// so exploring off the flags or approaching a region from behind still works.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
export const LANDMARKS=[
 [-14,0,0,'beach','Base camp'],[-18,-60,.5,'beach','The shoreline'],[18,-110,5,'dunes','Dune saddle'],[64,-164,11,'dunes','The soft climb'],
 [128,-224,13,'grass','Grass country'],[190,-278,15,'grass','The meadow'],[236,-312,15.5,'river','Ford approach'],[248,-336,14.2,'river','Rocky ford'],
 [273,-405,26,'grass','Into the foothills'],[286,-477,39,'mud','The first switchback'],[365,-489,52,'mud','Low range. High hopes.'],
 [386,-562,67,'snow','Snow line'],[312,-600,81,'snow','The hairpin'],[360,-675,96,'snow','Above the clouds'],
 [447,-658,108,'volcanic','Black rock ridge'],[527,-680,116,'volcanic','Definitely not Home Depot'],
 [570,-570,99,'volcanic','The long way down'],[665,-536,80,'grass','Canyon bridge'],[665,-424,80,'grass','The far bank'],[627,-400,70,'grass','Canyon overlook'],[552,-430,58,'mud','Rain on the descent'],[475,-346,26.5,'river','Fern creek crossing'],
 [447,-300,24,'mud','Mud & manners'],[339,-147,13,'mud','Last puddle'],[255,-67,8,'grass','Homeward meadow'],
 [163,11,5,'grass','Back to grass'],[145,38,5,'grass','Sunset camp']
].map(([x,z,height,biome,name],index)=>({x,z,height,biome,name,index,...(name==='Canyon bridge'?{gateRadius:1.2}:{})}));
// Judge Dean LLC — two choices reconnect at shared gates. Every corridor exists in the world.
export const CAMP={x:145,z:38,height:5,radius:18};
export const ROUTE_FORKS=[
 {id:'dunes',at:2,title:'Across the dunes',options:[
  {id:'saddle',name:'Dune climb',description:'Direct, soft sand. Use steady throttle and 4LO.',replacements:{}},
  {id:'shelf',name:'Coastal shelf',description:'Longer, firmer graded shelf around the soft climb.',replacements:{3:{x:77,z:-127,height:9,biome:'dunes',name:'Coastal shelf'}}}]},
 {id:'return',at:21,title:'The last valley',options:[
  {id:'mud',name:'Mud trail',description:'Direct muddy descent. Keep momentum through the ruts.',replacements:{}},
  {id:'bank',name:'Fern bank',description:'A longer firm trail around the deepest mud.',replacements:{22:{x:511,z:-246,height:19,biome:'grass',name:'Fern bank'}}}]}
];
export const BRANCH_PATHS=ROUTE_FORKS.map(f=>{const o=f.options[1],indices=Object.keys(o.replacements).map(Number);return [LANDMARKS[indices[0]-1],...indices.map(i=>({...o.replacements[i],index:i})),LANDMARKS[indices.at(-1)+1]]});
export const BIOMES={beach:{name:'BEACH',color:'#c99768'},dunes:{name:'DUNES',color:'#dbac79'},grass:{name:'TALL GRASS',color:'#829261'},river:{name:'ROCKY RIVER',color:'#7cb1b5'},snow:{name:'DEEP SNOW',color:'#dce6ed'},mud:{name:'MUD TRAILS',color:'#806250'},volcanic:{name:'VOLCANIC RIDGE',color:'#ec794b'}};
const mainSegments=LANDMARKS.slice(0,-1).map((a,i)=>{const b=LANDMARKS[i+1],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);return {a,b,dx,dz,length,length2:length*length}});
const branchSegments=BRANCH_PATHS.flatMap(path=>path.slice(0,-1).map((a,i)=>{const b=path[i+1],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);return {a,b,dx,dz,length,length2:length*length,branch:true}}));
// Preserve the existing coastal dune landscape as an unflagged exploration trail.
const coastalTrail=[LANDMARKS.find(p=>p.name==='Back to grass'),{x:72,z:48,height:5,biome:'dunes'},{x:-14,z:0,height:0,biome:'beach'}];
const scenicSegments=coastalTrail.slice(0,-1).map((a,i)=>{const b=coastalTrail[i+1],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);return {a,b,dx,dz,length,length2:length*length}});
const segments=[...mainSegments,...branchSegments,...scenicSegments];
export const LOOP_LENGTH=mainSegments.reduce((n,s)=>n+s.length,0);
export function routeSample(x,z){
 let best=null,distance=Infinity,progress=0,bestProgress=0;
 for(const s of segments){const t=clamp(((x-s.a.x)*s.dx+(z-s.a.z)*s.dz)/s.length2,0,1),qx=s.a.x+s.dx*t,qz=s.a.z+s.dz*t,d=(x-qx)**2+(z-qz)**2;
  if(d<distance){distance=d;best={segment:s,t,x:qx,z:qz};bestProgress=progress+s.length*t;}progress+=s.length;
 }
 const b={...best.segment,...best},w=smooth(0,1,b.t),weights={beach:0,dunes:0,grass:0,river:0,snow:0,mud:0,volcanic:0};weights[b.a.biome]+=1-w;weights[b.b.biome]+=w;
 const biome=Object.keys(weights).reduce((a,k)=>weights[k]>weights[a]?k:a,'beach');
 return {x:b.x,z:b.z,distance:Math.sqrt(distance),height:b.a.height+(b.b.height-b.a.height)*w,weights,biome,branch:!!b.branch,progress:Math.min(1,bestProgress/LOOP_LENGTH),dx:b.dx/b.length,dz:b.dz/b.length};
}
// The same cross-section shapes the bed, the mean water edge, and wet contact.
// The upstream spring closes to a point; the mouth continues under the ocean.
export const riverBounds=Object.freeze({minX:-60,maxX:520});
export const riverZ=x=>-340+Math.sin((x-140)*.025)*10;
export const riverMouthBlend=x=>smooth(-48,-28,x);
export const riverLevel=x=>-.18+Math.max(0,x+36)*.052*smooth(-28,0,x);
export function riverDistance(x,z){return Math.abs(z-riverZ(x))}
export function riverWidth(x){return (4.8+2.6*Math.exp(-Math.pow((x-248)/32,2)))*(1-smooth(498,riverBounds.maxX,x))}
export function riverProfile(x,z){
 const level=riverLevel(x),distance=riverDistance(x,z),width=riverWidth(x),source=1-smooth(498,riverBounds.maxX,x),active=x>=riverBounds.minX&&x<riverBounds.maxX;
 const lateral=width>0?distance/width:Infinity;
 // A broad shallow bed eases into a real shoreline, then a gently sloped bank.
 // Bed detail vanishes at the waterline so noise cannot punch dry holes through it.
 const inner=1-smooth(.45,1,lateral),bed=.36*source*inner;
 const outside=Math.max(0,distance-width),bankRise=outside*.15;
 const depth=active?bed-bankRise:-bankRise;
 const influence=(1-smooth(width+8,width+28,distance))*(1-smooth(riverBounds.maxX,riverBounds.maxX+18,x))*smooth(riverBounds.minX-12,riverBounds.minX,x);
 return {level,distance,width,depth,wet:active?smooth(0,.035,depth):0,bank:smooth(width-.8,width+1.6,distance)*(1-smooth(width+8,width+20,distance)),influence,ground:level-depth};
}
// Worn approaches follow the flagged trail, not the whole green riverbank.
// Share this mask between surface materials, foliage, and physical stones.
export function riverApproach(x,z,route=routeSample(x,z),profile=riverProfile(x,z)){
 if(x<90||x>riverBounds.maxX||route.distance>=8)return 0;
 const bankDistance=Math.max(0,profile.distance-profile.width);
 return (1-smooth(4.5,8,route.distance))*(1-smooth(18,42,bankDistance));
}
export function riverMask(x,z){return riverProfile(x,z).wet}
export function riverRippleScale(x,z){return smooth(0,.25,Math.max(0,riverProfile(x,z).depth))}
export function riverHeight(x,z,time=0){return riverLevel(x)+(Math.sin(x*.9+z*1.8-time*2.2)*.012+Math.sin(x*2.3+time*3.1)*.006)*riverRippleScale(x,z)}
export function biomeWeather(x,z){const b=routeSample(x,z),w=b.weights;
 const canyon=(1-smooth(75,145,Math.abs(x-665)))*(1-smooth(65,120,Math.abs(z+470)));
 return {mode:'expedition',live:false,label:canyon>.6?'CANYON CROSSING':BIOMES[b.biome].name,canyon,volcanic:w.volcanic,altitude:8+canyon*12+w.river*14-w.grass*4+w.snow*8+w.mud*3-w.volcanic*16,cloud:.20+w.river*.18-w.grass*.05+w.snow*.65+w.mud*.74+w.volcanic*.30,wind:10+w.snow*15+w.mud*10+w.volcanic*12,rain:w.mud*.85,snow:w.snow*.88,fog:false,storm:false};
}

export const waterExists=(x,z)=>x<(-36+8*Math.sin(z*.006)+3*Math.sin(z*.019))+10||riverMask(x,z)>0;

// Shared dimensions for the crater and outer-flank scenery; route-side hazards
// and the basalt lava crossing have separate bounded pools.
export const VOLCANO={x:640,z:-745,radius:235,craterRadius:27,lavaHeight:177};
export function volcanoRelief(x,z){
 const dx=x-VOLCANO.x,dz=z-VOLCANO.z,r=Math.hypot(dx,dz),a=Math.atan2(dz,dx);
 const flank=Math.pow(Math.max(0,1-r/VOLCANO.radius),1.22)*205;
 const ribs=(Math.sin(a*9+r*.026)*7+Math.sin(a*17-r*.018)*3)*smooth(35,65,r)*(1-smooth(180,235,r));
 return 35+flank+ribs-75*(1-smooth(15,35,r));
}
export function riverGreenery(x,z){return smooth(90,150,x)*(1-smooth(495,535,x))*(1-smooth(12,58,riverDistance(x,z)))}
