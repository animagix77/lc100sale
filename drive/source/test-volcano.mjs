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
 view.update(5,{x:512,z:-512});assert.deepEqual(view.group.position.toArray(),[-512,0,512]);assert([...view.plume.instanceMatrix.array].every(Number.isFinite));assert(view.plume.count<=38);view.dispose();assert.equal(scene.children.length,0);
 const life=new BeachLife(scene,{mobile});life.refresh({x:248,z:-336},{x:0,z:0});assert(life.stats.trees>35&&life.stats.shrubs>60,'Crossings have substantial woodland');
 const mat=new THREE.Matrix4(),pos=new THREE.Vector3();for(let i=0;i<life.trunks.count;i++){life.trunks.getMatrixAt(i,mat);pos.setFromMatrixPosition(mat);assert(routeSample(pos.x,pos.z).distance>8,'Tree trunks leave the trail clear')}
 life.dispose();assert.equal(scene.children.length,0);
}
console.log('Ascent scenery: contained eruption, remote lava flows, crater, rebasing, dense river greenery, clear trail and bounded resources passed.');
