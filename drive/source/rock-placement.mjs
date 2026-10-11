// Judge Dean LLC — shared, bounded bedrock placement for rocks and plant clearings.
import {baseHeight,surfaceAt,noise,smooth} from './terrain.mjs';
import {riverMask,routeSample} from './expedition.mjs';
import {inRoadsideClearing} from './roadside-spots.mjs';
const rand=(a,b)=>{const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n)};
const cache=new Map(),fifo=[];let cursor=0;
export function rockFormationAt(ix,iz){
 const key=`${ix},${iz}`;if(cache.has(key))return cache.get(key);
 const create=()=>{const x=ix*12+rand(ix,iz)*9,z=iz*12+rand(iz,ix)*9;
    const scale=.85+rand(ix+8,iz)*1.45,reach=scale*2.55;
    if(inRoadsideClearing(x,z,reach+2)||riverMask(x,z)>.05)return null;
    const route=routeSample(x,z),surface=surfaceAt(x,z),h=baseHeight(x,z);
    // Bedrock shoulders occur in the woodland as well as above the tree line.
    // Leave the beach, both forks, river channels and the engineered canyon alone.
    if(h<8||surface.canyonRock>.1||route.distance<6+reach||route.distance>115||route.weights.beach+route.weights.dunes>.45)return null;
    if(noise(x*.025,z*.025)<.32)return null;
    const probes=[[reach,0],[-reach,0],[0,reach],[0,-reach]];
    if(probes.some(([a,b])=>riverMask(x+a,z+b)>.05||inRoadsideClearing(x+a,z+b,1)))return null;
    const floor=probes.map(([a,b])=>baseHeight(x+a,z+b));
    if(Math.max(...floor)-Math.min(...floor)>scale*2.6)return null;
    // The deep tapered footing buries into the bank while upper ledges remain exposed.
    return {x,z,h,surface,ix,iz,scale};
 };
 const result=create();if(cache.size>=4000){cache.delete(fifo[cursor]);fifo[cursor]=key;cursor=(cursor+1)%4000;}else fifo.push(key);cache.set(key,result);return result;
}
export function rockFormationMask(x,z){
 const gx=Math.floor(x/12),gz=Math.floor(z/12);let mask=0;
 for(let iz=gz-1;iz<=gz+1;iz++)for(let ix=gx-1;ix<=gx+1;ix++){
  // Reject cells cheaply before querying height/surface for a new region.
  const rx=ix*12+rand(ix,iz)*9,rz=iz*12+rand(iz,ix)*9,d=Math.hypot(x-rx,z-rz);
  if(d>5.7)continue;const r=rockFormationAt(ix,iz);if(r)mask=Math.max(mask,1-smooth(r.scale*1.75,r.scale*2.55,d));
 }
 return mask;
}
