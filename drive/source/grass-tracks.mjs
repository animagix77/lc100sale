const untouched=Object.freeze({amount:0,dx:0,dz:0});
// A bounded world-space memory of crushed vegetation. Streaming a render cell or
// rebasing the physics origin must not erase the trail the truck just made.
export class GrassTracks{
 constructor(){this.cells=new Map();this.spacing=.65;this.previous=null;this.lastStamp=-Infinity;this.lastPrune=0;this.maxCells=10000;this.bounds=[Infinity,Infinity,-Infinity,-Infinity];}
 strength(cell,time){return cell?cell.amount*Math.exp(-Math.max(0,time-cell.time-35)/48):0;}
 update(p,time,heading){
  if(time-this.lastStamp<.09)return;
  const previous=this.previous,dx=previous?p.x-previous.x:0,dz=previous?p.z-previous.z:0,distance=Math.hypot(dx,dz),forward={x:-Math.sin(heading),z:-Math.cos(heading)};
  const direction=distance>.04&&distance<10?{x:dx/distance,z:dz/distance}:forward;
  const steps=distance<10?Math.max(1,Math.ceil(distance/.45)):1;
  for(let i=1;i<=steps;i++){const u=i/steps,x=previous&&distance<10?previous.x+dx*u:p.x,z=previous&&distance<10?previous.z+dz*u:p.z;this.stamp(x,z,time,heading,direction);}
  this.previous={x:p.x,z:p.z};this.lastStamp=time;
  if(time-this.lastPrune>5||this.cells.size>this.maxCells){for(const [key,c] of this.cells)if(this.strength(c,time)<.025)this.cells.delete(key);this.lastPrune=time;while(this.cells.size>this.maxCells)this.cells.delete(this.cells.keys().next().value);}
 }
 stamp(x,z,time,heading,direction){
  this.bounds[0]=Math.min(this.bounds[0],x-4);this.bounds[1]=Math.min(this.bounds[1],z-4);this.bounds[2]=Math.max(this.bounds[2],x+4);this.bounds[3]=Math.max(this.bounds[3],z+4);
  const fx=-Math.sin(heading),fz=-Math.cos(heading),rx=Math.cos(heading),rz=-Math.sin(heading),s=this.spacing;
  for(let j=Math.floor((z-3.3)/s);j<=Math.ceil((z+3.3)/s);j++)for(let i=Math.floor((x-3.3)/s);i<=Math.ceil((x+3.3)/s);i++){
   const dx=i*s-x,dz=j*s-z,long=dx*fx+dz*fz,side=dx*rx+dz*rz;
   if(Math.abs(long)>2.6||Math.abs(side)>1.7)continue;
   const edge=Math.min(1,(1.7-Math.abs(side))/.4),tyre=Math.exp(-Math.pow((Math.abs(side)-1.0)/.3,2)),amount=(.87+tyre*.13)*edge,key=`${i},${j}`,old=this.cells.get(key),retained=this.strength(old,time);
   this.cells.delete(key);this.cells.set(key,{amount:Math.max(amount,retained),dx:direction.x*.85+rx*Math.sign(side)*.18,dz:direction.z*.85+rz*Math.sign(side)*.18,time});
  }
 }
 sample(x,z,time){
  if(x<this.bounds[0]||z<this.bounds[1]||x>this.bounds[2]||z>this.bounds[3])return untouched;
  const gx=x/this.spacing,gz=z/this.spacing,i=Math.floor(gx),j=Math.floor(gz),u=gx-i,v=gz-j;let amount=0,dx=0,dz=0;
  for(let b=0;b<2;b++)for(let a=0;a<2;a++){const cell=this.cells.get(`${i+a},${j+b}`),w=(a?u:1-u)*(b?v:1-v)*this.strength(cell,time);if(cell){amount+=w;dx+=cell.dx*w;dz+=cell.dz*w;}}
  return {amount,dx,dz};
 }
 clear(){this.bounds=[Infinity,Infinity,-Infinity,-Infinity];this.cells.clear();this.previous=null;this.lastStamp=-Infinity;}
}
