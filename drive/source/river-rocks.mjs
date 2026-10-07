import {riverZ,riverWidth,riverLevel,routeSample} from './expedition.mjs';
import {baseHeight} from './terrain.mjs';
const rand=(a,b)=>{const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n)};
// Fixed riverbed, independent of camera, viewport and terrain streaming. The marked
// ford has low, broad stepping stones; bank shelves offer taller crawling obstacles.
export function riverRock(column,row){
 const x=column*3+(rand(column,row)-.5)*1.5;
 if(x<40||x>490)return null;
 const lateral=row/3.6+(rand(row,column)-.5)*.19,z=riverZ(x)+lateral*riverWidth(x);
 const line=routeSample(x,z).distance<5,bank=Math.abs(lateral)>.85;
 const scale=line?.58+rand(column,row+9)*.36:bank?1.35+rand(column,row+9)*1.1:.9+rand(column,row+9)*.85;
 const y=baseHeight(x,z)-.065;
 return {x,z,y,sx:scale*(1.05+rand(column,row+11)*.45),sy:scale*(line?.72:.92),sz:scale*(.85+rand(column,row+13)*.4),rx:(rand(column,row+16)-.5)*.18,rz:(rand(column,row+17)-.5)*.18,yaw:rand(column,row+3)*Math.PI*2,wet:y<riverLevel(x),tint:rand(column,row+22)};
}
export function riverRocksNear(x,z,radius=132){
 const rocks=[];
 for(let column=Math.floor((x-radius)/3);column<=Math.ceil((x+radius)/3);column++)for(let row=-4;row<=4;row++){
  const r=riverRock(column,row);if(r&&Math.hypot(r.x-x,r.z-z)<radius)rocks.push(r);
 }
 return rocks.sort((a,b)=>(a.x-x)**2+(a.z-z)**2-((b.x-x)**2+(b.z-z)**2));
}
