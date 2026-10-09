import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three/webgpu';
import {ImpactShake} from './impact-shake.mjs';

const near=(a,b,message,tolerance=1e-10)=>assert(Math.abs(a-b)<tolerance,`${message}: ${a} != ${b}`);
const impact={kind:'rock',source:'volcano',radius:.65,distance:12,velocity:22,ground:true,energy:.6,pan:.6};
const hit=overrides=>new ImpactShake().update(0,[{...impact,...overrides}]);

for(const ignored of [
 {kind:'wood'},{source:'terrain'},{source:undefined},{ground:false},{ground:undefined},
 {radius:.49},{radius:NaN},{radius:Infinity},{distance:38},{distance:100},{distance:-1},
 {distance:NaN},{velocity:2},{velocity:0},{velocity:Infinity}
])assert.equal(hit(ignored).strength,0,`Unrelated or invalid contact ignored: ${JSON.stringify(ignored)}`);
const close=hit({distance:5}),far=hit({distance:30}),small=hit({radius:.5}),large=hit({radius:.75}),slow=hit({velocity:5});
assert(close.strength>far.strength&&far.strength>0,'Nearby landings are stronger than distant landings');
assert(large.strength>small.strength&&small.strength>0,'Larger rocks shake more; threshold size produces only a small kick');
assert(hit({}).strength>slow.strength,'Hard landings are stronger than gentle contacts');

const burst=new ImpactShake().update(0,Array.from({length:200},()=>({...impact,radius:2,distance:0,velocity:100,pan:1})));
near(burst.strength,1,'Simultaneous impact strength has a hard cap');
assert(burst.impulses.length<=8,'A large event burst has bounded memory');
for(let i=0;i<150;i++){
 burst.update(1/240);
 assert(burst.position.length()<=.100000001,'Translation remains below 10 cm');
 assert(burst.rotation.length()<=.012000001,'Combined rotation remains below 0.012 radians');
}
const bounded=new PerspectiveCamera(48,1,.1,1500),base=bounded.quaternion.clone();burst.apply(bounded);
assert(base.angleTo(bounded.quaternion)<=.01201,'Actual camera orientation respects the rotation cap');

const decay=hit({});let previous=decay.strength;
for(let i=0;i<120;i++){decay.update(1/120);assert(decay.strength<=previous,'Each impact envelope decays monotonically');previous=decay.strength}
assert(decay.strength<.0003,'Shake is imperceptible after one second');decay.update(.2);assert.equal(decay.strength,0);assert.equal(decay.impulses.length,0);

const outcomes=[];
for(const fps of [30,60,120]){const shake=hit({});for(let i=0;i<fps/2;i++)shake.update(1/fps);outcomes.push(shake)}
for(const shake of outcomes.slice(1)){
 near(shake.strength,outcomes[0].strength,'Decay is independent of render rate');
 for(const axis of ['x','y','z']){near(shake.position[axis],outcomes[0].position[axis],`Position ${axis} is independent of render rate`);near(shake.rotation[axis],outcomes[0].rotation[axis],`Rotation ${axis} is independent of render rate`)}
}
hit({}).update(5).apply(new PerspectiveCamera());assert.equal(hit({}).update(5).strength,0,'A long frame expires old effects rather than replaying them');

const camera=new PerspectiveCamera(48,1.7,.1,1500);camera.position.set(42,8,-103);camera.lookAt(15,2,-180);
const shake=hit({}),originalPosition=camera.position.clone(),originalRotation=camera.quaternion.clone(),projection=camera.projectionMatrix.clone();
shake.apply(camera);assert(camera.position.distanceTo(originalPosition)>.005,'A normal nearby large landing has a visible position kick');
const oncePosition=camera.position.clone(),onceRotation=camera.quaternion.clone();shake.apply(camera);
assert.deepEqual(camera.position,oncePosition,'Applying twice does not compound translation');assert.deepEqual(camera.quaternion.toArray(),onceRotation.toArray(),'Applying twice does not compound rotation');
shake.restore(camera);shake.restore(camera);assert.deepEqual(camera.position,originalPosition);assert.deepEqual(camera.quaternion.toArray(),originalRotation.toArray());
assert.equal(camera.fov,48,'Camera field of view is unaffected');assert.deepEqual(camera.projectionMatrix,projection);

// Simulate a moving follow camera, including a world-origin shift. Exact pose
// restoration ensures that a series of impacts cannot creep into camera follow.
for(let i=0;i<360;i++){
 shake.restore(camera);camera.position.add(new Vector3(.07,0,-.15));if(i===100)camera.position.x-=512;
 camera.lookAt(camera.position.x-4,camera.position.y-1,camera.position.z-10);
 const position=camera.position.clone(),rotation=camera.quaternion.clone();
 shake.update(1/60,i%30===0?[impact]:[]).apply(camera);shake.restore(camera);
 assert.deepEqual(camera.position,position,'Camera follow retains its exact unshaken position');assert.deepEqual(camera.quaternion.toArray(),rotation.toArray(),'Camera follow retains its exact unshaken orientation');
}
shake.update(0,[impact]);const beforeReset=camera.position.clone(),rotationBeforeReset=camera.quaternion.clone();shake.apply(camera).reset(camera);
assert.deepEqual(camera.position,beforeReset);assert.deepEqual(camera.quaternion.toArray(),rotationBeforeReset.toArray());assert.equal(shake.strength,0);assert.equal(shake.impulses.length,0);

const reduced=new ImpactShake({reduced:true});reduced.update(0,[impact]).apply(camera);
assert.equal(reduced.strength,0);assert.deepEqual(camera.position,beforeReset);assert.deepEqual(camera.quaternion.toArray(),rotationBeforeReset.toArray());
shake.update(0,[impact]).apply(camera);shake.reduced=true;shake.update(1/60,[impact]);assert.deepEqual(camera.position,beforeReset);assert.deepEqual(camera.quaternion.toArray(),rotationBeforeReset.toArray());assert.equal(shake.strength,0,'Enabling reduced motion also removes an already applied kick');
console.log('Volcanic camera shake: large nearby ground impacts only, size/speed/distance attenuation, bounded bursts, short frame-independent decay, exact restore through follow/rebasing, unchanged FOV and reduced motion passed.');
