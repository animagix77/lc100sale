// Deterministic infinite coastline. World coordinates remain stable as render tiles recycle.
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const hash=(x,z)=>{const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n)};
export function noise(x,z){const a=Math.floor(x),b=Math.floor(z),u=smooth(0,1,x-a),v=smooth(0,1,z-b);return (hash(a,b)*(1-u)+hash(a+1,b)*u)*(1-v)+(hash(a,b+1)*(1-u)+hash(a+1,b+1)*u)*v}
export const shore=z=>-36+8*Math.sin(z*.006)+3*Math.sin(z*.019);
export function baseHeight(x,z){const d=x-shore(z);if(d<0)return -.4+d*.075;const bank=smooth(18,42,d),amplitude=4+20*smooth(24,105,d),ridge=Math.pow(.5+.5*Math.sin(x*.067+Math.sin(z*.026)*1.8+z*.033),1.65);return -.4+d*.020+bank*(amplitude*(.10+ridge*.90)+noise(x*.041,z*.041)*1.4)+Math.sin(z*.21+x*.32)*.035*smooth(5,25,d)}
export const softnessAt=(x,z)=>smooth(14,65,x-shore(z))*(.78+.22*noise(x*.026,z*.026));
// Sparse half-metre deformation field, shared across tile edges and the physics collider.
export class SandField{
 constructor(){this.ruts=new Map();this.dirty=new Set();this.stamps=0;this.deepest=0;this.clock=0}
 atGrid(i,j){return baseHeight(i*.5,j*.5)+(this.ruts.get(`${i},${j}`)?.depth||0)}
 height(x,z){const gx=x*2,gz=z*2,i=Math.floor(gx),j=Math.floor(gz),u=gx-i,v=gz-j;return (this.atGrid(i,j)*(1-u)+this.atGrid(i+1,j)*u)*(1-v)+(this.atGrid(i,j+1)*(1-u)+this.atGrid(i+1,j+1)*u)*v}
 depthAt(x,z){const i=Math.floor(x*2),j=Math.floor(z*2),u=x*2-i,v=z*2-j;const d=(a,b)=>Math.max(0,-(this.ruts.get(a+','+b)?.depth||0));return (d(i,j)*(1-u)+d(i+1,j)*u)*(1-v)+(d(i,j+1)*(1-u)+d(i+1,j+1)*u)*v}
 stamp(x,z,load=1,travel=.17,slip=0){this.stamps++;this.clock++;const ix=Math.round(x*2),iz=Math.round(z*2),soft=softnessAt(x,z);for(let j=iz-2;j<=iz+2;j++)for(let i=ix-2;i<=ix+2;i++){const r=Math.hypot(i*.5-x,j*.5-z);if(r>.85)continue;const key=`${i},${j}`,old=this.ruts.get(key)?.depth||0;const energy=clamp(travel/.17,.1,2.5),dig=1+soft*Math.min(3,slip)*.38;
 const depression=-.022*(.35+soft)*clamp(load,.25,1.7)*energy*dig*Math.exp(-r*r/.12);
 const berm=r>.38?.004*energy*soft*Math.exp(-Math.pow((r-.62)/.18,2)):0;
 const depth=clamp(old+depression+berm,-(.10+.56*soft),.09);this.ruts.set(key,{depth,t:this.clock});this.deepest=Math.min(this.deepest,depth);for(const tx of [Math.floor((i*.5-.001)/32),Math.floor((i*.5+.001)/32)])for(const tz of [Math.floor((j*.5-.001)/32),Math.floor((j*.5+.001)/32)])this.dirty.add(`${tx},${tz}`)}
 // Retain the most recent ~kilometres of tracks without growing memory indefinitely.
 if(this.ruts.size>90000){let n=0;for(const key of this.ruts.keys()){this.ruts.delete(key);if(++n===12000)break}}
 }
}
