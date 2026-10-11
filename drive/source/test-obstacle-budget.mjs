import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {DrivePhysics,RAPIER} from './physics.mjs';
import {BeachObstacles} from './obstacles.mjs';
const p=await DrivePhysics.create(),g=new THREE.BoxGeometry(2,3,4),material=new THREE.MeshBasicMaterial(),points=[];
for(let x=-30;x<=180;x+=6)for(const z of [-30,-18,-6,6,18,30])points.push({x,z});
const rocks=new THREE.InstancedMesh(g,material,points.length),life={key:'forest-0',rocks},q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.3),matrix=new THREE.Matrix4();
const writeMatrices=()=>points.forEach(({x,z},i)=>rocks.setMatrixAt(i,matrix.compose(new THREE.Vector3(x-p.origin.x,2,z-p.origin.z),q,new THREE.Vector3(1.2,.8,1.4))));writeMatrices();
const solid=new BeachObstacles(p,{budget:0,maxCreates:2});p.reset(0,0,0);solid.refresh(life,{budgeted:true});
assert(solid.pending.size>30,'Distant shapes are actually queued');
const firstEntries=solid.groups.get(rocks).entries,queued=[...solid.pending][0];assert(firstEntries.filter(e=>e.collider&&Math.hypot(e.x,e.z)-e.objectRadius>24).length<=2);
// Frequent scenery commits and rebases retain pending work rather than restart
// it. Installed objects retain exact collider identity as well.
const existing=firstEntries.find(e=>e.collider),handle=existing.collider.handle;
p.rebase(256,-128);writeMatrices();life.key='forest-rebased';solid.refresh(life,{budgeted:true});
assert(solid.groups.get(rocks).entries.includes(queued));assert(solid.groups.get(rocks).entries.includes(existing));assert.equal(existing.collider.handle,handle);
let largest=solid.colliders.length+solid.pending.size,checks=0;
for(let frame=0;frame<180;frame++){
 const x=frame*1.12; // 50 mph at 20 FPS: much harsher than one render-frame move.
 p.reset(x,0,0);if(frame%5===0)life.key='forest-'+frame;solid.refresh(life,{budgeted:true});
 const entries=solid.groups.get(rocks).entries;largest=Math.max(largest,entries.length);assert.equal(entries.length,solid.colliders.length+solid.pending.size,'No orphaned or duplicated work');
 for(const point of points)if(Math.hypot(point.x-x,point.z)<=24){
  const entry=entries.find(e=>Math.abs(e.x-point.x)<.001&&Math.abs(e.z-point.z)<.001);assert(entry?.collider,'The entire immediate collision zone is ready before physics');
  const ray=new RAPIER.Ray({x:point.x-p.origin.x,y:10,z:point.z-p.origin.z},{x:0,y:-1,z:0});
  assert(Math.abs(entry.collider.castRay(ray,20,true)-6.8)<.001,'Queued/rebased colliders use exact rendered transforms');checks++;
 }
}
assert(largest<points.length,'Objects outside the resident range are retired');
// Standing still eventually completes the outer zone even when source keys
// change every frame. No queue reset can starve an otherwise relevant object.
p.reset(90,0,0);for(let frame=0;frame<300;frame++){life.key='settle-'+frame;solid.refresh(life,{budgeted:true});if(!solid.pending.size)break;}assert.equal(solid.pending.size,0);
const before=solid.colliders.length;solid.refresh(life);assert.equal(solid.colliders.length,before);solid.clear();assert.equal(solid.pending.size,0);assert.equal(solid.handles.size,0);
// Long objects must be immediate when their ends enter the safe zone, even if
// their centres are outside it and the outer work budget is only one shape.
rocks.count=1;rocks.setMatrixAt(0,matrix.compose(new THREE.Vector3(70-p.origin.x,2,-p.origin.z),new THREE.Quaternion(),new THREE.Vector3(50,.8,1)));life.key='long log';p.reset(0,0,0);solid.refresh(life,{budgeted:true});assert.equal(solid.colliders.length,1);assert.equal(solid.pending.size,0);
const hit=solid.colliders[0].castRay(new RAPIER.Ray({x:21-p.origin.x,y:10,z:-p.origin.z},{x:0,y:-1,z:0}),20,true);assert(Math.abs(hit-6.8)<.001,'The near end of a distant-centred object is solid');
solid.dispose();assert.equal(solid.pending.size,0);p.dispose();rocks.dispose();g.dispose();material.dispose();console.log(`Budgeted obstacle streaming: ${checks} exact surface checks at 50 mph/20 FPS, 24m safety zone, large bounds, retained queues/rebases, completion and bounded cleanup passed.`);
