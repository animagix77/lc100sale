import * as THREE from 'three/webgpu';
import {attribute,float,smoothstep,uv} from 'three/tsl';
import {baseHeight,smooth,surfaceAt} from './terrain.mjs';
import {riverGreenery} from './expedition.mjs';

const TAU=Math.PI*2,FIREFLY_CELL=10;
const rand=(x,z=0)=>{const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n)};
const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
// Match the actual grassy surface and foliage masks, including the worn ford.
const grassy=s=>s.grass>=.30&&s.riverApproach<=.18&&s.river<=.05&&s.snow<.15&&s.volcanic<.10&&s.biome!=='beach';

export class MeadowWildlife{
 constructor(scene,field,{mobile=false,reduced=false}={}){
  Object.assign(this,{scene,field,mobile,reduced});this.dummy=new THREE.Object3D();this.stats={birds:0,fireflies:0};
  this.fireflyCapacity=mobile?32:64;this.radius=mobile?34:46;
  this.fireflyData=Array.from({length:this.fireflyCapacity},()=>({x:0,y:0,z:0,phase:0,pace:0,size:0}));
  this.fireflyKey='';this.fireflyCount=0;this.disposed=false;
  this.offsets=[];for(let z=-4;z<=4;z++)for(let x=-4;x<=4;x++)this.offsets.push({x,z,d:x*x+z*z});this.offsets.sort((a,b)=>a.d-b.d||a.z-b.z||a.x-b.x);

  const glowGeometry=new THREE.PlaneGeometry(1,1);this.fireflyAlpha=new THREE.InstancedBufferAttribute(new Float32Array(this.fireflyCapacity),1);glowGeometry.setAttribute('fireflyAlpha',this.fireflyAlpha);
  const glowMat=new THREE.MeshBasicNodeMaterial({color:'#ffdb79',transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false,fog:false});
  const radius=uv().sub(.5).length().mul(2),halo=float(1).sub(smoothstep(0,1,radius)).pow(2),core=float(1).sub(smoothstep(0,.18,radius));
  glowMat.color.multiplyScalar(3.4);
  glowMat.opacityNode=halo.mul(.45).add(core.mul(.95)).mul(attribute('fireflyAlpha','float'));
  this.fireflies=new THREE.InstancedMesh(glowGeometry,glowMat,this.fireflyCapacity);this.fireflies.count=0;this.fireflies.frustumCulled=false;this.fireflies.visible=false;this.fireflies.renderOrder=3;scene.add(this.fireflies);
 }
 _height(x,z){const height=this.field?.height(x,z);return Number.isFinite(height)?height:baseHeight(x,z)}
 _refreshFireflies(p){
  const cx=Math.floor(p.x/FIREFLY_CELL),cz=Math.floor(p.z/FIREFLY_CELL),key=`${cx},${cz}`;if(key===this.fireflyKey)return;
  const centerX=(cx+.5)*FIREFLY_CELL,centerZ=(cz+.5)*FIREFLY_CELL;let count=0;
  for(const offset of this.offsets){
   const ix=cx+offset.x,iz=cz+offset.z,anchorX=(ix+.15+rand(ix,iz)*.70)*FIREFLY_CELL,anchorZ=(iz+.15+rand(iz+9,ix-7)*.70)*FIREFLY_CELL;
   if(Math.hypot(anchorX-centerX,anchorZ-centerZ)>this.radius||count>=this.fireflyCapacity)continue;
   const anchorSurface=surfaceAt(anchorX,anchorZ);if(!grassy(anchorSurface))continue;
   const patchDensity=riverGreenery(anchorX,anchorZ)>.18?.95:.86;if(rand(ix+71,iz-41)>patchDensity)continue;
   // Two lights share a patch, but not a phase: brief little constellations,
   // rooted in the vegetation rather than a camera-following particle cloud.
   for(let j=0;j<2&&count<this.fireflyCapacity;j++){
    const x=anchorX+(j?1.1+rand(ix+61,iz)*1.8:0),z=anchorZ+(j?rand(ix+67,iz)*3-1.5:0),surface=surfaceAt(x,z);
    if(!grassy(surface))continue;
    const riparian=riverGreenery(x,z),hover=riparian>.3?1.38+rand(ix+13+j,iz)*.44:2.32+rand(ix+13+j,iz)*.48;
    const f=this.fireflyData[count++];f.x=x;f.z=z;f.y=this._height(x,z)+hover;f.phase=rand(ix+23+j*11,iz)*TAU;f.pace=.78+rand(ix+29+j,iz)*.48;f.size=.80+rand(ix+31+j,iz)*.22;
   }
  }
  this.fireflyCount=count;this.fireflies.count=count;this.fireflyKey=key;
 }
 update(p,time,origin,camera,weather={}){
  if(this.disposed)return;
  if(!Number.isFinite(p?.x)||!Number.isFinite(p?.z)||!Number.isFinite(time)){this.fireflies.visible=false;this.stats.birds=this.stats.fireflies=0;return}
  const ox=finite(origin?.x),oz=finite(origin?.z),surface=surfaceAt(p.x,p.z),d=this.dummy;
  this._refreshFireflies(p);
  const dusk=Math.pow(1-smooth(-7,16,finite(weather.altitude,8)),.55),habitat=surface.snow<.15&&surface.volcanic<.10&&surface.biome!=='snow'&&surface.biome!=='volcanic'&&surface.biome!=='beach';
  const strength=habitat?dusk*(1-Math.min(.75,finite(weather.rain)*.6+finite(weather.snow)*.8)):0,t=this.reduced?0:time;
  this.fireflies.visible=strength>.002&&this.fireflyCount>0;let lit=0;
  for(let i=0;i<this.fireflyCount;i++){
   const f=this.fireflyData[i],x=f.x+(this.reduced?0:Math.sin(t*.42+f.phase)*.16),z=f.z+(this.reduced?0:Math.cos(t*.36+f.phase)*.16),y=f.y+(this.reduced?0:Math.sin(t*.70+f.phase)*.075);
   d.position.set(x-ox,y,z-oz);if(camera?.quaternion)d.quaternion.copy(camera.quaternion);else d.rotation.set(0,0,0);
   const cameraDistance=camera?.position?d.position.distanceTo(camera.position):Math.hypot(x-p.x,z-p.z),near=smooth(3,7,cameraDistance),far=1-smooth(this.radius-12,this.radius+1,Math.hypot(x-p.x,z-p.z));
   const blink=this.reduced?.48:.18+.82*Math.pow(Math.max(0,Math.sin(t*f.pace+f.phase)),1.6),alpha=Math.min(1,1.65*strength*blink*near*far);
   this.fireflyAlpha.setX(i,alpha);if(alpha>.035)lit++;// Cap the nearby halo's apparent size so bright insects never become large orbs.
   const glowSize=Math.min(f.size,cameraDistance*.035);d.scale.set(glowSize,glowSize,1);d.updateMatrix();this.fireflies.setMatrixAt(i,d.matrix);
  }
  this.fireflyAlpha.needsUpdate=true;this.fireflies.instanceMatrix.needsUpdate=true;this.stats.fireflies=this.fireflies.visible?lit:0;
 }
 reset(){
  // Recovery keeps ambient fireflies anchored in their existing world patches.
  this.stats.birds=0;
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;
  this.scene.remove(this.fireflies);this.fireflies.geometry.dispose();this.fireflies.material.dispose();this.fireflies.dispose?.();
  this.stats.birds=this.stats.fireflies=0;
 }
}
