import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {BeachLife} from './beach-life.mjs';
import {shore} from './terrain.mjs';
import {oceanHeight} from './ocean-height.mjs';
for(const mobile of [false,true]){
 const scene=new THREE.Scene(),life=new BeachLife(scene,{mobile}),p={x:shore(0)+22,z:0},origin={x:0,z:0};life.update(p,0,origin);
 console.log({mobile,...life.stats});assert(life.stats.grass>100);assert(life.stats.logs>0&&life.stats.wrack>0);assert.equal(life.boats.length,5);
 const samples=JSON.stringify(life.samples),mat=life.logs.instanceMatrix.array.slice();life.update({x:p.x+1,z:1},1,origin);assert.equal(JSON.stringify(life.samples),samples,'No reshuffling within a world cell');assert.deepEqual(life.logs.instanceMatrix.array,mat);assert.equal(life.time.value,1,'Wind clock advances');
 for(const s of life.samples){const d=s.x-shore(s.z);assert(d<16||d>29,'Main driving strip stays clear of debris')}
 const boat=life.boats[0],before=boat.mesh.position.clone();life.update(p,5,origin);assert(boat.mesh.position.distanceTo(before)>.05,'Fishing boats move with the swell');assert(Math.abs(boat.mesh.position.y-oceanHeight(boat.x,boat.z,5)+.13)<1e-6);for(const b of life.boats)assert(b.x<shore(b.z)-70,'Fleet stays offshore');
 const world=life.boats.map(b=>b.mesh.position.clone());life.update(p,5,{x:512,z:-512});life.boats.forEach((b,i)=>{assert(Math.abs(b.mesh.position.x+512-world[i].x)<1e-6);assert(Math.abs(b.mesh.position.z-512-world[i].z)<1e-6)});
 for(const z of [-2000,4000,10000]){life.update({x:shore(z)+22,z},8,{x:0,z});for(const m of [life.grass,life.logs,life.wrack]){assert(m.count<=m.instanceMatrix.count);assert([...m.instanceMatrix.array].every(Number.isFinite))}assert.equal(scene.children.length,8,'Streaming keeps object count fixed')}
 life.dispose();assert.equal(scene.children.length,0);
}
const calm=new BeachLife(new THREE.Scene(),{reduced:true});calm.update({x:-14,z:0},5,{x:0,z:0});assert.equal(calm.time.value,0);calm.dispose();console.log('Scenery: placement, wind, boat flotation, world anchoring, bounded streaming and disposal passed');
