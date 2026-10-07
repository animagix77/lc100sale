import * as THREE from 'three/webgpu';
import {attribute,float,positionWorld,smoothstep} from 'three/tsl';

// Hashed coverage keeps depth and shadows intact without sorting thousands of
// transparent plants. The same player anchor is used in the main and shadow pass.
export function sceneryFade(mesh,{anchor,clock,near,far,arrival=true,solidNear=false}){
 const material=mesh.material;
 const distance=positionWorld.xz.distance(anchor);
 let visibility=float(1).sub(smoothstep(near,far,distance));
 if(arrival){
  const birth=new THREE.InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count).fill(-2),1);
  mesh.geometry.setAttribute('sceneryBirth',birth);
  const born=attribute('sceneryBirth','float');
  visibility=visibility.mul(smoothstep(born,born.add(.8),clock));
 }
 if(solidNear){
  // Trees retain solid, depth-writing silhouettes nearby. Only their fading
  // fragments use transparency, so large crowns never dissolve into stipple.
  const ghostMaterial=material.clone();
  material.alphaHash=false;material.transparent=false;material.depthWrite=true;material.alphaTest=.5;
  material.opacityNode=visibility.greaterThanEqual(.999).select(float(1),float(0));
  ghostMaterial.alphaHash=false;ghostMaterial.transparent=true;ghostMaterial.depthWrite=false;ghostMaterial.alphaTest=.001;
  ghostMaterial.opacityNode=visibility.lessThan(.999).select(visibility,float(0));
  const ghost=new THREE.InstancedMesh(mesh.geometry,ghostMaterial,mesh.instanceMatrix.count);
  ghost.name='scenery-soft-distance';ghost.frustumCulled=false;ghost.castShadow=false;ghost.receiveShadow=mesh.receiveShadow;
  mesh.userData.sceneryGhost=ghost;mesh.add(ghost);syncSceneryFade(mesh);
 }else{material.alphaHash=true;material.opacityNode=visibility;}
 mesh.userData.fadeRange={near,far};
 return mesh;
}
// These aliases share all geometry, transform and color storage with the
// original collision-bearing mesh. Counts change only when a full batch commits.
export function syncSceneryFade(mesh){const ghost=mesh.userData.sceneryGhost;if(!ghost)return;ghost.instanceMatrix=mesh.instanceMatrix;ghost.instanceColor=mesh.instanceColor;ghost.count=mesh.count;ghost.visible=mesh.visible;}
export function disposeSceneryFade(mesh){const ghost=mesh.userData.sceneryGhost;if(!ghost)return;ghost.removeFromParent();ghost.material.dispose();ghost.dispose();delete mesh.userData.sceneryGhost;}
const position=(a,i,origin)=>({x:a[i*16+12]+origin.x,z:a[i*16+14]+origin.z});
const identity=p=>`${Math.round(p.x*100)},${Math.round(p.z*100)}`;
// Retained objects keep their appearance when buffers change order. Floating
// origins can round across a centimeter bucket, so inspect adjacent buckets too.
export function stageSceneryArrival(mesh,staged,time,oldOrigin,newOrigin,initial=false){
 const target=staged.geometry?.attributes.sceneryBirth??staged.sceneryBirth;
 if(!target)return;
 const previous=mesh.geometry.attributes.sceneryBirth,known=new Map();
 if(!initial)for(let i=0;i<mesh.count;i++){const p=position(mesh.instanceMatrix.array,i,oldOrigin);known.set(identity(p),{...p,birth:previous.getX(i)})}
 for(let i=0;i<staged.count;i++){
  const p=position(staged.instanceMatrix.array,i,newOrigin);let prior=known.get(identity(p));
  if(!prior&&!initial){const x=Math.round(p.x*100),z=Math.round(p.z*100);for(let b=-1;b<=1&&!prior;b++)for(let a=-1;a<=1;a++){const q=known.get(`${x+a},${z+b}`);if(q&&Math.abs(q.x-p.x)<.002&&Math.abs(q.z-p.z)<.002){prior=q;break;}}}
  target.setX(i,initial?-2:prior?.birth??time);
 }
}
