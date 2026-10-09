import * as THREE from 'three/webgpu';
import {attribute,float,positionLocal,sin,smoothstep,uniform,uv,vec3} from 'three/tsl';
import {baseHeight,smooth,surfaceAt} from './terrain.mjs';
import {riverGreenery} from './expedition.mjs';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const TAU=Math.PI*2,PATCH=14,FIREFLY_CELL=10,COOLDOWN=120,COOLDOWN_LIMIT=128;
const rand=(x,z=0)=>{const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n)};
const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
// Match the actual grassy surface and foliage masks, including the worn ford.
const grassy=s=>s.grass>=.30&&s.riverApproach<=.18&&s.river<=.05&&s.snow<.15&&s.volcanic<.10&&s.biome!=='beach';

export class MeadowWildlife{
 constructor(scene,field,{mobile=false,reduced=false}={}){
  Object.assign(this,{scene,field,mobile,reduced});this.dummy=new THREE.Object3D();this.clock=uniform(0);this.stats={birds:0,fireflies:0};
  this.birdCapacity=1;this.fireflyCapacity=mobile?32:64;this.radius=mobile?34:46;
  this.birdData=Array.from({length:this.birdCapacity},()=>({active:false}));
  this.fireflyData=Array.from({length:this.fireflyCapacity},()=>({x:0,y:0,z:0,phase:0,pace:0,size:0}));
  this.cooldowns=new Map();this.fireflyKey='';this.fireflyCount=0;this.travel=0;this.lastFlush=-Infinity;this.lastPosition=null;this.lastTime=null;this.disposed=false;
  this.offsets=[];for(let z=-4;z<=4;z++)for(let x=-4;x<=4;x++)this.offsets.push({x,z,d:x*x+z*z});this.offsets.sort((a,b)=>a.d-b.d||a.z-b.z||a.x-b.x);

  // A compact body, head, beak and broad wings read as a bird from the chase
  // camera. Thin disconnected brown triangles looked like airborne grass.
  const wings=new THREE.BufferGeometry();wings.setAttribute('position',new THREE.Float32BufferAttribute([
   -.025,.018,-.10,-.18,.055,-.05,-.33,.008,.105, -.025,.018,-.10,-.33,.008,.105,-.06,.010,.075,
   .025,.018,-.10,.33,.008,.105,.18,.055,-.05, .025,.018,-.10,.06,.010,.075,.33,.008,.105,
   0,0,.055,-.075,0,.30,.075,0,.30
  ],3));wings.computeVertexNormals();
  const body=new THREE.IcosahedronGeometry(1,1).scale(.045,.055,.15);
  const head=new THREE.IcosahedronGeometry(.048,1).translate(0,.043,-.105);
  const beak=new THREE.ConeGeometry(.018,.065,4).rotateX(-Math.PI/2).translate(0,.041,-.160);
  const parts=[wings,body,head,beak],clean=parts.map(g=>{const copy=g.index?g.toNonIndexed():g;copy.deleteAttribute('uv');return copy});
  const geometry=mergeGeometries(clean);for(const g of new Set([...parts,...clean]))g.dispose();
  const phases=new Float32Array(this.birdCapacity);for(let i=0;i<phases.length;i++)phases[i]=i*2.399;
  geometry.setAttribute('birdPhase',new THREE.InstancedBufferAttribute(phases,1));
  const birdMat=new THREE.MeshStandardNodeMaterial({color:'#64513a',roughness:1,side:THREE.DoubleSide});
  birdMat.positionNode=positionLocal.add(vec3(0,positionLocal.x.abs().mul(smoothstep(.035,.18,positionLocal.x.abs())).mul(sin(this.clock.mul(19).add(attribute('birdPhase','float')))).mul(1.25),0));
  this.birds=new THREE.InstancedMesh(geometry,birdMat,this.birdCapacity);this.birds.count=this.birdCapacity;this.birds.frustumCulled=false;this.birds.visible=false;scene.add(this.birds);
  this.dummy.scale.setScalar(0);this.dummy.updateMatrix();for(let i=0;i<this.birdCapacity;i++)this.birds.setMatrixAt(i,this.dummy.matrix);

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
 _flush(p,time,fx,fz,pace){
  const ix=Math.floor(p.x/PATCH),iz=Math.floor(p.z/PATCH),key=`${ix},${iz}`;
  if(time-(this.cooldowns.get(key)??-Infinity)<COOLDOWN)return;
  const desired=1,side=rand(ix,iz+19)>.5?1:-1;let spawned=0,slot=0;
  for(let attempt=0;attempt<12&&spawned<desired;attempt++){
   while(slot<this.birdCapacity&&this.birdData[slot].active)slot++;
   if(slot>=this.birdCapacity)break;
   const n=attempt,spread=side*(.85+rand(ix+n,iz+31)*1.45),ahead=5.5+rand(ix+n,iz+37)*2.2;
   const x=p.x+fx*ahead-fz*spread,z=p.z+fz*ahead+fx*spread;
   if(!grassy(surfaceAt(x,z)))continue;
   const lateral=side*(.50+rand(ix+n+41,iz)*.35),forward=.9+rand(ix+n+47,iz)*.35,length=Math.hypot(lateral,forward),speed=7+Math.min(14,pace)*.5+rand(ix+n+53,iz)*1.5;
   const b=this.birdData[slot++],canopy=riverGreenery(x,z)>.3?1.45:2.5;
   Object.assign(b,{active:true,x,z,clearance:canopy,y:this._height(x,z)+canopy+rand(ix+n+59,iz)*.25,vx:(fx*forward-fz*lateral)/length*speed,vz:(fz*forward+fx*lateral)/length*speed,start:time,ttl:4.3+rand(ix+n+61,iz)*.7,lift:1.65+rand(ix+n+67,iz)*.8,size:1.35+rand(ix+n+71,iz)*.20,bank:side*.12});spawned++;
  }
  if(spawned){this.cooldowns.delete(key);this.cooldowns.set(key,time);if(this.cooldowns.size>COOLDOWN_LIMIT)this.cooldowns.delete(this.cooldowns.keys().next().value);this.lastFlush=time;this.travel=0}
 }
 update(p,time,origin,camera,weather={}, {speed=0,heading=0,grounded=false}={}){
  if(this.disposed)return;
  if(!Number.isFinite(p?.x)||!Number.isFinite(p?.z)||!Number.isFinite(time)){this.birds.visible=false;this.fireflies.visible=false;this.stats.birds=this.stats.fireflies=0;this.lastPosition=null;return}
  const dt=this.lastTime===null?0:time-this.lastTime;this.lastTime=time;if(dt<0)this.reset();
  const ox=finite(origin?.x),oz=finite(origin?.z),pace=Math.abs(finite(speed)),surface=surfaceAt(p.x,p.z),d=this.dummy;
  let dx=0,dz=0,distance=0;if(this.lastPosition){dx=p.x-this.lastPosition.x;dz=p.z-this.lastPosition.z;distance=Math.hypot(dx,dz)}
  const settledWeather=finite(weather.altitude,8)>-3&&finite(weather.rain)<.3&&finite(weather.snow)<.15;
  const moving=!this.reduced&&settledWeather&&grounded&&pace>.65&&dt>0&&dt<1&&distance>.004&&distance<Math.max(3,pace*dt*3)&&distance/dt>.35&&grassy(surface);
  if(moving){
   this.travel+=distance;
   if(this.travel>10&&time-this.lastFlush>12){const yaw=finite(heading),dir=Math.sign(speed)||1;this._flush(p,time,distance>.02?dx/distance:-Math.sin(yaw)*dir,distance>.02?dz/distance:-Math.cos(yaw)*dir,pace)}
  }else this.travel=0;
  if(!this.lastPosition)this.lastPosition={x:p.x,z:p.z};else{this.lastPosition.x=p.x;this.lastPosition.z=p.z}
  this.clock.value=this.reduced?0:time;let active=0;
  for(let i=0;i<this.birdCapacity;i++){
   const b=this.birdData[i],age=time-b.start;if(b.active&&(this.reduced||!settledWeather||age<0||age>b.ttl))b.active=false;
   if(b.active){
    const x=b.x+b.vx*age,z=b.z+b.vz*age,y=Math.max(this._height(x,z)+b.clearance,b.y+b.lift*age+1.1*(1-Math.exp(-age*2)));
    d.position.set(x-ox,y,z-oz);d.rotation.set(.20*(1-smooth(.2,1.8,age)),Math.atan2(-b.vx,-b.vz),b.bank*(1+Math.sin(age*1.8)*.6));const clearance=camera?.position?smooth(2.5,5,d.position.distanceTo(camera.position)):1;
    d.scale.setScalar(b.size*clearance*(1-smooth(b.ttl-.8,b.ttl,age)));active++;
   }else{d.position.set(0,0,0);d.rotation.set(0,0,0);d.scale.setScalar(0)}
   d.updateMatrix();this.birds.setMatrixAt(i,d.matrix);
  }
  this.birds.instanceMatrix.needsUpdate=true;this.birds.visible=active>0;this.stats.birds=active;

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
  for(const b of this.birdData)b.active=false;
  this.birds.visible=false;this.stats.birds=0;this.lastPosition=null;this.lastTime=null;this.travel=0;
  // Recovery removes flights; world-patch cooldowns and anchored scenery survive.
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;
  for(const mesh of [this.birds,this.fireflies]){this.scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();mesh.dispose?.()}
  this.cooldowns.clear();this.stats.birds=this.stats.fireflies=0;
 }
}
