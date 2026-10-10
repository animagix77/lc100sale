import {CanyonRiverView} from './canyon-river-view.mjs';
// Judge Dean LLC — suspended timber crossing, river gorge and atmospheric depth.
import * as THREE from 'three/webgpu';
import {uv,uniform,sin,positionLocal,mix,color,float,smoothstep,mx_noise_float,vec3} from 'three/tsl';
import {BRIDGE_SPEC as S,bridgeCableHeight} from './canyon-bridge.mjs';
import {canyonCenterZ,canyonFloor} from './canyon.mjs';
const up=new THREE.Vector3(0,1,0),a=new THREE.Vector3(),b=new THREE.Vector3(),v=new THREE.Vector3(),q=new THREE.Quaternion(),dummy=new THREE.Object3D();
export class CanyonBridgeView{
 constructor(scene,physics,options={}){
  this.options=options;
  this.physics=physics;this.group=new THREE.Group();this.group.name='Canyon suspension bridge';scene.add(this.group);this.resources=[];this.clock=uniform(0);
  const grain=new Uint8Array(256*64*4);for(let y=0;y<64;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4,n=Math.sin(x*.3+Math.sin(y*.11)*5)*12+Math.sin(x*1.73+y*.03)*6+Math.sin(y*.06)*6;grain[i]=123+n;grain[i+1]=92+n*.8;grain[i+2]=59+n*.5;grain[i+3]=255}
  const texture=new THREE.DataTexture(grain,256,64);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.needsUpdate=true;this.resources.push(texture);
  const wood=new THREE.MeshStandardMaterial({map:texture,roughness:.94,color:0xb9a58b}),rope=new THREE.MeshStandardMaterial({color:0x514230,roughness:1}),cut=new THREE.MeshStandardMaterial({color:0x8b7450,roughness:1});
  this.resources.push(wood,rope,cut);
  const cylinder=new THREE.CylinderGeometry(1,1,1,10),ropeGeo=new THREE.CylinderGeometry(1,1,1,6);this.resources.push(cylinder,ropeGeo);
  this.logs=new THREE.InstancedMesh(cylinder,wood,S.count*10);this.logs.castShadow=this.logs.receiveShadow=true;this.logs.frustumCulled=false;this.group.add(this.logs);
  this.ropes=new THREE.InstancedMesh(ropeGeo,rope,700);this.ropes.frustumCulled=false;this.ropes.castShadow=true;this.group.add(this.ropes);
  this.hardware=new THREE.InstancedMesh(cylinder,wood,40);this.hardware.castShadow=this.hardware.receiveShadow=true;this.group.add(this.hardware);
  this.bindings=new THREE.InstancedMesh(new THREE.TorusGeometry(.20,.026,5,12),rope,80);this.resources.push(this.bindings.geometry);this.bindings.frustumCulled=false;this.group.add(this.bindings);
  const sillGeo=new THREE.BoxGeometry(4.5,2,1.35),sillMat=new THREE.MeshStandardMaterial({color:0x706f68,roughness:1});this.resources.push(sillGeo,sillMat);for(const end of [-1,1]){const sill=new THREE.Mesh(sillGeo,sillMat);sill.position.set(S.centerX,79,S.centerZ+end*30.725);sill.castShadow=sill.receiveShadow=true;this.group.add(sill);}
  this.buildBanks();this.buildGorge();this.update(0);
 }
 bar(mesh,index,p1,p2,radius){v.subVectors(p2,p1);dummy.position.copy(p1).add(p2).multiplyScalar(.5);const length=v.length();dummy.quaternion.setFromUnitVectors(up,v.multiplyScalar(1/Math.max(length,.00001)));dummy.scale.set(radius,length,radius);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix)}
 buildBanks(){let n=0;for(const end of [-1,1]){const z=S.centerZ+end*S.span/2;
  for(const side of [-1,1]){const x=S.centerX+side*2.85;this.bar(this.hardware,n++,a.set(x,79.45,z),b.set(x,86.5,z),.23);this.bar(this.hardware,n++,a.set(x+side*1.75,79.75,z+end*2.3),b.set(x,84.4,z),.16);}
  this.bar(this.hardware,n++,a.set(S.centerX-3.15,86,z),b.set(S.centerX+3.15,86,z),.25);
  for(const side of [-1,1])this.bar(this.hardware,n++,a.set(S.centerX+side*3.2,79.6,z+end*7),b.set(S.centerX+side*3.2,81.1,z+end*7),.23);
 }for(const end of [-1,1])for(let j=0;j<5;j++){const z=S.centerZ+end*(30.16+j*.27);this.bar(this.hardware,n++,a.set(S.centerX-2.25,79.86,z),b.set(S.centerX+2.25,79.86,z),.14);}
 this.hardware.count=n;this.hardware.instanceMatrix.needsUpdate=true;}
 buildGorge(){
  this.riverView=new CanyonRiverView(this.group,this.options);
  // Broad transparent veils sit down in the gorge; the deck remains crisp.
  const mist=new THREE.MeshBasicNodeMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide});const radial=float(1).sub(smoothstep(.05,.5,uv().sub(.5).length()));mist.colorNode=color('#a8bab5');mist.opacityNode=radial.mul(.12);
  const mistGeo=new THREE.PlaneGeometry(1,1);this.resources.push(mist,mistGeo);for(let i=0;i<4;i++){const m=new THREE.Mesh(mistGeo,mist);m.rotation.x=-Math.PI/2;m.position.set(716+i*38,43+i*3,canyonCenterZ(716+i*38));m.scale.set(160,45,1);this.group.add(m);}
 }
 update(time,camera){
  this.clock.value=time;this.riverView.update(time,camera);const origin=this.physics.origin;this.group.position.set(-origin.x,0,-origin.z);const truck=this.physics.position();this.group.visible=Math.hypot(truck.x-S.centerX,truck.z-S.centerZ)<520;if(!this.group.visible)return;let logN=0,ropeN=0,knotN=0;
  const poses=this.physics.bridge.poses(),point=(pose,x,y,z,out)=>out.set(x,y,z).applyQuaternion(q.set(pose.rotation.x,pose.rotation.y,pose.rotation.z,pose.rotation.w)).add(v.set(pose.position.x,pose.position.y,pose.position.z));
  for(const pose of poses){
   for(let j=0;j<10;j++){const z=-1.35+j*.3,r=.15+(Math.sin((pose.index*10+j)*7.7)*.008);point(pose,-2.2,.03,z,a);point(pose,2.2,.03,z,b);this.bar(this.logs,logN++,a,b,r);}
   // Side ropes share the physical rail height, bend and roll with each body.
   for(const side of [-1,1]){
    point(pose,side*2.13,.70,-1.5,a);point(pose,side*2.13,.70,1.5,b);this.bar(this.ropes,ropeN++,a,b,.055);
    point(pose,side*1.98,0,0,a);const anchor=this.physics.bridge.segments[pose.index].anchors[side===-1?0:1];b.set(anchor.x,anchor.y,anchor.z);this.bar(this.ropes,ropeN++,a,b,.032);
    point(pose,side*1.98,.05,0,a);dummy.position.copy(a);dummy.quaternion.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);dummy.scale.set(1,1,1);dummy.updateMatrix();this.bindings.setMatrixAt(knotN++,dummy.matrix);
   }
  }
  for(const side of [-1,1]){
   const x=S.centerX+side*1.98;for(let i=0;i<60;i++){const z=S.centerZ-30+i;this.bar(this.ropes,ropeN++,a.set(x,bridgeCableHeight(z),z),b.set(x,bridgeCableHeight(z+1),z+1),.074)}
   // Tower saddles carry the main ropes to buried bank anchors.
   for(const end of [-1,1]){const z=S.centerZ+end*30;this.bar(this.ropes,ropeN++,a.set(x,86,z),b.set(S.centerX+side*3.2,80.5,z+end*7),.074);}
  }
  this.logs.count=logN;this.ropes.count=ropeN;this.bindings.count=knotN;for(const m of [this.logs,this.ropes,this.bindings])m.instanceMatrix.needsUpdate=true;
 }
 dispose(){this.riverView.dispose();this.group.removeFromParent();for(const m of [this.logs,this.ropes,this.hardware,this.bindings])m.dispose();for(const r of this.resources)r.dispose()}
}
