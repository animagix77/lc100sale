import * as THREE from 'three/webgpu';
import {positionLocal,texture,uniform,float,smoothstep,cameraPosition,modelWorldMatrixInverse,vec4,sin} from 'three/tsl';

export function lampState(altitude,wasDark,{braking=false,reversing=false}={}){
 const dark=Number.isFinite(altitude)?(wasDark?altitude<16:altitude<12):wasDark;
 return {dark,braking:!!braking,reversing:!!reversing};
}
// Illuminate the original painted lenses: no floating replacement lamp geometry.
export class VehicleLights{
 constructor(truck,{mobile=false,reduced=false}={}){
  this.truck=truck;this.reduced=reduced;this.dark=false;this.volumeTime=uniform(0);this.volumeDensity=uniform(.007);this.group=new THREE.Group();this.group.name='Automatic vehicle lamps';truck.add(this.group);
  this.head=uniform(0);this.tail=uniform(0);this.stop=uniform(0);this.reverse=uniform(0);this.materials=[];
  const p=positionLocal,x=p.x.abs(),y=p.y,z=p.z;
  const band=(v,lo,hi)=>smoothstep(lo,lo+.025,v).mul(float(1).sub(smoothstep(hi-.025,hi,v)));
  truck.getObjectByName('Body')?.traverse(mesh=>{
   if(!mesh.isMesh||!mesh.material.map)return;
   const original=mesh.material,mat=new THREE.MeshStandardNodeMaterial();mat.copy(original);
   const tex=texture(original.map),red=smoothstep(.04,.15,tex.r.sub(tex.g.mul(1.4)).sub(tex.b.mul(.15))),white=smoothstep(.24,.52,tex.r.min(tex.g).min(tex.b));
   const front=band(x,.49,.94).mul(band(y,.94,1.19)).mul(float(1).sub(smoothstep(-2.02,-1.95,z))).mul(white);
   const rear=band(x,.64,1.04).mul(band(y,.89,1.32)).mul(smoothstep(2.05,2.16,z));
   const high=band(x,0,.48).mul(band(y,1.76,1.96)).mul(smoothstep(1.90,2.05,z)).mul(red);
   mat.emissiveNode=uniform(new THREE.Color('#ffe3ac')).mul(front).mul(this.head)
    .add(uniform(new THREE.Color('#ff0000')).mul(rear.mul(red)).mul(this.tail))
    .add(uniform(new THREE.Color('#ff0000')).mul(high).mul(this.stop))
    .add(uniform(new THREE.Color('#ecf4ff')).mul(rear.mul(white)).mul(this.reverse));
   mesh.material=mat;this.materials.push({mesh,original,mat});
  });
  const spot=(color,position,target,distance,angle,decay)=>{
   const light=new THREE.SpotLight(color,0,distance,angle,.72,decay);light.position.set(...position);light.target.position.set(...target);this.group.add(light,light.target);return light;
  };
  this.beams=[-1,1].map(side=>spot('#ffe3ac',[side*.73,1.08,-2.27],[side*1.5,-.25,-23],48,.40,1.45));
  // Short ray-marched light volumes: integrate a soft cone through coastal air.
  // Fixed 8/12 samples and no screen-sized buffers keep the mobile cost bounded.
  const vg=new THREE.ConeGeometry(Math.tan(.34)*14,14,16,1,true).translate(0,-7,0);
  this.volumeMaterial=new THREE.MeshBasicNodeMaterial({color:'#f2ce94',transparent:true,depthWrite:false,side:THREE.BackSide});
  const eye=modelWorldMatrixInverse.mul(vec4(cameraPosition,1)).xyz,ray=positionLocal.sub(eye),length=ray.length().max(.001),dir=ray.div(length),span=length.min(30),steps=mobile?8:12,step=span.div(steps);
  let optical=float(0);
  for(let i=0;i<steps;i++){
   const sample=eye.add(dir.mul(length.sub(step.mul(i+.5)))),axial=sample.y.negate(),radius=axial.mul(Math.tan(.34)).max(.001);
   const radial=float(1).sub(smoothstep(.22,1,sample.xz.length().div(radius))),ends=smoothstep(.1,.65,axial).mul(float(1).sub(smoothstep(10,14,axial)));
   const wisps=sin(sample.x.mul(.7).add(sample.y.mul(.4)).add(sample.z).add(this.volumeTime.mul(.22))).mul(.12).add(.88);
   optical=optical.add(radial.mul(ends).mul(wisps).mul(step));
  }
  this.volumeMaterial.opacityNode=float(1).sub(optical.mul(this.volumeDensity).mul(this.head.div(3.8)).negate().exp()).min(.16);
  this.volumes=this.beams.map(light=>{const mesh=new THREE.Mesh(vg,this.volumeMaterial);mesh.name='Coastal headlight scattering';mesh.position.copy(light.position);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),light.target.position.clone().sub(light.position).normalize());this.group.add(mesh);return mesh});
  // One economical shadow map keeps logs and dune ridges grounded in the beams.
  if(!mobile){const light=this.beams[0];light.castShadow=true;light.shadow.mapSize.set(512,512);light.shadow.camera.near=.1;light.shadow.bias=-.0002;light.shadow.normalBias=.035;}
  this.rearGlow=spot('#ff2310',[0,1.05,2.55],[0,.05,5.7],7,1.02,1.8);
  this.backup=spot('#e4efff',[0,1.16,2.55],[0,-.15,10],15,.78,1.5);
 }
 update(dt,altitude,signals={},weather={}){
  if(!this.reduced)this.volumeTime.value+=Math.min(dt,.1);
  const density=weather.fog?.025:.007+Math.max(weather.rain||0,weather.snow||0)*.012;this.volumeDensity.value+=(density-this.volumeDensity.value)*(1-Math.exp(-dt*.8));
  const state=lampState(altitude,this.dark,signals);this.dark=state.dark;this.state=state;
  const k=1-Math.exp(-Math.min(dt,1)*14),approach=(u,target)=>{u.value+=(target-u.value)*k};
  approach(this.head,state.dark?3.8:0);approach(this.tail,state.braking?.9:state.dark?.20:0);approach(this.stop,state.braking?.9:0);approach(this.reverse,state.reversing?4:0);
  for(const beam of this.beams)beam.intensity=150*this.head.value/3.8;
  this.rearGlow.intensity=this.tail.value*12;this.backup.intensity=this.reverse.value*10;
 }
 dispose(){this.volumes[0].geometry.dispose();this.volumeMaterial.dispose();this.group.removeFromParent();for(const light of [...this.beams,this.rearGlow,this.backup]){light.shadow?.map?.dispose();light.dispose();}for(const {mesh,original,mat} of this.materials){mesh.material=original;mat.dispose();}}
}
