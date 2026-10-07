import * as THREE from 'three/webgpu';
import {baseHeight,surfaceAt} from './terrain.mjs';
import {routeSample,riverMask} from './expedition.mjs';
const rand=(a,b)=>{const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n)};
function fracturedRock(){
 const g=new THREE.IcosahedronGeometry(1,1),p=g.attributes.position,c=[],v=new THREE.Vector3(),tone=new THREE.Color();
 for(let i=0;i<p.count;i++){
  v.fromBufferAttribute(p,i);const cut=.88+Math.sin(v.x*9+v.z*5)*.09;
  v.set(v.x*cut,Math.round(v.y*5)/5*.8+.3,v.z*(.85+Math.sin(v.y*8)*.08));p.setXYZ(i,v.x,v.y,v.z);
  const seam=.75+.19*(.5+.5*Math.sin(v.y*16+v.x*.7));tone.setRGB(seam,seam*.98,seam*.98);c.push(tone.r,tone.g,tone.b);
 }g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.computeVertexNormals();return g;
}
export class MountainDetails{
 constructor(scene,{mobile=false}={}){
  Object.assign(this,{scene,mobile});this.key='';this.samples=[];this.dummy=new THREE.Object3D();
  this.rocks=new THREE.InstancedMesh(fracturedRock(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.91,flatShading:true}),mobile?100:170);
  this.scree=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1,flatShading:true}),mobile?550:1100);
  for(const m of [this.rocks,this.scree]){m.count=0;m.frustumCulled=false;m.receiveShadow=true;m.setColorAt(0,new THREE.Color(1,1,1));scene.add(m)}this.rocks.castShadow=true;
 }
 refresh(p,origin){
  const cx=Math.floor(p.x/64),cz=Math.floor(p.z/64),key=`${cx},${cz},${origin.x},${origin.z}`;if(key===this.key)return;this.key=key;this.rocks.userData.detailKey=key;
  const centerX=cx*64+32,centerZ=cz*64+32,candidates=[];
  for(let iz=Math.floor((centerZ-145)/12);iz<=Math.ceil((centerZ+145)/12);iz++)for(let ix=Math.floor((centerX-145)/12);ix<=Math.ceil((centerX+145)/12);ix++){
   const x=ix*12+rand(ix,iz)*9,z=iz*12+rand(iz,ix)*9,h=baseHeight(x,z),surface=surfaceAt(x,z),route=routeSample(x,z),distance=Math.hypot(x-centerX,z-centerZ);
   if(h<30||route.distance<10||route.distance>115||distance>145||riverMask(x,z)>.05||surface.grass>.4)continue;
   candidates.push({x,z,h,surface,ix,iz,distance});
  }
  candidates.sort((a,b)=>a.distance-b.distance);let ri=0,si=0;this.samples=[];const d=this.dummy,c=new THREE.Color();
  for(const r of candidates.slice(0,this.rocks.instanceMatrix.count)){
   const {x,z,h,surface,ix,iz}=r,scale=1.0+rand(ix+8,iz)*2.3;
   d.position.set(x-origin.x,h-.36,z-origin.z);d.rotation.set((rand(ix,iz+3)-.5)*.2,rand(ix,iz+2)*Math.PI*2,(rand(ix,iz+4)-.5)*.18);d.scale.set(scale*(1.1+rand(ix+4,iz)),scale*.7,scale);d.updateMatrix();this.rocks.setMatrixAt(ri,d.matrix);
   c.set(surface.volcanic>.3?'#696169':'#897d75').lerp(new THREE.Color('#c4ccd0'),surface.snow*.50).multiplyScalar(.85+rand(ix+6,iz)*.35);this.rocks.setColorAt(ri++,c);this.samples.push({x,z,kind:'rock'});
  }
  // Small stones make the shoulder read as broken ground. They are below tyre
  // obstacle scale; the larger outcrops share exact geometry with solid colliders.
  for(let iz=Math.floor((centerZ-56)/3);iz<=Math.ceil((centerZ+56)/3);iz++)for(let ix=Math.floor((centerX-56)/3);ix<=Math.ceil((centerX+56)/3);ix++){
   if(si>=this.scree.instanceMatrix.count)break;
   const x=ix*3+rand(ix,iz)*2.7,z=iz*3+rand(iz,ix)*2.7,h=baseHeight(x,z),surface=surfaceAt(x,z),route=routeSample(x,z);
   if(h<28||route.distance<2.8||surface.grass>.5||riverMask(x,z)>.1||surface.snow>.75)continue;
   const scale=.06+rand(ix+6,iz)*.17;d.position.set(x-origin.x,h+.035,z-origin.z);d.rotation.set(rand(ix,iz),rand(ix+2,iz)*6.28,rand(ix+3,iz));d.scale.set(scale*1.8,scale*.65,scale);d.updateMatrix();this.scree.setMatrixAt(si,d.matrix);c.set(surface.volcanic>.3?'#8f7c79':'#a19782').multiplyScalar(.75+rand(ix+4,iz)*.5);this.scree.setColorAt(si++,c);
  }
  this.rocks.count=ri;this.scree.count=si;for(const m of [this.rocks,this.scree]){m.instanceMatrix.needsUpdate=true;m.instanceColor.needsUpdate=true}
 }
 dispose(){for(const m of [this.rocks,this.scree]){m.removeFromParent();m.geometry.dispose();m.material.dispose();m.dispose()}}
}
