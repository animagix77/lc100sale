import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {SandField,baseHeight,shore} from './terrain.mjs';
import {TerrainView} from './terrain-view.mjs';
import {DrivePhysics,RAPIER} from './physics.mjs';
const field=new SandField(),physics=await DrivePhysics.create(field),view=new TerrainView(new THREE.Scene(),physics,field);
// Test untracked dunes outside the expedition’s grass and compacted trail.
view.update(96,256);
const left=view.tiles.get('2,8'),right=view.tiles.get('3,8');
const original=right.mesh.geometry.attributes.color.getX(0);
for(let i=0;i<70;i++)field.stamp(96,256,1,.17,2);
view.refresh();
const a=left.mesh.geometry.attributes.position,b=right.mesh.geometry.attributes.position;
assert(Math.abs(a.getY(64)-b.getY(0))<1e-5,'Deformation crosses tile seam without a crack');
assert(Math.abs(b.getY(0)-field.height(96,256))<1e-5,'Rendered groove matches shared soil height');
assert(right.mesh.geometry.attributes.color.getX(0)<original*.7,'Deep grooves are visibly darker');
assert(field.depthAt(96,256)>.65&&field.depthAt(96,256)<.9,'Sustained slip can excavate deep soft-sand holes');
assert([...field.ruts.values()].some(v=>v.depth>.025),'Displaced sand forms raised edges');
physics.world.step();const ground=field.height(96,256),hit=physics.world.castRay(new RAPIER.Ray({x:96,y:ground+3,z:256},{x:0,y:-1,z:0}),5,true);
assert(hit&&Math.abs(hit.timeOfImpact-3)<.02,'Collision surface follows the dug-out trench');
view.update(600,600);view.update(96,256);
assert(Math.abs(view.tiles.get('3,8').mesh.geometry.attributes.position.getY(0)-ground)<1e-5,'Ruts persist when tiles stream out and back');
assert(view.tiles.get('3,8').mesh.geometry.attributes.color.getX(0)<original*.7,'Rut shading survives streaming');
// A rolling pass must leave readable tracks, while firm sand deforms less than soft sand.
const pass=(d)=>{const f=new SandField(),x=shore(256)+d;for(let z=254;z<258;z+=.17){f.stamp(x,z,1,.17,0);f.stamp(x,z,1,.17,0)}return f.depthAt(x,256)};
const firm=pass(12),soft=pass(70);assert(soft>.12&&soft>firm*2,'Normal travel leaves deeper tracks in soft sand');
console.log({deepest:field.deepest,firmPass:firm,softPass:soft,collisionHeight:ground,tiles:view.tiles.size});physics.dispose();
console.log('Rut geometry, berms, shading, collision and streaming checks passed');
