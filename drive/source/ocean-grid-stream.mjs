// Judge Dean LLC — prepare water rows off the visible mesh, publish atomically.
import {shore,baseHeight} from './terrain.mjs';
import {COASTAL_WATER_EXTENT} from './expedition.mjs';
import {archipelagoRegion,islandOceanBed} from './coastal-islands.mjs';
export class OceanGridStream{
 constructor(ocean,{clock=()=>performance.now()}={}){
  this.ocean=ocean;this.clock=clock;this.pending=null;this.completed=0;
  const count=(ocean.nx+1)*(ocean.nz+1);
  this.positions=new Float32Array(count*3);this.beds=new Float32Array(count);this.columns=new Float64Array(ocean.nx+1);
 }
 rebase(origin){
  const o=this.ocean;if(!o.originKey)return;
  const [x,z]=o.originKey.split(',').map(Number),dx=x-origin.x,dz=z-origin.z;if(!dx&&!dz)return;
  const position=o.mesh.geometry.attributes.position;
  for(let i=0;i<position.count;i++){position.array[i*3]+=dx;position.array[i*3+2]+=dz;}
  position.needsUpdate=true;o.originKey=`${origin.x},${origin.z}`;
  if(this.pending){for(let i=0;i<this.pending.rows*(o.nx+1);i++){this.positions[i*3]+=dx;this.positions[i*3+2]+=dz;}Object.assign(this.pending.origin,origin);}
 }
 begin(center,focus,origin){
  const o=this.ocean,right=focus+20,left=focus-20,far=Math.min(-1200,left-256);
  for(let i=0;i<=o.nx;i++)this.columns[i]=i<o.shoreColumns?right+(COASTAL_WATER_EXTENT-right)*Math.pow(1-i/o.shoreColumns,focus===-8?2:1):i<=o.shoreColumns+o.nearX?right-(i-o.shoreColumns)*40/o.nearX:left-(left-far)*Math.pow((i-o.shoreColumns-o.nearX)/(o.nx-o.shoreColumns-o.nearX),1.55);
  this.pending={center,focus,origin:{...origin},rows:0,bedRows:new Map(),reuse:focus===o.focus};
 }
 update(p,origin,budgetMs=Infinity){
  const o=this.ocean;this.rebase(origin);
  const center=Math.floor(p.z/6)*6,focus=Math.min(-8,-8+o.focusStep*Math.round(((p.x??shore(p.z))-shore(p.z)+8)/o.focusStep));
  const initial=!Number.isFinite(o.center),teleport=initial||Math.abs(center-o.center)>96||Math.abs(focus-o.focus)>48;
  if(!this.pending&&center===o.center&&focus===o.focus)return false;
  // Finish a nearby staging job even while the vehicle crosses another row.
  // Large teleports explicitly rebuild before physics/visibility can resume.
  if(!this.pending||teleport&&(this.pending.center!==center||this.pending.focus!==focus))this.begin(center,focus,origin);
  const job=this.pending,deadline=this.clock()+(teleport?Infinity:Math.max(0,budgetMs));
  while(job.rows<=o.nz&&this.clock()<deadline){
   const j=job.rows,z=job.center+o.rowOffsets[j],coast=shore(z)-job.origin.x,estuary=Math.abs(z+340)<=55;
   const cached=job.reuse?o.bedRows.get(z):null,row=cached??new Float32Array(o.nx+1);job.bedRows.set(z,row);
   for(let i=0;i<=o.nx;i++){
    const index=j*(o.nx+1)+i,x=coast+this.columns[i],worldX=x+job.origin.x;
    this.positions[index*3]=x;this.positions[index*3+1]=-.18;this.positions[index*3+2]=z-job.origin.z;
    const bed=cached?cached[i]:archipelagoRegion(worldX,z)>0?islandOceanBed(worldX,z,baseHeight):estuary&&worldX>=-72?baseHeight(worldX,z):this.columns[i]<0?-.4+this.columns[i]*.075:baseHeight(worldX,z);
    row[i]=bed;this.beds[index]=bed;
   }
   job.rows++;
  }
  if(job.rows<=o.nz)return false;
  const geometry=o.mesh.geometry;geometry.attributes.position.array.set(this.positions);geometry.attributes.oceanBed.array.set(this.beds);
  geometry.attributes.position.needsUpdate=geometry.attributes.oceanBed.needsUpdate=true;
  o.columnOffsets.set(this.columns);o.bedRows=job.bedRows;o.center=job.center;o.focus=job.focus;o.originKey=`${job.origin.x},${job.origin.z}`;
  this.pending=null;this.completed++;return true;
 }
 dispose(){this.pending=null;}
}
