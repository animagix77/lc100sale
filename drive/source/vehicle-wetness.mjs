import * as THREE from 'three/webgpu';
import {uniform,positionLocal,smoothstep,float,materialColor,materialRoughness,mix} from 'three/tsl';

const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,Number.isFinite(v)?v:0));
const approach=(value,target,rate,dt)=>target+(value-target)*Math.exp(-rate*dt);
// Separate coats keep a river crossing below the windows while rain wets the roof.
export class WetnessState {
 constructor(){this.rain=0;this.water=0;this.splashHeight=1;this.draining=0;this.amount=0;}
 update(dt,{rain=0,contact=0,depth=0,speed=0}={}){
  if(!Number.isFinite(dt)||dt<=0)return this;
  rain=clamp(rain);contact=clamp(contact);depth=clamp(depth,0,2);speed=Math.abs(Number.isFinite(speed)?speed:0);
  this.rain=rain>.02?approach(this.rain,Math.max(this.rain,rain),.28,dt):this.rain*Math.exp(-dt/75);
  const soaking=contact*clamp(depth*2.2+speed*.045+.18);
  this.water=soaking>.01?approach(this.water,Math.max(this.water,soaking),2.8,dt):this.water*Math.exp(-dt/65);
  if(contact>.01){this.splashHeight=approach(this.splashHeight,clamp(.78+depth*.65+speed*.025,.78,1.70),3,dt);this.draining=Math.max(this.draining,soaking);}
  else this.draining*=Math.exp(-dt/8);
  this.amount=Math.max(this.rain,this.water);
  return this;
 }
 reset(){this.rain=this.water=this.draining=this.amount=0;this.splashHeight=1;}
}

const lowerEdges=[[-.94,.52,-1.78],[.94,.52,-1.78],[-.98,.63,1.55],[.98,.63,1.55],[-.93,.66,-.2],[.93,.66,-.2],[-.61,.49,2.17],[.61,.49,2.17]];
const roofEdges=[[-.82,1.98,-.72],[.82,1.98,-.72],[-.86,1.99,1.27],[.86,1.99,1.27]];

export class VehicleWetness {
 constructor(scene,truck,{mobile=false,reduced=false,groundHeight=()=>-Infinity,waterHeight=()=>-Infinity}={}){
  this.scene=scene;this.truck=truck;this.reduced=reduced;this.groundHeight=groundHeight;this.waterHeight=waterHeight;
  this.state=new WetnessState();this.rain=uniform(0);this.water=uniform(0);this.splashHeight=uniform(1);this.materials=[];
  this.max=mobile?8:16;this.pool=Array.from({length:this.max},()=>({alive:false,x:0,y:0,z:0,vx:0,vy:0,vz:0,life:0,age:0}));
  this.dummy=new THREE.Object3D();this.point=new THREE.Vector3();this.emitCredit=0;this.serial=0;this.stats={wetness:0,drips:0};
  // Wrap only the original truck surfaces. Snow, lamps and recovery boards keep their own materials.
  const surfaces=[];const body=truck.getObjectByName('Body');body?.traverse(mesh=>{if(mesh.isMesh)surfaces.push({mesh,body:true})});
  for(const name of ['FL','FR','RL','RR'])truck.getObjectByName('Roll_'+name)?.traverse(mesh=>{if(mesh.isMesh)surfaces.push({mesh,body:false})});
  const converted=new Map();
  for(const {mesh,body:isBody} of surfaces){
   const previous=mesh.material,originals=Array.isArray(previous)?previous:[previous];
   const mapped=originals.map(original=>{
    if(!original?.isMeshStandardMaterial&&!original?.isMeshStandardNodeMaterial)return original;
    const key=original.uuid+':'+isBody;if(converted.has(key))return converted.get(key);
    const mat=new THREE.MeshStandardNodeMaterial();mat.copy(original);
    // Preserve the head/tail light emission graph created by VehicleLights.
    if(original.isNodeMaterial){mat.emissiveNode=original.emissiveNode;mat.colorNode=original.colorNode;mat.roughnessNode=original.roughnessNode;}
    const lower=isBody?float(1).sub(smoothstep(this.splashHeight.sub(.28),this.splashHeight.add(.35),positionLocal.y)):float(1);
    const amount=this.rain.max(this.water.mul(lower));
    mat.colorNode=(mat.colorNode||materialColor).mul(float(1).sub(amount.mul(isBody?.105:.16)));
    const rough=mat.roughnessNode||materialRoughness;
    mat.roughnessNode=mix(rough,rough.mul(.48).max(.12),amount);
    mat.name=(original.name||'Vehicle surface')+' / wet coat';converted.set(key,mat);return mat;
   });
   mesh.material=Array.isArray(mesh.material)?mapped:mapped[0];this.materials.push({mesh,original:previous,mapped});
  }
  this.ownedMaterials=[...converted.values()];
  this.geometry=new THREE.OctahedronGeometry(1,0);
  this.material=new THREE.MeshStandardNodeMaterial({color:'#abcbd0',roughness:.12,metalness:.05,transparent:true,opacity:.62,depthWrite:false});
  this.drops=new THREE.InstancedMesh(this.geometry,this.material,this.max);this.drops.name='Water draining from the LC100';this.drops.frustumCulled=false;this.drops.count=0;this.drops.visible=false;this.drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(this.drops);
 }
 update(dt,weather={},water={},origin={x:0,z:0},velocity={x:0,y:0,z:0},time=0){
  if(!Number.isFinite(dt)||dt<=0)return;
  this.state.update(dt,{rain:weather.rain,contact:water.contact,depth:water.depth,speed:Math.hypot(velocity.x||0,velocity.z||0)});
  this.rain.value=this.state.rain;this.water.value=this.state.water;this.splashHeight.value=this.state.splashHeight;this.stats.wetness=this.state.amount;
  let count=0;const step=Math.min(dt,.1);
  for(const d of this.pool){
   if(!d.alive)continue;d.age+=step;d.vy-=9.81*step;d.x+=d.vx*step;d.y+=d.vy*step;d.z+=d.vz*step;
   const floor=Math.max(this.groundHeight(d.x,d.z),this.waterHeight(d.x,d.z,time));
   if(d.age>=d.life||d.y<=floor+.025){d.alive=false;continue;}
  }
  // Small droplets, not another tyre-spray system. Rain gutters drain while it rains;
  // rocker panels trail a few drops for seconds after leaving a crossing.
  const rain=clamp(weather.rain),rate=this.reduced?0:(this.state.draining*6+rain*this.state.rain*5)*(this.max/16);
  this.emitCredit=Math.min(this.emitCredit+rate*step,2);
  if(rate>.02){this.truck.updateWorldMatrix(true,false);while(this.emitCredit>=1){this.emitCredit--;const d=this.pool.find(drop=>!drop.alive);if(!d)break;
   const n=this.serial++,roof=rain>.25&&n%3===0,edges=roof?roofEdges:lowerEdges,p=edges[n%edges.length];
   this.point.set(...p);this.truck.localToWorld(this.point);
   Object.assign(d,{alive:true,x:this.point.x+origin.x,y:this.point.y,z:this.point.z+origin.z,vx:(velocity.x||0)*.35,vy:-.4,vz:(velocity.z||0)*.35,life:roof?.52:.34,age:0});
  }}else this.emitCredit=0;
  for(const d of this.pool){if(!d.alive)continue;
   this.dummy.position.set(d.x-origin.x,d.y,d.z-origin.z);this.dummy.rotation.set(0,0,0);
   const taper=1-d.age/d.life;this.dummy.scale.set(.012*taper,.024+Math.min(.042,Math.abs(d.vy)*.010),.012*taper);this.dummy.updateMatrix();this.drops.setMatrixAt(count++,this.dummy.matrix);
  }
  this.drops.count=count;this.drops.visible=count>0;if(count)this.drops.instanceMatrix.needsUpdate=true;this.stats.drips=count;
 }
 reset(){this.state.reset();this.rain.value=this.water.value=0;this.emitCredit=0;for(const d of this.pool)d.alive=false;this.drops.count=0;this.drops.visible=false;this.stats.wetness=this.stats.drips=0;}
 dispose(){this.drops.removeFromParent();this.geometry.dispose();this.material.dispose();for(const {mesh,original} of this.materials)mesh.material=original;for(const mat of this.ownedMaterials)mat.dispose();this.materials.length=0;}
}
