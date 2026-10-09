import * as THREE from 'three/webgpu';
import {uniform,uv,float,smoothstep,positionLocal,vec3,sin,attribute} from 'three/tsl';
import {shore,smooth,surfaceAt} from './terrain.mjs';
import {coastalWind} from './coastal-wind.mjs';
const rand=n=>{const v=Math.sin(n*127.1+39.7)*43758.5453;return v-Math.floor(v)};
export class CoastalAtmosphere{
 constructor(scene,field,{mobile=false,reduced=false}={}){
  Object.assign(this,{scene,field,reduced});this.dummy=new THREE.Object3D();this.clock=uniform(0);this.hazeOpacity=uniform(.24);this.stats={gulls:0,sand:0};
  // Wide, feathered coastal mist, confined offshore rather than a screen overlay.
  const hazeMat=new THREE.MeshBasicNodeMaterial({color:'#debba0',transparent:true,depthWrite:false,fog:false,side:THREE.DoubleSide});
  hazeMat.opacityNode=float(1).sub(smoothstep(.12,1,uv().sub(.5).length().mul(2))).pow(2).mul(this.hazeOpacity);
  this.haze=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),hazeMat,5);this.haze.frustumCulled=false;this.haze.renderOrder=2;scene.add(this.haze);
  // A few ground-hugging inland veils give the meadow and river valleys depth.
  // Their anchors are world-space cells; camera-distance fades hide recycling.
  this.mistCount=mobile?6:9;this.mistOffsets=[[0,0],[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
  this.mistAlpha=new THREE.InstancedBufferAttribute(new Float32Array(this.mistCount),1);
  const mistGeo=new THREE.PlaneGeometry(1,1);mistGeo.setAttribute('mistAlpha',this.mistAlpha);
  const mistMat=new THREE.MeshBasicNodeMaterial({color:'#d6ba8d',transparent:true,depthWrite:false,fog:false,side:THREE.DoubleSide});
  mistMat.opacityNode=float(1).sub(smoothstep(.04,1,uv().sub(.5).length().mul(2))).pow(1.5).mul(attribute('mistAlpha','float'));
  this.inlandMist=new THREE.InstancedMesh(mistGeo,mistMat,this.mistCount);this.inlandMist.frustumCulled=false;this.inlandMist.renderOrder=2;scene.add(this.inlandMist);
  this.mistColor=new THREE.Color();this.mistCells=Array.from({length:this.mistCount},()=>({}));this.mistKey='';
  // A small illustrated silhouette with flexing wing tips, not particle sprites.
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([
   0,0,-.22,-.38,.10,.02,-.88,.01,.27, 0,0,-.22,-.88,.01,.27,-.16,-.01,.18,
   0,0,-.22,.88,.01,.27,.38,.10,.02, 0,0,-.22,.16,-.01,.18,.88,.01,.27,
   -.045,0,-.31,.045,0,-.31,0,-.04,.37],3));g.computeVertexNormals();
  this.birdCount=mobile?2:3;g.setAttribute('flapPhase',new THREE.InstancedBufferAttribute(Float32Array.from({length:this.birdCount},(_,i)=>i*2.17),1));
  const birdMat=new THREE.MeshStandardNodeMaterial({color:'#e6dac4',roughness:1,side:THREE.DoubleSide});
  const phase=attribute('flapPhase','float'),flap=sin(this.clock.mul(4.6).add(phase)).mul(smoothstep(.45,.85,sin(this.clock.mul(.31).add(phase))));
  birdMat.positionNode=positionLocal.add(vec3(0,positionLocal.x.abs().pow(1.5).mul(flap).mul(.38),0));
  this.gulls=new THREE.InstancedMesh(g,birdMat,this.birdCount);this.gulls.frustumCulled=false;scene.add(this.gulls);
 }
 update(p,time,origin,camera,weather={}){
  const t=this.reduced?0:time,wind=coastalWind(t,weather.wind),wet=Math.max(weather.rain||0,weather.snow||0),night=(weather.altitude??8)<-6,d=this.dummy;
  this.clock.value=t;this.hazeOpacity.value=(weather.fog?.52:.26+wind*.045+wet*.13)*(night?.80:1);
  this.haze.material.color.set(night?'#8492b5':(weather.altitude??8)<14?'#debba0':'#c3d9dc');
  const region=Math.floor(p.z/120);
  for(let i=0;i<5;i++){const id=region+i-2,z=id*120+Math.sin(t*.035+id)*14,x=shore(z)-6-rand(id)*14;
   d.position.set(x-origin.x,2.5+rand(id+40)*2,z-origin.z);d.quaternion.copy(camera.quaternion);d.scale.set(105+rand(id+60)*35,13+rand(id+70)*8,1);d.updateMatrix();this.haze.setMatrixAt(i,d.matrix);
  }this.haze.instanceMatrix.needsUpdate=true;
  const cx=Math.floor(p.x/38),cz=Math.floor(p.z/38),altitude=weather.altitude??8,cloud=weather.cloud??.2;
  this.inlandMist.material.color.set(night?'#718ea9':altitude<14?'#dac39a':'#b7ced0').lerp(this.mistColor.set('#a0b8c1'),Math.min(.85,wet*.65+cloud*.25));
  const mistKey=cx+','+cz;
  if(mistKey!==this.mistKey){
   for(let i=0;i<this.mistCount;i++){
    const offset=this.mistOffsets[i],ix=cx+offset[0],iz=cz+offset[1],x=(ix+.45+rand(ix+iz*71)*.1)*38,z=(iz+.45+rand(iz+ix*37)*.1)*38,surface=surfaceAt(x,z),cell=this.mistCells[i];
    Object.assign(cell,{x,z,y:this.field.height(x,z)+2.0,habitat:smooth(.15,.55,surface.grass)*(1-surface.snow)*(1-surface.volcanic),width:48+rand(ix*13+iz)*14,height:8+rand(iz*17+ix)*3});
   }this.mistKey=mistKey;
  }
  let mistVisible=false;
  for(let i=0;i<this.mistCount;i++){
   const cell=this.mistCells[i],distance=Math.hypot(cell.x-p.x,cell.z-p.z),edge=smooth(12,25,distance)*(1-smooth(56,78,distance));
   const alpha=cell.habitat*edge*(.35+wet*.17+(weather.fog?.14:0))*(night?.88:1);
   this.mistAlpha.setX(i,alpha);if(alpha>.001)mistVisible=true;
   d.position.set(cell.x-origin.x,cell.y,cell.z-origin.z);d.quaternion.copy(camera.quaternion);d.scale.set(cell.width,cell.height,1);d.updateMatrix();this.inlandMist.setMatrixAt(i,d.matrix);
  }
  this.inlandMist.visible=mistVisible;this.inlandMist.instanceMatrix.needsUpdate=true;this.mistAlpha.needsUpdate=true;
  // Keep ambient motion on the horizon; tyre effects carry nearby movement.
  this.gulls.visible=!night&&!this.reduced&&wet<.6;
  const birdRegion=Math.floor(p.z/95);
  for(let i=0;i<this.birdCount;i++){const id=birdRegion+i-Math.floor(this.birdCount/2),a=t*(.055+rand(id+80)*.015)+id*2.3,z=id*95-40+Math.sin(a)*24,x=shore(z)-95+Math.cos(a)*24;
   d.position.set(x-origin.x,18+rand(id+50)*10+Math.sin(a*1.8)*.5,z-origin.z);d.rotation.set(.04,Math.atan2(Math.sin(a)*24,-Math.cos(a)*24),-.14);d.scale.setScalar((.55+rand(id+91)*.20)*smooth(35,70,d.position.distanceTo(camera.position)));d.updateMatrix();this.gulls.setMatrixAt(i,d.matrix);
  }this.gulls.instanceMatrix.needsUpdate=true;this.stats.gulls=this.gulls.visible?this.birdCount:0;
 }
 dispose(){for(const mesh of [this.haze,this.inlandMist,this.gulls]){this.scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();mesh.dispose?.()}}
}
