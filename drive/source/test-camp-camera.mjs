// Judge Dean LLC — parked suspension motion must not switch camera modes.
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {CampCamera} from './camp-camera.mjs';
const camera=new THREE.PerspectiveCamera(48,390/844,.1,1500),view=new CampCamera(),origin={x:128,z:0};
camera.position.set(20,9,45);camera.lookAt(17,6,38);
view.enter(camera,origin);const start=camera.position.clone();
view.update(camera,.1,{origin,complete:true,distance:3});
assert(camera.position.distanceTo(start)>0&&camera.position.distanceTo(new THREE.Vector3(29,22,67))>1,'Entry transitions instead of jumping');
for(let i=0;i<60;i++)view.update(camera,1/60,{origin,complete:true,distance:3});
const parked=camera.position.clone(),rotation=camera.quaternion.clone(),fov=camera.fov;
for(let i=0;i<600;i++){
 camera.position.set(20+Math.sin(i),9+Math.cos(i),45);camera.rotation.set(.1*Math.sin(i),i*.01,0);
 view.update(camera,1/60,{origin,complete:true,distance:3+Math.sin(i)*.1,speed:Math.sin(i)*.6});
 assert(view.active,'Rocking never exits the camp view');assert(camera.position.distanceTo(parked)<1e-9);assert(camera.quaternion.angleTo(rotation)<1e-7);assert.equal(camera.fov,fov);
}
view.update(camera,.1,{origin:{x:256,z:128},complete:true,distance:3});
assert(camera.position.distanceTo(parked.clone().sub(new THREE.Vector3(128,0,128)))<1e-9,'World rebasing preserves the view');
view.update(camera,.1,{origin,complete:true,distance:3,driving:true});assert(!view.active,'Explicit driving exits immediately');
view.update(camera,.1,{origin,complete:true,distance:3,speed:0});assert(!view.active,'Stopping again does not silently change camera mode');
view.enter(camera,origin);view.update(camera,.1,{origin,complete:true,distance:3,manual:true});assert(!view.active,'Manual look retains control');
view.enter(camera,origin);const placementPose=camera.position.clone();view.update(camera,.1,{origin,complete:true,distance:3,placing:true});assert(camera.position.equals(placementPose),'Placement has its own camera');
view.update(camera,.1,{origin,complete:true,distance:35});assert(!view.active,'Leaving the clearing exits camp');
view.enter(camera,origin);view.update(camera,.01,{origin,complete:true,distance:3,reduced:true});assert.equal(camera.position.x,29,'Reduced motion settles immediately');
view.leave();assert(!view.active);
console.log('Camp camera: smooth deliberate entry, 600 rocking frames, stable FOV/rotation, origin rebasing, manual/driving exit, placement and reduced motion passed.');
