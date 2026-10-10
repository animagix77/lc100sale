// Judge Dean LLC — molten contact, safe causeway, burn timing and reusable effects.
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {LavaRecovery} from './lava-recovery.mjs';
import {VehicleFire} from './vehicle-fire.mjs';
import {LavaCrossingView} from './lava-crossing-view.mjs';
import {VolcanoView} from './volcano-view.mjs';
import {lavaCrossingPoint} from './lava-crossing.mjs';
import {VOLCANO} from './expedition.mjs';
import {baseHeight,lavaSurfaceHeight} from './terrain.mjs';
const scene=new THREE.Scene(),crossing=new LavaCrossingView(scene),volcano=new VolcanoView(scene),r=new LavaRecovery();
let pos={x:0,y:0,z:0},origin={x:0,z:0};
const physics={position:()=>({x:pos.x+origin.x,y:pos.y,z:pos.z+origin.z}),rb:{translation:()=>pos,rotation:()=>({x:0,y:0,z:0,w:1})},vehicle:{wheelSuspensionLength:()=>.5}};
const surfaces=[crossing.lava,volcano.lake,volcano.flows];
function place(x,z,y){pos={x:x-origin.x,y,z:z-origin.z};crossing.update(0,origin);volcano.update(0,origin)}
// Chassis at normal ride height: tire samples contact ground, not nearby glow.
for(let u=-10;u<=10;u+=.5){const p=lavaCrossingPoint(0,u);place(p.x,p.z,baseHeight(p.x,p.z)+1.04);assert(!r.touching(physics,surfaces),'The basalt causeway remains safe')}
const molten=lavaCrossingPoint(20);place(molten.x,molten.z,lavaSurfaceHeight(molten.x,molten.z)+.75);assert(r.touching(physics,surfaces),'Tires touching channel lava ignite');
place(molten.x,molten.z,lavaSurfaceHeight(molten.x,molten.z)+7);assert(!r.touching(physics,surfaces),'Airborne above lava is not contact');
place(VOLCANO.x,VOLCANO.z,VOLCANO.lavaHeight+.75);assert(r.touching(physics,surfaces),'Crater lake is hazardous');
const flow=volcano.flowPoints[45];place(flow.x,flow.z,baseHeight(flow.x,flow.z)+1.04);assert(r.touching(physics,surfaces),'Visible flank streams are hazardous');
origin={x:512,z:-512};place(molten.x,molten.z,lavaSurfaceHeight(molten.x,molten.z)+.75);assert(r.touching(physics,surfaces),'Origin rebasing preserves contact');
assert.equal(r.update(1/60,false),null);assert.equal(r.update(1/60,true),'ignite');
for(let i=0;i<179;i++)assert.equal(r.update(1/60,false),null,'The fire stays lit after leaving the liquid');
assert.equal(r.update(.04,false),'respawn');assert.equal(r.rescues,1);assert.equal(r.update(.1,true),null,'Only one respawn per ignition');r.reset();assert(!r.burning);assert.equal(r.rescues,1);assert.equal(r.update(NaN,true),null);
for(const mobile of [false,true]){
 const fire=new VehicleFire(scene,{mobile}),camera=new THREE.PerspectiveCamera();
 fire.update(1.5,physics,camera);for(const mesh of fire.meshes){assert(mesh.visible);assert(mesh.count>0&&mesh.count<=44);assert([...mesh.instanceMatrix.array].every(Number.isFinite));}
 fire.update(null,physics,camera);assert(fire.meshes.every(m=>!m.visible&&m.count===0),'Respawn clears all fire and smoke');fire.dispose();
}
crossing.dispose();volcano.dispose();assert.equal(scene.children.length,0);
console.log('Lava recovery: dry causeway, channel/crater/flank contact, airborne clearance, rebasing, three-second burn, one respawn, bounded effects and cleanup passed.');
