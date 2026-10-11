// Judge Dean LLC — exposed cliffs stay bare and river scenery follows terrain.
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {BeachLife} from './beach-life.mjs';
import {CanyonRiverView} from './canyon-river-view.mjs';
import {canyonRockMask,canyonRiver} from './canyon.mjs';
import {baseHeight} from './terrain.mjs';
import {routeSample} from './expedition.mjs';
const scene=new THREE.Scene(),life=new BeachLife(scene,{mobile:true,reduced:true}),matrix=new THREE.Matrix4(),point=new THREE.Vector3();
let checked=0;for(const at of [{x:665,z:-470},{x:710,z:-470}]){life.refresh(at,{x:0,z:0});for(let i=0;i<life.grass.count;i++){life.grass.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);assert(canyonRockMask(point.x,point.z)<=.08,'No grass instance may sprout from exposed canyon rock');checked++;}}
assert(checked>0,'Soil-covered rims retain vegetation');life.dispose();
const parent=new THREE.Group(),river=new CanyonRiverView(parent),positions=river.water.geometry.attributes.position;
for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i),r=canyonRiver(x);assert(Math.abs(positions.getY(i)-r.level)<.00001);assert(Math.abs(z-r.z)<=r.halfWidth+.0001);}
assert.equal(river.rockMesh.count,264);assert(river.water.geometry.index.count>20000);
assert(river.wallOutcrops.length>=32&&river.wallOutcrops.length<=80,'A bounded subset of existing pebble instances becomes meaningful wall detail');
assert(new Set(river.wallOutcrops.map(r=>r.cluster)).size>=8,'Wall fractures form separated geological clusters');
const rockPositions=river.rockMesh.geometry.attributes.position;assert.equal(rockPositions.count/3*river.rockMesh.count,21120,'Wall detail adds no rock triangles or instance draws');
for(let i=0;i<river.wallOutcrops.length;i++){
 river.rockMesh.getMatrixAt(river.wallRockStart+i,matrix);let buried=0,exposed=0;
 for(let j=0;j<rockPositions.count;j++){
  point.fromBufferAttribute(rockPositions,j).applyMatrix4(matrix);const above=point.y-baseHeight(point.x,point.z);if(above<-.079)buried++;
  if(above>.05){exposed++;assert(point.y<73.001,'Fractures cannot enter the deck or landing clearance');assert(routeSample(point.x,point.z).distance>6.999,'Visible outcrops stay away from the driving route');assert(above<3.501,'A fitted ledge cannot become an oversized disconnected boulder');}
 }
 assert(exposed>0&&buried>=rockPositions.count*.55,'Every visible fracture remains anchored inside its actual curved wall');
}
const banks=river.bankMesh.geometry.attributes.position,rows=banks.count/6;let narrow=Infinity,wide=-Infinity;
for(let side=0;side<2;side++)for(let row=0;row<rows;row++){
 const k=side*rows*3+row*3,x=banks.getX(k),r=canyonRiver(x),ratio=Math.abs(banks.getZ(k+2)-r.z)/r.halfWidth;narrow=Math.min(narrow,ratio);wide=Math.max(wide,ratio);
 for(let j=0;j<3;j++)assert(Math.abs(banks.getY(k+j)-baseHeight(banks.getX(k+j),banks.getZ(k+j))-.035)<.0001,'Bank breakup remains terrain-conforming');
 assert(Math.abs(banks.getZ(k+2)-r.z)>Math.abs(banks.getZ(k+1)-r.z)+.4,'Irregular margin strips cannot fold over themselves');
}
assert(wide-narrow>.6,'Bank silhouette has broad irregular gravel bars instead of a constant-width ribbon');
assert(river.bankMesh.material.transparent&&!river.bankMesh.material.depthWrite&&river.bankMesh.material.forceSinglePass,'Feathered bank margins blend into terrain without an extra backface draw');river.update(2);assert.equal(river.clock.value,2);river.dispose();assert.equal(parent.children.length,0);console.log('Canyon scenery: bare exposed rock, vegetated soil rims, downhill water geometry and bounded boulder/gravel detail passed.',{grassInstancesChecked:checked});
