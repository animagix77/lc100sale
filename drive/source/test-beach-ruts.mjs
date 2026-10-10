// Judge Dean LLC — pre-existing coastal tracks remain physical and deterministic.
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {SandField,beachRuts,baseHeight,shore} from './terrain.mjs';
import {riverZ} from './expedition.mjs';
import {DrivePhysics,RAPIER} from './physics.mjs';
import {TerrainView} from './terrain-view.mjs';
let deepest=0,highest=0,maxGrade=0;
for(let z=-500;z<600;z+=3)for(let d=0;d<=50;d+=.25){
 const x=shore(z)+d,h=beachRuts(x,z);assert(Number.isFinite(h));deepest=Math.min(deepest,h);highest=Math.max(highest,h);
 maxGrade=Math.max(maxGrade,Math.abs(beachRuts(x+.025,z)-beachRuts(x-.025,z))/.05);
 if(d<=10||d>=40)assert.equal(h,0,'Wash zone and inland terrain remain free of old beach tracks');
}
assert(deepest<-.16&&deepest>-.26,'Pronounced but bounded worn channels');assert(highest>.035&&highest<.10,'Displaced sand makes low shoulders');assert(maxGrade<.8,'Soft sloping walls, not vertical slots');
for(let x=-40;x<10;x++)assert.equal(beachRuts(x,riverZ(x)),0,'Do not add tracks to the river mouth');
const z=128,profile=[];for(let x=shore(z)+12;x<shore(z)+38;x+=.125)profile.push({x,h:beachRuts(x,z)});
const troughs=profile.filter((p,i)=>i>0&&i<profile.length-1&&p.h<-.05&&p.h<profile[i-1].h&&p.h<profile[i+1].h);
assert(troughs.length>=6,'Several paired traffic lines, rather than a single rut');
const f=new SandField(),p=await DrivePhysics.create(f),view=new TerrainView(new THREE.Scene(),p,f),x=Math.round(troughs[0].x*2)/2;
assert.equal(f.ruts.size,0,'Old ruts do not prefill the mutable deformation map');view.update(x,z);p.world.step();
const tx=Math.floor(x/32),tz=Math.floor(z/32),tile=view.tiles.get(`${tx},${tz}`),k=Math.round((z-tz*32)*2)*65+Math.round((x-tx*32)*2),g=tile.mesh.geometry;
const sample=()=>{const y=f.height(x,z),hit=p.world.castRay(new RAPIER.Ray({x,y:y+2,z},{x:0,y:-1,z:0}),4,true);assert(hit&&Math.abs(hit.timeOfImpact-2)<.02,'Collision surface includes pre-existing ruts');return y;};
assert(Math.abs(g.attributes.position.getY(k)-baseHeight(x,z))<1e-5);assert(g.attributes.deformation.getX(k)<-.05,'Worn trough has compressed/darker surface shading');const original=sample();
for(let i=0;i<12;i++)f.stamp(x,z,1,.17,.1,0);view.refresh();p.world.step();assert(sample()<original-.04,'Fresh tyre contact can deepen an old channel');
assert(Math.abs(g.attributes.deformation.getX(k)-(beachRuts(x,z)+f.gridOffset(Math.round(x*2),z*2)))<1e-6,'Refreshing fresh tracks retains old compaction shading');
view.update(x,400);view.update(x,z);p.world.step();assert(Math.abs(sample()-f.height(x,z))<1e-5,'Physical ruts survive tile recycling');
assert.equal(new SandField().height(x,z),original,'Reload restores the same pre-existing beach');
console.log({deepest,highest,maxGrade,channels:troughs.length});view.dispose();p.dispose();
console.log('Pre-existing beach ruts: coastal bounds, paired grooves/berms, physical contacts, fresh deformation and recycling passed.');
