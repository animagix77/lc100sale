import {canyonAmbience} from './canyon-rapids.mjs';
import {CanyonBridgeView} from './canyon-bridge-view.mjs';
import {OpeningCinematic} from './opening-cinematic.mjs';
import {RearAxleView,FordDepthMarkers} from './expedition-details.mjs';
import {CampState,campPlacement} from './camp.mjs';
import {CampView} from './camp-view.mjs';
import {createJourneyUI,readJourney,saveJourney,campReadiness} from './journey-ui.mjs';
import {CAMP} from './expedition.mjs';
import {LavaRecovery} from './lava-recovery.mjs';
import {VehicleFire} from './vehicle-fire.mjs';
import {DrivingMessages} from './driving-messages.mjs';
import {TrailHintDisplay} from './trail-hint-display.mjs';
import {LoosePebbles} from './loose-pebbles.mjs';
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
import {LavaAtmosphere} from './lava-atmosphere.mjs';
import {bloom} from 'three/addons/tsl/display/BloomNode.js';
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
import {createTouchCamera} from './touch-camera.mjs';
import {ImpactShake} from './impact-shake.mjs';
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
import {fitTyreVisual} from './tyre-fit.mjs';
import {DrivePhysics,wheelLayout,RAPIER} from './physics.mjs';
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
let renderer,scenePass,renderPipeline,lavaBloom,plainOutput,glowOutput,bloomActive=false,physics,bridgeView,terrain,obstacles,hazards,pebbles,truck,antenna,vehicleLights,vehicleSnow,vehicleWetness,recovery,recoveryView,wheels=[],paused=false,loaded=false,dead=false,last=0,accumulator=0,elapsed=0,frameCount=0,cruise=false,started=false,camYaw=0,recoveryCamera=0,lastStamp=[],waterCenter=Infinity,aimHeight=null;
const messages=new DrivingMessages();
const cameraOrbit=new CameraOrbit(),impactShake=new ImpactShake({reduced:reduced||previewMode});
const keys=new Set(),temp=new THREE.Vector3(),dummy=new THREE.Object3D(),q=new THREE.Quaternion();
const soundtrack=previewMode?{pause(){},dispose(){}}:createMusic($('music'),()=>canvas.focus({preventScroll:true}),{onPower:on=>{antenna?.power(on,{speed:physics?.speed??0,recovering:!!recovery?.pending||recovery?.state!=='roof'});if(on)say('Rusty: Raising the antenna. A three-second flex from 2004.')}});
const audio=previewMode?{pause(){},update(){},dispose(){}}:createSound($('sound'),()=>canvas.focus({preventScroll:true}),(on,load)=>soundtrack.setEffectsMix(on,load));
if(!previewMode)audio.pause(true);
function openingFinished(){keys.clear();touchControls.reset();touchCamera.reset();respawnBrake=.55;accumulator=0;cameraOrbit.reset();weatherView.resetMotion(camera);last=performance.now();canvas.focus({preventScroll:true});say(savedJourney?route.complete?'Welcome back to Sunset camp. Your shelter and route choices are saved.':'Welcome back. Continuing from '+route.checkpoint().name+'.':$('quip').textContent);if(!route.complete)journeyUI?.open();}
const opening=previewMode?null:new OpeningCinematic({camera,onFinish:openingFinished});
function playOpening(resumed=!!savedJourney){started=true;setPaused(false);const origin={...physics.origin};if(!opening?.start({anchor:physics.rb.translation(),forward:physics.forward(),resumed,reduced,heightAt:(x,z)=>field.height(x+origin.x,z+origin.z),waterAt:(x,z)=>sampleWaterHeight(x+origin.x,z+origin.z,elapsed)}))openingFinished();}
const intro=previewMode?null:createDriveIntro($('drive-intro'),$('intro-start'),{onStart:()=>playOpening(),onExit:exit});
const pauseMenu=createPauseMenu($('paused'),{onResume:()=>setPaused(false)});
const oceanRecovery=new OceanRecovery(),trailNarrator=new TrailNarrator();
const trailCoach=new TrailCoach(),trailHintDisplay=new TrailHintDisplay();let trailHint=null,trailHintKey='',trailSampleAt=-Infinity;
let roadsideBrakeNotice=-Infinity;
let trailReading={gradeAhead:0,gradeCurrent:0,rocky:0};
const unstuck=new StuckRecovery();let unstuckResets=0;
const lavaRecovery=new LavaRecovery(),vehicleFire=new VehicleFire(scene,{mobile,reduced});
const rollover=new RolloverRecovery();let respawnBrake=0,rolloverResets=0;
const route=new WaypointRoute(),waypointView=new WaypointView(scene,route,field);
let rearAxle;const fordMarkers=new FordDepthMarkers(scene);
const camp=new CampState(),campView=new CampView(scene,field,{reduced});let hoodCamera=false,campCollider=null,hintExpanded=null,hintSince=0;
const savedJourney=previewMode?null:readJourney();if(savedJourney&&route.restore(savedJourney.route))camp.restore(savedJourney.camp);
function persistJourney(){if(!previewMode&&!saveJourney(route,camp))say('Checkpoint reached. This browser could not save it for your next visit.');}
function campNear(){const p=physics.position();return route.complete&&Math.hypot(p.x-CAMP.x,p.z-CAMP.z)<30;}
function campBlocked(x,y,z){let hit=false;physics.world.intersectionsWithShape({x:x-physics.origin.x,y:y+1,z:z-physics.origin.z},{x:0,y:0,z:0,w:1},new RAPIER.Cuboid(2.3,.9,2.3),c=>{if(obstacles?.has(c))hit=true;return !hit});return hit;}
function updateCampCollider(){if(campCollider){physics.world.removeCollider(campCollider,true);campCollider=null}if(camp.tent){const p=camp.tent;campCollider=physics.world.createCollider(RAPIER.ColliderDesc.cuboid(1.8,.95,1.8).setTranslation(p.x-physics.origin.x,p.y+.95,p.z-physics.origin.z).setRotation({x:0,y:Math.sin(p.yaw/2),z:0,w:Math.cos(p.yaw/2)}).setFriction(.6));}}
function beginCampPlacement(){if(!campNear()||Math.abs(physics.speed)>1){say('Park in the Sunset camp clearing before pitching your shelter.');return}cancelCruise();keys.clear();touchControls.reset();camp.begin(camp.tent?{...camp.tent}:{x:CAMP.x+7,z:CAMP.z+3,yaw:0});}
const journeyUI=previewMode?null:createJourneyUI({route,camp,onPause:()=>setPaused(true,{menu:false}),onResume:resume=>setPaused(!resume),context:()=>({paused,camp:campReadiness({complete:route.complete,distance:Math.hypot(physics.position().x-CAMP.x,physics.position().z-CAMP.z),speed:physics.speed,tent:!!camp.tent,fire:camp.fire})}),onSave:()=>{persistJourney();waypointView.key='';if(loaded)mapDraw(physics.position(),true)},onPlace:beginCampPlacement,onConfirm:()=>{camp.result=campPlacement(camp.candidate,{heightAt:(x,z)=>field.height(x,z),waterAt:(x,z)=>sampleWaterHeight(x,z,elapsed),vehicle:physics.position(),obstructed:campBlocked});if(campNear()&&camp.confirm()){updateCampCollider();persistJourney();say('Shelter pitched. The fire ring is ready when you are.');}},onCancel:()=>camp.cancel(),onRotate:()=>{if(camp.candidate)camp.candidate.yaw+=Math.PI/6;},onFire:()=>{if(!campNear()){say('Return to Sunset camp to tend the fire.');return}camp.fire=!camp.fire;persistJourney();},onCamera:on=>{hoodCamera=on;cameraOrbit.reset();},onRestart:()=>{route.next=route.passed=0;route.choices={};route.revision++;camp.tent=null;camp.fire=false;camp.cancel();updateCampCollider();persistJourney();reset(false);playOpening(false);}});
const campRay=new THREE.Raycaster();
canvas.addEventListener('pointerdown',event=>{if(!camp.placing||paused)return;const rect=canvas.getBoundingClientRect();campRay.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);for(let d=1;d<100;d+=.25){const point=campRay.ray.at(d,new THREE.Vector3());const x=point.x+physics.origin.x,z=point.z+physics.origin.z;if(point.y<=field.height(x,z)){camp.candidate={x,z,yaw:camp.candidate.yaw};break}}});
const expeditionMap=new ExpeditionMap($('map'),{overviewCanvas:$('route-map')}),mapDialog=$('route-dialog');let resumeAfterMap=false;
const touchControls=createTouchControls({joystick:$('joystick'),knob:$('joystick-knob'),ebrake:$('ebrake'),enabled:()=>loaded&&started&&!paused&&!previewMode&&!mapDialog.open&&!camp.placing,onChange:state=>{if(state.gas||state.reverse||state.handbrake)cancelCruise()}}),touch=touchControls.state;
const touchCamera=createTouchCamera({canvas,orbit:cameraOrbit,enabled:()=>loaded&&started&&!paused&&!previewMode&&!mapDialog.open&&!camp.placing,onDrag:()=>{canvas.focus({preventScroll:true});if(antenna)antenna.shot=false;}});
const hudMenu=createHudMenu($('hud-menu'),$('hud-options'),{onOpen:()=>{keys.clear();touchControls.reset();touchCamera.reset();cancelCruise()}});
function say(s,options){if(messages.say(s,elapsed,options))$('quip').textContent=messages.text}
function shiftInput(){const {gas,reverse,cruise:cruising}=drivingInput(keys,touch,cruise);return {gas,reverse,cruise:cruising}}
function showTrailHint(hint){
 const changed=trailHint?.id!==hint?.id,key=hint?`${hint.id}|${hint.title}|${hint.body}|${hint.targets.join(",")}`:'';trailHint=hint;
 if(key===trailHintKey)return;trailHintKey=key;if(changed){hintSince=elapsed;hintExpanded=null;}
 const panel=$('trail-tip');if(!hint&&panel.contains(document.activeElement))canvas.focus({preventScroll:true});panel.hidden=!hint;$('game').classList.toggle('has-trail-tip',!!hint);
 canvas.dataset.trailHint=hint?.id||'';
 if(hint){if($('trail-tip-title').textContent!==hint.title)$('trail-tip-title').textContent=hint.title;if($('trail-tip-body').textContent!==hint.body)$('trail-tip-body').textContent=hint.body;}
 const targets=new Set(hint?.targets||[]);
 document.querySelector('button[data-range="LO"]').classList.toggle('suggested-control',targets.has('range'));
 $('center-lock').classList.toggle('suggested-control',targets.has('lock'));
 $('recover').classList.toggle('suggested-control',targets.has('boards'));
}
$('trail-tip-title').setAttribute('tabindex','0');$('trail-tip-title').setAttribute('role','button');$('trail-tip-title').setAttribute('aria-label','Expand or collapse driving advice');
function toggleHint(){hintExpanded=$('trail-tip').classList.contains('hint-compact');}
$('trail-tip-title').addEventListener('click',toggleHint);$('trail-tip-title').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleHint();}});
$('trail-tip-dismiss').addEventListener('click',()=>{trailCoach.dismiss(trailHintDisplay.hint?.id);trailHintDisplay.clear();showTrailHint(null);canvas.focus({preventScroll:true})});
function updateTrailHint(dt,p,f,contacts,maxSlip,region){
 const blocked=previewMode||!started||paused||lavaRecovery.burning||physics.roadsideSafety.active||antenna?.holding||!$('radio-panel').hidden||!$('weather-panel').hidden;
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
 const candidate=trailCoach.update(dt,{...trailReading,...shiftInput(),speed:physics.speed,range:physics.range,
  centerLocked:physics.centerLocked,slip:maxSlip,stuck:physics.stuck||unstuck.visible,
  recoveryState:recovery?.state,grounded:contacts>0||(unstuck.visible&&Math.abs(physics.rb.linvel().y)<.3),blocked});
 showTrailHint(trailHintDisplay.update(candidate,dt,{blocked,range:physics.range,centerLocked:physics.centerLocked,recoveryState:recovery?.pending?'deploying':recovery?.state}));
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
let recoveryNoticeUntil=0,recoveryNoticeKey='';
function syncRecoveryNotice(){
 const key=recovery?.result||'',panel=$('recovery-status');
 const text={bridge:'Boards need firm ground. Cross to a bank, or return to the last checkpoint.',braking:'Braking to place boards…',ok:'Placing four boards…',placing:'Placing four boards…',ready:'Boards down. Select 4LO and ease forward.',tilted:'Truck too tilted. Return to your checkpoint.',unsettled:'Couldn’t settle. Brake or reposition, then tap Boards.',packing:'Packing the boards…',packed:'Boards back on the roof.',already:'Boards are being placed or packed.'}[key]||'';
 if(key!==recoveryNoticeKey){recoveryNoticeKey=key;recoveryNoticeUntil=elapsed+30;panel.textContent=text;}
 panel.hidden=!text||(!recovery?.pending&&recovery?.state!=='deploying'&&elapsed>=recoveryNoticeUntil);
}
function deployBoards(){
 if(!loaded||paused||lavaRecovery.burning)return;
 cancelCruise();keys.clear();touchControls.reset();
 const result=recovery.request();recoveryNoticeKey='';
 if(result==='ok'||result==='braking'){unstuck.dismiss();showUnstuck(false);say(result==='braking'?'Rusty: Braking for the boards. We’ll place them as soon as the truck slows.':'Rusty: Placing four boards. Select 4LO, lock the center and ease forward once they’re down.');}
 else if(result==='bridge')say('Boards need firm ground. Cross to a bank, or return to the last checkpoint.');
 else if(result==='tilted')say('Rusty: The truck is too tilted for boards. Return to the last checkpoint.');
 syncRecoveryNotice();canvas.focus({preventScroll:true});
}
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
const hemi=new THREE.HemisphereLight('#a498ca','#855063',1.7);scene.add(hemi);const light=new THREE.DirectionalLight('#ffd39d',2.1);light.castShadow=true;light.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);Object.assign(light.shadow.camera,{left:-32,right:32,top:32,bottom:-32,near:1,far:220});light.shadow.radius=mobile?3:6;light.shadow.intensity=.70;light.shadow.bias=-.0002;light.shadow.normalBias=.035;scene.add(light,light.target);
const ocean=new Ocean(scene,{mobile});
const river=new RiverView(scene,ocean);
const puddles=new MudPuddles(scene,{ocean,mobile,reduced});
const volcano=new VolcanoView(scene,{mobile,reduced});
const lavaCrossing=new LavaCrossingView(scene,{mobile,reduced});
const lavaAtmosphere=new LavaAtmosphere(scene,volcano.flowPoints,{mobile,reduced});
const wildlife=new MeadowWildlife(scene,field,{mobile,reduced});
const clouds=new SunsetClouds(scene,{reduced});
const weatherView=new WeatherView({scene,skyMat,sun,hemi,light,ocean,clouds,mobile,reduced});
const weatherUI=previewMode?null:createWeatherUI(state=>weatherView.set(state));
function waterUpdate(p,t){ocean.update(p,t,physics.origin);river.update(physics.origin);volcano.update(t,physics.origin);lavaCrossing.update(t,physics.origin);lavaAtmosphere.update(t,physics.origin,camera);if(lavaBloom){const strength=1-smooth(260,340,Math.hypot(p.x-VOLCANO.x,p.z-VOLCANO.z));lavaBloom.strength.value=strength*.34;const active=strength>.001&&!previewMode;if(active!==bloomActive){bloomActive=active;renderPipeline.outputNode=active?glowOutput:plainOutput;renderPipeline.needsUpdate=true;}}puddles.update(p,physics.origin,t,weatherView.state.rain)}
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
 camp.cancel();touchCamera.reset();impactShake.reset(camera);oceanRecovery.reset();lavaRecovery.reset();vehicleFire.clear();$('lava-warning').hidden=true;trailNarrator.resetContext();trailCoach.resetContext();trailHintDisplay.clear();trailSampleAt=-Infinity;showTrailHint(null);vehicleWetness?.reset();unstuck.reset();showUnstuck(false);hazards?.reset();wildlife.reset();recovery?.clear();cancelCruise();rollover.reset();respawnBrake=.55;accumulator=0;
 antenna?.restore(camera);if(antenna){antenna.shot=false;antenna.blend=0;}
 const pose=customPose??checkpointPose(route,(x,z)=>field.height(x,z)),z=previewMode?0:pose.z,x=previewMode?shore(z)+18:pose.x;
 terrain.prepareSpawn(x,z);beachLife.refresh({x,z},physics.origin);mountainDetails.refresh({x,z},physics.origin);lavaCrossing.update(elapsed,physics.origin);obstacles.refresh(beachLife);
 physics.reset(x,z,previewMode?field.height(x,z):pose.height);const yaw=pose.yaw;
 physics.rb.setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)},true);
 route.resetTracking();messages.clear();cameraOrbit.reset();keys.clear();touchControls.reset();lastStamp=[];effects.clear();ocean.clear();aimHeight=null;recoveryCamera=0;camYaw=yaw;weatherTick=-1;
 camera.position.set(x-physics.origin.x+Math.sin(yaw)*11+Math.cos(yaw)*4,(previewMode?field.height(x,z):pose.height)+4,z-physics.origin.z+Math.cos(yaw)*11-Math.sin(yaw)*4);weatherView.resetMotion(camera);
 if(announce)say('Rusty: Back at the last checkpoint. Rubber side down this time.');
}

function maybeRebase(){const p=physics.rb.translation();if(Math.abs(p.x)<512&&Math.abs(p.z)<512)return;const x=Math.round(p.x/32)*32,z=Math.round(p.z/32)*32;physics.rebase(x,z);camera.position.x-=x;camera.position.z-=z;weatherView.rebase(x,z);terrain.rebase();updateCampCollider();beachLife.refresh(physics.position(),physics.origin);mountainDetails.refresh(physics.position(),physics.origin);lavaCrossing.update(elapsed,physics.origin);obstacles.refresh(beachLife);trackCount=trackMesh.count=0;}
function sync(dt){bridgeView?.update(elapsed,camera);if(frameCount%30===0&&physics.bridge){const poses=physics.bridge.poses();canvas.dataset.bridgeMaxTilt=String(Math.max(...poses.map(p=>Math.acos(Math.min(1,Math.max(-1,1-2*(p.rotation.x*p.rotation.x+p.rotation.z*p.rotation.z)))))));canvas.dataset.bridgeDeckY=poses.map(p=>p.position.y.toFixed(2)).join(',');}impactShake.restore(camera);antenna?.restore(camera);const p=physics.position(),local=physics.rb.translation(),rot=physics.rb.rotation();q.set(rot.x,rot.y,rot.z,rot.w);truck.position.set(local.x,local.y,local.z);truck.quaternion.copy(q);truck.translateY(-.70);const f=physics.forward(),heading=Math.atan2(-f.x,-f.z);const rearCamber=rearAxle?.update(physics.vehicle.wheelSuspensionLength(2)??.5,physics.vehicle.wheelSuspensionLength(3)??.5)||0;wheels.forEach((w,i)=>{if(i>=2)w.steer.rotation.z=rearCamber;const length=physics.vehicle.wheelSuspensionLength(i)??.50;w.susp.position.y=.70+.06-length;w.steer.rotation.y=wheelLayout[i].front?physics.steer:0;w.roll.rotation.x=-physics.tyres[i].angle;});
 expeditionWeather(p);if(loaded)vehicleSnow?.update(dt,weatherView.state);vehicleLights?.update(dt,weatherView.state.altitude,physics.lighting,weatherView.state);ocean.updateVehicleLights(vehicleLights);if(vehicleLights)Object.assign(canvas.dataset,{headlights:String(vehicleLights.state.dark),brakeLights:String(vehicleLights.state.braking),reverseLights:String(vehicleLights.state.reversing)});
 recoveryView?.update();syncRecoveryNotice();
 // Keep the button and its label stable between pointer-down and pointer-up.
 // Rebuilding text on every animation frame can cancel clicks over the glyphs.
 const recoveryLabel=recovery?.pending?'Braking…':recovery?.state==='roof'?'Boards ↓':recovery?.state==='stowing'?'Packing…':recovery?.state==='ground'?'Reposition boards':'Placing boards…';
 const recoveryLabelNode=$('recovery-label');if(recoveryLabelNode.textContent!==recoveryLabel)recoveryLabelNode.textContent=recoveryLabel;
 const recoveryBusy=String(!!recovery?.pending||recovery?.state==='deploying'||recovery?.state==='stowing');
 if($('recover').getAttribute('aria-disabled')!==recoveryBusy)$('recover').setAttribute('aria-disabled',recoveryBusy);
 for(const mark of physics.marks.splice(0)){
  if(sampleWaterHeight(mark.x,mark.z,elapsed)>field.height(mark.x,mark.z)+.025)continue;
  effects.emit(mark,heading,physics.speed,elapsed);printAt(mark,heading);
 }
 sampleWheelWater(physics,sampleWaterHeight,elapsed,waterContactState);
 vehicleWetness?.soilUpdate(dt,physics.tyres,waterContactState);
 vehicleWetness?.update(dt,weatherView.state,waterContactState,physics.origin,physics.rb.linvel(),elapsed);
 Object.assign(canvas.dataset,{vehicleWetness:(vehicleWetness?.state.amount??0).toFixed(2),vehicleDrips:String(vehicleWetness?.stats.drips??0)});
 for(const mark of waterContactState.marks)if(mark.active)effects.emit(mark,heading,physics.speed,elapsed);
 for(const mark of waterContactState.marks)if(mark.active&&waterExists(mark.x,mark.z))ocean.disturb(mark,physics.speed,heading,elapsed);

 const recoveryFocus=!reduced&&!cameraOrbit.active&&(recovery?.state==='deploying'||(recovery?.state==='ground'&&Math.abs(physics.speed)<.5));recoveryCamera+=((recoveryFocus?1:0)-recoveryCamera)*(1-Math.exp(-dt*2));
 let delta=Math.atan2(Math.sin(heading-camYaw),Math.cos(heading-camYaw));camYaw+=delta*(1-Math.exp(-dt*2));const canyonView=(1-smooth(18,70,Math.abs(p.x-665)))*(1-smooth(45,95,Math.abs(p.z+470)));const vista=previewMode?0:smooth(40,100,p.y)*(1-recoveryCamera),fov=48+vista*16;if(Math.abs(camera.fov-fov)>.03){camera.fov+=(fov-camera.fov)*(1-Math.exp(-dt*2));camera.updateProjectionMatrix()}const narrow=innerWidth<1050&&innerHeight>innerWidth,dist=(previewMode?9.5:narrow?13.5:10.5)*(1-recoveryCamera)+2*recoveryCamera+vista*5.5,lateral=(previewMode?2:narrow?.5:3.7)*(1-recoveryCamera)*(1-vista*.6)+(narrow?15.5:8)*recoveryCamera;const orbitOffset=cameraOrbit.offset(camYaw,dist,lateral,(previewMode?2.8:narrow?4.1:3.3)-vista*.8+canyonView*3.5);temp.set(local.x+orbitOffset.x,local.y+orbitOffset.y,local.z+orbitOffset.z);temp.y=Math.max(temp.y,field.height(temp.x+physics.origin.x,temp.z+physics.origin.z)+2);camera.position.lerp(temp,1-Math.exp(-dt*(reduced?12:4)));camera.position.y=Math.max(camera.position.y,field.height(camera.position.x+physics.origin.x,camera.position.z+physics.origin.z)+1.2);const aim=(previewMode?1:3+vista*21)*(1-recoveryCamera)+.45*recoveryCamera;aimHeight??=local.y+1;aimHeight+=(local.y+1+vista*10*(1-canyonView*.9)-aimHeight)*(1-Math.exp(-dt*(reduced?12:2.4)));camera.lookAt(local.x+f.x*aim*(1-cameraOrbit.blend),aimHeight*(1-cameraOrbit.blend)+(local.y+1)*cameraOrbit.blend,local.z+f.z*aim*(1-cameraOrbit.blend));Object.assign(canvas.dataset,{cameraYaw:cameraOrbit.yaw.toFixed(3),cameraPitch:cameraOrbit.pitch.toFixed(3),cameraManual:String(cameraOrbit.active)});antenna?.camera(camera,field,physics.origin);if(hoodCamera&&!camp.placing){const eye=new THREE.Vector3(0,.85,-1.25).applyQuaternion(q).add(new THREE.Vector3(local.x,local.y,local.z));camera.position.copy(eye);const look=new THREE.Vector3(f.x,f.y,f.z).applyAxisAngle(new THREE.Vector3(0,1,0),cameraOrbit.yaw*cameraOrbit.blend);camera.lookAt(eye.x+look.x*20,eye.y+look.y*20+Math.sin(cameraOrbit.pitch*cameraOrbit.blend)*20-.25,eye.z+look.z*20);}
 if(camp.placing){camera.fov=Math.max(48,2*Math.atan((CAMP.radius+3)/(34*camera.aspect))*180/Math.PI);camera.updateProjectionMatrix();const fitHeight=34;camera.position.set(CAMP.x-physics.origin.x,field.height(CAMP.x,CAMP.z)+fitHeight,CAMP.z-physics.origin.z+fitHeight*.25);camera.lookAt(CAMP.x-physics.origin.x,field.height(CAMP.x,CAMP.z),CAMP.z-physics.origin.z+(innerWidth<700?8:0));camp.result=campPlacement(camp.candidate,{heightAt:(x,z)=>field.height(x,z),waterAt:(x,z)=>sampleWaterHeight(x,z,elapsed),vehicle:p,obstructed:campBlocked});}
 if(!camp.placing&&route.complete&&Math.hypot(p.x-CAMP.x,p.z-CAMP.z)<25&&Math.abs(physics.speed)<.25&&!hoodCamera&&!cameraOrbit.active){camera.fov=Math.max(48,2*Math.atan(13/(Math.hypot(12,17,29)*camera.aspect))*180/Math.PI);camera.updateProjectionMatrix();camera.position.set(CAMP.x-physics.origin.x+12,CAMP.height+17,CAMP.z-physics.origin.z+29);camera.lookAt(CAMP.x-physics.origin.x,CAMP.height+.5,CAMP.z-physics.origin.z);}
 $('game').classList.toggle('camp-placing',camp.placing);
 campView.root.visible=camp.placing||Math.hypot(p.x-CAMP.x,p.z-CAMP.z)<100;campView.update(camp,physics.origin,elapsed);fordMarkers.update(physics.origin);journeyUI?.update(physics);$('trail-tip').classList.toggle('hint-compact',!!trailHint&&(hintExpanded===false||(hintExpanded===null&&elapsed-hintSince>20)));$('trail-tip-title').setAttribute('aria-expanded',String(!($('trail-tip').classList.contains('hint-compact'))));
 Object.assign(canvas.dataset,{campPlacing:String(camp.placing),campTent:String(!!camp.tent),campFire:String(camp.fire),engineRpm:physics.powertrain.rpm.toFixed(0),autoGear:String(physics.powertrain.gear),routeComplete:String(route.complete),routeChoices:JSON.stringify(route.choices),fordingDepth:physics.fording.depth.toFixed(2)});
 sky.position.copy(camera.position);sun.position.copy(camera.position).add(new THREE.Vector3(-430,105,-650));light.position.set(local.x-60,local.y+75,local.z-65);light.target.position.set(local.x,local.y,local.z);
 $('game').classList.toggle('driving',physics.travel>8);$('speed').textContent=Math.round(Math.abs(physics.speed)*2.237);const d=p.x-shore(p.z),maxSlip=Math.max(...physics.tyres.map(w=>w.slip)),contacts=[0,1,2,3].filter(i=>physics.vehicle.wheelIsInContact(i)).length;$('surface').textContent=physics.roadsideSafety.active?'AUTO BRAKE · GIVE THEM SPACE':physics.stuck?'BOGGED · EASE OFF':contacts===0?'AIRBORNE':d<6?'SHALLOWS':maxSlip>1.2&&Math.abs(physics.speed)<1?'WHEELSPIN':physics.range==='LO'?'4LO · LOW RANGE':d>43?'4HI · SOFT SAND':'4HI · FIRM SAND';Object.assign(canvas.dataset,{renderer:renderer.backend.isWebGPUBackend?'webgpu':'webgl2',speed:physics.speed.toFixed(2),distance:physics.travel.toFixed(1),ruts:String(field.stamps),depth:field.deepest.toFixed(3),contacts:String(contacts),worldZ:p.z.toFixed(1),fps:String(Math.round(1/Math.max(.001,dt))),height:p.y.toFixed(2),tiles:String(terrain.tiles.size),terrain:'settled-gravel-1',water:'coastal-clean-1',waterImpulses:String(ocean.wake.impulses),waterDisplacement:ocean.wake.peak.toFixed(3),physics:'rapier-rigid-body',bumpSupport:String(Math.round(physics.bumpSupport||0)),bodyRoll:(Math.atan2(2*(rot.w*rot.z+rot.x*rot.y),1-2*(rot.x*rot.x+rot.z*rot.z))*180/Math.PI).toFixed(1),model:'meshy-radio-1',radio:String(soundtrack.powered??false),antenna:(antenna?.extension??0).toFixed(2),radioCamera:(antenna?.blend??0).toFixed(2),range:physics.range,centerLocked:String(physics.centerLocked),centerTransfer:physics.centerTransfer.toFixed(1),axleSlip:physics.axleSlip.toFixed(3),slip:maxSlip.toFixed(2),wheelRpm:(Math.max(...physics.tyres.map(w=>Math.abs(w.omega)))*60/(Math.PI*2)).toFixed(1),stuck:String(physics.stuck),spray:String(effects.stats.sand),dust:String(effects.stats.dust),powder:String(effects.stats.powder),splashes:String(effects.stats.splash),spraySheets:String(effects.stats.sheet),waterContact:waterContactState.contact.toFixed(2),waterDepth:waterContactState.depth.toFixed(2),rain:weatherView.state.rain.toFixed(2),snow:weatherView.state.snow.toFixed(2),precipitation:'weather-motion-1',checkpoint:route.checkpoint().name,rolloverResets:String(rolloverResets),rolloverTilt:rollover.tippedFor.toFixed(2),wake:String(effects.stats.wake),effects:'tire-spray-1',scenery:'coastal-physics-1',colliders:String(obstacles.colliders.length),clouds:String(clouds.parts.length),grass:String(beachLife.stats.grass),driftwood:String(beachLife.stats.logs),rocks:String(beachLife.stats.rocks),debris:String(beachLife.stats.wrack),boats:String(beachLife.stats.boats),recovery:recovery?.state||'roof',recoveryPending:String(!!recovery?.pending),recoveries:String(recovery?.recoveries||0),suspension:[0,1,2,3].map(i=>physics.vehicle.wheelSuspensionLength(i).toFixed(3)).join(',')});
 const target=route.target();if(!previewMode&&!lavaRecovery.burning&&route.update(p,{grounded:contacts>0,groundHeight:field.height(target.x,target.z)})){say(target.name==='Canyon bridge'?'Suspension bridge. Use 4LO, line up with the deck and keep a steady pace.':target.biome==='volcanic'&&target.name==='Definitely not Home Depot'?'Rusty: Active volcano. Still less heated than the conversation about keeping this truck.':route.complete?'Rusty: Sunset camp. Expedition complete. Park up, choose your tent spot and light the fire.':`${target.name} reached. Next: ${route.target().name}.`,{defer:!route.complete});persistJourney();if(route.complete)journeyUI?.open();}
 const guidance=route.guidance(p,heading),next=route.target(),region=surfaceAt(p.x,p.z),biome=BIOMES[region.biome];
 updateTrailHint(dt,p,f,contacts,maxSlip,region);
 $('waypoint-name').textContent=next.name.toUpperCase();$('waypoint-distance').textContent=`${Math.round(guidance.distance)} m`;$('waypoint-arrow').style.transform=`rotate(${-guidance.angle}rad)`;
 $('mission').textContent=route.complete?'SUNSET CAMP · EXPEDITION COMPLETE':`${next.leg} / ${WAYPOINT_COUNT} · ${biome.name}`;
 if(!physics.roadsideSafety.active&&!physics.stuck&&contacts>0&&region.biome!=='beach'&&region.biome!=='dunes')$('surface').textContent=biome.name;
 Object.assign(canvas.dataset,{biome:region.biome,expedition:'volcano-ascent-1',waypoint:String(next.leg),waypointsPassed:String(route.passed),waypointDistance:guidance.distance.toFixed(1)});

 waypointView.refresh(physics.origin);beachLife.update(p,elapsed,physics.origin,weatherView.state,heading,false);mountainDetails.update(p,physics.origin,elapsed);const roadsideQuip=roadside.update(p,physics.origin,elapsed,!previewMode&&!trailHint&&elapsed>messages.until);if(roadsideQuip)say(roadsideQuip);canvas.dataset.roadsideStories=String(roadside.stats.visible);pebbles?.update(p);Object.assign(canvas.dataset,{pebbles:String(pebbles?.stats.visible||0),pebblesMoving:String(pebbles?.stats.moving||0),pebblesDisplaced:String(pebbles?.stats.displaced||0)});atmosphere.update(p,elapsed,physics.origin,camera,weatherView.state);wildlife.update(p,elapsed,physics.origin,camera,weatherView.state);hazards?.update(p,elapsed,physics.origin,camera,weatherView.state);Object.assign(canvas.dataset,{grassBirds:String(wildlife.stats.birds),fireflies:String(wildlife.stats.fireflies),volcanicRocks:String(hazards?.stats.rocks||0),volcanicEmbers:String(hazards?.stats.embers||0),volcanicSmoke:String(hazards?.stats.smoke||0),volcanicImpacts:String(hazards?.stats.impacts||0),volcanicImpactSmoke:String(hazards?.stats.impactSmoke||0),volcanicEffects:'volcanic-impact-1',lavaCrossing:'basalt-crawl-1',visibility:scene.fog.far.toFixed(0),lighting:'dramatic-expedition-2'});Object.assign(canvas.dataset,{gulls:String(atmosphere.stats.gulls),windSand:String(atmosphere.stats.sand),atmosphere:"dramatic-air-1"});return p;
}
function mapDraw(p,force=false){
 if(previewMode)return;const f=physics.forward(),heading=Math.atan2(-f.x,-f.z);
 if(!expeditionMap.draw(p,heading,route,{overview:mapDialog.open,force}))return;
 const target=route.target(),distance=Math.hypot(target.x-p.x,target.z-p.z),label=distance>=1000?(distance/1000).toFixed(1)+' km':Math.round(distance)+' m';
 $('map-leg').textContent=String(target.leg).padStart(2,'0')+' / '+WAYPOINT_COUNT;
 $('map-next-name').textContent=target.name;$('map-next-distance').textContent=label;
 $('route-summary').textContent='Next: '+target.name+' · '+label+' · Stop '+target.leg+' of '+WAYPOINT_COUNT+(route.complete?' · Expedition complete':' · Sunset camp awaits');
}
function openMap(){if(!loaded||!started||previewMode||mapDialog.open)return;resumeAfterMap=!paused;setPaused(true,{menu:false});mapDialog.showModal();mapDraw(physics.position(),true);}
$('map-open').addEventListener('click',openMap);$('map').addEventListener('click',openMap);
$('map-close').addEventListener('click',()=>mapDialog.close());
mapDialog.addEventListener('close',()=>{if(resumeAfterMap&&!document.hidden){setPaused(false);$('map-open').focus({preventScroll:true})}else setPaused(true);resumeAfterMap=false;});
function setPaused(value,{menu=true}={}){if(value&&opening?.active)opening.finish();if(journeyUI?.dialog.open){if(value&&menu)journeyUI.suspendResume();value=true;menu=false;}hudMenu.close();if(!loaded||(!previewMode&&!started))return;if(previewMode){paused=value;canvas.dataset.previewPaused=String(value);last=performance.now();accumulator=0;return}if(value&&mapDialog.open)resumeAfterMap=false;paused=value;if(value){impactShake.reset(camera);trailCoach.suppress();showTrailHint(null)}showUnstuck(!value&&unstuck.visible);soundtrack.pause(value);if(value)cancelCruise();if(value&&menu&&!mapDialog.open)pauseMenu.open();else pauseMenu.close();keys.clear();touchControls.reset();touchCamera.reset();document.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));last=performance.now();accumulator=0;if(!value)canvas.focus({preventScroll:true});audio.pause(value)}
function resize(){touchControls.reset();camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer?.setSize(innerWidth,innerHeight);if(loaded)mapDraw(physics.position(),true)}
function exit(){if(parent!==window)parent.postMessage({type:'lc100:drive-close'},location.origin);else location.href='../#test-drive'}
$('exit').addEventListener('click',exit);$('pause').addEventListener('click',()=>setPaused(true));$('resume').addEventListener('click',()=>setPaused(false));$('reset').addEventListener('click',()=>{reset();setPaused(false)});
const keyboard=createKeyboardControls({keys,state:()=>({loaded:loaded&&(previewMode||started),paused,preview:previewMode||!!opening?.active||mapDialog.open||camp.placing||journeyUI?.dialog.open}),focus:()=>canvas.focus({preventScroll:true}),cancelCruise,pause:setPaused,range:()=>chooseRange(physics.range==='HI'?'LO':'HI'),recover:deployBoards,lock:toggleCenterLock,look:code=>{cameraOrbit.nudge(code);if(antenna)antenna.shot=false;},recenter:()=>{cameraOrbit.recenter();if(antenna)antenna.shot=false;}});
addEventListener('keydown',keyboard.keydown);addEventListener('keyup',keyboard.keyup);addEventListener('blur',()=>{keys.clear();touchControls.reset();if(loaded&&!previewMode)setPaused(true)});document.addEventListener('visibilitychange',()=>{if(document.hidden)setPaused(true)});addEventListener('resize',resize);

async function init(){try{
 // Single-sample scene depth permits volume occlusion; output FXAA keeps edges smooth.
 renderer=new THREE.WebGPURenderer({canvas,antialias:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,previewMode?1:mobile?1.2:1.6));renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;await renderer.init();scenePass=pass(scene,camera,{samples:0});const sceneColor=scenePass.getTextureNode('output');lavaBloom=bloom(sceneColor,.34,.45,2.5);lavaBloom.setResolutionScale(mobile?.25:.4);plainOutput=fxaa(renderOutput(sceneColor));glowOutput=fxaa(renderOutput(sceneColor.add(lavaBloom)));renderPipeline=new THREE.RenderPipeline(renderer,plainOutput);renderPipeline.outputColorTransform=false;intro?.progress(5,'Found the keys. Giving gravity a job.','Starting the drive…');physics=await DrivePhysics.create(field);bridgeView=new CanyonBridgeView(scene,physics,{mobile,reduced});physics.waterHeight=(x,z)=>sampleWaterHeight(x,z,elapsed);intro?.progress(10,'Getting the truck off the driveway…','Loading the truck…');terrain=new TerrainView(scene,physics,field);obstacles=new BeachObstacles(physics);pebbles=new LoosePebbles(scene,physics,field,{mobile});hazards=new VolcanoHazards(scene,physics,field,{mobile,reduced});$('load-status').textContent='Shaping dunes. Reconsidering the driveway.';
 const ec=document.createElement('canvas');ec.width=512;ec.height=256;const ex=ec.getContext('2d'),eg=ex.createLinearGradient(0,0,0,256);eg.addColorStop(0,'#574b7e');eg.addColorStop(.42,'#ce96a7');eg.addColorStop(.5,'#ffd19a');eg.addColorStop(.57,'#c37c65');eg.addColorStop(1,'#63475d');ex.fillStyle=eg;ex.fillRect(0,0,512,256);const et=new THREE.CanvasTexture(ec);et.mapping=THREE.EquirectangularReflectionMapping;et.colorSpace=THREE.SRGBColorSpace;const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromEquirectangular(et).texture;scene.environmentIntensity=.6;pmrem.dispose();et.dispose();
 intro?.progress(15,'Getting the truck off the driveway…','Loading the truck…');const gltf=await new GLTFLoader().loadAsync('lc100.glb?v=radio-1',event=>{if(event.total>0)intro?.progress(15+20*event.loaded/event.total,`Truck download: ${Math.floor(100*event.loaded/event.total)}%.`,'Loading the truck…')});intro?.progress(35,'Packing the recovery boards. Optimism only gets you so far.','Packing the boards…');truck=gltf.scene;scene.add(truck);antenna=new PowerAntenna(truck,{reduced});for(const w of wheelLayout){const susp=truck.getObjectByName('Susp_'+w.name),st=truck.getObjectByName('Steer_'+w.name),roll=truck.getObjectByName('Roll_'+w.name);wheels.push({susp,steer:st,roll});mergeRigid(roll);fitTyreVisual(roll)}mergeRigid(truck.getObjectByName('Body'));rearAxle=new RearAxleView(truck);vehicleLights=new VehicleLights(truck,{mobile,reduced});vehicleWetness=new VehicleWetness(scene,truck,{mobile,reduced,groundHeight:(x,z)=>field.height(x,z),waterHeight:sampleWaterHeight});vehicleSnow=new VehicleSnow(truck);recovery=new Recovery(physics);const boards=await new GLTFLoader().loadAsync('traction-board.glb?v=recovery-1',event=>{if(event.total>0)intro?.progress(35+3*event.loaded/event.total,undefined,'Packing the boards…')});intro?.progress(38,'Shaping dunes. Reconsidering your confidence.','Building the route…');recoveryView=new RecoveryView(scene,truck,boards.scene,recovery);reset(false);updateCampCollider();for(let i=0;i<240;i++)physics.step(1/120,{turn:0,brake:true});if(!previewMode){physics.rb.setLinvel({x:0,y:0,z:0},true);physics.rb.setAngvel({x:0,y:0,z:0},true);physics.speed=0;}physics.soundEvents.length=0;sync(1);waterUpdate(physics.position(),0);terrain.animate(0);clouds.update(camera,0);mapDraw(physics.position());if(!previewMode)weatherView.update(10,camera,physics.rb.translation(),renderer);intro?.progress(40,'Downloads done. Getting the scene ready.','Preparing the expedition…');await new Promise(requestAnimationFrame);const warmup=[...vehicleFire.meshes,pebbles.mesh,puddles.mesh,vehicleWetness.drops,...roadside.meshes,roadside.smoke,wildlife.fireflies,atmosphere.inlandMist,hazards.rocks,hazards.embers,hazards.smoke,hazards.impactSmoke].map(mesh=>({mesh,visible:mesh.visible,count:mesh.count}));for(const entry of warmup){entry.mesh.visible=true;entry.mesh.count=1;}try{await renderer.compileAsync(scene,camera,null,event=>{if(event.total>0)intro?.progress(40+55*event.loaded/event.total,`${event.loaded} of ${event.total} scene pieces ready.`,'Preparing the expedition…')});}finally{for(const entry of warmup){entry.mesh.visible=entry.visible;entry.mesh.count=entry.count}}intro?.busy('Drawing the first frame…','One last look before we give you the keys.');await new Promise(requestAnimationFrame);if(!previewMode){const output=renderPipeline.outputNode;renderPipeline.outputNode=glowOutput;renderPipeline.needsUpdate=true;renderPipeline.render();renderPipeline.outputNode=output;renderPipeline.needsUpdate=true;await new Promise(requestAnimationFrame);}loaded=true;$('loading').hidden=true;if(previewMode){paused=!previewActive;renderPipeline.render();parent.postMessage({type:'lc100:preview-ready'},location.origin)}else{paused=true;weatherView.update(10,camera,physics.rb.translation(),renderer);renderPipeline.render();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));intro.ready();}last=performance.now();renderer.setAnimationLoop(frame);
 }catch(e){intro?.fail();console.error('Beach drive initialization failed',e);$('load-status').textContent='This browser couldn’t start the 3D drive. Try a recent browser with graphics acceleration enabled.';document.querySelector('.loadline').hidden=true;const b=document.createElement('button');b.className='primary';b.textContent='Back to the truck';b.addEventListener('click',exit);$('loading').append(b)}}
function frame(now){if(dead)return;const dt=Math.min(.06,(now-last)/1000);last=now;if(paused)return;if(opening?.active){elapsed+=dt;opening.update(dt);const p=physics.position();sky.position.copy(camera.position);sun.position.copy(camera.position).add(new THREE.Vector3(-430,105,-650));waterUpdate(p,elapsed);clouds.update(camera,elapsed);campView.update(camp,physics.origin,elapsed);atmosphere.update(p,elapsed,physics.origin,camera,weatherView.state);wildlife.update(p,elapsed,physics.origin,camera,weatherView.state);weatherView.update(dt,camera,physics.rb.translation(),renderer);bridgeView?.update(elapsed,camera);audio.update({canyonRiver:canyonAmbience(p),speed:0,engine:physics.powertrain,tyres:[],range:physics.range,input:{},shoreDistance:p.x-shore(p.z),rain:weatherView.state.rain,campfire:camp.fire?1-smooth(3,25,Math.hypot(p.x-(CAMP.x-10),p.z-CAMP.z)):0});renderPipeline.render();return;}impactShake.restore(camera);elapsed+=dt;if(messages.update(elapsed))$('quip').textContent=messages.text;frameCount++;cameraOrbit.update(dt,keys,{enabled:!previewMode});const input=drivingInput(keys,touch,cruise);antenna?.update(dt,{driving:!!(input.gas||input.reverse||input.brake||input.handbrake||input.turn),recovering:!!recovery?.pending||recovery?.state!=='roof'});if(antenna?.holding){input.brake=true;input.cruise=false;}if(input.reverse||input.brake||input.handbrake){cancelCruise();input.cruise=false}if(lavaRecovery.burning||camp.placing||physics.fording.stalled){Object.assign(input,{gas:false,reverse:false,cruise:false,brake:true,turn:0,handbrake:false});}if(respawnBrake>0&&!previewMode){respawnBrake=Math.max(0,respawnBrake-dt);Object.assign(input,{gas:false,reverse:false,turn:0,cruise:false,handbrake:false,brake:true})}const p=physics.position();if(previewMode){const f=physics.forward(),heading=Math.atan2(-f.x,-f.z),desired=Math.atan2(-(shore(p.z-15)+18-p.x),15),error=Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading));input.turn=clamp(error*2.4,-1,1);input.cruise=true;}terrain.update(p.x,p.z);beachLife.stream(p,physics.origin);mountainDetails.stream(p,physics.origin);obstacles.refresh(beachLife);pebbles.stream(p);accumulator+=dt;let steps=0;while(accumulator>=1/120&&steps++<8){physics.step(1/120,input);accumulator-=1/120}const safety=physics.roadsideSafety;canvas.dataset.proximityBrake=String(safety.active);canvas.dataset.proximityScene=safety.scene||'';if(safety.active){cancelCruise();input.gas=0;input.reverse=0;input.cruise=false;input.handbrake=false;input.brake=true;if(!previewMode&&elapsed>roadsideBrakeNotice){say('Rusty: Auto brake. They already have car trouble. They don’t need you. Reverse or steer around.');roadsideBrakeNotice=elapsed+18;}}const afterStep=physics.position();
 if(!previewMode&&Math.abs(afterStep.x-665)<28&&Math.abs(afterStep.z+470)<37&&afterStep.y<66){reset(false);say('Recovered to the last bank checkpoint. Use 4LO and hold a steady line across the bridge.');}
 if(!previewMode&&physics.fording.rescueAge>=3){reset(false);say('Engine flooded. Recovered to the last checkpoint. Follow the marked shallow ford.');}
 if(!previewMode){
  const event=lavaRecovery.update(dt,lavaRecovery.burning?false:lavaRecovery.touching(physics,[lavaCrossing.lava,volcano.lake,volcano.flows]));
  if(event==='ignite'){cancelCruise();keys.clear();touchControls.reset();recovery.clear();unstuck.dismiss();showUnstuck(false);$('lava-warning').hidden=false;say('Rusty: That was lava. Returning to the last checkpoint…');}
  if(event==='respawn'){reset(false);Object.assign(input,{gas:false,reverse:false,cruise:false,brake:true});say('Rusty: Fire out. Back at '+route.checkpoint().name+'. Let’s stay on the basalt this time.');}
 }
 if(!previewMode&&oceanRecovery.update(dt,{position:afterStep,waterHeight:ocean.height(afterStep.x,afterStep.z,elapsed),groundHeight:field.height(afterStep.x,afterStep.z)})){const pose=beachRecoveryPose(afterStep,(x,z)=>field.height(x,z)),quip=oceanRecovery.message();reset(false,pose);Object.assign(input,{gas:false,reverse:false,turn:0,cruise:false,handbrake:false,brake:true});say(quip);canvas.dataset.oceanRescues=String(oceanRecovery.rescues);}if(!previewMode&&!lavaRecovery.burning&&rollover.update(dt,physics.rb.rotation())){rolloverResets++;reset(false);Object.assign(input,{gas:false,reverse:false,turn:0,cruise:false,handbrake:false,brake:true});say('Rusty: That was the roof. Back to '+route.checkpoint().name+'. Rubber side down.');}if(!previewMode)showUnstuck(unstuck.update(dt,{position:physics.position(),velocity:physics.rb.linvel(),input,blocked:lavaRecovery.burning||physics.roadsideSafety.active||recovery?.pending||recovery?.state==='deploying'||recovery?.state==='stowing'||antenna?.holding}));maybeRebase();const pos=sync(dt);if(frameCount%8===0)terrain.refresh();waterUpdate(pos,elapsed);ocean.updateWheelFoam(dt,physics,elapsed);terrain.animate(elapsed);clouds.update(camera,elapsed);if(!previewMode)weatherView.update(dt,camera,physics.rb.translation(),renderer);if(frameCount%5===0)mapDraw(pos);effects.update(dt,camera,physics.origin,elapsed);const impacts=[...physics.soundEvents.splice(0),...(hazards?.drainImpacts()||[])];if(!previewMode){const observation=trailNarrator.update(dt,{biome:surfaceAt(pos.x,pos.z).biome,stuck:physics.stuck||unstuck.visible,waterContact:waterContactState.contact,speed:physics.speed,rain:weatherView.state.rain,impacts,canSpeak:!trailHint&&elapsed>messages.until});if(observation)say(observation);}audio.update({canyonRiver:canyonAmbience(pos),campfire:camp.fire?1-smooth(3,25,Math.hypot(pos.x-(CAMP.x-10),pos.z-CAMP.z)):0,engine:physics.powertrain,impacts,speed:physics.speed,tyres:physics.tyres,range:physics.range,input,shoreDistance:pos.x-shore(pos.z),waterContact:waterContactState.contact,waterDepth:waterContactState.depth,rain:weatherView.state.rain});impactShake.update(dt,impacts);impactShake.apply(camera);canvas.dataset.cameraShake=impactShake.strength.toFixed(3);vehicleFire.update(lavaRecovery.burning?lavaRecovery.age:null,physics,camera);canvas.dataset.lavaRecovery=lavaRecovery.burning?'burning':'ready';canvas.dataset.lavaRescues=String(lavaRecovery.rescues);renderPipeline.render()}
addEventListener('message',event=>{if(!previewMode||event.source!==parent||event.origin!==location.origin||event.data?.type!=='lc100:preview-active')return;previewActive=event.data.active===true&&!document.hidden;setPaused(!previewActive)});
addEventListener('pagehide',()=>{dead=true;opening?.dispose();journeyUI?.dispose();campView.dispose();rearAxle?.dispose();fordMarkers.dispose();hudMenu.dispose();touchControls.dispose();touchCamera.dispose();intro?.dispose();vehicleSnow?.dispose();vehicleWetness?.dispose();vehicleLights?.dispose();weatherUI?.dispose();weatherView.dispose();atmosphere.dispose();soundtrack.dispose();renderer?.setAnimationLoop(null);hazards?.dispose();vehicleFire.dispose();pebbles?.dispose();wildlife.dispose();obstacles?.dispose();terrain?.dispose();bridgeView?.dispose();physics?.dispose();clouds.dispose();lavaAtmosphere.dispose();lavaBloom?.dispose();lavaCrossing.dispose();volcano.dispose();river.dispose();puddles.dispose();ocean.dispose();effects.dispose();roadside.dispose();mountainDetails.dispose();beachLife.dispose();waypointView.dispose();renderPipeline?.dispose();scenePass?.dispose();renderer?.dispose();audio.dispose()},{once:true});init();
