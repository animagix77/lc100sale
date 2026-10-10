// Judge Dean LLC — exposed cliffs stay bare and river scenery follows terrain.
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {BeachLife} from './beach-life.mjs';
import {CanyonRiverView} from './canyon-river-view.mjs';
import {canyonRockMask,canyonRiver} from './canyon.mjs';
const scene=new THREE.Scene(),life=new BeachLife(scene,{mobile:true,reduced:true}),matrix=new THREE.Matrix4(),point=new THREE.Vector3();
let checked=0;for(const at of [{x:665,z:-470},{x:710,z:-470}]){life.refresh(at,{x:0,z:0});for(let i=0;i<life.grass.count;i++){life.grass.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);assert(canyonRockMask(point.x,point.z)<=.08,'No grass instance may sprout from exposed canyon rock');checked++;}}
assert(checked>0,'Soil-covered rims retain vegetation');life.dispose();
const parent=new THREE.Group(),river=new CanyonRiverView(parent),positions=river.water.geometry.attributes.position;
for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i),r=canyonRiver(x);assert(Math.abs(positions.getY(i)-r.level)<.00001);assert(Math.abs(z-r.z)<=r.halfWidth+.0001);}
assert.equal(river.rockMesh.count,264);assert(river.water.geometry.index.count>20000);river.update(2);assert.equal(river.clock.value,2);river.dispose();assert.equal(parent.children.length,0);console.log('Canyon scenery: bare exposed rock, vegetated soil rims, downhill water geometry and bounded boulder/gravel detail passed.',{grassInstancesChecked:checked});
