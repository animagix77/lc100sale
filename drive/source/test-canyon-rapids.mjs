// Judge Dean LLC — downstream flow, bounded spray and distance-aware ambience.
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {RAPIDS,riverFlowCoordinate,riverMistParticle,canyonAmbience} from './canyon-rapids.mjs';
import {CanyonRiverView} from './canyon-river-view.mjs';
import {canyonRiver} from './canyon.mjs';
for(const x of [620,665,720,940])for(const t of [0,9,150])assert(Math.abs(riverFlowCoordinate(x+RAPIDS.speed*.5,t+.5)-riverFlowCoordinate(x,t))<1e-9,'A visible foam feature moves only downstream at the shared speed');
for(let i=0;i<RAPIDS.mistDesktop;i++){let previous=riverMistParticle(i,0);for(let t=.15;t<70;t+=.15){const p=riverMistParticle(i,t),r=canyonRiver(p.x);assert(Object.values(p).every(Number.isFinite));assert(p.x>RAPIDS.start&&p.x<RAPIDS.end);assert(p.y>r.level&&p.y<r.level+7);assert(p.alpha>=0&&p.alpha<=.21);assert(Math.abs(p.alpha-previous.alpha)<.025,'Mist never pops on at a lifecycle boundary');if(p.age>previous.age)assert(p.x>previous.x,'Mist drifts downstream');previous=p}}
assert(canyonAmbience({x:665,y:80,z:-470})>.20);assert(canyonAmbience({x:665,y:80,z:-570})<canyonAmbience({x:665,y:80,z:-470}));assert.equal(canyonAmbience({x:-14,y:1,z:0}),0);assert.equal(canyonAmbience(null),0);
for(const mobile of [true,false]){const parent=new THREE.Group(),view=new CanyonRiverView(parent,{mobile,reduced:true}),camera=new THREE.PerspectiveCamera();view.update(3,camera);const first=view.mist.instanceMatrix.array.slice();view.update(90,camera);assert.equal(view.mist.count,mobile?26:48);assert.equal(view.clock.value,0);assert.deepEqual(view.mist.instanceMatrix.array,first,'Reduced-motion mode keeps mist and flow steady');assert([...first].every(Number.isFinite));view.dispose();assert.equal(parent.children.length,0)}
console.log('Rapids: consistent downstream advection, spray lifetime continuity, bounded mobile pools, reduced motion, cleanup and local-only ambience passed.');
