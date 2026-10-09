import * as THREE from 'three/webgpu';
import {uniform,uv,float,smoothstep,attribute} from 'three/tsl';
import {shore,smooth,surfaceAt} from './terrain.mjs';
import {coastalWind} from './coastal-wind.mjs';
const rand=n=>{const v=Math.sin(n*127.1+39.7)*43758.5453;return v-Math.floor(v)};
export class CoastalAtmosphere{
 constructor(scene,field,{mobile=false,reduced=false}={}){
  Object.assign(this,{scene,field,reduced});this.dummy=new THREE.Object3D();this.hazeOpacity=uniform(.24);this.stats={gulls:0,sand:0};
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
 }
 update(p,time,origin,camera,weather={}){
  const t=this.reduced?0:time,wind=coastalWind(t,weather.wind),wet=Math.max(weather.rain||0,weather.snow||0),night=(weather.altitude??8)<-6,d=this.dummy;
  this.hazeOpacity.value=(weather.fog?.52:.26+wind*.045+wet*.13)*(night?.80:1);
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
 }
 dispose(){for(const mesh of [this.haze,this.inlandMist]){this.scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();mesh.dispose?.()}}
}
