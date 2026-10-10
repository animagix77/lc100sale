// Judge Dean LLC — physical suspension travel drives the visible rear axle.
import * as THREE from 'three/webgpu';
import {riverZ,riverLevel} from './expedition.mjs';
export class RearAxleView{
 constructor(truck){this.root=new THREE.Group();this.geometry=new THREE.CylinderGeometry(.065,.065,1.924,10);this.diffGeometry=new THREE.SphereGeometry(.18,12,8);this.material=new THREE.MeshStandardMaterial({color:'#343635',roughness:.75,metalness:.25});this.axle=new THREE.Mesh(this.geometry,this.material);this.diff=new THREE.Mesh(this.diffGeometry,this.material);this.diff.scale.set(1,.85,1.2);this.axle.castShadow=this.diff.castShadow=true;this.root.add(this.axle,this.diff);truck.add(this.root);}
 update(left,right){const angle=Math.atan2(left-right,1.924);this.root.position.set(0,.76-(left+right)/2,1.43);this.root.rotation.z=angle;this.axle.rotation.z=Math.PI/2;return angle;}
 dispose(){this.root.removeFromParent();this.geometry.dispose();this.diffGeometry.dispose();this.material.dispose();}
}
export class FordDepthMarkers{
 constructor(scene){this.root=new THREE.Group();scene.add(this.root);this.materials=[new THREE.MeshStandardMaterial({color:'#eddfb5',roughness:.85}),new THREE.MeshStandardMaterial({color:'#714a37',roughness:.9})];this.geometry=new THREE.CylinderGeometry(.055,.055,.10,8);this.meshes=this.materials.map(m=>new THREE.InstancedMesh(this.geometry,m,32));this.meshes.forEach(m=>{m.count=0;this.root.add(m)});const dummy=new THREE.Object3D();for(const x of [248,470])for(const side of [-1,1]){const z=riverZ(x);for(let i=0;i<15;i++){const mesh=this.meshes[i%2];dummy.position.set(x+side*7,riverLevel(x)-.35+i*.10,z);dummy.updateMatrix();mesh.setMatrixAt(mesh.count++,dummy.matrix);}}this.meshes.forEach(m=>{m.instanceMatrix.needsUpdate=true;m.computeBoundingSphere()});}
 update(origin){this.root.position.set(-origin.x,0,-origin.z);}
 dispose(){this.root.removeFromParent();this.meshes.forEach(m=>m.dispose());this.geometry.dispose();this.materials.forEach(m=>m.dispose());}
}
