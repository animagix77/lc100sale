import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {SandField} from './terrain.mjs';
import {TerrainView} from './terrain-view.mjs';
import {DrivePhysics,RAPIER} from './physics.mjs';
const field=new SandField(),physics=await DrivePhysics.create(field),scene=new THREE.Scene(),view=new TerrainView(scene,physics,field);
const started=performance.now();view.update(256,-512);const initial=performance.now()-started,far=view.far;
// Warming the outer ring does not add draw calls or collider meshes.
for(let i=0;i<500&&view.pending.size;i++)view.update(256,-512);
assert.equal(view.tiles.size,25);assert.equal(view.cache.size,24);assert.equal(view.pending.size,0);
view.geometry=()=>{throw new Error('Normal driving must never build a whole mesh synchronously')};
const timings=[];
for(let frame=0;frame<950;frame++){
 const x=256+frame*.18,z=-512-frame*.04,start=performance.now();view.update(x,z);timings.push(performance.now()-start);
 assert(view.tiles.has(`${Math.floor(x/32)},${Math.floor(z/32)}`),'The vehicle always has fine collision terrain');
 assert(view.tiles.size<=40&&view.cache.size<=49&&view.pending.size<=49,'Streaming pools remain bounded');
}
for(let i=0;i<900&&(view.pending.size||view.farJob);i++)view.update(427,-550);
assert.equal(view.tiles.size,25);assert.notEqual(view.far,far,'Far geometry eventually recenters without synchronous generation');
// Every active near tile has its own hole in the retained far buffer, even while
// old and incoming near strips temporarily coexist.
const g=view.far.geometry,{tx,tz,n,size}=g.userData.grid,step=size/n;
for(const t of view.tiles.values()){
 const i=Math.round((t.tx*32-tx)/step),j=Math.round((t.tz*32-tz)/step),o=(j*n+i)*6;
 assert.equal(g.index.array[o],g.index.array[o+1]);assert.equal(g.index.array[o],g.index.array[o+5]);
}
// Ruts generated while a tile was prefetched must be applied when it appears.
for(let i=0;i<30;i++)field.stamp(512,-550,1,.17,2);
for(let i=0;i<550;i++)view.update(448,-550);
const rutTile=view.tiles.get('16,-18');assert(rutTile,'Prefetched forward tile becomes active');
const localJ=Math.round((-550-rutTile.tz*32)*2),k=localJ*65;
assert(Math.abs(rutTile.mesh.geometry.attributes.position.getY(k)-field.height(512,-550))<1e-4,'Activating a cached tile applies current ruts');
// Floating origin changes transform existing buffers/colliders, not regenerate them.
const mesh= view.far,near=view.tiles.get('14,-18'),before=near.mesh.geometry.attributes.position.getX(0);
physics.rebase(416,-544);const rebaseStart=performance.now();view.rebase();const rebaseTime=performance.now()-rebaseStart;
assert.equal(view.far,mesh);assert.equal(near.mesh.geometry.attributes.position.getX(0)+near.mesh.position.x,before-416);
physics.world.step();const y=field.height(448,-550),hit=physics.world.castRay(new RAPIER.Ray({x:448-416,y:y+3,z:-550+544},{x:0,y:-1,z:0}),5,true);
assert(hit&&Math.abs(hit.timeOfImpact-3)<.03,'Terrain collisions still align after origin translation');
// Jobs may span an origin shift: completed buffers still use global terrain samples.
view.budget=.15;for(let i=0;i<12;i++)view.update(480,-550);
assert([...view.pending.values()].some(job=>job.rows),'A terrain row generator is suspended between frames');
physics.rebase(32,0);view.rebase();view.budget=3;
for(let i=0;i<650;i++)view.update(512,-550);
const streamed=view.tiles.get('18,-18');assert(streamed,'A tile generated across the origin shift becomes active');
const streamedPositions=streamed.mesh.geometry.attributes.position;
assert.equal(streamedPositions.getX(0)+streamed.mesh.position.x+physics.origin.x,18*32);
assert.equal(streamedPositions.getZ(0)+streamed.mesh.position.z+physics.origin.z,-18*32);
physics.world.step();const shiftedY=field.height(576,-550),shiftedHit=physics.world.castRay(new RAPIER.Ray({x:576-physics.origin.x,y:shiftedY+3,z:-550-physics.origin.z},{x:0,y:-1,z:0}),5,true);
assert(shiftedHit&&Math.abs(shiftedHit.timeOfImpact-3)<.03,'Jobs completed after rebasing create aligned colliders');
const sorted=timings.toSorted((a,b)=>a-b);console.log({initialMs:initial,streamMedianMs:sorted[Math.floor(sorted.length*.5)],streamP95Ms:sorted[Math.floor(sorted.length*.95)],streamMaxMs:sorted.at(-1),rebaseMs:rebaseTime,tiles:view.tiles.size,cached:view.cache.size});
view.dispose();assert.equal(view.cache.size+view.tiles.size+view.pending.size,0);assert.equal(scene.children.length,0,'Disposal releases active and prefetched terrain');physics.dispose();
console.log('Terrain prefetch, bounded streaming, far holes, cached ruts and origin rebasing checks passed');
