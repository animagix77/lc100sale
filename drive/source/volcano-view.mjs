import * as THREE from 'three/webgpu';
import {uniform,positionLocal,uv,sin,mix,color,mx_noise_float,vec3,float,smoothstep,abs} from 'three/tsl';
import {VOLCANO} from './expedition.mjs';
import {baseHeight} from './terrain.mjs';
const rand=n=>{const a=Math.sin(n*127.1+71.7)*43758.5453;return a-Math.floor(a)};
// Small ballistic arcs stay over the crater. No projectiles follow the player.
export function eruptionParticle(i,time){
 const duration=2.5+rand(i+5)*1.7,t=((time+rand(i+1)*duration)%duration+duration)%duration,a=rand(i+2)*Math.PI*2;
 const flight=t/duration,r=Math.sin(flight*Math.PI)*(8+rand(i+3)*18);
 return {x:VOLCANO.x+Math.cos(a)*r,z:VOLCANO.z+Math.sin(a)*r,y:204+Math.sin(flight*Math.PI)*(22+rand(i+4)*36),scale:.55+rand(i+6)*.85};
}
// Black cooling rafts split around incandescent seams; the bright core travels down
// the channel while its cooled edges remain stable against the basalt banks.
function lavaMaterial(clock,{lake=false}={}){
 const mat=new THREE.MeshStandardNodeMaterial({roughness:.86,side:THREE.DoubleSide});
 const p=lake?vec3(positionLocal.x.mul(.11),positionLocal.y.mul(.11),float(3)):vec3(uv().x.mul(3.6),uv().y.mul(18).sub(clock.mul(.16)),float(3));
 const coarse=mx_noise_float(p).mul(.5).add(.5),fine=mx_noise_float(p.mul(3.8)).mul(.5).add(.5);
 const seam=float(1).sub(smoothstep(.025,.105,abs(coarse.sub(.5).add(fine.sub(.5).mul(.19)))));
 const hot=seam.mul(.64).add(smoothstep(.53,.72,coarse).mul(.36));
 const edge=lake?float(1):smoothstep(0,.19,uv().x).mul(float(1).sub(smoothstep(.81,1,uv().x)));
 const glow=hot.mul(edge).mul(sin(clock.mul(.8).add(p.y)).mul(.045).add(.955));
 mat.colorNode=mix(color('#231e26'),color('#973a20'),glow);
 mat.emissiveNode=mix(color('#ff4414'),color('#ffc466'),smoothstep(.42,.85,glow)).mul(glow.mul(2.35));
 mat.roughnessNode=mix(float(.95),float(.47),glow);
 if(lake)mat.positionNode=positionLocal.add(vec3(0,0,sin(positionLocal.x.mul(.25).add(clock.mul(.7))).mul(sin(positionLocal.y.mul(.18).sub(clock.mul(.48)))).mul(.28)));
 return mat;
}
function billowGeometry(){
 const g=new THREE.IcosahedronGeometry(1,2),p=g.attributes.position,v=new THREE.Vector3();
 // Coherent lobes, rather than unrelated vertex noise, keep the facets watertight.
 for(let i=0;i<p.count;i++){
  v.fromBufferAttribute(p,i);const s=1+Math.sin(v.x*7.4+v.z*2.3)*.09+Math.cos(v.y*8.1-v.x*2)*.07;
  v.multiplyScalar(s);p.setXYZ(i,v.x,v.y,v.z);
 }
 g.computeVertexNormals();return g;
}
export class VolcanoView{
 constructor(scene,{mobile=false,reduced=false}={}){
  this.scene=scene;this.reduced=reduced;this.clock=uniform(0);this.dummy=new THREE.Object3D();this.group=new THREE.Group();scene.add(this.group);this.flowPoints=[];this.rockPoints=[];this.color=new THREE.Color();this.emberColor=new THREE.Color('#ff8f32');this.vector=new THREE.Vector3();this.up=new THREE.Vector3(0,1,0);
  this.material=lavaMaterial(this.clock);this.lakeMaterial=lavaMaterial(this.clock,{lake:true});
  const lake=new THREE.Mesh(new THREE.RingGeometry(0,VOLCANO.craterRadius,mobile?40:64,mobile?7:12),this.lakeMaterial);lake.rotation.x=-Math.PI/2;lake.position.set(VOLCANO.x,VOLCANO.lavaHeight,VOLCANO.z);this.group.add(lake);this.lake=lake;
  const positions=[],indices=[],uvs=[],rocks=[];
  // Streams are draped onto the mountain's remote northern and eastern flanks.
  for(const [stream,[angle,length,width]] of [[-2.85,140,3.5],[-1.8,175,4.5],[-.65,195,5],[.2,180,4]].entries()){
   const start=positions.length/3;
   for(let j=0;j<=90;j++){
    const t=j/90,r=32+t*length,a=angle+Math.sin(t*9+angle)*.07,x=VOLCANO.x+Math.cos(a)*r,z=VOLCANO.z+Math.sin(a)*r,w=width*(.55+.45*Math.sin(t*11)**2);
    this.flowPoints.push({x,z});
    for(const side of [-1,1]){const xx=x-Math.sin(a)*w*side,zz=z+Math.cos(a)*w*side;positions.push(xx,baseHeight(xx,zz)+.32,zz);uvs.push((side+1)/2,t)}
    if(j<90){const i=start+j*2;indices.push(i,i+1,i+2,i+1,i+3,i+2)}
    // Solid cooled chunks overlap the outer margins, breaking the ribbon silhouette.
    if(j% (mobile?9:5)===0)for(const side of [-1,1]){
     const seed=stream*300+j*2+side+8,xx=x-Math.sin(a)*w*side*(.86+rand(seed)*.35),zz=z+Math.cos(a)*w*side*(.86+rand(seed)*.35);
     rocks.push({x:xx,y:baseHeight(xx,zz)+.22,z:zz,s:.7+rand(seed+3)*1.5,a,seed});
    }
   }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();this.flows=new THREE.Mesh(g,this.material);this.group.add(this.flows);
  // Broken angular rim catches the warm eruption light without spilling onto the route.
  for(let i=0,n=mobile?28:44;i<n;i++){
   const a=i/n*Math.PI*2,r=33+rand(i+600)*6,x=VOLCANO.x+Math.cos(a)*r,z=VOLCANO.z+Math.sin(a)*r;
   rocks.push({x,y:baseHeight(x,z)+.3,z,s:1.8+rand(i+620)*2.2,a,seed:i+600});
  }
  this.crust=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1,flatShading:true}),rocks.length);this.crust.receiveShadow=true;this.crust.frustumCulled=false;this.group.add(this.crust);
  for(let i=0;i<rocks.length;i++){
   const r=rocks[i],d=this.dummy;this.rockPoints.push({x:r.x,z:r.z});d.position.set(r.x,r.y,r.z);d.rotation.set(rand(r.seed)*.7,r.a,rand(r.seed+1)*.65);d.scale.set(r.s*1.1,r.s*.38,r.s*.8);d.updateMatrix();this.crust.setMatrixAt(i,d.matrix);
   this.color.set('#26232d').lerp(new THREE.Color('#715047'),rand(r.seed+5)*.7);this.crust.setColorAt(i,this.color);
  }
  this.crust.instanceMatrix.needsUpdate=true;
  const count=mobile?40:70;
  this.ejecta=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:'#ffffff',toneMapped:false}),count);this.ejecta.frustumCulled=false;this.group.add(this.ejecta);
  // Layered faceted billows preserve the illustrated look while giving the plume volume.
  this.plume=new THREE.InstancedMesh(billowGeometry(),new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1,flatShading:true}),mobile?25:38);this.plume.frustumCulled=false;this.group.add(this.plume);
  const c=new THREE.Color();for(let i=0;i<this.plume.count;i++){const t=i/(this.plume.count-1);c.set('#b76643').lerp(new THREE.Color('#474752'),Math.min(1,t*3)).multiplyScalar(.84+rand(i+60)*.27);this.plume.setColorAt(i,c)}
  this.glow=new THREE.PointLight('#ff6928',80,100,1.7);this.glow.position.set(VOLCANO.x,205,VOLCANO.z);this.group.add(this.glow);
  this.update(0,{x:0,z:0});
 }
 update(time,origin){
  const t=this.reduced?0:time,d=this.dummy;this.clock.value=t;this.group.position.set(-origin.x,0,-origin.z);
  for(let i=0;i<this.ejecta.count;i++){
   const p=eruptionParticle(i,t),ahead=eruptionParticle(i,t+.012),ascending=ahead.y>=p.y;
   d.position.set(p.x,p.y,p.z);this.vector.set(ahead.x-p.x,ahead.y-p.y,ahead.z-p.z).normalize();d.quaternion.setFromUnitVectors(this.up,this.vector);d.scale.set(p.scale*.48,p.scale*(ascending?2.1:1.3),p.scale*.48);d.updateMatrix();this.ejecta.setMatrixAt(i,d.matrix);
   this.color.set(ascending?'#ffc466':'#e85c24').lerp(this.emberColor,rand(i+24)*.38);this.ejecta.setColorAt(i,this.color);
  }this.ejecta.instanceMatrix.needsUpdate=true;this.ejecta.instanceColor.needsUpdate=true;
  for(let i=0;i<this.plume.count;i++){
   const h=i/(this.plume.count-1),a=i*2.399+t*(.013+rand(i+100)*.013),billow=Math.sin(t*.22+i)*2.4,spread=4+h*28,pulse=1+Math.sin(t*.23+i*2.7)*.055;
   d.position.set(VOLCANO.x+h*h*65+Math.cos(a)*spread,213+h*110+billow,VOLCANO.z-h*22+Math.sin(a)*spread*.65);
   d.rotation.set(i*.5+t*.011,t*.014+i,Math.sin(t*.07+i)*.10);const s=(8.5+h*32)*pulse;d.scale.set(s*1.15,s*.83,s);d.updateMatrix();this.plume.setMatrixAt(i,d.matrix);
  }this.plume.instanceMatrix.needsUpdate=true;
  this.glow.intensity=75+Math.sin(t*1.7)*8+Math.sin(t*.57)*3;
 }
 dispose(){const geometries=new Set(),materials=new Set();this.group.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);materials.add(o.material);o.dispose?.()}});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();this.glow.dispose();this.group.removeFromParent()}
}
