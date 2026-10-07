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
  const contacts=Array.from({length:4},(_,i)=>({x:-36+(i%2)*2,y:-1,z:i<2?-1.4:1.4}));
 const physics={speed:0,origin:{x:0,z:0},vehicle:{wheelContactPoint:i=>contacts[i],wheelIsInContact:()=>true}};
 for(let i=0;i<60;i++)ocean.updateWheelFoam(1/60,physics,1);
 assert(ocean.wheelFoam.every(slot=>slot.value.z>.59),'All four wet tires receive gentle foam even at rest');
 physics.speed=8;for(let i=0;i<60;i++)ocean.updateWheelFoam(1/60,physics,1);
 assert(ocean.wheelFoam.every(slot=>slot.value.z>.94),'Driving adds stronger tire foam');
 physics.origin={x:512,z:-512};contacts.forEach(c=>{c.x-=512;c.z+=512});ocean.updateWheelFoam(1/60,physics,1);
 assert.equal(ocean.wheelFoam[0].value.x,-36,'Foam remains at the world-space wheel after rebasing');
 contacts.forEach(c=>c.y=3);for(let i=0;i<90;i++)ocean.updateWheelFoam(1/60,physics,1);
 assert(ocean.wheelFoam.every(slot=>slot.value.z<.001),'Dry tires shed residual foam');
 ocean.clear();assert(ocean.wheelFoam.every(slot=>slot.value.z===0),'Recovery/reset clears wheel foam');

 assert.equal(scene.children.length,1,'Streaming does not accumulate ocean meshes');ocean.dispose();
 console.log({mobile,vertices:p.count});
}
console.log('Ocean mesh, streaming, animation budget and rebase checks passed');
