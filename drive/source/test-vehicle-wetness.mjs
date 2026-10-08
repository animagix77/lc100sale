import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {WetnessState,VehicleWetness} from './vehicle-wetness.mjs';
import {VehicleLights} from './vehicle-lights.mjs';
import {VehicleSnow} from './vehicle-snow.mjs';

const coat=new WetnessState();coat.update(1,{rain:1});assert(coat.rain>.2&&coat.rain<.3,'Rain wets progressively');
coat.update(20,{rain:1});assert(coat.rain>.99);
coat.update(10,{});assert(coat.rain>.85&&coat.rain<.9,'Paint stays damp after rainfall');
coat.reset();coat.update(1,{contact:1,depth:.35,speed:4});assert(coat.water>.9&&coat.splashHeight<1.3,'Crossings wet lower body, not an instant roof blanket');
const wet=coat.amount,drain=coat.draining;coat.update(8,{});assert(coat.amount>wet*.85);assert(coat.draining<drain*.38,'Dripping ends before the finish dries');
const amount=coat.amount;coat.update(NaN,{rain:1});coat.update(0,{rain:1});assert.equal(coat.amount,amount);
coat.update(1000,{});assert(coat.amount<.00001);coat.reset();assert.equal(coat.amount,0);

for(const mobile of [false,true]){
 const scene=new THREE.Scene(),truck=new THREE.Group(),body=new THREE.Group();body.name='Body';truck.add(body);scene.add(truck);
 const original=new THREE.MeshStandardMaterial({map:new THREE.Texture(),color:'#718291',roughness:.38,metalness:.3}),shell=new THREE.Mesh(new THREE.BoxGeometry(1.8,1.3,4).translate(0,1.25,0),original);body.add(shell);
 const wheelMaterial=new THREE.MeshStandardMaterial({color:'#202428',roughness:.94}),wheel=new THREE.Mesh(new THREE.SphereGeometry(.4),wheelMaterial),roll=new THREE.Group();roll.name='Roll_FL';roll.add(wheel);truck.add(roll);
 const lights=new VehicleLights(truck,{mobile});const lampMat=shell.material,emission=lampMat.emissiveNode;
 const wetness=new VehicleWetness(scene,truck,{mobile,groundHeight:()=>0});
 assert.equal(wetness.max,mobile?8:16);assert.notEqual(shell.material,lampMat);assert.equal(shell.material.emissiveNode,emission);assert.equal(shell.material.map,original.map);assert.equal(shell.material.metalness,original.metalness);
 assert(shell.material.colorNode&&shell.material.roughnessNode);assert.notEqual(wheel.material,wheelMaterial);
 const snow=new VehicleSnow(truck),snowMaterial=snow.material;
 for(let i=0;i<240;i++)wetness.update(1/60,{rain:.8},{contact:1,depth:.35},{x:0,z:0},{x:1,y:0,z:2},i/60);
 assert(wetness.stats.drips>0);assert(wetness.stats.drips<=wetness.max);assert(wetness.stats.wetness>.8);assert.equal(snow.material,snowMaterial);assert(snow.meshes.every(m=>m.material===snowMaterial));
 assert(wetness.drops.instanceMatrix.array.every(Number.isFinite));
 // Drops already in the air are stored in world coordinates, independent of origin rebases.
 const drop=wetness.pool.find(d=>d.alive);drop.vx=drop.vy=drop.vz=0;const absoluteX=drop.x;truck.position.set(-100,0,-100);
 wetness.update(.001,{rain:0},{},{x:100,z:100},{x:0,y:0,z:0},5);assert.equal(drop.x,absoluteX);
 let slot=wetness.pool.filter(d=>d.alive).indexOf(drop),matrix=new THREE.Matrix4();wetness.drops.getMatrixAt(slot,matrix);assert(Math.abs(matrix.elements[12]-(absoluteX-100))<.00001);
 wetness.reset();assert.equal(wetness.drops.count,0);assert(!wetness.drops.visible);assert.equal(wetness.state.amount,0);
 wetness.reduced=true;for(let i=0;i<120;i++)wetness.update(1/60,{rain:1},{contact:1,depth:.5});assert.equal(wetness.stats.drips,0);assert(wetness.state.amount>.9,'Reduced motion keeps wet finish without droplets');
 snow.dispose();wetness.dispose();assert.equal(shell.material,lampMat);assert.equal(wheel.material,wheelMaterial);lights.dispose();assert.equal(shell.material,original);assert(!scene.children.includes(wetness.drops));
 original.map.dispose();original.dispose();wheelMaterial.dispose();shell.geometry.dispose();wheel.geometry.dispose();
}
console.log('Vehicle wetness: gradual rain, localized crossing coat, drying/draining, light/texture/snow preservation, bounded drops, rebasing, reset, reduced motion and disposal passed.');
