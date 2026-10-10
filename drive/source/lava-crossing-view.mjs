import * as THREE from 'three/webgpu';
import {uniform} from 'three/tsl';
import {moltenMaterial} from './lava-material.mjs';
import {LAVA_CROSSING,lavaCrossingPoint,lavaCrossingProfile} from './lava-crossing.mjs';
import {baseHeight,lavaSurfaceHeight} from './terrain.mjs';
const random=n=>{const x=Math.sin(n*127.1+58.4)*43758.5453;return x-Math.floor(x)};
export class LavaCrossingView{
 constructor(scene,{mobile=false,reduced=false}={}){
  this.scene=scene;this.reduced=reduced;this.clock=uniform(0);this.origin={x:Infinity,z:Infinity};this.group=new THREE.Group();scene.add(this.group);
  const positions=[],uvs=[],indices=[];
  // Two sheets terminate inside the basalt embankments. Subdivisions follow the
  // cut bed, so the river cannot float above the banks or cover the causeway.
  for(const side of [-1,1]){
   const start=positions.length/3,rows=mobile?64:100,cols=8;
   for(let j=0;j<=rows;j++){
    const s=side*(4.35+j/rows*78.4),center=lavaCrossingPoint(s),profile=lavaCrossingProfile(center.x,center.z),w=(profile?.width||5.5)*(.9-.48*Math.max(0,(Math.abs(s)-72)/11));
    for(let k=0;k<=cols;k++){const u=(k/cols*2-1)*w,p=lavaCrossingPoint(s,u),edge=Math.abs(k/cols*2-1);positions.push(p.x,lavaSurfaceHeight(p.x,p.z)-edge*edge*.055,p.z);uvs.push(k/cols,(s+85)/170)}
    if(j<rows)for(let k=0;k<cols;k++){const i=start+j*(cols+1)+k;indices.push(i,i+1,i+cols+1,i+1,i+cols+2,i+cols+1)}
   }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  this.lava=new THREE.Mesh(geometry,moltenMaterial(this.clock,{mode:'crossing'}));this.group.add(this.lava);
  this.rockPoints=[];
  // Low embedded stones give each axle a distinct climb. The main line stays
  // wide enough for the LC100 and its spacer-poked tyres.
  for(let row=0;row<9;row++)for(const side of [-1,1]){
   const u=-9+row*2.2,s=side*(.9+random(row*2+side+20)*.30),p=lavaCrossingPoint(s,u),seed=200+row*2+side;
   this.rockPoints.push({...p,y:baseHeight(p.x,p.z)-.07,sx:.62+random(seed)*.23,sy:.22+random(seed+1)*.10,sz:.60+random(seed+2)*.30,a:random(seed+3)*Math.PI,seed,crawl:true});
  }
  for(let i=0,n=mobile?42:64;i<n;i++){
   const s=-78+i/(n-1)*156;if(Math.abs(s)<5)continue;const center=lavaCrossingPoint(s),w=lavaCrossingProfile(center.x,center.z)?.width||6.4,side=i%2?1:-1,p=lavaCrossingPoint(s,side*(w+.3+random(i+40)*.65)),seed=i+500;
   this.rockPoints.push({...p,y:baseHeight(p.x,p.z)-.18,sx:.85+random(seed)*.8,sy:.45+random(seed+1)*.50,sz:.9+random(seed+2)*.85,a:random(seed+3)*Math.PI,seed,crawl:false});
  }
  this.rocks=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshStandardMaterial({color:'#ffffff',flatShading:true,roughness:.95}),this.rockPoints.length);this.rocks.castShadow=this.rocks.receiveShadow=true;this.rocks.frustumCulled=false;this.rocks.userData.detailKey='lava-crossing-1';scene.add(this.rocks);this.dummy=new THREE.Object3D();this.color=new THREE.Color();const warm=new THREE.Color('#694a45');
  for(let i=0;i<this.rockPoints.length;i++){const p=this.rockPoints[i];this.color.set('#34323b').lerp(warm,random(p.seed+5)*.6);this.rocks.setColorAt(i,this.color)}
  this.update(0,{x:0,z:0});
 }
 update(time,origin){
  this.clock.value=this.reduced?0:time;this.group.position.set(-origin.x,0,-origin.z);
  if(this.origin.x===origin.x&&this.origin.z===origin.z)return;
  this.origin={...origin};const d=this.dummy;
  for(let i=0;i<this.rockPoints.length;i++){const p=this.rockPoints[i];d.position.set(p.x-origin.x,p.y,p.z-origin.z);d.rotation.set(0,p.a,0);d.scale.set(p.sx,p.sy,p.sz);d.updateMatrix();this.rocks.setMatrixAt(i,d.matrix)}this.rocks.instanceMatrix.needsUpdate=true;
 }
 dispose(){this.lava.geometry.dispose();this.lava.material.dispose();this.group.removeFromParent();this.rocks.geometry.dispose();this.rocks.material.dispose();this.rocks.dispose();this.rocks.removeFromParent()}
}
