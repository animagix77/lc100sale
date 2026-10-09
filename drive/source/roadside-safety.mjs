import {ROADSIDE_SPOTS,roadsideActors} from './roadside-spots.mjs';

// A circular truck footprint encloses its corners at every steering/roll angle.
// These small keep-clear areas include the open doors and seated people's feet.
const TRUCK_RADIUS=2.65, BUFFER=.45;
export function roadsideZones(spots=ROADSIDE_SPOTS){
 return spots.flatMap(spot=>[
  {id:spot.id,kind:'vehicle',x:spot.x,z:spot.z,radius:(spot.tipped?3.3:spot.kind==='pickup'?3:2.85)+TRUCK_RADIUS+BUFFER},
  ...roadsideActors(spot).map(actor=>({id:spot.id,kind:'person',x:actor.x,z:actor.z,radius:1.05+TRUCK_RADIUS+BUFFER}))
 ]);
}
// Distance to first entry into an expanded scene boundary along a unit vector.
export function approachDistance(p,dx,dz,zone){
 const x=zone.x-p.x,z=zone.z-p.z,along=x*dx+z*dz;
 if(along<=0)return Infinity; // Leaving a scene must always remain possible.
 const across2=Math.max(0,x*x+z*z-along*along),r2=zone.radius*zone.radius;
 if(across2>=r2)return Infinity;
 return Math.max(0,along-Math.sqrt(r2-across2));
}
export class RoadsideSafety{
 constructor(zones=roadsideZones()){this.zones=zones;this.reset()}
 reset(){this.active=false;this.scene=null;this.interventions=0}
 filter(input,p,velocity,forward){
  this.active=false;this.scene=null;
  const speed=Math.hypot(velocity.x,velocity.z),fl=Math.hypot(forward.x,forward.z)||1;
  const command=input.reverse?-1:(input.gas||input.cruise?1:0);
  // Brake earlier at speed. Also watch lateral slides and gravity rollbacks,
  // independently of the direction the bonnet or accelerator happens to point.
  const stopping=speed*speed/11+speed*.45+.8;
  for(const zone of this.zones){
   // Deliberate escape wins over residual inward gravity velocity. The
   // swept boundary still catches rollback while reverse torque builds.
   const escaping=command&&((p.x-zone.x)*forward.x+(p.z-zone.z)*forward.z)*command/fl>.05;
   const moving=!escaping&&speed>.025&&approachDistance(p,velocity.x/speed,velocity.z/speed,zone)<stopping;
   const powered=command&&approachDistance(p,forward.x/fl*command,forward.z/fl*command,zone)<1.2;
   if(moving||powered){this.active=true;this.scene=zone.id;break}
  }
  return this.active?{...input,gas:0,reverse:0,cruise:false,handbrake:false,brake:1}:input;
 }
 constrain(previous,next,velocity){
  const dx=next.x-previous.x,dz=next.z-previous.z,distance=Math.hypot(dx,dz);
  let hit=null,travel=distance;
  if(distance>1e-8)for(const zone of this.zones){
   const entry=approachDistance(previous,dx/distance,dz/distance,zone);
   if(entry<travel){hit=zone;travel=entry}
  }
  let x=next.x,z=next.z;
  if(hit){const t=Math.max(0,travel-.003)/distance;x=previous.x+dx*t;z=previous.z+dz*t;}
  // Handle a reset inside a keep-clear area, or tiny numerical penetrations.
  // Recheck overlapping person/vehicle zones rather than pushing into another.
  for(let pass=0;pass<12;pass++){
   let changed=false;
   for(const zone of this.zones){
    const ox=x-zone.x,oz=z-zone.z,length=Math.hypot(ox,oz);
    if(length>=zone.radius)continue;
    const nx=length>1e-8?ox/length:1,nz=length>1e-8?oz/length:0;
    x=zone.x+nx*(zone.radius+.003);z=zone.z+nz*(zone.radius+.003);hit=zone;changed=true;
   }
   if(!changed)break;
  }
  if(!hit)return null;
  // Strip only motion into the boundary. Preserve vertical suspension motion
  // and tangential velocity, so steering/sliding away never feels glued down.
  let vx=velocity.x,vz=velocity.z;
  for(const zone of this.zones){
   const ox=x-zone.x,oz=z-zone.z,length=Math.hypot(ox,oz);
   if(length>zone.radius+.03)continue;
   const nx=ox/length,nz=oz/length,inward=vx*nx+vz*nz;
   if(inward<0){vx-=nx*inward;vz-=nz*inward;}
  }
  this.active=true;this.scene=hit.id;this.interventions++;
  return {position:{x,y:next.y,z},velocity:{x:vx,y:velocity.y,z:vz}};
 }
}
