// Judge Dean LLC — a shared, deterministic ravine for rendered and physical terrain.
// The timber deck is a separate dynamic body; this module never fills its gap.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
export const CANYON=Object.freeze({x:665,z:-470,span:60,height:80,halfWidth:30,minX:560,maxX:1020,floor:34,approachLength:48});
export function canyonCenterZ(x){const dx=x-CANYON.x;return CANYON.z+Math.sin(dx*.012)*11*smooth(16,72,Math.abs(dx));}
// A continuously descending stream; water never follows the old sinusoidal
// floor elevation uphill. Broad alternating gravel banks frame its incision.
export function canyonRiver(x){const dx=x-CANYON.x;return {z:canyonCenterZ(x)+Math.sin(dx*.027)*1.8+Math.sin(dx*.061)*.45,halfWidth:3.8+Math.sin(dx*.022)*.6,level:35.1-dx*.007};}
export function canyonRiverProfile(x,z){const river=canyonRiver(x),distance=Math.abs(z-river.z),outside=Math.max(0,distance-river.halfWidth);return {...river,distance,outside,wet:1-smooth(river.halfWidth-.25,river.halfWidth,distance),channel:1-smooth(4,8,outside)};}
export function canyonFloor(x,z){
 const r=canyonRiverProfile(x,z),original=Math.max(r.level+.6,CANYON.floor+Math.sin((x-CANYON.x)*.024)*2.5+Math.cos((z-CANYON.z)*.12)*1.1);
 const bed=r.level-.85*(1-Math.pow(Math.min(1,r.distance/r.halfWidth),2))+r.outside*.17;
 return original+(bed-original)*r.channel;
}
export function canyonProfile(x,z){
 if(x<CANYON.minX||x>CANYON.maxX||z<CANYON.z-100||z>CANYON.z+100)return {distance:Math.abs(z-CANYON.z),halfWidth:30,length:0,influence:0,wall:1,pad:0,exposedRock:0,rimRelief:0,floor:CANYON.floor};
 const dx=Math.abs(x-CANYON.x),distance=Math.abs(z-canyonCenterZ(x));
 const length=smooth(CANYON.minX,CANYON.minX+42,x)*(1-smooth(CANYON.maxX-70,CANYON.maxX,x));
 const sculpt=smooth(16,52,dx),widening=1+smooth(30,130,dx)*.34,halfWidth=CANYON.halfWidth*widening+sculpt*(Math.sin(x*.046)*2.1+Math.sin(x*.087+.8)*1.15);
 const influence=length*(1-smooth(halfWidth+5,halfWidth+35,distance));
 // Layered cliffs with a broad floor. The landing benches meet y80; shallow
 // anchor sockets below the end timbers avoid intersecting their undersides.
 const side=z<canyonCenterZ(x)?-1:1;
 // Broad gullies and resistant shelves vary across tens of metres. The cliff
 // still consists of rounded continuous surfaces rather than spiky noise.
 const erosion=sculpt*(Math.sin(x*.115+side*.8)*1.6+Math.sin(x*.047-side*.4)*1.9)*Math.sin(Math.PI*clamp(distance/halfWidth,0,1));
 const t=clamp((distance+erosion-halfWidth*.40)/(halfWidth*.60),0,1);
 const shelves=.16*smooth(0,.23,t)+.34*smooth(.29,.43,t)+.30*smooth(.54,.70,t)+.20*smooth(.79,1,t);
 const wall=smooth(halfWidth*.48,halfWidth,distance)*(1-sculpt)+shelves*sculpt;
 const north=z<CANYON.z,pad=(1-smooth(9,19,dx))*smooth(28,30,Math.abs(z-CANYON.z))*(1-smooth(north?78:44,north?92:62,Math.abs(z-CANYON.z)));
 const exposedRock=length*(1-smooth(halfWidth+3,halfWidth+12,distance))*(1-pad*smooth(halfWidth-.15,halfWidth+1,distance));
 const rimRelief=sculpt*(3+4*Math.pow(Math.sin(x*.073+side*.9),2))*smooth(.68,.9,distance/halfWidth)*(1-smooth(1.01,1.3,distance/halfWidth));
 return {distance,halfWidth,length,influence,wall,pad,exposedRock,rimRelief,floor:canyonFloor(x,z)};
}
export function canyonHeight(x,z,original){
 const p=canyonProfile(x,z);if(p.influence<=0&&p.pad<=0)return original;
 const padded=original+(CANYON.height-original)*p.pad;
 // The bridge rim stays coherent even where the procedural distant mountains
 // are lower; beyond the abutments preserve the existing mountain silhouette.
 const rimWeight=(1-smooth(16,55,Math.abs(x-CANYON.x)))*(1-smooth(30,52,p.distance));
 const rim=Math.max(padded,p.floor+28*p.length)+(CANYON.height-padded)*rimWeight+p.rimRelief;
 const cut=p.floor+(rim-p.floor)*p.wall;
 const gorge=rim+(Math.min(rim,cut)-rim)*p.length;
 const ground=padded+(gorge-padded)*p.influence;
 // Leave clearance beneath the physical end sections, including their tiny
 // overlap beyond the nominal anchor. The fixed abutment sill ends outside
 // the span; a wheel transfers directly from that sill onto moving timber.
 const socket=(1-smooth(2.4,3.6,Math.abs(x-CANYON.x)))*(1-smooth(30.2,31.4,Math.abs(z-CANYON.z)));
 const underside=CANYON.height-.60-.07*Math.max(0,30-Math.abs(z-CANYON.z));
 return ground+(Math.min(ground,underside)-ground)*socket;
}
export function canyonFirmness(x,z){
 const dx=Math.abs(x-CANYON.x),dz=Math.abs(z-CANYON.z);
 // The entire deck footprint and both anchored approaches are hard surfaces.
 const north=z<CANYON.z;return (1-smooth(5,10,dx))*(1-smooth(north?78:46,north?92:62,dz));
}

export const canyonRockMask=(x,z)=>canyonProfile(x,z).exposedRock;
