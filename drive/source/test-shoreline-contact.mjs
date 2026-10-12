// Judge Dean LLC — shallow water must end on the sand, not a mesh boundary.
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {Ocean} from './ocean.mjs';
import {archipelagoRegion} from './coastal-islands.mjs';
import {baseHeight,shore} from './terrain.mjs';
import {oceanHeight,waterSurfaceHeight} from './ocean-height.mjs';
for(const mobile of [false,true]){
 const ocean=new Ocean(new THREE.Scene(),{mobile});
 // Real foreshore depressions extend beyond the former +12 m mesh edge.
 for(const z of [-60,-100,100]){
  ocean.update({x:shore(z)+16,z},2,{x:0,z:0});
  for(let d=10;d<26;d+=.25){
   const x=shore(z)+d,water=oceanHeight(x,z,2),ground=baseHeight(x,z);
   if(water-ground>.03){
    assert(ocean.columnOffsets[0]>d+2,`Submerged shore ${d}m inland at z=${z} must not hit the ocean mesh boundary`);
    assert.equal(waterSurfaceHeight(x,z,2),water,'Tyres detect the same shallow water as the renderer');
   }
  }
  const p=ocean.mesh.geometry.attributes.position,b=ocean.mesh.geometry.attributes.oceanBed;
  let checked=0;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),vz=p.getZ(i),d=x-shore(vz);
   if(Math.abs(vz-z)>8||d<10||d>30||archipelagoRegion(x,vz)>0)continue;
   assert(Math.abs(b.getX(i)-baseHeight(x,vz))<.002,'Water depth uses the graded/rutted beach, not the obsolete dune surface');checked++;
  }
  assert(checked>50);
 }
 ocean.update({x:-26,z:-60},3,{x:0,z:0});
 const rows=new Set(ocean.bedRows.values()),geometry=ocean.mesh.geometry;
 ocean.update({x:-26,z:-54},4,{x:0,z:0});
 assert([...ocean.bedRows.values()].filter(row=>rows.has(row)).length>(mobile?115:175),'Streaming reuses overlapping fine shoreline rows');
 for(let z=-48;z<=180;z+=6)ocean.update({x:-26,z},5,{x:0,z:0});
 assert.equal(ocean.bedRows.size,ocean.nz+1,'Shoreline cache cannot grow along an extended drive');
 assert.equal(ocean.mesh.geometry,geometry,'Shoreline correction adds no ocean meshes or geometry allocations');
 ocean.dispose();
}
console.log('Shoreline contact: submerged mesh coverage, actual sand bed and matching tyre water passed');
