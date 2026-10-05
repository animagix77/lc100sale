import {shore,smooth} from './terrain.mjs';
// CPU counterpart to Ocean's displacement, for tire/water interaction positions.
export function oceanHeight(x,z,time){
 const d=x-shore(z),offshore=1-smooth(-25,2,d);
 const phase=d*.30-z*.025+Math.sin(z*.071)*1.2+Math.sin(z*.13)*.3-time*1.35;
 const swell=Math.sin(phase)*.36+Math.sin(d*.14+z*.046-time*.78)*.20;
 const cross=Math.sin(x*.41+z*.23-time*1.05)*.065;
 return -.18+(swell+cross)*offshore+Math.sin(time*.8-z*.026)*.075*(1-offshore);
}
export function surfaceProfile(mark,speed,ground,time){
 const activity=Math.abs(speed)+Math.max(0,mark.slip),water=oceanHeight(mark.x,mark.z,time);
 const wet=mark.x-shore(mark.z)<10&&water>ground+.025;
 return {wet,water,activity,emit:activity>.35,dust:!wet&&mark.x-shore(mark.z)>10};
}
