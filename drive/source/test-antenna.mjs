import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {PowerAntenna} from './antenna.mjs';
function rig(){const root=new THREE.Group(),base=new THREE.Group();base.name='RadioAntenna';root.add(base);let p=base;for(let i=1;i<=3;i++){const s=new THREE.Group();s.name='Antenna_'+i;p.add(s);p=s}return root}
const antenna=new PowerAntenna(rig());const step=(seconds,args={})=>{for(let i=0;i<seconds*120;i++)antenna.update(1/120,args)};
antenna.power(true);step(1);assert(antenna.extension>.45&&antenna.extension<.55);assert(antenna.blend>.9);assert(antenna.holding);
const cam=new THREE.PerspectiveCamera();cam.position.set(7,4,11);cam.lookAt(0,1,0);const original=cam.position.clone(),rot=cam.quaternion.clone();antenna.camera(cam,{height:()=>0},{x:0,z:0});assert(cam.position.z<0,'front camera cut');antenna.restore(cam);assert(cam.position.equals(original)&&cam.quaternion.equals(rot),'chase pose survives the cut');
step(1);assert.equal(antenna.extension,1);assert.equal(antenna.stages[0].position.y,0);assert.equal(antenna.stages[2].position.y,.27);
step(2);assert(antenna.blend<.001&&!antenna.holding,'camera returns without further input');
antenna.power(false);step(2);assert.equal(antenna.extension,0);assert.equal(antenna.stages[0].position.y,-.29);
antenna.power(true);step(.2,{driving:true});assert.equal(antenna.blend,0);assert(!antenna.holding,'driver immediately retains control');
antenna.power(false);step(2);antenna.power(true,{speed:4});step(1);assert.equal(antenna.blend,0,'moving vehicle keeps the chase camera');
const reduced=new PowerAntenna(rig(),{reduced:true});reduced.power(true);reduced.update(2);assert.equal(reduced.blend,0);assert.equal(reduced.extension,1);
const recovery=new PowerAntenna(rig());recovery.power(true,{recovering:true});recovery.update(1);assert.equal(recovery.blend,0);
console.log('Antenna: telescoping travel, timed camera return, drive/recovery interruption, moving and reduced-motion guards passed.');
