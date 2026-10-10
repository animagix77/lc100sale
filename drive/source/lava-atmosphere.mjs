// Judge Dean LLC — bounded, depth-tested illuminated vapor over actual molten channels.
import * as THREE from 'three/webgpu';
import {attribute,uniform,uv,vec3,float,mix,color,smoothstep,mx_noise_float} from 'three/tsl';
import {lavaCrossingPoint} from './lava-crossing.mjs';
import {lavaSurfaceHeight,baseHeight,smooth} from './terrain.mjs';
const rand=n=>{const v=Math.sin(n*127.1+89.2)*43758.5453;return v-Math.floor(v)};
export class LavaAtmosphere{
 constructor(scene,flowPoints,{mobile=false,reduced=false}={}){
  this.reduced=reduced;this.clock=uniform(0);this.root=new THREE.Group();scene.add(this.root);this.dummy=new THREE.Object3D();this.anchors=[];
  for(const side of [-1,1])for(let i=0;i<(mobile?7:11);i++){const p=lavaCrossingPoint(side*(9+i*(mobile?10:6.5)));this.anchors.push({...p,y:lavaSurfaceHeight(p.x,p.z),size:9+rand(i)*4});}
  for(let i=8;i<flowPoints.length;i+=mobile?26:17){const p=flowPoints[i];this.anchors.push({...p,y:baseHeight(p.x,p.z)+.4,size:10+rand(i)*6});}
  const count=this.anchors.length,g=new THREE.PlaneGeometry(1,1);
  g.setAttribute('lavaVaporOpacity',new THREE.InstancedBufferAttribute(new Float32Array(count),1));g.setAttribute('lavaVaporSeed',new THREE.InstancedBufferAttribute(Float32Array.from(this.anchors,(_,i)=>rand(i+8)*13),1));
  const mat=new THREE.MeshBasicNodeMaterial({transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,fog:true});
  const radius=uv().sub(.5).length().mul(2),soft=float(1).sub(smoothstep(.12,1,radius)).pow(1.7);
  const billow=mx_noise_float(vec3(uv().x.mul(3.5),uv().y.mul(4).sub(this.clock.mul(.065)),attribute('lavaVaporSeed','float'))).mul(.35).add(.65);
  mat.colorNode=mix(color('#eb6b25').mul(1.5),color('#685f70'),smoothstep(.05,.90,uv().y));
  mat.opacityNode=soft.mul(billow).mul(attribute('lavaVaporOpacity','float'));
  this.haze=new THREE.InstancedMesh(g,mat,count);this.haze.frustumCulled=false;this.haze.renderOrder=3;this.haze.castShadow=false;this.root.add(this.haze);
  this.lights=[];for(const s of mobile?[-13,14]:[-30,-10,12,35]){const p=lavaCrossingPoint(s),light=new THREE.PointLight('#ff7628',180,mobile?36:30,2);light.position.set(p.x,lavaSurfaceHeight(p.x,p.z)+2.2,p.z);this.root.add(light);this.lights.push(light);}
  this.update(0,{x:0,z:0});
 }
 update(time,origin,camera){
  const t=this.reduced?0:time;this.clock.value=t;this.root.position.set(-origin.x,0,-origin.z);const d=this.dummy,op=this.haze.geometry.attributes.lavaVaporOpacity;
  for(let i=0;i<this.anchors.length;i++){const a=this.anchors[i],age=(t*.035+rand(i+90))%1,fade=smooth(0,.16,age)*(1-smooth(.65,1,age));
   d.position.set(a.x+age*2,a.y+1.3+age*4.2,a.z+Math.sin(i)*age*1.8);if(camera)d.quaternion.copy(camera.quaternion);else d.quaternion.identity();d.scale.set(a.size*(.8+age*.35),a.size*(.6+age*.4),1);d.updateMatrix();this.haze.setMatrixAt(i,d.matrix);
   const distance=camera?Math.hypot(d.position.x-origin.x-camera.position.x,d.position.y-camera.position.y,d.position.z-origin.z-camera.position.z):50;op.setX(i,fade*.30*smooth(1.8,6,distance)*(1-smooth(180,270,distance)));
  }
  this.haze.instanceMatrix.needsUpdate=true;op.needsUpdate=true;
  this.lights.forEach((l,i)=>{l.intensity=180*(1+Math.sin(t*.7+i)*.065);});
 }
 dispose(){this.haze.geometry.dispose();this.haze.material.dispose();this.haze.dispose();for(const l of this.lights)l.dispose();this.root.removeFromParent();}
}
