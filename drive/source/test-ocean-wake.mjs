import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {Ocean} from './ocean.mjs';
import {shore,baseHeight} from './terrain.mjs';
import {oceanHeight} from './ocean-height.mjs';

// Reproduce the lost offshore deformation: the old coastline-only dense band
// left no vertices within three metres of a tyre at shore-40m. A 69cm wake
// existed in the simulation, but its actual ocean mesh moved less than 1mm.
for(const mobile of [false,true]){
 const ocean=new Ocean(new THREE.Scene(),{mobile}),geometry=ocean.mesh.geometry,positions=geometry.attributes.position,texture=ocean.wakeTexture,pixels=ocean.wakePixels;
 const records=[];
 for(const [distance,z] of [[4,15.3],[2,15.3],[0,21.8],[-3,26.2],[-8,31.7],[-32,38.2],[-40,63.8],[-60,-.3],[-100,-97.4],[-260,128.2]]){
  const x=shore(z)+distance;ocean.clear();ocean.update({x,z},0,{x:0,z:0});
  for(let frame=0;frame<24;frame++){ocean.disturb({x,z,wheel:0,slip:0},8,0,frame/30);ocean.wake.step(1/30)}
  ocean.update({x,z},.8,{x:0,z:0});let near=0,visibleCrest=0,visibleTrough=0,nearest=Infinity;
  for(let i=0;i<positions.count;i++){
   const vx=positions.getX(i),vz=positions.getZ(i),distance=Math.hypot(vx-x,vz-z);
   nearest=Math.min(nearest,distance);if(distance<3)near++;
   // The vertex shader adds this same world-space displacement to its swell.
   const displacement=ocean.height(vx,vz,.8)-oceanHeight(vx,vz,.8,ocean.waveScale.value);
   if(Number.isFinite(displacement)){visibleCrest=Math.max(visibleCrest,displacement);visibleTrough=Math.min(visibleTrough,displacement)}
  }
  assert(near>=(mobile?48:90),'Every ocean driving position has tyre-scale surface vertices');
  assert(nearest<.55,'The detailed ocean patch follows the vehicle across shoreline and stream cells');
  assert(visibleCrest>.18&&visibleCrest>ocean.wake.peak*.50,'Actual ocean vertices retain the raised bow rather than only a normal-map wake');
  assert(visibleTrough<-.05,'Actual ocean vertices retain the depressed trailing trough');
  assert.equal(ocean.columnOffsets[0],12,'Moving the detailed patch does not open a hole beside the shoreline');
  assert(ocean.columnOffsets[ocean.nx]<=-1200,'The same ocean mesh still reaches the horizon');
  for(let i=1;i<ocean.columnOffsets.length;i++)assert(ocean.columnOffsets[i]<ocean.columnOffsets[i-1],'Adaptive columns never fold or collapse to zero width');
  assert.equal(ocean.mesh.geometry,geometry);assert.equal(ocean.mesh.geometry.attributes.position,positions);assert.equal(ocean.wakeTexture,texture);assert.equal(ocean.wakePixels,pixels);
  const sample={x:x+.25,z:z-1},before=ocean.height(sample.x,sample.z,.8),world=positions.array.slice();
  ocean.update({x,z},.8,{x:512,z:-512});assert.equal(ocean.height(sample.x,sample.z,.8),before,'CPU contact waterline remains unchanged by a rebase');
  for(let i=0;i<positions.count;i+=43){assert(Math.abs(positions.getX(i)+512-world[i*3])<.00015);assert(Math.abs(positions.getZ(i)-512-world[i*3+2])<.00015,'Rebase preserves the displaced mesh sampling locations')}
  records.push({distance,verticesNearTyre:near,crest:visibleCrest});
 }
 assert(positions.count<(mobile?18000:34000),'Restoring displacement does not add ocean vertices');
 assert.equal(ocean.mesh.parent.children.length,1,'No overlapping wake plane hides the displaced surface');
 ocean.dispose();console.log({mobile,records});
}
console.log('Ocean wake geometry: offshore bow/trough, local detail, shoreline/horizon coverage, streaming, rebasing and fixed GPU budget passed');

// Retessellation must not resample the visible wave under the truck. Both
// sides of each detail-window boundary use the same world-space triangles.
for(const mobile of [false,true]){
 const ocean=new Ocean(new THREE.Scene(),{mobile}),localVertices=(cx,cz)=>{
  const p=ocean.mesh.geometry.attributes.position,set=new Set();
  for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i)-cx)<5&&Math.abs(p.getZ(i)-cz)<5)set.add(`${p.getX(i).toFixed(4)},${p.getZ(i).toFixed(4)}`);
  return [...set].sort();
 };
 const z=15.3,edge=-8-ocean.focusStep*.5,x=shore(z)+edge;
 ocean.update({x:x+.001,z},1,{x:0,z:0});const shoreward=localVertices(x,z);
 ocean.update({x:x-.001,z},1,{x:0,z:0});assert.deepEqual(localVertices(x,z),shoreward,'Crossing the offshore detail boundary keeps identical local surface vertices');
 const rowZ=18,rowX=shore(rowZ)-40;
 ocean.update({x:rowX,z:rowZ-.001},1,{x:0,z:0});const previousRow=localVertices(rowX,rowZ);
 ocean.update({x:rowX,z:rowZ+.001},1,{x:0,z:0});assert.deepEqual(localVertices(rowX,rowZ),previousRow,'Crossing a streaming row does not move the ocean triangles under the truck');
 ocean.dispose();
}
console.log('Ocean detail continuity: exact world-space local grid across offshore and alongshore window shifts passed');

// Ordinary driving in shallow seawater still supplies and visibly renders
// the wake. Classify each moving tyre against its actual coastal bed height.
for(const mobile of [false,true]){
 const ocean=new Ocean(new THREE.Scene(),{mobile}),speed=8;let wetContacts=0,crest=0;
 ocean.update({x:shore(15.3)-3,z:15.3},0,{x:0,z:0});
 for(let frame=1;frame<=90;frame++){
  const time=frame/60,z=15.3-speed*time,x=shore(z)-3;
  for(let wheel=0;wheel<4;wheel++){
   const wx=x+(wheel%2?.85:-.85),wz=z+(wheel<2?-1.3:1.3);
   if(ocean.height(wx,wz,time)>baseHeight(wx,wz)+.025){wetContacts++;ocean.disturb({x:wx,z:wz,wheel,slip:0},speed,0,time)}
  }
  ocean.update({x,z},time,{x:0,z:0});
  if(frame%10===0){const p=ocean.mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i)-x)<4&&Math.abs(p.getZ(i)-z)<6)crest=Math.max(crest,ocean.wake.sample(p.getX(i),p.getZ(i)))}
 }
 assert(wetContacts>200&&ocean.wake.impulses>80,'Normal coastal wading keeps supplying real tyre disturbances');
 assert(crest>.15,'The moving shallow-water bow is visible in actual ocean mesh vertices');
 console.log({mobile,coastalWetContacts:wetContacts,coastalCrest:crest});ocean.dispose();
}
console.log('Coastal driving: shallow-water contact and visible moving geometric wake passed');
