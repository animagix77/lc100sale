import {LANDMARKS,routeSample,riverMask} from './expedition.mjs';
import {baseHeight} from './terrain.mjs';
import {COASTAL_LANDMARKS,COASTAL_CAMP,BARGE_SITE,coastalRouteDistance,islandProfile} from './coastal-islands.mjs';
const stories=[
 {id:'buried-pickup',segment:2,t:.52,kind:'pickup',color:'#bc6546',buried:.48,quip:'Rusty: All-terrain tyres. Apparently this was the other terrain.'},
 {id:'repair-meeting',segment:8,t:.48,kind:'suv',color:'#c8aa70',hood:true,door:true,steam:true,couple:true,quip:'Rusty: He said he knew a shortcut. The passenger is now conducting his performance review.'},
 {id:'wrong-way-up',segment:10,t:.50,kind:'boxy',color:'#769488',tipped:true,quip:'Rusty: Excellent underbody access. Questionable parking technique.'},
 {id:'snow-confidence',segment:12,t:.52,kind:'suv',color:'#7587a0',buried:.55,snow:true,quip:'Rusty: Snow mode selected. Movement sold separately.'}
];
function locate(story){
 const a=LANDMARKS[story.segment],b=LANDMARKS[story.segment+1],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);let best;
 for(const t of [story.t,story.t-.12,story.t+.12])for(const side of [1,-1])for(const offset of [12,15,18]){
  const x=a.x+dx*t-dz/len*offset*side,z=a.z+dz*t+dx/len*offset*side;
  if(routeSample(x,z).distance<10||riverMask(x,z)>.01)continue;
  const h=baseHeight(x,z),hx=(baseHeight(x+2,z)-baseHeight(x-2,z))/4,hz=(baseHeight(x,z+2)-baseHeight(x,z-2))/4;
  let rough=0;for(const ox of [-2,0,2])for(const oz of [-3,0,3])rough=Math.max(rough,Math.abs(baseHeight(x+ox,z+oz)-h-hx*ox-hz*oz));
  const score=Math.hypot(hx,hz)*3+rough+offset*.015+Math.abs(t-story.t);
  if(!best||score<best.score)best={x,z,h,hx,hz,score,yaw:Math.atan2(-dx,-dz)+side*.32};
 }
 if(!best)throw new Error('No safe roadside placement: '+story.id);
 return Object.freeze({...story,...best});
}
// Judge Dean LLC — soft-sand stories sit on dry island shoulders, never in the
// low-tide crossings. Search only once at startup, using the actual terrain.
const coastalStories=[
 {id:'palm-sand-pickup',segment:3,t:.46,kind:'pickup',color:'#789b92',buried:.43,lean:.075,coastal:true,abandoned:true,quip:'Rusty: That pickup found the soft shoulder. Stay in the worn tracks.'},
 {id:'barge-bay-bogged',segment:4,t:.82,kind:'boxy',color:'#d0a160',buried:.38,lean:-.09,coastal:true,abandoned:true,quip:'Rusty: A short detour. A rather long parking stay.'},
 {id:'driftwood-sand-suv',segment:7,t:.90,kind:'suv',color:'#b5755c',buried:.49,lean:.065,coastal:true,abandoned:true,quip:'Rusty: Another vote for the firm sand. Follow the tyre tracks.'}
];
function locateCoastal(story){
 const a=COASTAL_LANDMARKS[story.segment],b=COASTAL_LANDMARKS[story.segment+1],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);let best;
 for(const t of [story.t,story.t-.14,story.t+.14])for(const side of [1,-1])for(const offset of [13,16,19]){
  const x=a.x+dx*t-dz/len*offset*side,z=a.z+dz*t+dx/len*offset*side,p=islandProfile(x,z);
  if(coastalRouteDistance(x,z)<12||p.land<.99||p.rock>.10||p.grass>.35||Math.hypot(x-COASTAL_CAMP.x,z-COASTAL_CAMP.z)<COASTAL_CAMP.radius+15||Math.hypot(x-BARGE_SITE.x,z-BARGE_SITE.z)<23)continue;
  const h=baseHeight(x,z),hx=(baseHeight(x+2,z)-baseHeight(x-2,z))/4,hz=(baseHeight(x,z+2)-baseHeight(x,z-2))/4;
  let rough=0,minHeight=h;for(const ox of [-3,0,3])for(const oz of [-4,0,4]){const y=baseHeight(x+ox,z+oz);minHeight=Math.min(minHeight,y);rough=Math.max(rough,Math.abs(y-h-hx*ox-hz*oz));}
  if(minHeight<.35||Math.hypot(hx,hz)>.22||rough>.35)continue;
  const score=Math.hypot(hx,hz)*3+rough+p.grass+Math.abs(t-story.t)+offset*.01;
  if(!best||score<best.score)best={x,z,h,hx,hz,score,yaw:Math.atan2(-dx,-dz)+side*.42};
 }
 if(!best)throw new Error('No safe coastal roadside placement: '+story.id);
 return Object.freeze({...story,...best});
}
export const ROADSIDE_SPOTS=Object.freeze([...stories.map(locate),...coastalStories.map(locateCoastal)]);
// Shared by rendering and proximity braking so the people remain protected.
export function roadsideActors(spot){
 if(spot.abandoned)return [];
 const cs=Math.cos(spot.yaw),sn=Math.sin(spot.yaw);
 const actors=[{localX:-2.8,localZ:-.5,angle:0,options:{pose:'seated',coat:spot.couple?'#587482':'#9b7855'}}];
 if(spot.couple)actors.push({localX:-3.25,localZ:1.15,angle:-.35,options:{pose:'standing',woman:true,coat:'#c8774e'}});
 return actors.map(a=>({...a,x:spot.x+a.localX*cs+a.localZ*sn,z:spot.z-a.localX*sn+a.localZ*cs}));
}
// Pull-offs stay free of intersecting trees, rocks and tall grass.
export const inRoadsideClearing=(x,z,padding=0)=>ROADSIDE_SPOTS.some(p=>(p.x-x)**2+(p.z-z)**2<(6.5+padding)**2);
