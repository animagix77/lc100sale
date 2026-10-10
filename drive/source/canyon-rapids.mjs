// Judge Dean LLC — one downstream coordinate for whitewater, spray and ambience.
import {canyonRiver} from './canyon.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
export const RAPIDS=Object.freeze({start:603,end:950,speed:4.6,mistDesktop:48,mistMobile:26});
export const riverFlowCoordinate=(x,time)=>x-time*RAPIDS.speed;
export function riverMistParticle(index,time){
 const seed=n=>{const v=Math.sin(n*127.1+94.3)*43758.5453;return v-Math.floor(v)};
 const duration=11+seed(index+301)*8,age=((time/duration+seed(index+511))%1+1)%1;
 const sourceX=RAPIDS.start+10+seed(index+44)*(RAPIDS.end-RAPIDS.start-36),x=sourceX+age*19,r=canyonRiver(x);
 return {x,z:r.z+(seed(index+61)-.5)*r.halfWidth*1.2+age*1.5,y:r.level+.6+age*(3+seed(index+113)*3),width:7+age*11,height:2.5+age*3.5,alpha:Math.sin(Math.PI*age)**2*(.13+seed(index+28)*.07),age};
}
export function canyonAmbience(position){
 if(!position||![position.x,position.y,position.z].every(Number.isFinite))return 0;
 const x=clamp(position.x,RAPIDS.start,RAPIDS.end),r=canyonRiver(x),distance=Math.hypot(position.x-x,position.z-r.z,(position.y-r.level)*.75);
 return (1-smooth(25,160,distance))*.23;
}
