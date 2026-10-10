// Judge Dean LLC — distant, alpha-soft cloud banks with continuous weather cover.
import * as THREE from 'three/webgpu';
import {attribute,texture,uv,vec2,uniform} from 'three/tsl';
const rand=n=>{const v=Math.sin(n*127.1)*43758.5453;return v-Math.floor(v)};
export class SunsetClouds {
 constructor(scene,{reduced=false,mobile=false}={}){
  this.scene=scene;this.reduced=reduced;this.mobile=mobile;this.cover=.2;this.disposed=false;
  // Keep a lightweight untextured fallback for an unavailable optional image.
  const g=new THREE.IcosahedronGeometry(1,2);
  this.alpha=new THREE.InstancedBufferAttribute(new Float32Array(24),1);g.setAttribute('cloudAlpha',this.alpha);
  const material=new THREE.MeshBasicNodeMaterial({color:'#e4e6e6',transparent:true,fog:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});
  this.tint=uniform(material.color);material.opacityNode=attribute('cloudAlpha','float');
  this.mesh=new THREE.InstancedMesh(g,material,24);this.mesh.frustumCulled=false;this.mesh.renderOrder=-1;scene.add(this.mesh);
  this.parts=[];this.dummy=new THREE.Object3D();this.target=new THREE.Vector3();
  for(let bank=0;bank<24;bank++){
   const angle=bank*2.399+.12,range=760+rand(bank+10)*200;
   this.parts.push({x:Math.sin(angle)*range,z:Math.cos(angle)*range,y:90+rand(bank+40)*210,width:180+rand(bank+80)*185,height:65+rand(bank+100)*75,rank:bank,flip:rand(bank+120)>.5?-1:1});
  }
  // Transparent banks render back to front; rank still distributes weather cover.
  this.parts.sort((a,b)=>Math.hypot(b.x,b.y,b.z)-Math.hypot(a.x,a.y,a.z));this.setCover(this.cover);
 }
 async loadTexture({loader=new THREE.TextureLoader()}={}){
  const map=await loader.loadAsync(`textures/terrain/cumulus-bank-v1${this.mobile?'-768':''}.webp`).catch(()=>null);
  if(!map)return false;if(this.disposed){map.dispose();return false;}
  map.colorSpace=THREE.SRGBColorSpace;map.needsUpdate=true;
  this.texture?.dispose();this.texture=map;this.mesh.material.map=map;this.mesh.material.needsUpdate=true;
  const old=this.mesh.geometry,g=new THREE.PlaneGeometry(1,1);g.setAttribute('cloudAlpha',this.alpha);g.setAttribute('cloudMirror',new THREE.InstancedBufferAttribute(Float32Array.from(this.parts,p=>p.flip),1));const coords=uv(),u=attribute('cloudMirror','float').lessThan(0).select(coords.x.oneMinus(),coords.x);this.mesh.material.colorNode=texture(map,vec2(u,coords.y)).mul(this.tint); this.mesh.geometry=g;old.dispose();return true;
 }
 setCover(cover){
  this.cover=THREE.MathUtils.clamp(cover,0,1);
  for(let i=0;i<this.parts.length;i++){
   const p=this.parts[i],weight=THREE.MathUtils.smoothstep(7+this.cover*19-p.rank,0,2);
   this.alpha.setX(i,weight*(.76+rand(p.rank+150)*.17));
  }
  this.alpha.needsUpdate=true;
 }
 update(camera,time){
  const d=this.dummy,drift=this.reduced?0:Math.sin(time*.004*(this.wind||1))*22;
  this.parts.forEach((p,i)=>{
   d.position.set(camera.position.x+p.x+drift,camera.position.y+p.y,camera.position.z+p.z);
   if(this.texture){d.scale.set(p.width,p.height,1);this.target.set(camera.position.x,d.position.y,camera.position.z);d.lookAt(this.target);}
   else{d.scale.set(p.width*.45,p.height*.12,p.width*.13);d.rotation.set(0,.2,0);}
   d.updateMatrix();this.mesh.setMatrixAt(i,d.matrix);
  });this.mesh.instanceMatrix.needsUpdate=true;
 }
 dispose(){this.disposed=true;this.scene.remove(this.mesh);this.mesh.geometry.dispose();this.mesh.material.dispose();this.texture?.dispose();this.mesh.dispose();}
}
