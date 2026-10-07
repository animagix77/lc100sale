import {riverZ,riverWidth,riverLevel,routeSample,riverApproach,riverMask} from './expedition.mjs';
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
// Small embedded stones on the dry approaches use the same mesh/collider path as
// the riverbed. A fixed world grid keeps them stable across streamed cells.
export function riverApproachRock(column,row){
 const x=column*4+(rand(column+401,row)-.5)*2.8,z=row*4+(rand(row,column+607)-.5)*2.8;
 if(x<90||x>520||Math.abs(z+340)>64)return null;
 const approach=riverApproach(x,z);
 if(approach<.35||riverMask(x,z)>.02||Math.abs(z-riverZ(x))<riverWidth(x)+2||rand(column+701,row)>.72)return null;
 const scale=.38+rand(column+809,row)*.55;
 return {x,z,y:baseHeight(x,z)-.055,sx:scale*(1+rand(column+811,row)*.5),sy:scale*.42,sz:scale*(.85+rand(column+813,row)*.35),rx:0,rz:0,yaw:rand(column+817,row)*Math.PI*2,wet:false,tint:rand(column+823,row),approach:true};
}
export function riverRocksNear(x,z,radius=132){
 const rocks=[];
 for(let column=Math.floor((x-radius)/3);column<=Math.ceil((x+radius)/3);column++)for(let row=-4;row<=4;row++){
  const r=riverRock(column,row);if(r&&Math.hypot(r.x-x,r.z-z)<radius)rocks.push(r);
 }
 // Limit this extra grid to the narrow crossing belt rather than the whole streamed square.
 for(let column=Math.floor(Math.max(90,x-radius)/4);column<=Math.ceil(Math.min(520,x+radius)/4);column++)for(let row=Math.floor(Math.max(-404,z-radius)/4);row<=Math.ceil(Math.min(-276,z+radius)/4);row++){
  const r=riverApproachRock(column,row);if(r&&Math.hypot(r.x-x,r.z-z)<radius)rocks.push(r);
 }
 return rocks.sort((a,b)=>(a.x-x)**2+(a.z-z)**2-((b.x-x)**2+(b.z-z)**2));
}
