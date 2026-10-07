import {riverMask} from './expedition.mjs';
import {shore,clamp,smooth} from './terrain.mjs';
export const WAKE_LIMITS=Object.freeze({speed:22.352,crest:1.10,trough:.45,velocity:5.5});
// Bounded shallow-wave height field in absolute world coordinates. A moving window
// keeps old ripples in place; floating-origin rebases never alter this field.
export class WakeField{
 constructor({size=129,spacing=.5}={}){this.size=size;this.spacing=spacing;this.count=size*size;this.height=new Float32Array(this.count);this.velocity=new Float32Array(this.count);this.mask=new Float32Array(this.count);this.data=new Float32Array(this.count*4);this.x=Infinity;this.z=Infinity;this.impulses=0;this.peak=0;this.clock=0;this.dirty=true}
 move(x,z){const half=(this.size-1)*this.spacing/2,nx=Math.floor(x/8)*8-half,nz=Math.floor(z/8)*8-half;if(nx===this.x&&nz===this.z)return false;
  const dx=Math.round((nx-this.x)/this.spacing),dz=Math.round((nz-this.z)/this.spacing),n=this.size,h=new Float32Array(this.count),v=new Float32Array(this.count);
  if(Number.isFinite(dx)&&Math.abs(dx)<n&&Math.abs(dz)<n)for(let j=0;j<n;j++)for(let i=0;i<n;i++){const a=i+dx,b=j+dz;if(a>=0&&a<n&&b>=0&&b<n){h[j*n+i]=this.height[b*n+a];v[j*n+i]=this.velocity[b*n+a]}}
  this.height=h;this.velocity=v;this.x=nx;this.z=nz;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const edge=Math.min(i,j,n-1-i,n-1-j),d=nx+i*this.spacing-shore(nz+j*this.spacing);this.mask[j*n+i]=smooth(0,7,edge)*Math.max(1-smooth(5,10,d),riverMask(nx+i*this.spacing,nz+j*this.spacing))}
  this.dirty=true;return true;
 }
 stamp(x,z,speed,slip=0,heading=0){
  const pace=Math.min(Math.abs(speed),WAKE_LIMITS.speed),spin=clamp(slip,0,6);
  if(!Number.isFinite(this.x)||pace+spin<.35)return false;
  const n=this.size,s=this.spacing,gx=(x-this.x)/s,gz=(z-this.z)/s;if(gx<3||gz<3||gx>n-4||gz>n-4)return false;
  const rush=smooth(4,WAKE_LIMITS.speed,pace),force=clamp(pace*.20+spin*.035,.08,1.15)+4.3*rush;
  const crest=.035+pace*.035+.90*rush,radius=Math.ceil((1.8+1.2*rush)/s),direction=Math.sign(speed)||1,fx=-Math.sin(heading)*direction,fz=-Math.cos(heading)*direction;
  let touched=false;
  for(let j=Math.max(1,Math.floor(gz)-radius);j<=Math.min(n-2,Math.ceil(gz)+radius);j++)for(let i=Math.max(1,Math.floor(gx)-radius);i<=Math.min(n-2,Math.ceil(gx)+radius);i++){
   const k=j*n+i,mask=this.mask[k];if(mask<=0)continue;
   const dx=(i-gx)*s,dz=(j-gz)*s,along=dx*fx+dz*fz,side=dx*fz-dz*fx;
   // Speed adds a wider, swept bow and raised shoulders; reverse pushes it
   // toward the rear bumper. Crawling keeps the compact tyre-scale ripple.
   const bow=Math.exp(-((along-.70-.50*rush+Math.abs(side)*.55*rush)**2/(.34+.65*rush)+side*side/(.68+1.8*rush)));
   const trough=Math.exp(-((along+.28)**2/(.38+.70*rush)+side*side/(.40+.65*rush)));
   const shape=bow*.90-trough*.95,target=crest*shape*mask;
   // Approach a bounded displacement/momentum target. Repeated contacts in
   // one frame cannot stack unbounded energy into a stationary cell.
   this.velocity[k]=clamp(this.velocity[k]+(force*shape*mask-this.velocity[k])*.55,-WAKE_LIMITS.velocity,WAKE_LIMITS.velocity);
   const change=(target-this.height[k])*.65;
   this.height[k]=clamp(this.height[k]+(shape>0?Math.max(0,change):Math.min(0,change)),-WAKE_LIMITS.trough,WAKE_LIMITS.crest);
   touched=true;
  }
  if(touched){this.impulses++;this.dirty=true}return touched;
 }
 step(dt){if(!Number.isFinite(this.x))return;this.clock+=Math.min(dt,.08);const n=this.size,s2=this.spacing**2,h=this.height,v=this.velocity,step=1/60;
  while(this.clock>=step){this.clock-=step;for(let j=1;j<n-1;j++)for(let i=1;i<n-1;i++){const k=j*n+i,lap=(h[k-1]+h[k+1]+h[k-n]+h[k+n]-4*h[k])/s2;v[k]=clamp((v[k]+lap*3.24*step)*Math.exp(-(.90+(1-this.mask[k])*10)*step)*(this.mask[k]>0?1:0),-WAKE_LIMITS.velocity,WAKE_LIMITS.velocity)}
   for(let k=0;k<this.count;k++){h[k]=clamp((h[k]+v[k]*step)*Math.exp(-.22*step)*(this.mask[k]>0?1:0),-WAKE_LIMITS.trough,WAKE_LIMITS.crest)}
  }this.dirty=true;
 }
 pack(){const n=this.size,s=this.spacing,h=this.height,d=this.data;this.peak=0;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const k=j*n+i,dx=i>0&&i<n-1?(h[k+1]-h[k-1])/(2*s):0,dz=j>0&&j<n-1?(h[k+n]-h[k-n])/(2*s):0;d[k*4]=h[k];d[k*4+1]=dx;d[k*4+2]=dz;d[k*4+3]=clamp(Math.hypot(dx,dz)*1.7+Math.abs(this.velocity[k])*.18+Math.max(0,h[k])*.35,0,.95);this.peak=Math.max(this.peak,Math.abs(h[k]))}this.dirty=false;return d;
 }
 sample(x,z){const a=(x-this.x)/this.spacing,b=(z-this.z)/this.spacing,i=Math.floor(a),j=Math.floor(b),n=this.size;if(i<0||j<0||i>=n-1||j>=n-1)return 0;const u=a-i,v=b-j,k=j*n+i,h=this.height;return (h[k]*(1-u)+h[k+1]*u)*(1-v)+(h[k+n]*(1-u)+h[k+n+1]*u)*v}
 clear(){this.height.fill(0);this.velocity.fill(0);this.data.fill(0);this.clock=this.impulses=this.peak=0;this.dirty=true}
}
