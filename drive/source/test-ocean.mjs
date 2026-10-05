import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {Ocean} from './ocean.mjs';
for(const mobile of [false,true]){
 const scene=new THREE.Scene(),ocean=new Ocean(scene,{mobile});ocean.update({z:0},1,{x:0,z:0});
 const first=ocean.mesh.geometry,p=first.attributes.position;
 assert(p.count<40000,'Ocean geometry stays within the mobile/desktop budget');
 assert([...p.array].every(Number.isFinite),'All ocean positions are finite');
 assert(first.attributes.normal.getY(100)>.99,'Surface faces upward');
 ocean.update({z:1},2,{x:0,z:0});assert.equal(ocean.mesh.geometry,first,'Animation updates uniforms without rebuilding the mesh');
 const worldX=p.getX(100),worldZ=p.getZ(100);
 ocean.update({z:1},3,{x:512,z:-512});
 const rebased=ocean.mesh.geometry.attributes.position;
 assert(Math.abs(rebased.getX(100)+512-worldX)<.001&&Math.abs(rebased.getZ(100)-512-worldZ)<.001,'Floating-origin rebase preserves world-space wave phase');
 ocean.update({z:12000},4,{x:512,z:12000});assert.equal(ocean.mesh.geometry.attributes.position.count,p.count,'Endless coast keeps constant geometry size');
 assert.equal(scene.children.length,1,'Streaming does not accumulate ocean meshes');ocean.dispose();
 console.log({mobile,vertices:p.count});
}
console.log('Ocean mesh, streaming, animation budget and rebase checks passed');
