import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {VOLCANO,routeSample,LANDMARKS} from './expedition.mjs';
import {VolcanoView,eruptionParticle} from './volcano-view.mjs';
import {baseHeight} from './terrain.mjs';
import {BeachLife} from './beach-life.mjs';
assert(Math.max(...LANDMARKS.map(p=>p.height))>=116);
assert(baseHeight(VOLCANO.x,VOLCANO.z)<VOLCANO.lavaHeight,'Lake sits above crater floor');
for(let a=0;a<Math.PI*2;a+=.1)assert(baseHeight(VOLCANO.x+35*Math.cos(a),VOLCANO.z+35*Math.sin(a))>VOLCANO.lavaHeight+10,'Crater rim contains lava');
for(const mobile of [false,true]){
 const scene=new THREE.Scene(),view=new VolcanoView(scene,{mobile});
 for(let t=0;t<16;t+=.25)for(let i=0;i<view.ejecta.count;i++){
  const p=eruptionParticle(i,t);assert(Math.hypot(p.x-VOLCANO.x,p.z-VOLCANO.z)<=26.01);assert(routeSample(p.x,p.z).distance>95,'Ejecta stays far from the driving route');
 }
 assert(view.flowPoints.every(p=>routeSample(p.x,p.z).distance>45),'Molten flows never cross the trail');
 assert(view.rockPoints.every(p=>routeSample(p.x,p.z).distance>40),'Raised lava crust and crater fragments remain clear of the trail');
 assert(view.crust.count<=(mobile?120:200),'Fixed rock budget is smaller on mobile');
 assert([...view.crust.instanceMatrix.array].every(Number.isFinite),'Basalt fragments have finite transforms');
 const startPlume=view.plume.instanceMatrix.array.slice(),startEjecta=view.ejecta.instanceMatrix.array.slice();
 view.update(5,{x:512,z:-512});
 assert.notDeepEqual(view.plume.instanceMatrix.array,startPlume,'Billows move and change shape');
 assert.notDeepEqual(view.ejecta.instanceMatrix.array,startEjecta,'Ejecta advances along its crater-confined arcs');
 let triangles=0;view.group.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1)});
 assert(triangles<(mobile?9000:16000),'Detailed eruption remains within a bounded geometry budget');assert.deepEqual(view.group.position.toArray(),[-512,0,512]);assert([...view.plume.instanceMatrix.array].every(Number.isFinite));assert(view.plume.count<=38);view.dispose();assert.equal(scene.children.length,0);
 const life=new BeachLife(scene,{mobile});life.refresh({x:248,z:-336},{x:0,z:0});assert(life.stats.trees>35&&life.stats.shrubs>60,'Crossings have substantial woodland');
 const mat=new THREE.Matrix4(),pos=new THREE.Vector3();for(let i=0;i<life.trunks.count;i++){life.trunks.getMatrixAt(i,mat);pos.setFromMatrixPosition(mat);assert(routeSample(pos.x,pos.z).distance>8,'Tree trunks leave the trail clear')}
 life.dispose();assert.equal(scene.children.length,0);
}
const stillScene=new THREE.Scene(),still=new VolcanoView(stillScene,{reduced:true});
const stillPlume=still.plume.instanceMatrix.array.slice(),stillEjecta=still.ejecta.instanceMatrix.array.slice(),stillGlow=still.glow.intensity;
still.update(600,{x:256,z:-256});
assert.deepEqual(still.plume.instanceMatrix.array,stillPlume,'Reduced motion freezes plume billowing');
assert.deepEqual(still.ejecta.instanceMatrix.array,stillEjecta,'Reduced motion freezes ejecta');
assert.equal(still.clock.value,0,'Reduced motion freezes lava advection');assert.equal(still.glow.intensity,stillGlow,'Reduced motion freezes light flicker');
assert.deepEqual(still.group.position.toArray(),[-256,0,256],'Static scenery still rebases correctly');
still.dispose();assert.equal(stillScene.children.length,0);
console.log('Ascent scenery: contained eruption, remote lava flows, crater, rebasing, dense river greenery, clear trail and bounded resources passed.');
