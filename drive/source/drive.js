import {puddleAt,puddleHeight} from './mud-puddles.mjs';
import {MudPuddles} from './puddle-view.mjs';
import {OceanRecovery,beachRecoveryPose} from './ocean-recovery.mjs';
import {TrailNarrator} from './trail-narrator.mjs';
import {TrailCoach} from './trail-coach.mjs';
import {lavaCrossingProfile} from './lava-crossing.mjs';
import {VehicleWetness} from './vehicle-wetness.mjs';
import {RoadsideStories} from './roadside-view.mjs';
import {StuckRecovery} from './unstuck.mjs';
import {RolloverRecovery,checkpointPose} from './rollover.mjs';
import {LavaCrossingView} from './lava-crossing-view.mjs';
import {MeadowWildlife} from './meadow-wildlife.mjs';
import {VolcanoHazards} from './volcano-hazards.mjs';
import {LANDMARKS,BIOMES,LOOP_LENGTH,VOLCANO,routeSample,biomeWeather,riverZ,waterExists} from './expedition.mjs';
import {ExpeditionMap} from './expedition-map.mjs';
import {MountainDetails} from './mountain-details.mjs';
import {VolcanoView} from './volcano-view.mjs';
import {RiverView} from './river-view.mjs';
import {CoastalAtmosphere} from './coastal-atmosphere.mjs';
import {VehicleSnow} from './vehicle-snow.mjs';
import {VehicleLights} from './vehicle-lights.mjs';
import {WeatherView} from './weather-view.mjs';
import {createWeatherUI} from './weather-ui.mjs';
import {createDriveIntro} from './drive-intro.mjs';
import {createPauseMenu} from './pause-menu.mjs';
import {createHudMenu} from './hud-menu.mjs';
import {PowerAntenna} from './antenna.mjs';
import {createMusic} from './music.mjs';
import {createKeyboardControls,drivingInput} from './keyboard.mjs';
import {CameraOrbit} from './camera-orbit.mjs';
import {createTouchControls} from './touch-controls.mjs';
import {createSound} from './sound.mjs';
import * as THREE from 'three/webgpu';
import {positionLocal,mix,color,smoothstep,pass,renderOutput} from 'three/tsl';
import {fxaa} from 'three/addons/tsl/display/FXAANode.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Recovery} from './recovery.mjs';
import {RecoveryView} from './recovery-view.mjs';
import {RANGES} from './drivetrain.mjs';
import {DrivePhysics,wheelLayout} from './physics.mjs';
import {SandField,baseHeight,shore,smooth,clamp,surfaceAt} from './terrain.mjs';
import {TerrainView} from './terrain-view.mjs';
import {Ocean} from './ocean.mjs';
import {WaypointRoute,WAYPOINT_COUNT} from './waypoints.mjs';
import {WaypointView} from './waypoint-view.mjs';
import {BeachObstacles} from './obstacles.mjs';
import {SunsetClouds} from './clouds.mjs';
import {BeachLife} from './beach-life.mjs';
import {SurfaceEffects} from './surface-effects.mjs';
import {createWheelWaterState,sampleWheelWater} from './wheel-water.mjs';
const previewMode=new URLSearchParams(location.search).get('preview')==='1';
if(previewMode)document.documentElement.classList.add('preview-mode');
let previewActive=false;
const $=id=>document.getElementById(id),canvas=$('view'),mobile=matchMedia('(pointer:coarse)').matches||innerWidth<700,reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
if(parent!==window)$('exit').hidden=true;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,1500),field=new SandField();
let renderer,scenePass,renderPipeline,physics,terrain,obstacles,hazards,truck,antenna,vehicleLights,vehicleSnow,vehicleWetness,recovery,recoveryView,wheels=[],paused=false,loaded=false,dead=false,last=0,accumulator=0,elapsed=0,frameCount=0,cruise=false,started=false,quipUntil=0,camYaw=0,recoveryCamera=0,lastStamp=[],waterCenter=Infinity,aimHeight=null;
const cameraOrbit=new CameraOrbit();
const keys=new Set(),temp=new THREE.Vector3(),dummy=new THREE.Object3D(),q=new THREE.Quaternion();
const soundtrack=previewMode?{pause(){},dispose(){}}:createMusic($('music'),()=>canvas.focus({preventScroll:true}),{onPower:on=>{antenna?.power(on,{speed:physics?.speed??0,recovering:recovery?.state!=='roof'});if(on)say('Rusty: Raising the antenna. A three-second flex from 2004.')}});
const audio=previewMode?{pause(){},update(){},dispose(){}}:createSound($('sound'),()=>canvas.focus({preventScroll:true}),(on,load)=>soundtrack.setEffectsMix(on,load));
if(!previewMode)audio.pause(true);
const intro=previewMode?null:createDriveIntro($('drive-intro'),$('intro-start'),{onStart:()=>{started=true;setPaused(false)},onExit:exit});
const pauseMenu=createPauseMenu($('paused'),{onResume:()=>setPaused(false)});
const oceanRecovery=new OceanRecovery(),trailNarrator=new TrailNarrator();
const trailCoach=new TrailCoach();let trailHint=null,trailHintKey='',trailSampleAt=-Infinity;
let roadsideBrakeNotice=-Infinity;
let trailReading={gradeAhead:0,gradeCurrent:0,rocky:0};
const unstuck=new StuckRecovery();let unstuckResets=0;
const rollover=new RolloverRecovery();let respawnBrake=0,rolloverResets=0;
const route=new WaypointRoute(),waypointView=new WaypointView(scene,route,field);
const expeditionMap=new ExpeditionMap($('map'),{overviewCanvas:$('route-map')}),mapDialog=$('route-dialog');let resumeAfterMap=false;
const touchControls=createTouchControls({joystick:$('joystick'),knob:$('joystick-knob'),ebrake:$('ebrake'),enabled:()=>loaded&&started&&!paused&&!previewMode&&!mapDialog.open,onChange:state=>{if(state.gas||state.reverse||state.handbrake)cancelCruise()}}),touch=touchControls.state;
const hudMenu=createHudMenu($('hud-menu'),$('hud-options'),{onOpen:()=>{keys.clear();touchControls.reset();cancelCruise()}});
function say(s){$('quip').textContent=s;quipUntil=elapsed+9}
function shiftInput(){const {gas,reverse,cruise:cruising}=drivingInput(keys,touch,cruise);return {gas,reverse,cruise:cruising}}
function showTrailHint(hint){
 const key=hint?`${hint.id}|${hint.body}`:'';trailHint=hint;
 if(key===trailHintKey)return;trailHintKey=key;
 const panel=$('trail-tip');if(!hint&&panel.contains(document.activeElement))canvas.focus({preventScroll:true});panel.hidden=!hint;$('game').classList.toggle('has-trail-tip',!!hint);
 canvas.dataset.trailHint=hint?.id||'';
 if(hint){$('trail-tip-title').textContent=hint.title;$('trail-tip-body').textContent=hint.body}
 const targets=new Set(hint?.targets||[]);
 document.querySelector('button[data-range="LO"]').classList.toggle('suggested-control',targets.has('range'));
 $('center-lock').classList.toggle('suggested-control',targets.has('lock'));
 $('recover').classList.toggle('suggested-control',targets.has('boards'));
}
$('trail-tip-dismiss').addEventListener('click',()=>{trailCoach.dismiss();showTrailHint(null);canvas.focus({preventScroll:true})});
function updateTrailHint(dt,p,f,contacts,maxSlip,region){
 const blocked=previewMode||!started||paused||physics.roadsideSafety.active||antenna?.holding||!$('radio-panel').hidden||!$('weather-panel').hidden;
 if(!blocked&&elapsed>=trailSampleAt){
  // Sample a short approach, not every frame or the whole route. Local bumps
  // are filtered by the coach's sustained-grade threshold and hysteresis.
  trailSampleAt=elapsed+.25;const length=Math.hypot(f.x,f.z)||1,dx=f.x/length,dz=f.z/length;
  const near={x:p.x+dx*2,z:p.z+dz*2},ahead={x:p.x+dx*8,z:p.z+dz*8};
  const h0=field.height(p.x,p.z),h2=field.height(near.x,near.z),h8=field.height(ahead.x,ahead.z);
  const approach=surfaceAt(ahead.x,ahead.z),lava=lavaCrossingProfile(ahead.x,ahead.z);
  trailReading={gradeCurrent:(h2-h0)/2,gradeAhead:(h8-h2)/6,
   rocky:Math.max(region.river*region.trail,approach.river*approach.trail,(lava?.causeway||0)*(lava?.influence||0))};
 }
 showTrailHint(trailCoach.update(dt,{...trailReading,...shiftInput(),speed:physics.speed,range:physics.range,
  centerLocked:physics.centerLocked,slip:maxSlip,stuck:physics.stuck||unstuck.visible,
  recoveryState:recovery?.state,grounded:contacts>0||(unstuck.visible&&Math.abs(physics.rb.linvel().y)<.3),blocked}));
}

function chooseRange(range){if(!loaded||paused||previewMode)return;if(!physics.setRange(range,shiftInput())){say('Rusty: Lift off the gas and turn off cruise to change range. Gravity can keep doing its thing.');return}cancelCruise();document.querySelectorAll('button[data-range]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.range===range)));$('range-note').textContent=range==='LO'?'LOW SPEED · MORE TORQUE':'HIGH RANGE · CRUISING';$('cruise').title=range==='LO'?'Gentle crawl at about 3 mph':'Gentle cruise at about 8 mph';say(range==='LO'?'Rusty: Low range. More grunt. Less hurry. Soft sand still gets a vote.':'Rusty: High range. Back to beach speed.');canvas.focus({preventScroll:true})}
for(const b of document.querySelectorAll('button[data-range]'))b.addEventListener('click',()=>chooseRange(b.dataset.range));
function toggleCenterLock(){
 if(!loaded||paused||previewMode)return;
 const locked=!physics.centerLocked;
 if(!physics.setCenterLock(locked,shiftInput())){say('Rusty: Lift off the gas and turn off cruise to switch the center lock. Rolling is fine.');canvas.focus({preventScroll:true});return;}
 cancelCruise();$('center-lock').setAttribute('aria-pressed',String(locked));$('center-lock').textContent=locked?'CENTER LOCK · ON':'CENTER LOCK · OFF';
 say(locked?'Rusty: Front and rear now working together. Someone in this vehicle should.':'Rusty: Center unlocked. A little less argument in the corners.');canvas.focus({preventScroll:true});
}
$('center-lock').addEventListener('click',toggleCenterLock);
function deployBoards(){if(!loaded||paused)return;cancelCruise();const result=recovery.deploy();if(result==='ok'){unstuck.dismiss();showUnstuck(false);say('Rusty: Orange boards. Finally, a sensible impulse purchase. Lock the center and ease forward in 4LO.');}else if(result==='moving')say('Rusty: Slow to a crawl first. The boards are not a high-speed delivery service.');else if(result==='tilted')say('Rusty: Boards are not a rotisserie. Tip it over and we’ll return you to the last checkpoint.');else say('Rusty: Boards are down. Ease forward, then they’ll return to the rack.');canvas.focus({preventScroll:true})}
$('recover').addEventListener('click',deployBoards);
function showUnstuck(visible){
 const panel=$('unstuck-help');
 if(panel.hidden===!visible)return;
 const focused=panel.contains(document.activeElement);
 panel.hidden=!visible;
 if(!visible&&focused)canvas.focus({preventScroll:true});
 canvas.dataset.unstuck=String(visible);
}
$('unstuck-reset').addEventListener('click',()=>{
 if(!loaded||paused||previewMode||!unstuck.visible)return;
 unstuckResets++;reset(false);sync(1/60);mapDraw(physics.position(),true);
 canvas.dataset.unstuckResets=String(unstuckResets);
 say('Rusty: Back at '+route.checkpoint().name+'. The rock has agreed not to press charges.');
 canvas.focus({preventScroll:true});
});
$('unstuck-dismiss').addEventListener('click',()=>{unstuck.dismiss();showUnstuck(false);canvas.focus({preventScroll:true})});

function cancelCruise(){cruise=false;$('cruise').setAttribute('aria-pressed','false');$('cruise').textContent='Cruise'}
$('cruise').addEventListener('click',()=>{cruise=!cruise;$('cruise').setAttribute('aria-pressed',String(cruise));$('cruise').textContent=cruise?'Cruise on':'Cruise';canvas.focus({preventScroll:true})});
// Graphic sunset palette: dark violet overhead, coral horizon, amber dunes and blue surf.
const skyMat=new THREE.MeshBasicNodeMaterial({side:THREE.BackSide,depthWrite:false,fog:false,toneMapped:false});const sy=positionLocal.y.div(1200);skyMat.colorNode=mix(mix(color('#ed8a75'),color('#f2ad79'),smoothstep(-.03,.025,sy)),color('#49355e'),smoothstep(.015,.30,sy));const sky=new THREE.Mesh(new THREE.SphereGeometry(1200,32,20),skyMat);sky.renderOrder=-20;scene.add(sky);scene.fog=new THREE.Fog('#d59388',180,520);
const sun=new THREE.Mesh(new THREE.SphereGeometry(25,40,24),new THREE.MeshBasicMaterial({color:'#ffe3a0',fog:false}));sun.renderOrder=-10;scene.add(sun);
const hemi=new THREE.HemisphereLight('#a498ca','#855063',1.7);scene.add(hemi);const light=new THREE.DirectionalLight('#ffd39d',2.1);light.castShadow=true;light.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);Object.assign(light.shadow.camera,{left:-20,right:20,top:20,bottom:-20,near:1,far:220});light.shadow.bias=-.0002;light.shadow.normalBias=.035;scene.add(light,light.target);
const ocean=new Ocean(scene,{mobile});
const river=new RiverView(scene,ocean);
const puddles=new MudPuddles(scene,{ocean,mobile,reduced});
const volcano=new VolcanoView(scene,{mobile,reduced});
const lavaCrossing=new LavaCrossingView(scene,{mobile,reduced});
const wildlife=new MeadowWildlife(scene,field,{mobile,reduced});
const clouds=new SunsetClouds(scene,{reduced});
const weatherView=new WeatherView({scene,skyMat,sun,hemi,light,ocean,clouds,mobile,reduced});
const weatherUI=previewMode?null:createWeatherUI(state=>weatherView.set(state));
function waterUpdate(p,t){ocean.update(p,t,physics.origin);river.update(physics.origin);volcano.update(t,physics.origin);lavaCrossing.update(t,physics.origin);puddles.update(p,physics.origin,t,weatherView.state.rain)}
let weatherTick=-1;
function expeditionWeather(p){if(!previewMode&&weatherUI?.expedition&&elapsed>=weatherTick){weatherView.set(biomeWeather(p.x,p.z));weatherTick=elapsed+.35;}}
// Recent tread prints add fine detail on top of the physically displaced terrain.
const trackMax=7000,trackMesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(.32,.18),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.24,depthWrite:false,side:THREE.DoubleSide}),trackMax);trackMesh.count=0;trackMesh.setColorAt(0,new THREE.Color('#654638'));trackMesh.frustumCulled=false;scene.add(trackMesh);let trackCount=0;
function printAt(p,heading){if(surfaceAt(p.x,p.z).grass>.3)return;const ox=physics.origin.x,oz=physics.origin.z,h=field.height(p.x,p.z);const slopeX=(field.height(p.x+.2,p.z)-field.height(p.x-.2,p.z))/.4,slopeZ=(field.height(p.x,p.z+.2)-field.height(p.x,p.z-.2))/.4;dummy.position.set(p.x-ox,h+.018,p.z-oz);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(-slopeX,1,-slopeZ).normalize());dummy.rotateZ(heading);dummy.scale.set(1,1,1);dummy.updateMatrix();const slot=trackCount++%trackMax;trackMesh.setMatrixAt(slot,dummy.matrix);const s=surfaceAt(p.x,p.z);trackMesh.setColorAt(slot,new THREE.Color(s.snow>.4?'#96b0c5':s.mud>.4?'#29231f':'#654638'));trackMesh.instanceColor.needsUpdate=true;trackMesh.count=Math.min(trackCount,trackMax);trackMesh.instanceMatrix.needsUpdate=true}
const sampleWaterHeight=(x,z,t)=>{const level=ocean.height(x,z,t);return puddleAt(x,z)?Math.max(level,puddleHeight(x,z,field.height(x,z))):level;};
const effects=new SurfaceEffects(scene,field,{mobile,waterHeight:sampleWaterHeight});
const waterContactState=createWheelWaterState();
const beachLife=new BeachLife(scene,{mobile,reduced});
const roadside=new RoadsideStories(scene,{mobile,reduced});
const mountainDetails=new MountainDetails(scene,{mobile,reduced});beachLife.ridgeRocks=mountainDetails.rocks;beachLife.lavaRocks=lavaCrossing.rocks;
const atmosphere=new CoastalAtmosphere(scene,field,{mobile,reduced});

function mergeRigid(group){group.updateWorldMatrix(true,true);const inv=group.matrixWorld.clone().invert(),sets=new Map(),remove=[];group.traverse(o=>{if(!o.isMesh)return;let g=o.geometry.clone();g=g.index?g.toNonIndexed():g;for(const name of Object.keys(g.attributes))if(!['position','normal',...(o.material.map?['uv']:[])].includes(name))g.deleteAttribute(name);g.applyMatrix4(inv.clone().multiply(o.matrixWorld));const key=o.material.uuid;if(!sets.has(key))sets.set(key,{mat:o.material,geos:[]});sets.get(key).geos.push(g);remove.push(o)});for(const o of remove)o.removeFromParent();for(const v of sets.values()){const mesh=new THREE.Mesh(mergeGeometries(v.geos),v.mat);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh)}}
function reset(announce=true,customPose=null){
 oceanRecovery.reset();trailNarrator.resetContext();trailCoach.resetContext();trailSampleAt=-Infinity;showTrailHint(null);vehicleWetness?.reset();unstuck.reset();showUnstuck(false);hazards?.reset();wildlife.reset();recovery?.clear();cancelCruise();rollover.reset();respawnBrake=.55;accumulator=0;
 antenna?.restore(camera);if(antenna){antenna.shot=false;antenna.blend=0;}
 const pose=customPose??checkpointPose(route,(x,z)=>field.height(x,z)),z=previewMode?0:pose.z,x=previewMode?shore(z)+18:pose.x;
 terrain.prepareSpawn(x,z);beachLife.refresh({x,z},physics.origin);mountainDetails.refresh({x,z},physics.origin);lavaCrossing.update(elapsed,physics.origin);obstacles.refresh(beachLife);
 physics.reset(x,z,previewMode?field.height(x,z):pose.height);const yaw=pose.yaw;
 physics.rb.setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)},true);
 route.resetTracking();cameraOrbit.reset();keys.clear();touchControls.reset();lastStamp=[];effects.clear();ocean.clear();aimHeight=null;recoveryCamera=0;camYaw=yaw;weatherTick=-1;
 camera.position.set(x-physics.origin.x+Math.sin(yaw)*11+Math.cos(yaw)*4,(previewMode?field.height(x,z):pose.height)+4,z-physics.origin.z+Math.cos(yaw)*11-Math.sin(yaw)*4);weatherView.resetMotion(camera);
 if(announce)say('Rusty: Back at the last checkpoint. Rubber side down this time.');
}

function maybeRebase(){const p=physics.rb.translation();if(Math.abs(p.x)<512&&Math.abs(p.z)<512)return;const x=Math.round(p.x/32)*32,z=Math.round(p.z/32)*32;physics.rebase(x,z);camera.position.x-=x;camera.position.z-=z;weatherView.rebase(x,z);terrain.rebase();beachLife.refresh(physics.position(),physics.origin);mountainDetails.refresh(physics.position(),physics.origin);lavaCrossing.update(elapsed,physics.origin);obstacles.refresh(beachLife);trackCount=trackMesh.count=0;}
function sync(dt){antenna?.restore(camera);const p=physics.position(),local=physics.rb.translation(),rot=physics.rb.rotation();q.set(rot.x,rot.y,rot.z,rot.w);truck.position.set(local.x,local.y,local.z);truck.quaternion.copy(q);truck.translateY(-.70);const f=physics.forward(),heading=Math.atan2(-f.x,-f.z);wheels.forEach((w,i)=>{const length=physics.vehicle.wheelSuspensionLength(i)??.50;w.susp.position.y=.70+.06-length;w.steer.rotation.y=wheelLayout[i].front?physics.steer:0;w.roll.rotation.x=-physics.tyres[i].angle;});
 expeditionWeather(p);if(loaded)vehicleSnow?.update(dt,weatherView.state);vehicleLights?.update(dt,weatherView.state.altitude,physics.lighting,weatherView.state);ocean.updateVehicleLights(vehicleLights);if(vehicleLights)Object.assign(canvas.dataset,{headlights:String(vehicleLights.state.dark),brakeLights:String(vehicleLights.state.braking),reverseLights:String(vehicleLights.state.reversing)});
 recoveryView?.update();$('recover').textContent=recovery?.state==='roof'?'Boards ↓':recovery?.state==='stowing'?'Packing…':recovery?.state==='ground'?'Reposition boards':'Placing boards…';$('recover').setAttribute('aria-disabled',String(recovery?.state==='deploying'||recovery?.state==='stowing'));
 for(const mark of physics.marks.splice(0)){
  if(sampleWaterHeight(mark.x,mark.z,elapsed)>field.height(mark.x,mark.z)+.025)continue;
  effects.emit(mark,heading,physics.speed,elapsed);printAt(mark,heading);
 }
 sampleWheelWater(physics,sampleWaterHeight,elapsed,waterContactState);
 vehicleWetness?.update(dt,weatherView.state,waterContactState,physics.origin,physics.rb.linvel(),elapsed);
 Object.assign(canvas.dataset,{vehicleWetness:(vehicleWetness?.state.amount??0).toFixed(2),vehicleDrips:String(vehicleWetness?.stats.drips??0)});
 for(const mark of waterContactState.marks)if(mark.active)effects.emit(mark,heading,physics.speed,elapsed);
 for(const mark of waterContactState.marks)if(mark.active&&waterExists(mark.x,mark.z))ocean.disturb(mark,physics.speed,heading,elapsed);

 const recoveryFocus=!reduced&&!cameraOrbit.active&&(recovery?.state==='deploying'||(recovery?.state==='ground'&&Math.abs(physics.speed)<.5));recoveryCamera+=((recoveryFocus?1:0)-recoveryCamera)*(1-Math.exp(-dt*2));
 let delta=Math.atan2(Math.sin(heading-camYaw),Math.cos(heading-camYaw));camYaw+=delta*(1-Math.exp(-dt*2));const vista=previewMode?0:smooth(40,100,p.y)*(1-recoveryCamera),fov=48+vista*16;if(Math.abs(camera.fov-fov)>.03){camera.fov+=(fov-camera.fov)*(1-Math.exp(-dt*2));camera.updateProjectionMatrix()}const narrow=innerWidth<700,dist=(previewMode?9.5:narrow?13.5:10.5)*(1-recoveryCamera)+2*recoveryCamera+vista*5.5,lateral=(previewMode?2:narrow?.5:3.7)*(1-recoveryCamera)*(1-vista*.6)+(narrow?15.5:8)*recoveryCamera;const orbitOffset=cameraOrbit.offset(camYaw,dist,lateral,(previewMode?2.8:narrow?4.1:3.3)-vista*.8);temp.set(local.x+orbitOffset.x,local.y+orbitOffset.y,local.z+orbitOffset.z);temp.y=Math.max(temp.y,field.height(temp.x+physics.origin.x,temp.z+physics.origin.z)+2);camera.position.lerp(temp,1-Math.exp(-dt*(reduced?12:4)));camera.position.y=Math.max(camera.position.y,field.height(camera.position.x+physics.origin.x,camera.position.z+physics.origin.z)+1.2);const aim=(previewMode?1:3+vista*21)*(1-recoveryCamera)+.45*recoveryCamera;aimHeight??=local.y+1;aimHeight+=(local.y+1+vista*10-aimHeight)*(1-Math.exp(-dt*(reduced?12:2.4)));camera.lookAt(local.x+f.x*aim*(1-cameraOrbit.blend),aimHeight*(1-cameraOrbit.blend)+(local.y+1)*cameraOrbit.blend,local.z+f.z*aim*(1-cameraOrbit.blend));Object.assign(canvas.dataset,{cameraYaw:cameraOrbit.yaw.toFixed(3),cameraPitch:cameraOrbit.pitch.toFixed(3),cameraManual:String(cameraOrbit.active)});antenna?.camera(camera,field,physics.origin);sky.position.copy(camera.position);sun.position.copy(camera.position).add(new THREE.Vector3(-430,105,-650));light.position.set(local.x-60,local.y+75,local.z-65);light.target.position.set(local.x,local.y,local.z);
 $('game').classList.toggle('driving',physics.travel>8);$('speed').textContent=Math.round(Math.abs(physics.speed)*2.237);const d=p.x-shore(p.z),maxSlip=Math.max(...physics.tyres.map(w=>w.slip)),contacts=[0,1,2,3].filter(i=>physics.vehicle.wheelIsInContact(i)).length;$('surface').textContent=physics.roadsideSafety.active?'AUTO BRAKE · GIVE THEM SPACE':physics.stuck?'BOGGED · EASE OFF':contacts===0?'AIRBORNE':d<6?'SHALLOWS':maxSlip>1.2&&Math.abs(physics.speed)<1?'WHEELSPIN':physics.range==='LO'?'4LO · LOW RANGE':d>43?'4HI · SOFT SAND':'4HI · FIRM SAND';Object.assign(canvas.dataset,{renderer:renderer.backend.isWebGPUBackend?'webgpu':'webgl2',speed:physics.speed.toFixed(2),distance:physics.travel.toFixed(1),ruts:String(field.stamps),depth:field.deepest.toFixed(3),contacts:String(contacts),worldZ:p.z.toFixed(1),fps:String(Math.round(1/Math.max(.001,dt))),height:p.y.toFixed(2),tiles:String(terrain.tiles.size),terrain:'sand-relief-2',water:'coastal-clean-1',waterImpulses:String(ocean.wake.impulses),waterDisplacement:ocean.wake.peak.toFixed(3),physics:'rapier-rigid-body',bumpSupport:String(Math.round(physics.bumpSupport||0)),bodyRoll:(Math.atan2(2*(rot.w*rot.z+rot.x*rot.y),1-2*(rot.x*rot.x+rot.z*rot.z))*180/Math.PI).toFixed(1),model:'meshy-radio-1',radio:String(soundtrack.powered??false),antenna:(antenna?.extension??0).toFixed(2),radioCamera:(antenna?.blend??0).toFixed(2),range:physics.range,centerLocked:String(physics.centerLocked),centerTransfer:physics.centerTransfer.toFixed(1),axleSlip:physics.axleSlip.toFixed(3),slip:maxSlip.toFixed(2),wheelRpm:(Math.max(...physics.tyres.map(w=>Math.abs(w.omega)))*60/(Math.PI*2)).toFixed(1),stuck:String(physics.stuck),spray:String(effects.stats.sand),dust:String(effects.stats.dust),powder:String(effects.stats.powder),splashes:String(effects.stats.splash),spraySheets:String(effects.stats.sheet),waterContact:waterContactState.contact.toFixed(2),waterDepth:waterContactState.depth.toFixed(2),rain:weatherView.state.rain.toFixed(2),snow:weatherView.state.snow.toFixed(2),precipitation:'weather-motion-1',checkpoint:route.checkpoint().name,rolloverResets:String(rolloverResets),rolloverTilt:rollover.tippedFor.toFixed(2),wake:String(effects.stats.wake),effects:'tire-spray-1',scenery:'coastal-physics-1',colliders:String(obstacles.colliders.length),clouds:String(clouds.parts.length),grass:String(beachLife.stats.grass),driftwood:String(beachLife.stats.logs),rocks:String(beachLife.stats.rocks),debris:String(beachLife.stats.wrack),boats:String(beachLife.stats.boats),recovery:recovery?.state||'roof',recoveries:String(recovery?.recoveries||0),suspension:[0,1,2,3].map(i=>physics.vehicle.wheelSuspensionLength(i).toFixed(3)).join(',')});
 const target=route.target();if(!previewMode&&route.update(p,{grounded:contacts>0,groundHeight:field.height(target.x,target.z)})){say(target.biome==='volcanic'&&target.name==='Definitely not Home Depot'?'Rusty: Active volcano. Still less heated than the conversation about keeping this truck.':route.passed%WAYPOINT_COUNT===0?'Rusty: Expedition complete. Same beach. Significantly worse laundry. Another lap?':`${target.name} reached. Next: ${route.target().name}.`)}
 const guidance=route.guidance(p,heading),next=route.target(),region=surfaceAt(p.x,p.z),biome=BIOMES[region.biome];
 updateTrailHint(dt,p,f,contacts,maxSlip,region);
 $('waypoint-name').textContent=next.name.toUpperCase();$('waypoint-distance').textContent=`${Math.round(guidance.distance)} m`;$('waypoint-arrow').style.transform=`rotate(${-guidance.angle}rad)`;
 $('mission').textContent=`${next.leg} / ${WAYPOINT_COUNT} · ${biome.name} · Lap ${Math.floor(route.passed/WAYPOINT_COUNT)+1}`;
 if(!physics.roadsideSafety.active&&!physics.stuck&&contacts>0&&region.biome!=='beach'&&region.biome!=='dunes')$('surface').textContent=biome.name;
 Object.assign(canvas.dataset,{biome:region.biome,expedition:'volcano-ascent-1',waypoint:String(next.leg),waypointsPassed:String(route.passed),waypointDistance:guidance.distance.toFixed(1)});

 waypointView.refresh(physics.origin);beachLife.update(p,elapsed,physics.origin,weatherView.state,heading,false);mountainDetails.update(p,physics.origin,elapsed);const roadsideQuip=roadside.update(p,physics.origin,elapsed,!previewMode&&!trailHint&&elapsed>quipUntil);if(roadsideQuip)say(roadsideQuip);canvas.dataset.roadsideStories=String(roadside.stats.visible);atmosphere.update(p,elapsed,physics.origin,camera,weatherView.state);wildlife.update(p,elapsed,physics.origin,camera,weatherView.state,{speed:physics.speed,heading,grounded:contacts>0&&!previewMode});hazards?.update(p,elapsed,physics.origin,camera,weatherView.state);Object.assign(canvas.dataset,{grassBirds:String(wildlife.stats.birds),fireflies:String(wildlife.stats.fireflies),volcanicRocks:String(hazards?.stats.rocks||0),volcanicEmbers:String(hazards?.stats.embers||0),volcanicSmoke:String(hazards?.stats.smoke||0),volcanicImpacts:String(hazards?.stats.impacts||0),lavaCrossing:'basalt-crawl-1',visibility:scene.fog.far.toFixed(0),lighting:'dramatic-expedition-1'});Object.assign(canvas.dataset,{gulls:String(atmosphere.stats.gulls),windSand:String(atmosphere.stats.sand),atmosphere:"coastal-life-1"});return p;
}
function mapDraw(p,force=false){
 if(previewMode)return;const f=physics.forward(),heading=Math.atan2(-f.x,-f.z);
 if(!expeditionMap.draw(p,heading,route,{overview:mapDialog.open,force}))return;
 const target=route.target(),distance=Math.hypot(target.x-p.x,target.z-p.z),label=distance>=1000?(distance/1000).toFixed(1)+' km':Math.round(distance)+' m';
 $('map-leg').textContent=String(target.leg).padStart(2,'0')+' / '+WAYPOINT_COUNT;
 $('map-next-name').textContent=target.name;$('map-next-distance').textContent=label;
 $('route-summary').textContent='Next: '+target.name+' · '+label+' · Stop '+target.leg+' of '+WAYPOINT_COUNT+' · Lap '+(Math.floor(route.passed/WAYPOINT_COUNT)+1);
}
function openMap(){if(!loaded||!started||previewMode||mapDialog.open)return;resumeAfterMap=!paused;setPaused(true,{menu:false});mapDialog.showModal();mapDraw(physics.position(),true);}
$('map-open').addEventListener('click',openMap);$('map').addEventListener('click',openMap);
$('map-close').addEventListener('click',()=>mapDialog.close());
mapDialog.addEventListener('close',()=>{if(resumeAfterMap&&!document.hidden){setPaused(false);$('map-open').focus({preventScroll:true})}else setPaused(true);resumeAfterMap=false;});
function setPaused(value,{menu=true}={}){hudMenu.close();if(!loaded||(!previewMode&&!started))return;if(previewMode){paused=value;canvas.dataset.previewPaused=String(value);last=performance.now();accumulator=0;return}if(value&&mapDialog.open)resumeAfterMap=false;paused=value;if(value){trailCoach.suppress();showTrailHint(null)}showUnstuck(!value&&unstuck.visible);soundtrack.pause(value);if(value)cancelCruise();if(value&&menu&&!mapDialog.open)pauseMenu.open();else pauseMenu.close();keys.clear();touchControls.reset();document.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));last=performance.now();accumulator=0;if(!value)canvas.focus({preventScroll:true});audio.pause(value)}
function resize(){touchControls.reset();camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer?.setSize(innerWidth,innerHeight);if(loaded)mapDraw(physics.position(),true)}
function exit(){if(parent!==window)parent.postMessage({type:'lc100:drive-close'},location.origin);else location.href='../#test-drive'}
$('exit').addEventListener('click',exit);$('pause').addEventListener('click',()=>setPaused(true));$('resume').addEventListener('click',()=>setPaused(false));$('reset').addEventListener('click',()=>{reset();setPaused(false)});
const keyboard=createKeyboardControls({keys,state:()=>({loaded:loaded&&(previewMode||started),paused,preview:previewMode||mapDialog.open}),focus:()=>canvas.focus({preventScroll:true}),cancelCruise,pause:setPaused,range:()=>chooseRange(physics.range==='HI'?'LO':'HI'),recover:deployBoards,lock:toggleCenterLock,look:code=>{cameraOrbit.nudge(code);if(antenna)antenna.shot=false;},recenter:()=>{cameraOrbit.recenter();if(antenna)antenna.shot=false;}});
addEventListener('keydown',keyboard.keydown);addEventListener('keyup',keyboard.keyup);addEventListener('blur',()=>{keys.clear();touchControls.reset();if(loaded&&!previewMode)setPaused(true)});document.addEventListener('visibilitychange',()=>{if(document.hidden)setPaused(true)});addEventListener('resize',resize);

async function init(){try{
 // Single-sample scene depth permits volume occlusion; output FXAA keeps edges smooth.
 renderer=new THREE.WebGPURenderer({canvas,antialias:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,previewMode?1:mobile?1.2:1.6));renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;await renderer.init();scenePass=pass(scene,camera,{samples:0});renderPipeline=new THREE.RenderPipeline(renderer,fxaa(renderOutput(scenePass)));renderPipeline.outputColorTransform=false;intro?.progress(5,'Found the keys. Giving gravity a job.','Starting the drive…');physics=await DrivePhysics.create(field);physics.waterHeight=(x,z)=>sampleWaterHeight(x,z,elapsed);intro?.progress(10,'Getting the truck off the driveway…','Loading the truck…');terrain=new TerrainView(scene,physics,field);obstacles=new BeachObstacles(physics);hazards=new VolcanoHazards(scene,physics,field,{mobile,reduced});$('load-status').textContent='Shaping dunes. Reconsidering the driveway.';
 const ec=document.createElement('canvas');ec.width=512;ec.height=256;const ex=ec.getContext('2d'),eg=ex.createLinearGradient(0,0,0,256);eg.addColorStop(0,'#574b7e');eg.addColorStop(.42,'#ce96a7');eg.addColorStop(.5,'#ffd19a');eg.addColorStop(.57,'#c37c65');eg.addColorStop(1,'#63475d');ex.fillStyle=eg;ex.fillRect(0,0,512,256);const et=new THREE.CanvasTexture(ec);et.mapping=THREE.EquirectangularReflectionMapping;et.colorSpace=THREE.SRGBColorSpace;const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromEquirectangular(et).texture;scene.environmentIntensity=.6;pmrem.dispose();et.dispose();
 intro?.progress(15,'Getting the truck off the driveway…','Loading the truck…');const gltf=await new GLTFLoader().loadAsync('lc100.glb?v=radio-1',event=>{if(event.total>0)intro?.progress(15+20*event.loaded/event.total,`Truck download: ${Math.floor(100*event.loaded/event.total)}%.`,'Loading the truck…')});intro?.progress(35,'Packing the recovery boards. Optimism only gets you so far.','Packing the boards…');truck=gltf.scene;scene.add(truck);antenna=new PowerAntenna(truck,{reduced});for(const w of wheelLayout){const susp=truck.getObjectByName('Susp_'+w.name),st=truck.getObjectByName('Steer_'+w.name),roll=truck.getObjectByName('Roll_'+w.name);wheels.push({susp,steer:st,roll});mergeRigid(roll)}mergeRigid(truck.getObjectByName('Body'));vehicleLights=new VehicleLights(truck,{mobile,reduced});vehicleWetness=new VehicleWetness(scene,truck,{mobile,reduced,groundHeight:(x,z)=>field.height(x,z),waterHeight:sampleWaterHeight});vehicleSnow=new VehicleSnow(truck);recovery=new Recovery(physics);const boards=await new GLTFLoader().loadAsync('traction-board.glb?v=recovery-1',event=>{if(event.total>0)intro?.progress(35+3*event.loaded/event.total,undefined,'Packing the boards…')});intro?.progress(38,'Shaping dunes. Reconsidering your confidence.','Building the route…');recoveryView=new RecoveryView(scene,truck,boards.scene,recovery);reset(false);for(let i=0;i<240;i++)physics.step(1/120,{turn:0,brake:true});if(!previewMode){physics.rb.setLinvel({x:0,y:0,z:0},true);physics.rb.setAngvel({x:0,y:0,z:0},true);physics.speed=0;}physics.soundEvents.length=0;sync(1);waterUpdate(physics.position(),0);terrain.animate(0);clouds.update(camera,0);mapDraw(physics.position());if(!previewMode)weatherView.update(10,camera,physics.rb.translation(),renderer);intro?.progress(40,'Downloads done. Getting the scene ready.','Preparing the expedition…');await new Promise(requestAnimationFrame);const warmup=[puddles.mesh,vehicleWetness.drops,...roadside.meshes,roadside.smoke,wildlife.birds,wildlife.fireflies,atmosphere.inlandMist,hazards.rocks,hazards.embers,hazards.smoke].map(mesh=>({mesh,visible:mesh.visible,count:mesh.count}));for(const entry of warmup){entry.mesh.visible=true;entry.mesh.count=1;}try{await renderer.compileAsync(scene,camera,null,event=>{if(event.total>0)intro?.progress(40+55*event.loaded/event.total,`${event.loaded} of ${event.total} scene pieces ready.`,'Preparing the expedition…')});}finally{for(const entry of warmup){entry.mesh.visible=entry.visible;entry.mesh.count=entry.count}}intro?.busy('Drawing the first frame…','One last look before we give you the keys.');await new Promise(requestAnimationFrame);loaded=true;$('loading').hidden=true;if(previewMode){paused=!previewActive;renderPipeline.render();parent.postMessage({type:'lc100:preview-ready'},location.origin)}else{paused=true;weatherView.update(10,camera,physics.rb.translation(),renderer);renderPipeline.render();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));intro.ready();}last=performance.now();renderer.setAnimationLoop(frame);
 }catch(e){intro?.fail();console.error('Beach drive initialization failed',e);$('load-status').textContent='This browser couldn’t start the 3D drive. Try a recent browser with graphics acceleration enabled.';document.querySelector('.loadline').hidden=true;const b=document.createElement('button');b.className='primary';b.textContent='Back to the truck';b.addEventListener('click',exit);$('loading').append(b)}}
function frame(now){if(dead)return;const dt=Math.min(.06,(now-last)/1000);last=now;if(paused)return;elapsed+=dt;frameCount++;cameraOrbit.update(dt,keys,{enabled:!previewMode});const input=drivingInput(keys,touch,cruise);antenna?.update(dt,{driving:!!(input.gas||input.reverse||input.brake||input.handbrake||input.turn),recovering:recovery?.state!=='roof'});if(antenna?.holding){input.brake=true;input.cruise=false;}if(input.reverse||input.brake||input.handbrake){cancelCruise();input.cruise=false}if(respawnBrake>0&&!previewMode){respawnBrake=Math.max(0,respawnBrake-dt);Object.assign(input,{gas:false,reverse:false,turn:0,cruise:false,handbrake:false,brake:true})}const p=physics.position();if(previewMode){const f=physics.forward(),heading=Math.atan2(-f.x,-f.z),desired=Math.atan2(-(shore(p.z-15)+18-p.x),15),error=Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading));input.turn=clamp(error*2.4,-1,1);input.cruise=true;}terrain.update(p.x,p.z);beachLife.stream(p,physics.origin);mountainDetails.stream(p,physics.origin);obstacles.refresh(beachLife);accumulator+=dt;let steps=0;while(accumulator>=1/120&&steps++<8){physics.step(1/120,input);accumulator-=1/120}const safety=physics.roadsideSafety;canvas.dataset.proximityBrake=String(safety.active);canvas.dataset.proximityScene=safety.scene||'';if(safety.active){cancelCruise();input.gas=0;input.reverse=0;input.cruise=false;input.handbrake=false;input.brake=true;if(!previewMode&&elapsed>roadsideBrakeNotice){say('Rusty: Auto brake. They already have car trouble. They don’t need you. Reverse or steer around.');roadsideBrakeNotice=elapsed+18;}}const afterStep=physics.position();if(!previewMode&&oceanRecovery.update(dt,{position:afterStep,waterHeight:ocean.height(afterStep.x,afterStep.z,elapsed),groundHeight:field.height(afterStep.x,afterStep.z)})){const pose=beachRecoveryPose(afterStep,(x,z)=>field.height(x,z)),quip=oceanRecovery.message();reset(false,pose);Object.assign(input,{gas:false,reverse:false,turn:0,cruise:false,handbrake:false,brake:true});say(quip);canvas.dataset.oceanRescues=String(oceanRecovery.rescues);}if(!previewMode&&rollover.update(dt,physics.rb.rotation())){rolloverResets++;reset(false);Object.assign(input,{gas:false,reverse:false,turn:0,cruise:false,handbrake:false,brake:true});say('Rusty: That was the roof. Back to '+route.checkpoint().name+'. Rubber side down.');}if(!previewMode)showUnstuck(unstuck.update(dt,{position:physics.position(),velocity:physics.rb.linvel(),input,blocked:physics.roadsideSafety.active||recovery?.state==='deploying'||recovery?.state==='stowing'||antenna?.holding}));maybeRebase();const pos=sync(dt);if(frameCount%8===0)terrain.refresh();waterUpdate(pos,elapsed);ocean.updateWheelFoam(dt,physics,elapsed);terrain.animate(elapsed);clouds.update(camera,elapsed);if(!previewMode)weatherView.update(dt,camera,physics.rb.translation(),renderer);if(frameCount%5===0)mapDraw(pos);effects.update(dt,camera,physics.origin,elapsed);const impacts=[...physics.soundEvents.splice(0),...(hazards?.drainImpacts()||[])];if(!previewMode){const observation=trailNarrator.update(dt,{biome:surfaceAt(pos.x,pos.z).biome,stuck:physics.stuck||unstuck.visible,waterContact:waterContactState.contact,speed:physics.speed,rain:weatherView.state.rain,impacts,canSpeak:!trailHint&&elapsed>quipUntil});if(observation)say(observation);}audio.update({impacts,speed:physics.speed,tyres:physics.tyres,range:physics.range,input,shoreDistance:pos.x-shore(pos.z),waterContact:waterContactState.contact,waterDepth:waterContactState.depth,rain:weatherView.state.rain});renderPipeline.render()}
addEventListener('message',event=>{if(!previewMode||event.source!==parent||event.origin!==location.origin||event.data?.type!=='lc100:preview-active')return;previewActive=event.data.active===true&&!document.hidden;setPaused(!previewActive)});
addEventListener('pagehide',()=>{dead=true;hudMenu.dispose();touchControls.dispose();intro?.dispose();vehicleSnow?.dispose();vehicleWetness?.dispose();vehicleLights?.dispose();weatherUI?.dispose();weatherView.dispose();atmosphere.dispose();soundtrack.dispose();renderer?.setAnimationLoop(null);hazards?.dispose();wildlife.dispose();obstacles?.dispose();terrain?.dispose();physics?.dispose();clouds.dispose();lavaCrossing.dispose();volcano.dispose();river.dispose();puddles.dispose();ocean.dispose();effects.dispose();roadside.dispose();mountainDetails.dispose();beachLife.dispose();waypointView.dispose();renderPipeline?.dispose();scenePass?.dispose();renderer?.dispose();audio.dispose()},{once:true});init();
