import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {WeatherView} from './weather-view.mjs';

const fixtures=[];
const epsilon=4e-5;
function close(actual,expected,message,tolerance=epsilon){
 assert(Math.abs(actual-expected)<=tolerance,`${message}: ${actual} versus ${expected}`);
}
function sameVector(actual,expected,message,tolerance=epsilon){
 for(const axis of ['x','y','z'])close(actual[axis],expected[axis],`${message} (${axis})`,tolerance);
}
function fixture({mobile=false,reduced=false,cameraPosition=new THREE.Vector3()}={}){
 const scene=new THREE.Scene();scene.fog=new THREE.Fog('#aaa',30,200);scene.environmentIntensity=.5;
 const camera=new THREE.PerspectiveCamera();camera.position.copy(cameraPosition);
 const sun=new THREE.Object3D();sun.material={color:new THREE.Color()};
 const skyMat=new THREE.MeshBasicNodeMaterial();
 const ocean={skyTop:{value:new THREE.Color()},skyHorizon:{value:new THREE.Color()},sunColor:{value:new THREE.Color()},sunDirection:{value:new THREE.Vector3()},brightness:{value:1},waveScale:{value:1}};
 const clouds={setCover(){},mesh:{material:{color:new THREE.Color()},count:0},wind:0};
 const view=new WeatherView({scene,skyMat,sun,hemi:new THREE.HemisphereLight(),light:new THREE.DirectionalLight(),ocean,clouds,mobile,reduced});
 view.set({altitude:20,cloud:.4,wind:0,rain:1,snow:1,fog:false});
 // Identical samples make moving and stationary cameras directly comparable.
 for(let i=0;i<view.count;i++)view.seeds[i]=[((i*7)%31+.5)/31,((i*11)%31+.5)/31,((i*17)%31+.5)/31];
 view.resetMotion(camera);
 view.update(1/60,camera,{x:0,y:0,z:0});
 for(let i=0;i<view.count;i++)for(const offsets of [view.rainOffsets,view.snowOffsets])offsets.set([4+(i%7)*.1,8+(i%5)*.1,-7+(i%3)*.1],i*3);
 const result={view,camera,skyMat,step(dt=1/60,truck={x:0,y:0,z:0}){view.update(dt,camera,truck)}};
 fixtures.push(result);return result;
}
function rainPoint(f,index=0){return new THREE.Vector3().fromArray(f.view.positions,index*6).add(f.view.precip.position)}
function snowPoint(f,index=0){const m=new THREE.Matrix4();f.view.snowflakes.getMatrixAt(index,m);return new THREE.Vector3().setFromMatrixPosition(m).add(f.view.snowflakes.position)}
function rainLength(f,index=0){const p=f.view.positions,o=index*6;return Math.hypot(p[o+3]-p[o],p[o+4]-p[o+1],p[o+5]-p[o+2])}
function snowSize(f){const m=new THREE.Matrix4();f.view.snowflakes.getMatrixAt(0,m);return new THREE.Vector3().setFromMatrixScale(m).length()}
function sameParticles(a,b,label,worldShift=new THREE.Vector3()){
 for(let i=0;i<4;i++){
  sameVector(rainPoint(a,i).add(worldShift),rainPoint(b,i),`${label}: rain ${i}`);
  sameVector(snowPoint(a,i).add(worldShift),snowPoint(b,i),`${label}: snow ${i}`);
 }
}

try{
 // Camera translation must change apparent motion without dragging particles through the world.
 for(const dz of [-.75,.75]){
  const moving=fixture(),still=fixture(),dt=.05;
  moving.camera.position.z+=dz;moving.step(dt);still.step(dt);
  sameParticles(moving,still,'Travel preserves world particle positions');
  close(moving.view.rainOffsets[2]-still.view.rainOffsets[2],-dz,'Rain moves opposite camera travel');
  close(moving.view.snowOffsets[2]-still.view.snowOffsets[2],-dz,'Snow moves opposite camera travel');
  const headMinusTail=moving.view.positions[2]-moving.view.positions[5];
  assert(headMinusTail*-dz>0,'Rain streaks point along apparent motion during forward and reverse travel');
  sameVector(moving.view.precip.position,moving.camera.position,'Rain volume follows the camera');
  sameVector(moving.view.snowflakes.position,moving.camera.position,'Snow volume follows the camera');
 }
 {
  const moving=fixture(),still=fixture();
  moving.camera.position.set(.7,.3,-.5);moving.step(.05);still.step(.05);
  sameParticles(moving,still,'Horizontal and vertical camera movement preserves world continuity');
 }
 {
  const movingTruck=fixture(),stillTruck=fixture();
  movingTruck.step(.05,{x:120,y:15,z:-80});stillTruck.step(.05);
  sameParticles(movingTruck,stillTruck,'Moving the truck alone does not drag precipitation');
 }
 {
  const rotated=fixture(),still=fixture();
  rotated.camera.rotation.set(.2,1.3,-.1);rotated.step(.05);still.step(.05);
  sameParticles(rotated,still,'Rotating the camera does not rotate the weather volume');
 }
 {
  const origin=new THREE.Vector3(510,6,180),rebased=fixture({cameraPosition:origin}),control=fixture({cameraPosition:origin});
  for(const f of [rebased,control]){f.camera.position.z-=.5;f.step(.05)}
  const dx=512,dz=192;
  rebased.view.rebase(dx,dz);rebased.camera.position.x-=dx;rebased.camera.position.z-=dz;
  for(const f of [rebased,control]){f.camera.position.z-=.5;f.step(.05)}
  sameParticles(rebased,control,'Origin rebasing preserves world continuity',new THREE.Vector3(dx,0,dz));
  sameVector(rebased.view.cameraVelocity,control.view.cameraVelocity,'Rebasing preserves genuine camera velocity');
 }
 {
  const reset=fixture(),control=fixture();
  for(const f of [reset,control]){f.camera.position.z-=.6;f.step(.05)}
  assert(reset.view.cameraVelocity.length()>0,'The reset check starts with real camera motion');
  reset.camera.position.set(1300,70,-800);reset.view.resetMotion(reset.camera);control.view.resetMotion(control.camera);
  reset.step(.05);control.step(.05);
  sameParticles(reset,control,'Explicit resets preserve local precipitation distribution',control.camera.position.clone().sub(reset.camera.position));
  close(reset.view.cameraVelocity.length(),0,'Reset clears streak velocity');
  close(reset.view.cameraDelta.length(),0,'Reset does not become apparent particle travel');
 }
 {
  const cut=fixture(),control=fixture();
  cut.camera.position.set(14,2,-9);cut.step(1/60);control.step(1/60);
  sameParticles(cut,control,'A camera cut does not fling precipitation',control.camera.position.clone().sub(cut.camera.position));
  close(cut.view.cameraVelocity.length(),0,'Camera cuts clear streak velocity');
  cut.camera.position.x+=.8;cut.step(10);
  close(cut.view.cameraVelocity.length(),0,'Lighting warmup and long gaps do not create streak velocity');
  assert([...cut.view.positions].every(Number.isFinite),'Long updates retain finite rain geometry');
  assert([...cut.view.snowflakes.instanceMatrix.array].every(Number.isFinite),'Long updates retain finite snow transforms');
 }
 {
  const thirty=fixture(),sixty=fixture();
  for(const [f,hz] of [[thirty,30],[sixty,60]]){
   f.view.set({...f.view.state,wind:35});
   for(let frame=0;frame<hz/2;frame++){
    f.camera.position.set(3*(frame+1)/hz,.2*(frame+1)/hz,-5*(frame+1)/hz);f.step(1/hz);
   }
  }
  sameParticles(thirty,sixty,'Rain and snow travel equally at 30 and 60 FPS');
 }
 {
  const f=fixture(),lengths=[],sizes=[];
  for(const depth of [0,-1.2,-4]){
   f.view.rainOffsets.set([0,0,depth],0);f.view.snowOffsets.set([0,0,depth],0);f.step(1e-7);
   lengths.push(rainLength(f));sizes.push(snowSize(f));
  }
  close(lengths[0],0,'Rain at the lens collapses');close(sizes[0],0,'Snow at the lens disappears');
  assert(lengths[1]>lengths[0]&&lengths[2]>lengths[1],'Rain fades into view away from the lens');
  assert(sizes[1]>sizes[0]&&sizes[2]>sizes[1],'Snow fades into view away from the lens');
 }
 for(const mobile of [false,true])for(const reduced of [false,true]){
  const f=fixture({mobile,reduced}),v=f.view;
  assert.equal(v.count,mobile?700:1500,'Mobile keeps its existing smaller particle pool');
  const buffers=[v.positions,v.rainOffsets,v.snowOffsets,v.precip.geometry.attributes.position.array,v.snowflakes.instanceMatrix.array];
  v.set({...v.state,wind:60,rain:.64,snow:.35});
  for(let i=0;i<60;i++){f.camera.position.add(new THREE.Vector3(1,.1,-.8));f.step(1/30)}
  assert.equal(v.precip.visible,!reduced);assert.equal(v.snowflakes.visible,!reduced);
  if(!reduced){
   assert.equal(v.precip.geometry.drawRange.count,Math.round(v.count*.64)*2,'Rain intensity retains its bounded draw count');
   assert.equal(v.snowflakes.count,Math.round(v.count*.58*.35),'Snow intensity retains its bounded instance count');
   for(let i=0;i<v.precip.geometry.drawRange.count/2;i++)assert(rainLength(f,i)<=2.8001,'Fast travel never produces a screen-spanning rain streak');
  }
  for(const offsets of [v.rainOffsets,v.snowOffsets])for(let i=0;i<offsets.length;i+=3){
   assert(offsets[i]>=-18&&offsets[i]<=18&&offsets[i+2]>=-18&&offsets[i+2]<=18,'Horizontal recycling stays within the weather volume');
   assert(offsets[i+1]>=-8&&offsets[i+1]<=16,'Vertical recycling stays within the weather volume');
  }
  for(const [index,buffer] of [v.positions,v.rainOffsets,v.snowOffsets,v.precip.geometry.attributes.position.array,v.snowflakes.instanceMatrix.array].entries())assert.equal(buffer,buffers[index],'Driving reuses the fixed precipitation buffers');
 }
 console.log('Precipitation motion: world continuity, forward/reverse travel, camera rotation, reset/cut/rebase, frame independence, near-camera fading, bounded pools and reduced motion passed.');
}finally{
 for(const {view,skyMat} of fixtures){view.dispose();skyMat.dispose()}
}
