// Judge Dean LLC — physical suspension travel drives the visible rear axle.
import * as THREE from 'three/webgpu';
import {riverZ,riverLevel} from './expedition.mjs';
const rearTrack=1.924;

function buildAxle(truck){
 const root=new THREE.Group();
 const material=new THREE.MeshStandardMaterial({color:'#343635',roughness:.75,metalness:.25});
 const beam=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,rearTrack,10),material);
 const differential=new THREE.Mesh(new THREE.SphereGeometry(.18,12,8),material);
 beam.rotation.z=Math.PI/2;
 differential.scale.set(1,.85,1.2);
 beam.castShadow=differential.castShadow=true;
 root.position.set(0,.48,1.43);
 root.add(beam,differential);
 truck.add(root);
 return root;
}

export class RearAxleView{
 constructor(truck){
  const authored=truck.getObjectByName('RearAxleArt');
  this.root=authored??buildAxle(truck);
  this.ownedMaterial=authored?null:this.root.children[0].material;
  this.links=[];
  this.axis=new THREE.Vector3();
  this.turn=new THREE.Quaternion();
  this.stretch=new THREE.Matrix4();
  truck.traverse(node=>{
   const {chassis_anchor,axle_anchor}=node.userData;
   if(!chassis_anchor||!axle_anchor)return;
   const start=new THREE.Vector3().fromArray(chassis_anchor);
   const pickup=new THREE.Vector3().fromArray(axle_anchor);
   const neutral=pickup.clone().add(this.root.position).sub(start);
   this.links.push({node,start,pickup,length:neutral.length(),direction:neutral.normalize()});
   node.matrixAutoUpdate=false;
  });
 }

 update(left,right){
  const angle=Math.atan2(left-right,rearTrack);
  this.root.position.y=.76-(left+right)/2;
  this.root.rotation.z=angle;
  for(const {node,start,pickup,length,direction} of this.links){
   this.axis.copy(pickup).applyQuaternion(this.root.quaternion).add(this.root.position).sub(start);
   const change=this.axis.length()/length-1;
   this.turn.setFromUnitVectors(direction,this.axis.normalize());
   // Stretch only along the spring or link, so both bushings stay seated.
   const {x,y,z}=direction;
   this.stretch.set(1+change*x*x,change*x*y,change*x*z,0,
                    change*y*x,1+change*y*y,change*y*z,0,
                    change*z*x,change*z*y,1+change*z*z,0,
                    0,0,0,1);
   node.matrix.makeRotationFromQuaternion(this.turn).multiply(this.stretch).setPosition(start);
   node.matrixWorldNeedsUpdate=true;
  }
  return angle;
 }

 dispose(){
  if(!this.ownedMaterial)return;
  this.root.removeFromParent();
  this.ownedMaterial.dispose();
  for(const part of this.root.children)part.geometry.dispose();
 }
}
export class FordDepthMarkers{
 constructor(scene){this.root=new THREE.Group();scene.add(this.root);this.materials=[new THREE.MeshStandardMaterial({color:'#eddfb5',roughness:.85}),new THREE.MeshStandardMaterial({color:'#714a37',roughness:.9})];this.geometry=new THREE.CylinderGeometry(.055,.055,.10,8);this.meshes=this.materials.map(m=>new THREE.InstancedMesh(this.geometry,m,32));this.meshes.forEach(m=>{m.count=0;this.root.add(m)});const dummy=new THREE.Object3D();for(const x of [248,470])for(const side of [-1,1]){const z=riverZ(x);for(let i=0;i<15;i++){const mesh=this.meshes[i%2];dummy.position.set(x+side*7,riverLevel(x)-.35+i*.10,z);dummy.updateMatrix();mesh.setMatrixAt(mesh.count++,dummy.matrix);}}this.meshes.forEach(m=>{m.instanceMatrix.needsUpdate=true;m.computeBoundingSphere()});}
 update(origin){this.root.position.set(-origin.x,0,-origin.z);}
 dispose(){this.root.removeFromParent();this.meshes.forEach(m=>m.dispose());this.geometry.dispose();this.materials.forEach(m=>m.dispose());}
}
