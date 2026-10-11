// Judge Dean LLC — coastline placement, exact collision, wind and bounded GPU work.
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {IslandScenery,islandBargeGeometry,islandPalmCrownGeometry} from './island-scenery.mjs';
import {baseHeight} from './terrain.mjs';
import {ISLANDS,COASTAL_CAMP,BARGE_SITE,islandProfile,coastalRouteDistance} from './coastal-islands.mjs';

const scene=new THREE.Scene(),scenery=new IslandScenery(scene,{mobile:true}),matrix=new THREE.Matrix4(),vertex=new THREE.Vector3();
assert(scenery.stats.palms>=90&&scenery.stats.palms<=108,'All three islands retain substantial palm groves within the mobile budget');
assert(scenery.stats.shrubs>=250&&scenery.stats.grass>=600,'Shoreline understory mixes broadleaf shrubs and dune sedges');
for(const island of ISLANDS)assert(scenery.placements.filter(p=>p.kind==='palm'&&Math.hypot(p.x-island.x,p.z-island.z)<65).length>=18,`${island.name} has its own planted grove`);
assert.equal(scenery.obstacleMeshes.length,4);assert.equal(scenery.stats.wrecks,1);
const trunks=scenery.placements.filter(p=>p.kind==='palm');
assert(Math.max(...trunks.map(p=>p.sy))-Math.min(...trunks.map(p=>p.sy))>.50,'Mature and young palm crowns have genuinely varied heights');
assert(Math.max(...trunks.map(p=>p.crownSpread))-Math.min(...trunks.map(p=>p.crownSpread))>.30,'Crown fullness varies independently from trunk height');
for(const p of trunks){
 scenery.trunks.getMatrixAt(p.index,matrix);const attachment=new THREE.Vector3(.85,7.18,.19).applyMatrix4(matrix);
 scenery.crowns.getMatrixAt(p.index,matrix);vertex.set(.85,7.18,.19).applyMatrix4(matrix);
 assert(vertex.distanceTo(attachment)<.00005,'A wider crown stays attached to its curved trunk');
}
scenery.group.updateMatrixWorld(true);
const rootRay=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
for(const p of scenery.placements){
 if(!['palm','grass','shrub'].includes(p.kind))continue;
 rootRay.set(new THREE.Vector3(p.x,p.y+15,p.z),down);rootRay.far=30;
 assert.equal(rootRay.intersectObject(scenery.rocks).length,0,`${p.kind} roots must not emerge through the exact visible boulder mesh`);
 if(p.kind==='palm')assert.equal(rootRay.intersectObject(scenery.logs).length,0,'Driftwood cannot bisect a palm root');
}

let triangles=0,solidVertices=0,minimumRouteClearance=Infinity;
for(const mesh of scenery.meshes){
 const g=mesh.geometry;triangles+=(g.index?.count??g.attributes.position.count)/3*mesh.count;
 for(const a of Object.values(g.attributes))assert([...a.array].every(Number.isFinite),`${mesh.name} has no invalid shader attribute`);
 assert(g.boundingSphere.radius>0&&Number.isFinite(g.boundingSphere.radius));
 assert(mesh.userData.worldCoordinates,'All immutable instance transforms use the obstacle streamer’s world coordinate contract');
 assert(mesh.userData.detailKey.includes('coastal-islands-v1'),'A fixed scenery identity preserves streamed collider handles');
 if(!scenery.obstacleMeshes.includes(mesh))continue;
 for(let i=0;i<mesh.count;i++){
  mesh.getMatrixAt(i,matrix);
  for(let j=0;j<g.attributes.position.count;j++){
   vertex.fromBufferAttribute(g.attributes.position,j).applyMatrix4(matrix);solidVertices++;
   const distance=coastalRouteDistance(vertex.x,vertex.z);minimumRouteClearance=Math.min(minimumRouteClearance,distance);
   assert(distance>6.7,`${mesh.name} cannot project into the clear driving lane (${distance})`);
   assert(Math.hypot(vertex.x-COASTAL_CAMP.x,vertex.z-COASTAL_CAMP.z)>COASTAL_CAMP.radius+6,'Tent selection and truck arrival retain an open dry clearing');
  }
 }
}
assert(triangles<365000,`Mobile island geometry remains bounded (${triangles} triangles)`);
assert(scenery.meshes.length<=9,'Shared instancing keeps the whole archipelago to eight draw groups');
for(const p of scenery.placements){
 if(p.kind==='wreck')continue;
 const ground=baseHeight(p.x,p.z);
 assert(p.y<=ground+.001,'Scenery roots do not float above their actual collision terrain');
 if(p.kind==='palm'){assert(Math.abs(p.y-ground+.08)<.00001);assert(islandProfile(p.x,p.z).rock<=.32,'Palm roots belong to soil, not exposed headland stone');}
 if(p.kind==='grass'||p.kind==='shrub'){assert(Math.abs(p.y-ground+.035)<.00001);assert(ground>.72);assert(islandProfile(p.x,p.z).rock<=.28);}
}

// Wind changes a uniform only: no instance buffers, cells or geometry regenerate
// while navigating, and a floating-origin shift preserves every world position.
const buffers=scenery.meshes.map(mesh=>({mesh,array:mesh.instanceMatrix.array.slice(),version:mesh.instanceMatrix.version})),first=scenery.placements.find(p=>p.kind==='palm');
scenery.update({x:-145,z:-220},{x:0,z:0},5,{wind:.8});assert(scenery.group.visible);
first.mesh.getMatrixAt(first.index,matrix);vertex.setFromMatrixPosition(matrix).applyMatrix4(first.mesh.matrixWorld);const before=vertex.clone();
scenery.update({x:-400,z:-250},{x:-512,z:256},20,{wind:.2});first.mesh.getMatrixAt(first.index,matrix);vertex.setFromMatrixPosition(matrix).applyMatrix4(first.mesh.matrixWorld);vertex.x-=512;vertex.z+=256;
assert(vertex.distanceTo(before)<.0001,'A rebase moves rendering without shifting the planted world');
for(const {mesh,array,version} of buffers){assert.equal(mesh.instanceMatrix.version,version,'Driving does not upload scenery instance transforms');assert.deepEqual(mesh.instanceMatrix.array,array);}
assert.equal(scenery.clock.value,20);scenery.update({x:500,z:-500},{x:0,z:0},21);assert(!scenery.group.visible,'Remote mainland driving does not draw island geometry');

const mobileCrown=islandPalmCrownGeometry({mobile:true});
assert(mobileCrown.attributes.islandFlex.count===mobileCrown.attributes.position.count);
assert(mobileCrown.attributes.position.count/3<1400,'Individually folded palm leaflets remain economical on phones');
assert(mobileCrown.boundingBox.max.y-mobileCrown.boundingBox.min.y>2.8,'Fronds arch above and droop below their crown, rather than forming a flat fan');
assert([...mobileCrown.attributes.islandFlex.array].some(v=>v>.4),'Leaflet tips have flexible wind response');
mobileCrown.dispose();

// The wheelhouse uses actual holes: a ray passes through an open side window,
// while the same ray aimed lower intersects a corroded cabin wall.
const barge=islandBargeGeometry(),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),fittings=new THREE.Mesh(barge.detail,material),ray=new THREE.Raycaster();
fittings.updateMatrixWorld(true);ray.set(new THREE.Vector3(-10,4.02,-9.66),new THREE.Vector3(1,0,0));
assert.equal(ray.intersectObject(fittings).length,0,'Cabin window openings are geometry, not painted black rectangles');
ray.set(new THREE.Vector3(-10,3.04,-9.66),new THREE.Vector3(1,0,0));assert(ray.intersectObject(fittings).length>=2);
assert.equal(scenery.wreckPose.x,BARGE_SITE.x);assert.equal(scenery.wreckPose.z,BARGE_SITE.z);assert(scenery.wreckPose.bank!==0,'A grounded list distinguishes the abandoned wreck from a floating working boat');
assert(barge.hull.attributes.position.count<500,'The exact collision hull excludes thousands of tiny decorative metal fittings');
barge.hull.dispose();barge.detail.dispose();material.dispose();

const owned=scenery.geometries.length,removed=[];for(const g of scenery.geometries)g.addEventListener('dispose',()=>removed.push(g));scenery.dispose();assert.equal(removed.length,owned);assert.equal(scene.children.length,0);
console.log('Island scenery: grounded varied groves, bare headlands, lane/camp clearance, detailed open wreck, immutable rebasing and mobile resource limits passed.',{triangles,solidVertices,minimumRouteClearance});
