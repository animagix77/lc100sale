import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {Ocean} from './ocean.mjs';
import {shore,baseHeight} from './terrain.mjs';
import {oceanHeight,coastalWakeOffset,COASTAL_WAKE_LIMITS} from './ocean-height.mjs';

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
  assert(visibleCrest>(distance<=-8?.18:.015),'Actual ocean vertices retain a raised bow, with a smaller amplitude in shallow water');
  assert(visibleCrest<=COASTAL_WAKE_LIMITS.crest+1e-6,'Visible ocean geometry uses the conservative coastal crest budget');
  assert(visibleTrough<(distance<=-8?-.05:-.005),'Actual ocean vertices retain a trailing trough that tapers toward the shore');
  assert(visibleTrough>=-COASTAL_WAKE_LIMITS.trough-1e-6,'A wake cannot dig an oversized trough into the coast');
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

// Sample the actual mesh vertices and triangle centroids, including the wake
// behind all four moving tyres. The previous regression used only shore-3m
// at 8m/s and checked raw crest strength, missing holes on the wet foreshore.
// Read the packed half-float texture that the vertex shader actually samples.
function textureHeight(ocean,x,z){
 const field=ocean.wake,n=field.size,a=(x-field.x)/field.spacing,b=(z-field.z)/field.spacing,i=Math.floor(a),j=Math.floor(b);
 if(i<0||j<0||i>=n-1||j>=n-1)return 0;
 const u=a-i,v=b-j,k=j*n+i,h=index=>THREE.DataUtils.fromHalfFloat(ocean.wakePixels[index*4]);
 return (h(k)*(1-u)+h(k+1)*u)*(1-v)+(h(k+n)*(1-u)+h(k+n+1)*u)*v;
}
for(const mobile of [false,true])for(const distance of [4,2,0])for(const speed of [8,22.352,-8]){
 const ocean=new Ocean(new THREE.Scene(),{mobile}),position=ocean.mesh.geometry.attributes.position,bedAttribute=ocean.mesh.geometry.attributes.oceanBed,indices=ocean.mesh.geometry.index.array;
 const base=new Float64Array(position.count),displaced=new Float64Array(position.count),near=new Uint8Array(position.count),direction=Math.sign(speed);
 let wetVertices=0,wetTriangles=0,trailingTriangles=0,rawBreakthroughs=0,crest=0,trough=0,contacts=0;
 ocean.update({x:shore(15.3)+distance,z:15.3},0,{x:0,z:0});
 for(let frame=1;frame<=180;frame++){
  const time=frame/60,z=15.3-speed*time,x=shore(z)+distance;
  for(let wheel=0;wheel<4;wheel++){
   const wx=x+(wheel%2?.85:-.85),wz=z+(wheel<2?-1.3:1.3);
   if(ocean.height(wx,wz,time)>baseHeight(wx,wz)+.025){contacts++;ocean.disturb({x:wx,z:wz,wheel,slip:0},speed,0,time)}
  }
  ocean.update({x,z},time,{x:0,z:0});
  if(frame<30||frame%12!==0)continue;
  near.fill(0);
  for(let i=0;i<position.count;i++){
   const vx=position.getX(i),vz=position.getZ(i),behind=(vz-z)*direction;
   if(Math.abs(vx-x)>4||behind< -4||behind>12)continue;
   near[i]=1;
   const bed=baseHeight(vx,vz),shaderBed=bedAttribute.getX(i),raw=textureHeight(ocean,vx,vz),natural=oceanHeight(vx,vz,time),offset=coastalWakeOffset(natural-shaderBed,raw),h=natural+offset;
   assert(Math.abs(shaderBed-bed)<2e-6,'Uploaded ocean bed tracks the real coast at each displaced vertex');
   assert(Math.abs(h-ocean.height(vx,vz,time))<.0001,'Rendered half-float wake and gameplay contact height stay in agreement');
   base[i]=natural;displaced[i]=h;crest=Math.max(crest,offset);trough=Math.min(trough,offset);
   if(natural>bed+.002){
    wetVertices++;if(natural+raw<bed)rawBreakthroughs++;
    assert(h>bed,'A previously wet mesh vertex cannot disappear below the beach');
    assert(h-bed>=(natural-bed)*(1-COASTAL_WAKE_LIMITS.troughDepth)-2e-6,'Moving wakes retain the coastal depth budget');
   }
  }
  for(let i=0;i<indices.length;i+=3){
   const a=indices[i],b=indices[i+1],c=indices[i+2];if(!near[a]||!near[b]||!near[c])continue;
   const cx=(position.getX(a)+position.getX(b)+position.getX(c))/3,cz=(position.getZ(a)+position.getZ(b)+position.getZ(c))/3,bed=baseHeight(cx,cz),natural=(base[a]+base[b]+base[c])/3,h=(displaced[a]+displaced[b]+displaced[c])/3;
   if(natural>bed+.002){wetTriangles++;if((cz-z)*direction>2)trailingTriangles++;assert(h>bed,'The rendered triangles behind the truck stay above the seabed, not just their vertices')}
  }
 }
 assert(contacts>300&&ocean.wake.impulses>80,'Real wet tyre contacts feed the moving coastal wake');
 assert(wetVertices>1000&&wetTriangles>1000&&trailingTriangles>500,'The regression covers a wide, already-wet swath behind the truck');
 assert(rawBreakthroughs>0,'The sampled conditions reproduce the original raw-wake holes');
 assert(crest>.015&&trough<-.005,'Repair retains restrained visible geometric wake in the shallows');
 assert(crest<=COASTAL_WAKE_LIMITS.crest&&trough>=-COASTAL_WAKE_LIMITS.trough,'No rendered sample exceeds the conservative coast budget');
 console.log({mobile,distance,speed,rawBreakthroughs,wetVertices,wetTriangles,trailingTriangles,crest,trough});ocean.dispose();
}
console.log('Coastal driving: four moving tyres, reverse, 50mph, shallow vertices and trailing triangle waterline closure passed');
