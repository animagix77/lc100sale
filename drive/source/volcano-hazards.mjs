import * as THREE from 'three/webgpu';
import {attribute,color,float,mix,mx_noise_float,positionLocal,sin,smoothstep,uniform,uv,vec3} from 'three/tsl';
import {RAPIER} from './physics.mjs';
import {surfaceAt,clamp,smooth} from './terrain.mjs';
import {VOLCANO} from './expedition.mjs';
const rand=n=>{const v=Math.sin(n*127.1+47.7)*43758.5453;return v-Math.floor(v)};
const TWO_PI=Math.PI*2;

// Activity is local to the upper volcanic route. No objects are simulated at the
// beach, and the small route-side landings leave the truck's footprint clear.
export function volcanoHazardStrength(x,z){
 const distance=Math.hypot(x-VOLCANO.x,z-VOLCANO.z);
 return (1-smooth(230,290,distance))*smooth(.2,.7,surfaceAt(x,z).volcanic);
}
export function volcanoRockFlight(p,forward,index,height){
 const fx=forward?.x??0,fz=forward?.z??-1,length=Math.hypot(fx,fz)||1,rx=-fz/length,rz=fx/length;
 const side=index%2?1:-1,across=side*(6.5+rand(index+3)*8),along=-3+rand(index+5)*21;
 const x=p.x+rx*across+fx/length*along,z=p.z+rz*across+fz/length*along;
 const vx=VOLCANO.x-x,vz=VOLCANO.z-z,vl=Math.hypot(vx,vz)||1,run=7+rand(index+9)*7;
 const startX=x+vx/vl*run,startZ=z+vz/vl*run,ground=height(x,z),startY=Math.max(ground,height(startX,startZ))+20+rand(index+12)*13;
 const duration=2+rand(index+14)*.6;
 return {x:startX,y:startY,z:startZ,vx:(x-startX)/duration,vy:(ground-startY+4.905*duration*duration)/duration,vz:(z-startZ)/duration,targetX:x,targetZ:z,duration};
}

export class VolcanoHazards{
 constructor(scene,physics,field,{mobile=false,reduced=false}={}){
  Object.assign(this,{scene,physics,field,mobile,reduced});this.origin={...physics.origin};this.lastTime=null;this.nextSpawn=0;this.sequence=0;this.events=[];this.stats={rocks:0,embers:0,smoke:0,impacts:0};this.dummy=new THREE.Object3D();this.clock=uniform(0);this.anchorKey='';this.disposed=false;
  this.rockCount=mobile?6:10;this.emberCount=reduced?8:mobile?24:42;this.smokeCount=mobile?4:6;
  const geometry=new THREE.IcosahedronGeometry(1,0),positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),rough=.91+Math.sin(x*5+z*7+y*3)*.08;positions.setXYZ(i,x*rough,y*rough*.85,z*rough)}geometry.computeVertexNormals();
  this.heat=new Float32Array(this.rockCount);geometry.setAttribute('rockHeat',new THREE.InstancedBufferAttribute(this.heat,1));
  const rockMat=new THREE.MeshStandardNodeMaterial({color:'#39313c',roughness:.92,flatShading:true});
  const seam=float(1).sub(smoothstep(.03,.15,sin(positionLocal.x.mul(9).add(positionLocal.y.mul(6)).add(positionLocal.z.mul(8))).abs()));
  rockMat.colorNode=mix(color('#39313c'),color('#9d4f36'),attribute('rockHeat','float').mul(seam).mul(.6));rockMat.emissiveNode=color('#ff4e19').mul(attribute('rockHeat','float')).mul(seam).mul(2.4);
  this.rocks=new THREE.InstancedMesh(geometry,rockMat,this.rockCount);this.rocks.count=0;this.rocks.frustumCulled=false;this.rocks.castShadow=false;this.rocks.receiveShadow=true;scene.add(this.rocks);
  this.pool=[];this.handles=new Set();
  // Allocate convex hulls once. Disabled pooled bodies never enter active island
  // work; their handles and hulls survive landings, origin shifts and respawns.
  for(let i=0;i<this.rockCount;i++){
   const radius=.32+rand(i+19)*.34,vertices=new Float32Array(positions.array.length);for(let j=0;j<vertices.length;j++)vertices[j]=positions.array[j]*radius;
   const body=physics.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setEnabled(false).setCanSleep(true).setCcdEnabled(true).setLinearDamping(.12).setAngularDamping(.7));
   const collider=physics.world.createCollider(RAPIER.ColliderDesc.convexHull(vertices).setMass(45+radius*105).setCollisionGroups(0x0001ffff).setFriction(.85).setRestitution(.25),body);
   this.pool.push({body,collider,radius,active:false,settled:false,age:0,hitAt:-100,lastVx:0,lastVy:0,lastVz:0,contacts:0});this.handles.add(collider.handle);
  }
  const makeBillboards=(count,hex,ember)=>{
   const g=new THREE.PlaneGeometry(1,1);g.setAttribute('hazardOpacity',new THREE.InstancedBufferAttribute(new Float32Array(count),1));
   const mat=new THREE.MeshBasicNodeMaterial({color:hex,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:!ember});
   const r=uv().sub(.5).length().mul(2),edge=float(1).sub(smoothstep(0,1,r)).pow(ember?1.6:2);
   const density=ember?float(1):mx_noise_float(vec3(uv().x.mul(3),uv().y.mul(2),this.clock.mul(.07))).mul(.24).add(.76);
   mat.opacityNode=edge.mul(density).mul(attribute('hazardOpacity','float'));
   if(ember)mat.colorNode=mix(color('#d52913'),color('#ffb05b'),float(1).sub(smoothstep(.04,.40,r))).mul(1.5);
   const mesh=new THREE.InstancedMesh(g,mat,count);mesh.count=0;mesh.frustumCulled=false;mesh.renderOrder=ember?4:3;scene.add(mesh);return mesh;
  };
  this.embers=makeBillboards(this.emberCount,'#ee542b',true);this.smoke=makeBillboards(this.smokeCount,'#b18479',false);this.emberAnchors=[];this.smokeAnchors=[];
 }
 _register(rock,active){
  const obstacles=this.physics.obstacles;
  if(rock.registry&&rock.registry!==obstacles){rock.registry.handles?.delete(rock.collider.handle);rock.registry.kinds?.delete(rock.collider.handle)}
  rock.registry=obstacles;
  if(active){obstacles?.handles?.add(rock.collider.handle);obstacles?.kinds?.set(rock.collider.handle,'rock')}
  else {obstacles?.handles?.delete(rock.collider.handle);obstacles?.kinds?.delete(rock.collider.handle)}
 }
 _retire(rock){rock.active=false;rock.settled=false;rock.body.setEnabled(false);this._register(rock,false)}
 _spawn(p,time){
  const rock=this.pool.find(r=>!r.active);if(!rock)return;
  const index=this.sequence++,flight=volcanoRockFlight(p,this.physics.forward?.(),index,(x,z)=>this.field.height(x,z));
  // Deterministic alternatives avoid filling non-volcanic slopes at the edge.
  if(volcanoHazardStrength(flight.targetX,flight.targetZ)<.15)return;
  Object.assign(rock,{active:true,settled:false,age:0,started:time,expires:time+13+rand(index+21)*5,hitAt:-100,lastVx:flight.vx,lastVy:flight.vy,lastVz:flight.vz,contacts:0,flight});
  rock.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);rock.body.setTranslation({x:flight.x-this.origin.x,y:flight.y,z:flight.z-this.origin.z},true);rock.body.setRotation({x:0,y:0,z:0,w:1},true);rock.body.setLinvel({x:flight.vx,y:flight.vy,z:flight.vz},true);rock.body.setAngvel({x:1+rand(index+30)*2,y:rand(index+31)*2,z:rand(index+32)*2},true);rock.body.resetForces(false);rock.body.resetTorques(false);rock.body.setEnabled(true);this._register(rock,true);
 }
 _impact(rock,position,p,time,velocity,chassis=false){
  if(time-rock.hitAt<.45||velocity<1.3)return;rock.hitAt=time;rock.contacts++;
  // DrivePhysics already voices impacts when the truck itself closes quickly.
  // A moving rock can also strike a parked truck; use its relative speed below.
  if(chassis&&(this.physics.feedback?.bodyAt.get(rock.collider.handle)||0)>this.physics.time)return;
  const dx=position.x+this.origin.x-p.x,dz=position.z+this.origin.z-p.z,distance=Math.hypot(dx,dz),attenuation=1-smooth(8,38,distance);if(attenuation<=0)return;
  const forward=this.physics.forward?.()||{x:0,z:-1},pan=clamp((-forward.z*dx+forward.x*dz)/Math.max(8,distance),-.8,.8);
  this.events.push({kind:'rock',energy:clamp(velocity/24*attenuation,.08,.7),pan});if(this.events.length>8)this.events.shift();this.stats.impacts++;
 }
 _rebase(origin){
  const dx=origin.x-this.origin.x,dz=origin.z-this.origin.z;if(!dx&&!dz)return;
  for(const rock of this.pool)if(rock.active){const v=rock.body.translation();rock.body.setTranslation({x:v.x-dx,y:v.y,z:v.z-dz},false)}
  this.origin.x=origin.x;this.origin.z=origin.z;
 }
 _anchors(p){
  const cx=Math.floor(p.x/18),cz=Math.floor(p.z/18),key=cx+','+cz;if(key===this.anchorKey)return;this.anchorKey=key;const seed=cx*173+cz*97;
  const fill=(out,count,smoke)=>{out.length=0;for(let i=0;i<count;i++){const a=rand(seed+i*3)*TWO_PI,r=(smoke?12:5)+rand(seed+i*3+1)*(smoke?21:30),x=cx*18+9+Math.cos(a)*r,z=cz*18+9+Math.sin(a)*r;out.push({x,z,y:this.field.height(x,z),seed:seed+i*7,strength:volcanoHazardStrength(x,z)})}};
  fill(this.emberAnchors,this.emberCount,false);fill(this.smokeAnchors,this.smokeCount,true);
 }
 _ambient(p,time,camera,weather,strength){
  this._anchors(p);const d=this.dummy,t=this.reduced?0:time,wind=clamp(weather.wind??15,0,50)/50;
  const draw=(mesh,anchors,smoke)=>{let count=0;const opacity=mesh.geometry.attributes.hazardOpacity;
   for(const a of anchors){
    const phase=((t*(smoke?.035:.14)+rand(a.seed+10))%1+1)%1,fade=Math.sin(phase*Math.PI),drift=(phase-.5)*(smoke?6:3),x=a.x+drift*(.3+wind),z=a.z-drift*.45,y=a.y+(smoke?1.2+phase*1.1:.4+phase*(3+rand(a.seed+16)*5));
    const distance=Math.hypot(x-p.x,z-p.z),local=(1-smooth(smoke?28:20,smoke?48:38,distance))*a.strength*strength;if(local<.02)continue;
    d.position.set(x-this.origin.x,y,z-this.origin.z);const cameraDistance=camera?d.position.distanceTo(camera.position):20,near=smooth(smoke?5:2,smoke?13:5,cameraDistance);if(near<=.01)continue;
    if(camera)d.quaternion.copy(camera.quaternion);else d.quaternion.identity();
    const size=smoke?9+rand(a.seed+20)*7:.12+rand(a.seed+20)*.16;d.scale.set(size,smoke?2.2+rand(a.seed+25)*2:size*1.5,1);d.updateMatrix();mesh.setMatrixAt(count,d.matrix);opacity.setX(count,local*near*(smoke?.28:.88)*(this.reduced?.5:fade));count++;
   }mesh.count=count;mesh.visible=count>0;mesh.instanceMatrix.needsUpdate=true;opacity.needsUpdate=true;return count;
  };
  this.stats.embers=draw(this.embers,this.emberAnchors,false);this.stats.smoke=draw(this.smoke,this.smokeAnchors,true);
 }
 update(p,time,origin,camera,weather={}){
  if(this.disposed)return;this._rebase(origin);if(this.lastTime!==null&&time<this.lastTime)this.reset();this.lastTime=time;this.clock.value=this.reduced?0:time;
  const strength=volcanoHazardStrength(p.x,p.z);let count=0;
  if(strength>.2&&!this.reduced&&time>=this.nextSpawn){this._spawn(p,time);this.nextSpawn=time+(this.mobile?2.4:1.65)+rand(this.sequence+44)*.85}
  for(const rock of this.pool){
   if(!rock.active)continue;const body=rock.body;let position=body.translation();const x=position.x+origin.x,z=position.z+origin.z;
   if(time>rock.expires||Math.hypot(x-p.x,z-p.z)>62||strength<.01){this._retire(rock);continue}
   this._register(rock,true);rock.age=time-rock.started;
   if(!rock.settled){
    let velocity=body.linvel(),grounded=false;
    this.physics.world.contactPairsWith(rock.collider,other=>{
     if(this.handles.has(other.handle))return;
     this.physics.world.contactPair(rock.collider,other,manifold=>{
      let touching=false,impulse=0;for(let i=0;i<manifold.numContacts();i++)if(manifold.contactDist(i)<.025){touching=true;impulse+=manifold.contactImpulse(i)}
      if(!touching)return;
      if(other.handle===this.physics.chassis?.handle){
       if(impulse<=1)return;const n=manifold.normal(),truck=this.physics.rb.linvel();
       const before=Math.abs((rock.lastVx-truck.x)*n.x+(rock.lastVy-truck.y)*n.y+(rock.lastVz-truck.z)*n.z),after=Math.abs((velocity.x-truck.x)*n.x+(velocity.y-truck.y)*n.y+(velocity.z-truck.z)*n.z);
       this._impact(rock,position,p,time,Math.max(before,after),true);
      }else grounded=true;
     });
    });
    // Terrain tiles can stream out before a rock expires. This bounded fallback
    // only catches below-ground bodies; ordinary bounces use Rapier contacts.
    const floor=this.field.height(x,z)+rock.radius*.72;
    if(position.y<floor-.12){body.setTranslation({x:position.x,y:floor,z:position.z},true);if(velocity.y<0)body.setLinvel({x:velocity.x*.58,y:rock.contacts>1?0:-velocity.y*.24,z:velocity.z*.58},true);position=body.translation();grounded=true}
    if(grounded){this._impact(rock,position,p,time,Math.max(-rock.lastVy,-velocity.y));velocity=body.linvel();const speed=Math.hypot(velocity.x,velocity.y,velocity.z);
     if(rock.age>1.4&&(speed<1||body.isSleeping()||rock.age>7)){body.setLinvel({x:0,y:0,z:0},false);body.setAngvel({x:0,y:0,z:0},false);body.setBodyType(RAPIER.RigidBodyType.Fixed,false);rock.settled=true}
    }rock.lastVx=velocity.x;rock.lastVy=velocity.y;rock.lastVz=velocity.z;
   }
   const d=this.dummy;d.position.set(position.x,position.y,position.z);d.quaternion.copy(body.rotation());const fade=clamp((rock.expires-time)/1.1,0,1);d.scale.setScalar(rock.radius);d.updateMatrix();this.rocks.setMatrixAt(count,d.matrix);this.heat[count]=Math.max(.04,1-rock.age/8)*fade;count++;
  }
  this.rocks.count=count;this.rocks.visible=count>0;this.rocks.instanceMatrix.needsUpdate=true;this.rocks.geometry.attributes.rockHeat.needsUpdate=true;this.stats.rocks=count;
  if(strength>.02)this._ambient(p,time,camera,weather,strength);else {this.embers.count=this.smoke.count=0;this.embers.visible=this.smoke.visible=false;this.stats.embers=this.stats.smoke=0}
 }
 drainImpacts(){const events=this.events;this.events=[];return events}
 reset(){for(const rock of this.pool)this._retire(rock);this.events.length=0;this.lastTime=null;this.nextSpawn=0;this.sequence=0;this.anchorKey='';for(const mesh of [this.rocks,this.embers,this.smoke]){mesh.count=0;mesh.visible=false}Object.assign(this.stats,{rocks:0,embers:0,smoke:0,impacts:0})}
 dispose(){if(this.disposed)return;this.reset();for(const rock of this.pool)this.physics.world.removeRigidBody(rock.body);this.handles.clear();for(const mesh of [this.rocks,this.embers,this.smoke]){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();mesh.dispose()}this.disposed=true}
}
