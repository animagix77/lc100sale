// Judge Dean LLC — bounded flames and smoke; no modification of the vehicle model.
import * as THREE from 'three/webgpu';
import {uv,float,smoothstep,mix,color,attribute} from 'three/tsl';
const rand=n=>{const v=Math.sin(n*127.1+9.7)*43758.5453;return v-Math.floor(v)};
export class VehicleFire{
 constructor(scene,{mobile=false,reduced=false}={}){
  this.scene=scene;this.reduced=reduced;this.dummy=new THREE.Object3D();this.point=new THREE.Vector3();this.flameCount=mobile?28:44;this.smokeCount=mobile?12:20;
  this.meshes=[];
  for(const smoke of [false,true]){
   const count=smoke?this.smokeCount:this.flameCount,g=new THREE.PlaneGeometry(1,1),alpha=new THREE.InstancedBufferAttribute(new Float32Array(count),1);g.setAttribute('fireAlpha',alpha);
   const m=new THREE.MeshBasicNodeMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:smoke?THREE.NormalBlending:THREE.AdditiveBlending,toneMapped:false});
   const p=uv().sub(.5),radius=p.x.mul(smoke?2:2.8).pow(2).add(p.y.mul(2).pow(2)).sqrt();
   m.opacityNode=float(1).sub(smoothstep(.15,1,radius)).pow(smoke?1.4:1.1).mul(attribute('fireAlpha','float'));
   m.colorNode=smoke?color('#29262a'):mix(color('#ff3808'),color('#fff0a0'),float(1).sub(uv().y)).mul(2.6);
   const mesh=new THREE.InstancedMesh(g,m,count);mesh.count=0;mesh.visible=false;mesh.frustumCulled=false;mesh.renderOrder=smoke?5:4;scene.add(mesh);this.meshes.push(mesh);
  }
 }
 update(age,physics,camera){
  if(age===null){this.clear();return}
  const pos=physics.rb.translation(),q=physics.rb.rotation(),growth=Math.min(1,age/.4+.18),d=this.dummy;
  this.meshes.forEach((mesh,kind)=>{
   const smoke=kind===1,count=smoke?this.smokeCount:this.flameCount;mesh.count=count;mesh.visible=true;
   for(let i=0;i<count;i++){
    const phase=(age*(this.reduced?.32:smoke?.42:1.1)+rand(i+kind*80))%1;
    const x=(rand(i+12)-.5)*1.9,z=(rand(i+31)-.5)*4.1;
    this.point.set(x,.15,z).applyQuaternion(q).add(pos);d.position.copy(this.point);
    d.position.y+=(smoke?.8:0)+phase*(smoke?4.5:2.2);d.position.x+=Math.sin(i+phase*4)*phase*(smoke?.7:.17);
    d.quaternion.copy(camera.quaternion);const size=(smoke?.8+phase*1.8:.65+rand(i+42)*.4)*(smoke?1:growth);
    d.scale.set(size,smoke?size:size*(1.6+phase),1);d.updateMatrix();mesh.setMatrixAt(i,d.matrix);
    mesh.geometry.attributes.fireAlpha.setX(i,growth*Math.sin(Math.PI*phase)*(smoke?.38:.85));
   }
   mesh.instanceMatrix.needsUpdate=true;mesh.geometry.attributes.fireAlpha.needsUpdate=true;
  });
 }
 clear(){for(const mesh of this.meshes){mesh.visible=false;mesh.count=0}}
 dispose(){for(const mesh of this.meshes){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();mesh.dispose()}}
}
