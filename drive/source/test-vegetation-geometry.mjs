// Judge Dean LLC — rooted foliage silhouettes and exact contact geometry.
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {normalViewGeometry} from 'three/tsl';
import {BeachLife} from './beach-life.mjs';
import {DrivePhysics,RAPIER} from './physics.mjs';
import {BeachObstacles} from './obstacles.mjs';
import {routeSample} from './expedition.mjs';
for(const mobile of [false,true]){
 const scene=new THREE.Scene(),life=new BeachLife(scene,{mobile}),p=await DrivePhysics.create(),solids=new BeachObstacles(p,{radius:Infinity});
 life.setCanopyTexture(new THREE.Texture());life.refresh({x:273,z:-405},p.origin);const objects=scene.children.length,grass=life.grass.geometry,trunk=life.trunks.geometry,canopy=life.crowns.geometry;
 assert(grass.index.count/3<=120&&grass.attributes.position.count<=150,'Better tuft shape stays inside the previous vertex and triangle budgets');
 assert(trunk.index.count/3<250,'Roots and branch forks share one modest static geometry');
 assert(trunk.boundingBox.min.y<-.5&&trunk.boundingBox.max.y>6,'Trees have a buried footing and a stem entering their foliage');
 assert.equal(canopy.index.count/3,mobile?30:42,'Canopy detail keeps its original card budget');
 for(const material of [life.crowns.material,life.crowns.userData.sceneryGhost.material])assert.equal(material.normalNode,normalViewGeometry,'Both canopy passes retain outward crown normals on back-facing leaf cards');
 assert.equal(life.trunks.userData.sceneryGhost.geometry,trunk,'Distant trees reuse the same rooted silhouette');
 for(const geometry of [grass,trunk,canopy])for(const name of ['position','normal'])assert([...geometry.attributes[name].array].every(Number.isFinite),'Geometry stays finite');
 for(const geometry of [trunk,canopy])for(let i=0;i<geometry.attributes.normal.count;i++)assert(Math.abs(new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal,i).length()-1)<1e-5,'Bark and leaf normals stay normalized');
 assert([...trunk.attributes.uv.array].every(Number.isFinite),'Root and branch pieces retain bark coordinates');
 const transform=new THREE.Matrix4(),vertex=new THREE.Vector3();let near=0,minClearance=Infinity;
 for(let i=0;i<life.trunks.count;i++){
  life.trunks.getMatrixAt(i,transform);
  for(let j=0;j<trunk.attributes.position.count;j++){vertex.fromBufferAttribute(trunk.attributes.position,j).applyMatrix4(transform);minClearance=Math.min(minClearance,routeSample(vertex.x,vertex.z).distance);}
  if(Math.hypot(transform.elements[12]-273,transform.elements[14]+405)<50)near++;
 }
 assert(minClearance>6,'Actual root and branch surfaces stay outside the drivable corridor');assert(near>45,'Local canopy remains substantial');
 solids.refresh({key:life.key,trunks:life.trunks});p.world.step();life.trunks.updateMatrixWorld();const ray=new THREE.Raycaster();let contacts=0;
 for(let i=0;i<Math.min(12,life.trunks.count);i++){
  life.trunks.getMatrixAt(i,transform);
  // Aim horizontally through the flared collar, not at an unrelated ground plane.
  const from=new THREE.Vector3(.85,.12,0).applyMatrix4(transform),direction=new THREE.Vector3(-1,0,0).transformDirection(transform);ray.set(from,direction);
  const visual=ray.intersectObject(life.trunks,false)[0],physical=p.world.castRay(new RAPIER.Ray(from,direction),4,true);
  assert(visual&&physical&&solids.has(physical.collider),'Visible root flare has an actual tree collider');assert(Math.abs(visual.distance-physical.timeOfImpact)<.002,'Root contact follows the rendered surface within2mm');contacts++;
 }
 const original=life.trunks.geometry;life.update({x:273,z:-405},4,p.origin,{wind:12},0,false);assert.equal(life.trunks.geometry,original);assert.equal(scene.children.length,objects,'Wind/streaming do not add geometry or scene objects');
 console.log({mobile,grassTriangles:grass.index.count/3,trunkTriangles:trunk.index.count/3,nearbyTrees:near,minSurfaceRouteClearance:minClearance,physicalRootChecks:contacts});
 const map=life.crowns.material.map;solids.dispose();p.dispose();life.dispose();map.dispose();assert.equal(scene.children.length,0);
}
console.log('Vegetation geometry: folded/arching grass budgets, grounded trunks, bark UVs, shared canopy shapes, actual route clearance and physical root contacts passed.');
