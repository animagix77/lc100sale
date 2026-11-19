import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {VehicleLights,lampState} from './vehicle-lights.mjs';
import {DrivePhysics} from './physics.mjs';
assert(lampState(8,false).dark);assert(!lampState(30,true).dark);assert(lampState(14,true).dark);assert(!lampState(14,false).dark);
const truck=new THREE.Group(),body=new THREE.Group();body.name='Body';truck.add(body);const original=new THREE.MeshStandardMaterial({map:new THREE.Texture()}),mesh=new THREE.Mesh(new THREE.BoxGeometry(),original);body.add(mesh);
const lights=new VehicleLights(truck);lights.update(1,8);assert(lights.head.value>3.7);assert(lights.beams.every(l=>l.intensity>90));assert(lights.tail.value>.19);assert.equal(lights.reverse.value,0);assert(mesh.material.isMeshStandardNodeMaterial);
lights.update(1,8,{braking:true});assert(lights.tail.value>.89);assert(lights.stop.value>.89);assert.equal(lights.reverse.value,0);
lights.update(1,30,{reversing:true});assert(lights.head.value<.01);assert(lights.backup.intensity>39);assert(lights.tail.value<.01);
truck.position.set(4,2,9);truck.rotation.y=Math.PI/2;truck.updateMatrixWorld(true);const a=new THREE.Vector3(),b=new THREE.Vector3();lights.beams[0].getWorldPosition(a);lights.beams[0].target.getWorldPosition(b);assert(b.x<a.x,'Beams turn with the truck');
assert.equal(lights.volumes.length,2);assert(lights.volumeDensity.value>=.065);assert.equal(lights.volumeMaterial.fog,false);lights.volumes[0].geometry.computeBoundingBox();assert(lights.volumes[0].geometry.boundingBox.min.y<=-26,'Scattering reaches the middle distance');const clearDensity=lights.volumeDensity.value;lights.update(1,8,{}, {fog:true});assert(lights.volumeDensity.value>clearDensity,'Fog strengthens scattering');assert(lights.volumeMaterial.opacityNode);lights.dispose();assert.equal(mesh.material,original);assert(!truck.children.includes(lights.group));mesh.geometry.dispose();original.map.dispose();original.dispose();
// The published molded lenses have separate circuits, including untextured forward reflectors.
const moldedTruck=new THREE.Group(),moldedBody=new THREE.Group();moldedBody.name='Body';moldedTruck.add(moldedBody);
function optic(meshName,materialName,textured){
 const material=new THREE.MeshStandardMaterial();material.name=materialName;if(textured)material.map=new THREE.Texture();
 const lens=new THREE.Mesh(new THREE.BoxGeometry(),material);lens.name=meshName;moldedBody.add(lens);return lens;
}
const head=optic('main','Astra • faceted headlight reflector',false);
const brake=optic('housing','Rear lamps / ruby reflector cells',true);
const highBrake=optic('roof stop lamp and bumper reflectors','V5 / rear detail v6 / red prism edges',false);
const back=optic('Rear_lamps__right_reverse_gate','Rear lamps / clear reflector cells',true);
const indicator=optic('Rear_lamps__right_indicator_gate','Rear lamps / clear reflector cells',true);
const fog=optic('fog','Heritage bumper / faceted smoked silver fog reflector',true);
const moldedLights=new VehicleLights(moldedTruck);
for(const lens of [head,brake,highBrake,back])assert(lens.material.emissiveNode,'Each powered lamp has an emission shader');
for(const lens of [indicator,fog])assert.equal(lens.material.emissiveNode,undefined,'Inactive circuits retain their original material');
moldedLights.dispose();
for(const lens of moldedBody.children){assert(!lens.material.isNodeMaterial);lens.geometry.dispose();lens.material.map?.dispose();lens.material.dispose();}
const p=await DrivePhysics.create();p.rb.setLinvel({x:0,y:0,z:-3},true);p.step(1/120,{reverse:true});assert(p.lighting.braking&&!p.lighting.reversing,'Reverse input first brakes forward motion');p.rb.setLinvel({x:0,y:0,z:0},true);p.step(1/120,{reverse:true});assert(p.lighting.reversing&&!p.lighting.braking);p.step(1/120,{brake:true});assert(p.lighting.braking&&!p.lighting.reversing);p.step(1/120,{});assert(!p.lighting.braking&&!p.lighting.reversing,'Gravity and coasting do not fake reverse gear');p.dispose();
console.log('Vehicle lamps: dusk hysteresis, brake/reverse physics signals, lens emission, ground beams, truck transforms and disposal passed.');
