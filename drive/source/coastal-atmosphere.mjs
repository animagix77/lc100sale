import * as THREE from 'three/webgpu';
import {uniform,uv,float,smoothstep,positionLocal,vec3,sin,attribute} from 'three/tsl';
import {shore,clamp} from './terrain.mjs';
import {coastalWind} from './coastal-wind.mjs';
const rand=n=>{const v=Math.sin(n*127.1+39.7)*43758.5453;return v-Math.floor(v)};
const wrap=(n,size)=>((n%size)+size)%size;
export class CoastalAtmosphere{
 constructor(scene,field,{mobile=false,reduced=false}={}){
  Object.assign(this,{scene,field,reduced});this.dummy=new THREE.Object3D();this.clock=uniform(0);this.hazeOpacity=uniform(.04);this.stats={gulls:0,sand:0};
  // Wide, feathered coastal mist, confined offshore rather than a screen overlay.
  const hazeMat=new THREE.MeshBasicNodeMaterial({color:'#debba0',transparent:true,depthWrite:false,side:THREE.DoubleSide});
  hazeMat.opacityNode=float(1).sub(smoothstep(.12,1,uv().sub(.5).length().mul(2))).pow(2).mul(this.hazeOpacity);
  this.haze=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),hazeMat,5);this.haze.frustumCulled=false;this.haze.renderOrder=2;scene.add(this.haze);
  this.capacity=mobile?52:112;this.sandPositions=new Float32Array(this.capacity*6);const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(this.sandPositions,3));sg.setDrawRange(0,0);
  this.sand=new THREE.LineSegments(sg,new THREE.LineBasicMaterial({color:'#e4bd85',transparent:true,opacity:.2,depthWrite:false}));this.sand.frustumCulled=false;scene.add(this.sand);
  // A small illustrated silhouette with flexing wing tips, not particle sprites.
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([
   0,0,-.22,-.38,.10,.02,-.88,.01,.27, 0,0,-.22,-.88,.01,.27,-.16,-.01,.18,
   0,0,-.22,.88,.01,.27,.38,.10,.02, 0,0,-.22,.16,-.01,.18,.88,.01,.27,
   -.045,0,-.31,.045,0,-.31,0,-.04,.37],3));g.computeVertexNormals();
  this.birdCount=mobile?5:8;g.setAttribute('flapPhase',new THREE.InstancedBufferAttribute(Float32Array.from({length:this.birdCount},(_,i)=>i*2.17),1));
  const birdMat=new THREE.MeshStandardNodeMaterial({color:'#e6dac4',roughness:1,side:THREE.DoubleSide});
  const phase=attribute('flapPhase','float'),flap=sin(this.clock.mul(4.6).add(phase)).mul(smoothstep(.45,.85,sin(this.clock.mul(.31).add(phase))));
  birdMat.positionNode=positionLocal.add(vec3(0,positionLocal.x.abs().pow(1.5).mul(flap).mul(.38),0));
  this.gulls=new THREE.InstancedMesh(g,birdMat,this.birdCount);this.gulls.frustumCulled=false;scene.add(this.gulls);
 }
 update(p,time,origin,camera,weather={}){
  const t=this.reduced?0:time,wind=coastalWind(t,weather.wind),wet=Math.max(weather.rain||0,weather.snow||0),night=(weather.altitude??8)<-6,d=this.dummy;
  this.clock.value=t;this.hazeOpacity.value=(weather.fog?.36:.15+wind*.045+wet*.10)*(night?.68:1);
  this.haze.material.color.set(night?'#8492b5':(weather.altitude??8)<14?'#debba0':'#c3d9dc');
  const region=Math.floor(p.z/120);
  for(let i=0;i<5;i++){const id=region+i-2,z=id*120+Math.sin(t*.035+id)*14,x=shore(z)-6-rand(id)*14;
   d.position.set(x-origin.x,2.5+rand(id+40)*2,z-origin.z);d.quaternion.copy(camera.quaternion);d.scale.set(105+rand(id+60)*35,13+rand(id+70)*8,1);d.updateMatrix();this.haze.setMatrixAt(i,d.matrix);
  }this.haze.instanceMatrix.needsUpdate=true;
  this.sand.visible=!this.reduced&&wet<.12;let count=0;
  if(this.sand.visible){const n=Math.min(this.capacity,Math.round(this.capacity*clamp(wind,.12,1))),pace=.5+wind*2;
   for(let i=0;i<n;i++){const x=p.x+wrap(rand(i+1)*96+t*pace-p.x,96)-48,z=p.z+wrap(rand(i+201)*120-t*pace*.42-p.z,120)-60,coast=x-shore(z);
    if(coast<25||coast>115)continue;const length=.10+rand(i+401)*.24,h=.035+rand(i+601)*.10;
    this.sandPositions.set([x-origin.x,this.field.height(x,z)+h,z-origin.z,x+length-origin.x,this.field.height(x+length,z-length*.42)+h,z-length*.42-origin.z],count++*6);
   }this.sand.geometry.attributes.position.needsUpdate=true;
  }this.sand.geometry.setDrawRange(0,count*2);this.sand.material.opacity=clamp(.12+wind*.1,.12,.26);this.stats.sand=count;
  this.gulls.visible=!night&&!this.reduced&&wet<.6;
  const birdRegion=Math.floor(p.z/95);
  for(let i=0;i<this.birdCount;i++){const id=birdRegion+i-Math.floor(this.birdCount/2),a=t*(.13+rand(id+80)*.05)+id*2.3,z=id*95-40+Math.sin(a)*24,x=shore(z)-12+Math.cos(a)*20;
   d.position.set(x-origin.x,7+rand(id+50)*9+Math.sin(a*1.8)*1.2,z-origin.z);d.rotation.set(.04,Math.atan2(Math.sin(a)*20,-Math.cos(a)*24),-.14);d.scale.setScalar(.7+rand(id+91)*.35);d.updateMatrix();this.gulls.setMatrixAt(i,d.matrix);
  }this.gulls.instanceMatrix.needsUpdate=true;this.stats.gulls=this.gulls.visible?this.birdCount:0;
 }
 dispose(){for(const mesh of [this.haze,this.sand,this.gulls]){this.scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();mesh.dispose?.()}}
}
