import * as THREE from 'three/webgpu';
import {uniform,attribute,positionWorld,float,smoothstep} from 'three/tsl';
import {ROADSIDE_SPOTS} from './roadside-spots.mjs';
import {vehicleGeometry,personGeometry,combine} from './roadside-models.mjs';
import {baseHeight} from './terrain.mjs';
import {sceneryFade} from './scenery-fade.mjs';
export class RoadsideStories{
 constructor(scene,{mobile=false,reduced=false}={}){
  Object.assign(this,{scene,mobile,reduced});this.anchor=uniform(new THREE.Vector2());this.clock=uniform(0);this.seen=new Set();this.dummy=new THREE.Object3D();this.meshes=[];this.smokeSources=[];
  for(const spot of ROADSIDE_SPOTS){
   const parts=[],g=vehicleGeometry(spot),up=new THREE.Vector3(-spot.hx,1,-spot.hz).normalize();
   if(spot.tipped){g.rotateZ(Math.PI*.54);g.computeBoundingBox();g.translate(0,-g.boundingBox.min.y-.10,0)}else g.translate(0,-(spot.buried||0),0);
   const yaw=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),spot.yaw),slope=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),up);g.applyQuaternion(slope.multiply(yaw));g.translate(spot.x,spot.h,spot.z);parts.push(g);
   const actor=(x,z,options,angle=0)=>{const cs=Math.cos(spot.yaw),sn=Math.sin(spot.yaw),wx=spot.x+x*cs+z*sn,wz=spot.z-x*sn+z*cs,person=personGeometry(options);person.rotateY(spot.yaw+angle);person.translate(wx,baseHeight(wx,wz),wz);parts.push(person)};
   actor(-2.8,-.5,{pose:'seated',coat:spot.couple?'#587482':'#9b7855'});
   if(spot.couple)actor(-3.25,1.15,{pose:'standing',woman:true,coat:'#c8774e'},-.35);
   const mat=new THREE.MeshStandardNodeMaterial({vertexColors:true,roughness:.72,flatShading:true}),mesh=new THREE.Mesh(combine(parts),mat);mesh.name='roadside-'+spot.id;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.story=spot;mesh.frustumCulled=true;sceneryFade(mesh,{anchor:this.anchor,clock:this.clock,near:80,far:130,arrival:false});scene.add(mesh);this.meshes.push(mesh);
   if(spot.steam){const v=new THREE.Vector3(0,1.25,-1.8).applyQuaternion(slope).add(new THREE.Vector3(spot.x,spot.h,spot.z));this.smokeSources.push(v)}
  }
  const count=mobile?8:12,geometry=new THREE.IcosahedronGeometry(1,1);geometry.setAttribute('puffOpacity',new THREE.InstancedBufferAttribute(new Float32Array(count),1));
  const material=new THREE.MeshBasicNodeMaterial({color:'#d0c7b5',transparent:true,depthWrite:false});
  material.opacityNode=attribute('puffOpacity','float').mul(float(1).sub(smoothstep(55,95,positionWorld.xz.distance(this.anchor))));
  this.smoke=new THREE.InstancedMesh(geometry,material,count);this.smoke.count=0;this.smoke.frustumCulled=false;this.smoke.name='roadside-radiator-steam';scene.add(this.smoke);
  this.stats={visible:0,steam:0,triangles:this.meshes.reduce((n,m)=>n+m.geometry.attributes.position.count/3,0)};
 }
 update(p,origin,time,allowQuip=true){
  this.anchor.value.set(p.x-origin.x,p.z-origin.z);let visible=0,joke=null;
  for(const mesh of this.meshes){const s=mesh.userData.story,dist=Math.hypot(s.x-p.x,s.z-p.z);mesh.position.set(-origin.x,0,-origin.z);mesh.visible=dist<142;if(mesh.visible)visible++;
   if(allowQuip&&!joke&&dist<23&&!this.seen.has(s.id)){this.seen.add(s.id);joke=s.quip;}
  }
  let n=0;const source=this.smokeSources[0];
  if(source&&Math.hypot(source.x-p.x,source.z-p.z)<100){
   for(let i=0;i<this.smoke.instanceMatrix.count;i++){
    const age=this.reduced?i/this.smoke.instanceMatrix.count:(time*.19+i/this.smoke.instanceMatrix.count)%1;
    const size=.11+age*.49;this.dummy.position.set(source.x-origin.x+age*1.0+Math.sin(i*2.1)*age*.18,source.y+age*2.5,source.z-origin.z+age*.25);this.dummy.rotation.set(age,i,age*.7);this.dummy.scale.set(size,size*1.30,size);this.dummy.updateMatrix();this.smoke.setMatrixAt(n,this.dummy.matrix);this.smoke.geometry.attributes.puffOpacity.setX(n,Math.sin(age*Math.PI)*.18);n++;
   }
  }
  this.smoke.count=n;this.smoke.visible=n>0;this.smoke.instanceMatrix.needsUpdate=true;this.smoke.geometry.attributes.puffOpacity.needsUpdate=true;Object.assign(this.stats,{visible,steam:n});return joke;
 }
 dispose(){for(const m of [...this.meshes,this.smoke]){m.removeFromParent();m.geometry.dispose();m.material.dispose();m.dispose?.()}this.meshes.length=0;this.smokeSources.length=0;this.seen.clear()}
}
