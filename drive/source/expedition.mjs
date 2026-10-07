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
 [570,-570,99,'volcanic','The long way down'],[552,-430,58,'mud','Rain on the descent'],[475,-346,26.5,'river','Fern creek crossing'],
 [447,-300,24,'mud','Mud & manners'],[339,-147,13,'mud','Last puddle'],[255,-67,8,'grass','Homeward meadow'],
 [163,11,5,'grass','Back to grass'],[72,48,5,'dunes','Back over the dunes'],[-14,0,0,'beach','Back to base camp']
].map(([x,z,height,biome,name],index)=>({x,z,height,biome,name,index}));
export const BIOMES={beach:{name:'BEACH',color:'#c99768'},dunes:{name:'DUNES',color:'#dbac79'},grass:{name:'TALL GRASS',color:'#829261'},river:{name:'ROCKY RIVER',color:'#7cb1b5'},snow:{name:'DEEP SNOW',color:'#dce6ed'},mud:{name:'MUD TRAILS',color:'#806250'},volcanic:{name:'VOLCANIC RIDGE',color:'#ec794b'}};
const segments=LANDMARKS.slice(0,-1).map((a,i)=>{const b=LANDMARKS[i+1],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);return {a,b,dx,dz,length,length2:length*length}});
export const LOOP_LENGTH=segments.reduce((n,s)=>n+s.length,0);
export function routeSample(x,z){
 let best=null,distance=Infinity,progress=0,bestProgress=0;
 for(const s of segments){const t=clamp(((x-s.a.x)*s.dx+(z-s.a.z)*s.dz)/s.length2,0,1),qx=s.a.x+s.dx*t,qz=s.a.z+s.dz*t,d=(x-qx)**2+(z-qz)**2;
  if(d<distance){distance=d;best={segment:s,t,x:qx,z:qz};bestProgress=progress+s.length*t;}progress+=s.length;
 }
 const b={...best.segment,...best},w=smooth(0,1,b.t),weights={beach:0,dunes:0,grass:0,river:0,snow:0,mud:0,volcanic:0};weights[b.a.biome]+=1-w;weights[b.b.biome]+=w;
 const biome=Object.keys(weights).reduce((a,k)=>weights[k]>weights[a]?k:a,'beach');
 return {x:b.x,z:b.z,distance:Math.sqrt(distance),height:b.a.height+(b.b.height-b.a.height)*w,weights,biome,progress:bestProgress/LOOP_LENGTH,dx:b.dx/b.length,dz:b.dz/b.length};
}
export const riverZ=x=>-340+Math.sin((x-140)*.025)*10;
export const riverLevel=x=>-.18+Math.max(0,x+36)*.052;
export function riverDistance(x,z){return Math.abs(z-riverZ(x))}
export function riverWidth(x){return 4.8+2.6*Math.exp(-Math.pow((x-248)/32,2))}
export function riverMask(x,z){return smooth(-32,-8,x)*(1-smooth(475,520,x))*(1-smooth(riverWidth(x)-.5,riverWidth(x)+1.5,riverDistance(x,z)))}
export function riverHeight(x,z,time=0){return riverLevel(x)+Math.sin(x*.9+z*1.8-time*2.2)*.035+Math.sin(x*2.3+time*3.1)*.015}
export function biomeWeather(x,z){const b=routeSample(x,z),w=b.weights;
 return {mode:'expedition',live:false,label:BIOMES[b.biome].name,altitude:8+w.river*15+w.grass*17+w.snow*12+w.mud*8-w.volcanic*6,cloud:.20+w.river*.2+w.grass*.1+w.snow*.65+w.mud*.74+w.volcanic*.30,wind:10+w.snow*15+w.mud*10+w.volcanic*12,rain:w.mud*.85,snow:w.snow*.88,fog:false,storm:false};
}

export const waterExists=(x,z)=>x<(-36+8*Math.sin(z*.006)+3*Math.sin(z*.019))+10||riverMask(x,z)>.1;

// Eruptive activity is kept inside the crater and on the untravelled outer flank.
export const VOLCANO={x:640,z:-745,radius:235,craterRadius:27,lavaHeight:177};
export function volcanoRelief(x,z){
 const dx=x-VOLCANO.x,dz=z-VOLCANO.z,r=Math.hypot(dx,dz),a=Math.atan2(dz,dx);
 const flank=Math.pow(Math.max(0,1-r/VOLCANO.radius),1.22)*205;
 const ribs=(Math.sin(a*9+r*.026)*7+Math.sin(a*17-r*.018)*3)*smooth(35,65,r)*(1-smooth(180,235,r));
 return 35+flank+ribs-75*(1-smooth(15,35,r));
}
export function riverGreenery(x,z){return smooth(90,150,x)*(1-smooth(495,535,x))*(1-smooth(12,58,riverDistance(x,z)))}
