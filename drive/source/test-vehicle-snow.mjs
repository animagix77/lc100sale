import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {VehicleSnow} from './vehicle-snow.mjs';
const truck=new THREE.Group(),body=new THREE.Group();body.name='Body';truck.add(body);
const paint=new THREE.MeshStandardNodeMaterial({color:'#333344',metalness:.6,roughness:.2});
const geometry=new THREE.BoxGeometry(1.8,1.3,4);geometry.translate(0,1.25,0);
const shell=new THREE.Mesh(geometry,paint);body.add(shell);
const snow=new VehicleSnow(truck);assert(snow.meshes.length>0);assert.equal(shell.material,paint);
assert.equal(snow.amount.value,0);
for(let i=0;i<600;i++)snow.update(1/60,{snow:.88});
assert(snow.amount.value>.08&&snow.amount.value<.1,'Ten seconds gives a dusting, not an instant blanket');
const dusting=snow.amount.value;snow.update(0,{snow:1});assert.equal(snow.amount.value,dusting);
for(let i=0;i<6000;i++)snow.update(1/60,{snow:.88});assert.equal(snow.amount.value,1);
snow.update(10,{snow:0,rain:0});assert(snow.amount.value>.9&&snow.amount.value<1,'Snow persists when leaving the region');
const dryMelt=1-snow.amount.value;snow.amount.value=1;snow.update(10,{snow:0,rain:1});assert(1-snow.amount.value>dryMelt*2);
snow.update(1000,{snow:0});assert.equal(snow.amount.value,0);
for(const mesh of snow.meshes){const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;for(let i=0;i<p.count;i++)assert(n.getY(i)>.5&&p.getY(i)>1.15,'Snow stays on upper upward-facing surfaces');}
snow.dispose();assert.equal(shell.children.length,0);assert.equal(shell.material,paint);
console.log('Vehicle snow: gradual dusting, bounded accumulation, pause, dry/rain melt, upper surfaces and material preservation passed.');
