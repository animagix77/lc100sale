// Shared world-space channel footprint. The flagged trail forms a solid basalt
// causeway; molten channels pass on both sides without covering the wheel path.
export const LAVA_CROSSING=Object.freeze({x:487,z:-669,tx:80/Math.hypot(80,22),tz:-22/Math.hypot(80,22),length:170,width:6.4,causeway:3.1});
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t)};
export function lavaCrossingPoint(s,u=0){const c=LAVA_CROSSING,meander=Math.sin(s*.041)*2.1;return {x:c.x-c.tz*s+c.tx*(u+meander),z:c.z+c.tx*s+c.tz*(u+meander)}}
export function lavaCrossingProfile(x,z){
 const c=LAVA_CROSSING,dx=x-c.x,dz=z-c.z;
 if(Math.abs(dx)>48||Math.abs(dz)>94)return null;
 const s=dx*-c.tz+dz*c.tx,u=dx*c.tx+dz*c.tz-Math.sin(s*.041)*2.1;
 const end=1-smooth(70,85,Math.abs(s)),width=c.width*(.82+.18*Math.cos(s*.07));
 const influence=(1-smooth(width,width+3,Math.abs(u)))*end;
 if(influence<=0)return null;
 return {s,u,width,influence,end,causeway:1-smooth(c.causeway,c.causeway+1.4,Math.abs(s)),center:lavaCrossingPoint(s)};
}
