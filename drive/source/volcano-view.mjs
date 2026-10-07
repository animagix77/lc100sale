import * as THREE from 'three/webgpu';
import {uniform,positionLocal,sin,mix,color,mx_noise_float,vec3,float,smoothstep} from 'three/tsl';
import {VOLCANO} from './expedition.mjs';
import {baseHeight} from './terrain.mjs';
const rand=n=>{const a=Math.sin(n*127.1+71.7)*43758.5453;return a-Math.floor(a)};
// Small ballistic arcs stay over the crater. No projectiles follow the player.
export function eruptionParticle(i,time){
 const duration=2.5+rand(i+5)*1.7,t=((time+rand(i+1)*duration)%duration+duration)%duration,a=rand(i+2)*Math.PI*2;
 const flight=t/duration,r=Math.sin(flight*Math.PI)*(8+rand(i+3)*18);
 return {x:VOLCANO.x+Math.cos(a)*r,z:VOLCANO.z+Math.sin(a)*r,y:204+Math.sin(flight*Math.PI)*(22+rand(i+4)*36),scale:.55+rand(i+6)*.85};
}
export class VolcanoView{
 constructor(scene,{mobile=false,reduced=false}={}){
  this.scene=scene;this.reduced=reduced;this.clock=uniform(0);this.dummy=new THREE.Object3D();this.group=new THREE.Group();scene.add(this.group);this.flowPoints=[];
  const molten=new THREE.MeshStandardNodeMaterial({color:'#ff6329',roughness:.6});
  const flow=mx_noise_float(vec3(positionLocal.x.mul(.16),positionLocal.z.mul(.12).sub(this.clock.mul(.14)),float(7))).mul(.5).add(.5);
  const hot=smoothstep(.3,.68,flow.add(sin(positionLocal.y.mul(.28).add(this.clock.mul(.7))).mul(.12)));
  molten.colorNode=mix(color('#431b1c'),color('#d44818'),hot);molten.emissiveNode=mix(color('#e72d12'),color('#ff8622'),hot).mul(.95);
  this.material=molten;
  const lake=new THREE.Mesh(new THREE.CircleGeometry(VOLCANO.craterRadius,48),molten);lake.rotation.x=-Math.PI/2;lake.position.set(VOLCANO.x,VOLCANO.lavaHeight,VOLCANO.z);this.group.add(lake);
  const positions=[],indices=[];
  // Streams are draped onto the mountain's remote northern and eastern flanks.
  for(const [angle,length,width] of [[-2.85,140,3.5],[-1.8,175,4.5],[-.65,195,5],[.2,180,4]]){
   const start=positions.length/3;
   for(let j=0;j<=90;j++){
    const t=j/90,r=32+t*length,a=angle+Math.sin(t*9+angle)*.07,x=VOLCANO.x+Math.cos(a)*r,z=VOLCANO.z+Math.sin(a)*r,w=width*(.55+.45*Math.sin(t*11)**2);
    this.flowPoints.push({x,z});
    for(const side of [-1,1]){const xx=x-Math.sin(a)*w*side,zz=z+Math.cos(a)*w*side;positions.push(xx,baseHeight(xx,zz)+.32,zz)}
    if(j<90){const i=start+j*2;indices.push(i,i+1,i+2,i+1,i+3,i+2)}
   }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();const flows=new THREE.Mesh(g,molten);flows.material.side=THREE.DoubleSide;this.group.add(flows);
  const count=mobile?40:70;
  this.ejecta=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:'#ffb23c',toneMapped:false}),count);this.ejecta.frustumCulled=false;this.group.add(this.ejecta);
  // Layered faceted billows preserve the illustrated look while giving the plume volume.
  this.plume=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,2),new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1,flatShading:true}),mobile?25:38);this.plume.frustumCulled=false;this.group.add(this.plume);
  const c=new THREE.Color();for(let i=0;i<this.plume.count;i++){const t=i/this.plume.count;c.set('#714a49').lerp(new THREE.Color('#464650'),Math.min(1,t*2));this.plume.setColorAt(i,c)}
  this.glow=new THREE.PointLight('#ff6928',80,100,1.7);this.glow.position.set(VOLCANO.x,205,VOLCANO.z);this.group.add(this.glow);
  this.update(0,{x:0,z:0});
 }
 update(time,origin){
  const t=this.reduced?0:time,d=this.dummy;this.clock.value=t;this.group.position.set(-origin.x,0,-origin.z);
  for(let i=0;i<this.ejecta.count;i++){const p=eruptionParticle(i,t);d.position.set(p.x,p.y,p.z);d.rotation.set(t+i,t*.3,0);d.scale.set(p.scale*.65,p.scale*1.8,p.scale*.65);d.updateMatrix();this.ejecta.setMatrixAt(i,d.matrix)}this.ejecta.instanceMatrix.needsUpdate=true;
  for(let i=0;i<this.plume.count;i++){
   const h=i/(this.plume.count-1),a=i*2.399+t*.018,billow=Math.sin(t*.17+i)*2,spread=5+h*27;
   d.position.set(VOLCANO.x+h*h*65+Math.cos(a)*spread,213+h*110+billow,VOLCANO.z-h*22+Math.sin(a)*spread*.65);
   d.rotation.set(i*.5,t*.008+i,0);const s=10+h*31;d.scale.set(s*1.15,s*.83,s);d.updateMatrix();this.plume.setMatrixAt(i,d.matrix);
  }this.plume.instanceMatrix.needsUpdate=true;
  this.glow.intensity=75+Math.sin(t*1.7)*8;
 }
 dispose(){const geometries=new Set(),materials=new Set();this.group.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);materials.add(o.material);o.dispose?.()}});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();this.glow.dispose();this.group.removeFromParent()}
}
