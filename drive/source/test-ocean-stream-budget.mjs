import assert from 'node:assert/strict';
import {Scene} from 'three/webgpu';
import {Ocean} from './ocean.mjs';
for(const mobile of [true,false]){
 const ocean=new Ocean(new Scene(),{mobile}),reference=new Ocean(new Scene(),{mobile}),origin={x:0,z:0};
 const start={x:-70,z:-200},next={x:-80,z:-214};
 ocean.update(start,0,origin);reference.update(start,0,origin);
 const geometry=ocean.mesh.geometry,positions=geometry.attributes.position,old=positions.array.slice();let clock=0;
 ocean.gridStream.clock=()=>clock+=.1;
 ocean.update(next,.016,origin,{budgetMs:.4});
 assert(ocean.gridStream.pending,'One small slice leaves a pending grid');
 assert.deepEqual(positions.array,old,'Incomplete water rows never appear on screen');
 assert.equal(ocean.mesh.geometry,geometry);
 // Move the origin in the middle of preparation; visible and staged water
 // must stay in the same world positions, with no mixed-origin row seam.
 const shifted={x:512,z:-512};ocean.update(next,.032,shifted,{budgetMs:0});
 for(let i=0;i<positions.count;i+=113){assert(Math.abs(positions.getX(i)+512-old[i*3])<.0001);assert(Math.abs(positions.getZ(i)-512-old[i*3+2])<.0001);}
 let slices=0;while(ocean.gridStream.pending&&slices++<500)ocean.update(next,.032+slices/60,shifted,{budgetMs:.4});
 assert(slices>2&&slices<500,'Row slices finish without starvation');
 reference.update(next,1,shifted);
 const expected=reference.mesh.geometry.attributes.position.array;let maxError=0;for(let i=0;i<expected.length;i++)maxError=Math.max(maxError,Math.abs(positions.array[i]-expected[i]));assert(maxError<.0003,'Rebased staging matches synchronous geography within Float32 precision');
 assert.deepEqual(geometry.attributes.oceanBed.array,reference.mesh.geometry.attributes.oceanBed.array,'Bathymetry publishes with matching positions');
 assert.equal(ocean.bedRows.size,ocean.nz+1,'No row-cache growth after a job');
 ocean.update({x:-70,z:-220},4,shifted,{budgetMs:0});assert(ocean.gridStream.pending);
 ocean.update({x:-120,z:5000},4,shifted,{budgetMs:.01});assert.equal(ocean.gridStream.pending,null,'Teleport prepares coverage synchronously');
 assert.equal(ocean.mesh.geometry.attributes.position,positions,'GPU attributes are reused');
 ocean.dispose();reference.dispose();
}
console.log('Water row streaming: atomic publication, bounded staging, mid-job origin shift, matching bathymetry and teleport coverage passed.');
