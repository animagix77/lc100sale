// Judge Dean LLC — camera safety, deterministic handoff and accessible skip lifecycle.
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {OpeningShot,OpeningCinematic} from './opening-cinematic.mjs';
import {syncVehicleTransform} from './vehicle-transform.mjs';
const camera=new THREE.PerspectiveCamera(48,1,.1,1500);camera.position.set(3.7,4,10.5);camera.lookAt(0,1,-3);
const original={p:camera.position.clone(),q:camera.quaternion.clone(),fov:camera.fov};
const options={anchor:{x:0,y:1,z:0},forward:{x:0,z:-1},heightAt:(x,z)=>Math.max(0,1.4*Math.sin(x*.3)*Math.cos(z*.2)),waterAt:()=>.3};
for(const resumed of [false,true]){
 const shot=new OpeningShot();assert(shot.start(camera,{...options,resumed}));assert.equal(shot.duration,resumed?4.2:10);let samples=0,maxMove=0,previous=camera.position.clone();
 while(shot.active&&samples++<700){shot.update(1/60,camera);maxMove=Math.max(maxMove,previous.distanceTo(camera.position));previous.copy(camera.position);assert([...camera.position,...camera.quaternion].every(Number.isFinite));if(shot.active)assert(camera.position.y>=options.heightAt(camera.position.x,camera.position.z)+1.2999);}
 assert(samples<650&&maxMove<1,'Continuous bounded camera motion');assert(camera.position.equals(original.p));assert(camera.quaternion.equals(original.q));assert.equal(camera.fov,original.fov,'Exact existing camera restored at handoff');
}
const reduced=new OpeningShot();assert(!reduced.start(camera,{...options,reduced:true}));assert(camera.position.equals(original.p),'Reduced motion skips the camera travel');
const interrupted=new OpeningShot();interrupted.start(camera,options);interrupted.update(NaN,camera);interrupted.update(-10,camera);assert.equal(interrupted.time,0);interrupted.finish(camera);assert(camera.position.equals(original.p));
class Element{
 constructor(){this.events={};this.dataset={};this.style={setProperty(){}};this.classList={add(){},remove(){}};this.nodes={};this.open=false;}
 setAttribute(){} append(){} addEventListener(k,f){this.events[k]=f}removeEventListener(k){delete this.events[k]}querySelector(k){return this.nodes[k]??=new Element()}showModal(){this.open=true}close(){this.open=false}focus(){this.focused=true}remove(){this.removed=true}
}
const doc=new Element();doc.createElement=()=>new Element();doc.body=new Element();doc.documentElement=new Element();let finishes=0;
const ui=new OpeningCinematic({camera,document:doc,onFinish:()=>finishes++});assert(ui.start(options));assert(ui.dialog.open&&ui.skip.focused);assert.equal(ui.chapter.textContent,'THE COAST IS ONLY THE BEGINNING');
function key(code,extra={}){const e={code,prevented:false,stopped:false,preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true},...extra};doc.events.keydown(e);return e;}
assert(key('KeyW').prevented&&ui.active,'WASD cannot move the parked truck during the film');assert(!key('KeyW',{metaKey:true}).prevented,'Browser shortcuts stay available');
assert(key('Escape').stopped);assert(!ui.active&&!ui.dialog.open);assert.equal(finishes,1);ui.finish();assert.equal(finishes,1,'Skip completes only once');
ui.start({...options,resumed:true});assert.equal(ui.chapter.textContent,'Your expedition continues.');ui.skip.events.click();assert.equal(finishes,2);assert(camera.position.equals(original.p));
assert(!ui.start({...options,reduced:true}));assert(!ui.dialog.open);assert.equal(finishes,2);
ui.start(options);for(let i=0;i<620;i++)ui.update(1/60);assert.equal(finishes,3);assert(!ui.active&&!ui.dialog.open);
ui.start(options);ui.dispose();assert(!ui.active&&ui.dialog.removed);assert.equal(Object.keys(doc.events).length,0);assert.equal(finishes,3,'Disposal does not resume gameplay');
console.log('Opening cinematic: continuous safe camera, exact handoff, short resume, reduced motion, input blocking, skip, completion and disposal passed.');
// Portrait framing backs the camera away rather than cropping the truck's nose.
const phone=new THREE.PerspectiveCamera(48,390/844,.1,1500);phone.position.set(.5,5.1,13.5);phone.lookAt(0,1,-3);
const portrait=new OpeningShot();portrait.start(phone,options);let widest=0;
for(let i=0;i<620;i++){
 portrait.update(1/60,phone);phone.updateMatrixWorld();
 for(const x of [-1.1,1.1])for(const y of [-.3,2.8])for(const z of [-2.55,2.55])widest=Math.max(widest,Math.abs(new THREE.Vector3(x,y,z).project(phone).x));
}
assert(widest<.98,`Portrait shot contains the vehicle width: ${widest}`);
console.log('Phone framing keeps the truck inside the shot throughout the moving portion.');
// A new journey can begin while the rendered model still sits at a saved hill.
// Cinematic entry and driving must apply the same rigid-body/local-origin pose.
const truck=new THREE.Object3D();truck.position.set(386,68,-562);
for(const origin of [{x:0,z:0},{x:640,z:-512}])for(const tilt of [0,.18]){
 const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt,.37,-tilt*.5));
 const body={x:-14-origin.x,y:1.2,z:-origin.z};
 const expected=new THREE.Matrix4().compose(new THREE.Vector3(body.x,body.y,body.z),rotation,new THREE.Vector3(1,1,1)).multiply(new THREE.Matrix4().makeTranslation(0,-.70,0));
 syncVehicleTransform(truck,body,rotation);truck.updateMatrixWorld(true);
 truck.matrixWorld.elements.forEach((v,i)=>assert(Math.abs(v-expected.elements[i])<1e-10,'Cinematic renders the reset rigid-body pose, including rotation and rebasing'));
 const before=truck.position.clone();for(let i=0;i<60;i++)syncVehicleTransform(truck,body,rotation);assert(truck.position.equals(before),'Repeated synchronization cannot accumulate the model offset');
}
console.log('Cinematic vehicle reset: stale saved location, local origin, body tilt and repeat synchronization passed.');
