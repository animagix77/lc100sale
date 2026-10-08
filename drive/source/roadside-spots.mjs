import {LANDMARKS,routeSample,riverMask} from './expedition.mjs';
import {baseHeight} from './terrain.mjs';
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
export const ROADSIDE_SPOTS=Object.freeze(stories.map(locate));
// Pull-offs stay free of intersecting trees, rocks and tall grass.
export const inRoadsideClearing=(x,z,padding=0)=>ROADSIDE_SPOTS.some(p=>(p.x-x)**2+(p.z-z)**2<(6.5+padding)**2);
