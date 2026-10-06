import {shore,clamp,smooth} from './terrain.mjs';
// Bounded shallow-wave height field in absolute world coordinates. A moving window
// keeps old ripples in place; floating-origin rebases never alter this field.
export class WakeField{
 constructor({size=129,spacing=.5}={}){this.size=size;this.spacing=spacing;this.count=size*size;this.height=new Float32Array(this.count);this.velocity=new Float32Array(this.count);this.mask=new Float32Array(this.count);this.data=new Float32Array(this.count*4);this.x=Infinity;this.z=Infinity;this.impulses=0;this.peak=0;this.clock=0;this.dirty=true}
 move(x,z){const half=(this.size-1)*this.spacing/2,nx=Math.floor(x/8)*8-half,nz=Math.floor(z/8)*8-half;if(nx===this.x&&nz===this.z)return false;
  const dx=Math.round((nx-this.x)/this.spacing),dz=Math.round((nz-this.z)/this.spacing),n=this.size,h=new Float32Array(this.count),v=new Float32Array(this.count);
  if(Number.isFinite(dx)&&Math.abs(dx)<n&&Math.abs(dz)<n)for(let j=0;j<n;j++)for(let i=0;i<n;i++){const a=i+dx,b=j+dz;if(a>=0&&a<n&&b>=0&&b<n){h[j*n+i]=this.height[b*n+a];v[j*n+i]=this.velocity[b*n+a]}}
  this.height=h;this.velocity=v;this.x=nx;this.z=nz;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const edge=Math.min(i,j,n-1-i,n-1-j),d=nx+i*this.spacing-shore(nz+j*this.spacing);this.mask[j*n+i]=smooth(0,7,edge)*(1-smooth(5,10,d))}
  this.dirty=true;return true;
 }
 stamp(x,z,speed,slip=0,heading=0){if(!Number.isFinite(this.x)||Math.abs(speed)+slip<.35)return;const n=this.size,s=this.spacing,gx=(x-this.x)/s,gz=(z-this.z)/s;if(gx<3||gz<3||gx>n-4||gz>n-4)return;const force=clamp(Math.abs(speed)*.23+slip*.045,.10,1.35),direction=Math.sign(speed)||1,fx=-Math.sin(heading)*direction,fz=-Math.cos(heading)*direction;
  for(let j=Math.floor(gz)-3;j<=Math.ceil(gz)+3;j++)for(let i=Math.floor(gx)-3;i<=Math.ceil(gx)+3;i++){if(i<1||j<1||i>=n-1||j>=n-1)continue;const k=j*n+i,r2=((i-gx)**2+(j-gz)**2)*s*s;
   const dx=(i-gx)*s,dz=(j-gz)*s,along=dx*fx+dz*fz,side=dx*fz-dz*fx;
   // A broad raised bow in front of each tyre and a depressed trough behind it.
   // Its width spans multiple mesh vertices, including on smaller screens.
   const bow=Math.exp(-((along-.70)**2/.34+side*side/.68));
   const trough=Math.exp(-((along+.28)**2/.38+side*side/.40));
   const shape=bow*.90-trough*.95;
   this.velocity[k]+=force*shape*this.mask[k];
   this.height[k]=clamp(this.height[k]+force*.022*shape*this.mask[k],-.38,.42);
  }this.impulses++;this.dirty=true;
 }
 step(dt){if(!Number.isFinite(this.x))return;this.clock+=Math.min(dt,.08);const n=this.size,s2=this.spacing**2,h=this.height,v=this.velocity,step=1/60;
  while(this.clock>=step){this.clock-=step;for(let j=1;j<n-1;j++)for(let i=1;i<n-1;i++){const k=j*n+i,lap=(h[k-1]+h[k+1]+h[k-n]+h[k+n]-4*h[k])/s2;v[k]=(v[k]+lap*3.24*step)*Math.exp(-(.90+(1-this.mask[k])*10)*step)*(this.mask[k]>0?1:0)}
   for(let k=0;k<this.count;k++){h[k]=clamp((h[k]+v[k]*step)*Math.exp(-.22*step)*(this.mask[k]>0?1:0),-.38,.42)}
  }this.dirty=true;
 }
 pack(){const n=this.size,s=this.spacing,h=this.height,d=this.data;this.peak=0;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const k=j*n+i,dx=i>0&&i<n-1?(h[k+1]-h[k-1])/(2*s):0,dz=j>0&&j<n-1?(h[k+n]-h[k-n])/(2*s):0;d[k*4]=h[k];d[k*4+1]=dx;d[k*4+2]=dz;d[k*4+3]=clamp(Math.hypot(dx,dz)*2.5+Math.abs(this.velocity[k])*.28,0,.65);this.peak=Math.max(this.peak,Math.abs(h[k]))}this.dirty=false;return d;
 }
 sample(x,z){const a=(x-this.x)/this.spacing,b=(z-this.z)/this.spacing,i=Math.floor(a),j=Math.floor(b),n=this.size;if(i<0||j<0||i>=n-1||j>=n-1)return 0;const u=a-i,v=b-j,k=j*n+i,h=this.height;return (h[k]*(1-u)+h[k+1]*u)*(1-v)+(h[k+n]*(1-u)+h[k+n+1]*u)*v}
 clear(){this.height.fill(0);this.velocity.fill(0);this.data.fill(0);this.clock=this.impulses=this.peak=0;this.dirty=true}
}
