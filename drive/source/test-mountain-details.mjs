import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {MountainDetails} from './mountain-details.mjs';
import {DrivePhysics,RAPIER} from './physics.mjs';
import {BeachObstacles} from './obstacles.mjs';
import {routeSample} from './expedition.mjs';
for(const mobile of [false,true]){
 const scene=new THREE.Scene(),view=new MountainDetails(scene,{mobile}),p=await DrivePhysics.create(),solid=new BeachObstacles(p),life={key:'mountain',ridgeRocks:view.rocks};
 const pos={x:447,z:-658};view.refresh(pos,p.origin);solid.refresh(life);assert(view.rocks.count>30&&view.scree.count>100);assert(view.rocks.count<=view.rocks.instanceMatrix.count);assert(view.scree.count<=view.scree.instanceMatrix.count);assert.equal(solid.colliders.length,view.rocks.count);
 for(const r of view.samples)assert(routeSample(r.x,r.z).distance>=10,'Large rocks stay clear of the marked trail');
 const rock=view.samples[0];p.world.step();const ray=new RAPIER.Ray({x:rock.x,y:250,z:rock.z},{x:0,y:-1,z:0});assert(p.world.castRay(ray,300,true),'Mountain outcrops have physical surfaces');
 const before=view.rocks.instanceMatrix.array.slice(),count=p.world.colliders.len();view.refresh(pos,p.origin);solid.refresh(life);assert.deepEqual(view.rocks.instanceMatrix.array,before);assert.equal(p.world.colliders.len(),count);
 p.rebase(512,-512);view.refresh(pos,p.origin);solid.refresh(life);const mat=new THREE.Matrix4();view.rocks.getMatrixAt(0,mat);assert(Math.abs(mat.elements[12]+512-before[12])<.001);assert(Math.abs(mat.elements[14]-512-before[14])<.001);assert.equal(p.world.colliders.len(),count);
 view.refresh({x:-14,z:0},p.origin);solid.refresh(life);assert.equal(view.rocks.count,0,'Beach stays clear of mountain rocks');assert.equal(solid.colliders.length,0);
 solid.dispose();view.dispose();p.dispose();assert.equal(scene.children.length,0);
}
console.log('Mountain detail: fixed budgets, route clearance, real collisions, stable placement, rebase and cleanup passed.');
