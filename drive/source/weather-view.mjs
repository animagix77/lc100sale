import * as THREE from 'three/webgpu';
import {uniform,positionLocal,mix,smoothstep} from 'three/tsl';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
const wrap=(v,min,size)=>((v-min)%size+size)%size+min;
export class WeatherView{
 constructor({scene,skyMat,sun,hemi,light,ocean,clouds,mobile=false,reduced=false}){
  Object.assign(this,{scene,sun,hemi,light,ocean,clouds,reduced});this.state={altitude:8,cloud:.2,wind:8,rain:0,snow:0,fog:false};this.time=0;
  this.top=uniform(new THREE.Color('#49355e'));this.horizon=uniform(new THREE.Color('#f2ad79'));this.low=uniform(new THREE.Color('#ed8a75'));const y=positionLocal.y.div(1200);skyMat.colorNode=mix(mix(this.low,this.horizon,smoothstep(-.03,.025,y)),this.top,smoothstep(.015,.30,y));
  this.colors={top:new THREE.Color(),horizon:new THREE.Color(),low:new THREE.Color(),light:new THREE.Color(),cloud:new THREE.Color(),water:new THREE.Color(),fill:new THREE.Color(),ground:new THREE.Color()};this.tmp=new THREE.Color();this.stormShade=new THREE.Color();this.direction=new THREE.Vector3();
  this.count=mobile?700:1500;this.positions=new Float32Array(this.count*6);this.seeds=Array.from({length:this.count},()=>[Math.random(),Math.random(),Math.random()]);
  this.rainOffsets=new Float32Array(this.count*3);this.snowOffsets=new Float32Array(this.count*3);
  for(let i=0;i<this.count;i++){const r=this.seeds[i],j=i*3;this.rainOffsets.set([(r[0]-.5)*36,r[1]*24-8,(r[2]-.5)*36],j);this.snowOffsets.set([(r[2]-.5)*36,r[0]*24-8,(r[1]-.5)*36],j);}
  this.previousCamera=new THREE.Vector3();this.cameraDelta=new THREE.Vector3();this.cameraVelocity=new THREE.Vector3();this.velocityTarget=new THREE.Vector3();this.motionReady=false;this.precipTime=0;
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(this.positions,3));this.precip=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:'#cce1ea',transparent:true,opacity:.30,depthWrite:false}));this.precip.frustumCulled=false;scene.add(this.precip);this.flakeDummy=new THREE.Object3D();this.snowflakes=new THREE.InstancedMesh(new THREE.OctahedronGeometry(.045,0),new THREE.MeshBasicMaterial({color:'#f5f8ff',transparent:true,opacity:.8,depthWrite:false}),this.count);this.snowflakes.frustumCulled=false;this.snowflakes.visible=false;scene.add(this.snowflakes);this.set(this.state);
 }
 set(state){
  this.state=state;
  const a=state.altitude??8,c=clamp(state.cloud??.2,0,1),night=1-smooth(-9,-3,a),day=smooth(10,26,a),wet=clamp(Math.max(state.rain||0,state.snow||0),0,1);
  this.nightMix=night;this.stormShade.set('#748e98').lerp(this.tmp.set('#2e3f56'),night);
  const sunset=['#49365f','#f5b77d','#da8174'],daylight=['#387fa1','#bad5d5','#83b1b7'],moon=['#101d37','#526680','#253c53'];
  ['top','horizon','low'].forEach((key,i)=>this.colors[key].set(sunset[i]).lerp(this.tmp.set(daylight[i]),day).lerp(this.tmp.set(moon[i]),night).lerp(this.stormShade,c*.52+wet*.18));
  this.colors.light.set('#ffca82').lerp(this.tmp.set('#fff1d3'),day).lerp(this.tmp.set('#b4ccef'),night);
  // Warm raking sunlight against cool sky fill keeps the meadow dimensional.
  this.colors.fill.set('#9dbdc9').lerp(this.tmp.set('#83aac9'),night).lerp(this.tmp.set('#b0c3cc'),wet*.5);
  this.colors.ground.set('#655245').lerp(this.tmp.set('#313e49'),night).lerp(this.tmp.set('#4d5651'),wet*.4);
  this.colors.cloud.set('#ffe0b6').lerp(this.tmp.set('#e3edf0'),day).lerp(this.tmp.set('#536885'),night).lerp(this.tmp.set('#748895'),c*.48);
  this.day=.12*night+(1-night)*clamp((a+6)/25,.3,1);this.brightness=1-night*.50;
  // Visibility closes continuously as precipitation builds, never on its first drop.
  const weatherVeil=1-Math.pow(1-wet,1.35),fog=state.fog===true?1:clamp(Number(state.fog)||0,0,1);
  // Low sun catches a deeper veil; nearby ground stays clear for steering.
  const dusk=1-smooth(8,28,a);
  this.fogFar=(188-dusk*24-c*22-weatherVeil*65)*(1-fog)+76*fog;
  this.fogNear=(25-dusk*7-c*5-weatherVeil*6)*(1-fog)+9*fog;
  this.lightTarget=(3.15-c*1.8-weatherVeil*.20)*(1-night)+.68*night;
  this.hemiTarget=(1.18+c*.24)*(1-night)+1.13*night;
  this.environmentTarget=(.43-c*.08)*(1-night)+.26*night;
 }
 update(dt,camera,p,renderer){
  const s=this.state,k=1-Math.exp(-dt*.6);this.time+=dt;
  for(const key of ['top','horizon','low'])this[key].value.lerp(this.colors[key],k);
  this.scene.fog.color.lerp(this.horizon.value,k);this.scene.fog.far+=(this.fogFar-this.scene.fog.far)*k;this.scene.fog.near+=(this.fogNear-this.scene.fog.near)*k;
  this.hemi.color.lerp(this.colors.fill,k);this.hemi.groundColor.lerp(this.colors.ground,k);this.hemi.intensity+=(this.hemiTarget-this.hemi.intensity)*k;
  this.light.color.lerp(this.colors.light,k);this.light.intensity+=(this.lightTarget-this.light.intensity)*k;
  this.scene.environmentIntensity+=(this.environmentTarget-this.scene.environmentIntensity)*k;
  const y=Math.max(-70,Math.sin(s.altitude*Math.PI/180)*620)*(1-this.nightMix)+200*this.nightMix;this.direction.set(-430,y,-650);
  this.sun.position.copy(camera.position).add(this.direction);this.sun.material.color.lerp(this.colors.light,k);this.sun.visible=s.cloud<.88&&!s.fog;this.sun.scale.setScalar(1-this.nightMix*.4);
  this.light.position.set(p.x+this.direction.x*.10,p.y+Math.max(20,y*.12),p.z+this.direction.z*.10);this.light.target.position.set(p.x,p.y,p.z);
  this.clouds.mesh.material.color.lerp(this.colors.cloud,k);this.clouds.mesh.count=Math.round(25+s.cloud*65);this.clouds.wind=1+s.wind/15;
  this.ocean.skyTop.value.copy(this.top.value);this.ocean.skyHorizon.value.copy(this.horizon.value);this.ocean.sunColor.value.copy(this.colors.light).multiplyScalar((1-s.cloud)*this.day);
  this.ocean.sunDirection.value.copy(this.direction).normalize();this.ocean.brightness.value+=(this.brightness-this.ocean.brightness.value)*k;this.ocean.waveScale.value+=((.8+Math.min(s.wind,60)/60*.7)-this.ocean.waveScale.value)*k;
  this.precip.visible=s.rain>.01&&!this.reduced;this.snowflakes.visible=s.snow>.01&&!this.reduced;
  // The volume follows the camera, but its particles retain their world motion.
  // Subtract camera translation once; do not drag the weather along with the truck.
  const step=clamp(dt,0,.06),oldTime=this.precipTime;
  this.precipTime+=step;
  this.cameraDelta.subVectors(camera.position,this.previousCamera);
  if(!this.motionReady||dt>.25||this.cameraDelta.length()>Math.max(2,step*100))this.resetMotion(camera);
  else if(step>0)this.cameraVelocity.lerp(this.velocityTarget.copy(this.cameraDelta).divideScalar(step),1-Math.exp(-step*9));
  this.previousCamera.copy(camera.position);
  this.precip.position.copy(camera.position);this.snowflakes.position.copy(camera.position);
  const wind=clamp(s.wind||0,0,60)*.055,dx=this.cameraDelta.x,dy=this.cameraDelta.y,dz=this.cameraDelta.z;
  // Rain exposure follows the relative wind, making speed readable without a
  // camera-facing overlay. Pool size and draw calls stay fixed on mobile.
  if(this.precip.visible){
   const n=Math.round(this.count*clamp(s.rain,0,1));
   this.precip.geometry.setDrawRange(0,n*2);this.precip.material.opacity=.34+s.rain*.22;
   for(let i=0;i<n;i++){
    const r=this.seeds[i],j=i*3,v=i*6,fall=17+r[2]*7,offset=this.rainOffsets;
    const x=offset[j]=wrap(offset[j]+wind*step-dx,-18,36);
    const y=offset[j+1]=wrap(offset[j+1]-fall*step-dy,-8,24);
    const z=offset[j+2]=wrap(offset[j+2]+wind*.18*step-dz,-18,36);
    const vx=wind-this.cameraVelocity.x,vy=-fall-this.cameraVelocity.y,vz=wind*.18-this.cameraVelocity.z;
    const exposure=Math.min(.04+r[0]*.02,2.8/Math.max(1,Math.hypot(vx,vy,vz)))*smooth(.85,2.2,Math.hypot(x,y,z));
    this.positions[v]=x;this.positions[v+1]=y;this.positions[v+2]=z;
    this.positions[v+3]=x-vx*exposure;this.positions[v+4]=y-vy*exposure;this.positions[v+5]=z-vz*exposure;
   }
   this.precip.geometry.attributes.position.needsUpdate=true;
  }
  if(this.snowflakes.visible){
   const n=Math.round(this.count*.58*clamp(s.snow,0,1));
   for(let i=0;i<n;i++){
    const r=this.seeds[i],j=i*3,offset=this.snowOffsets,phase=r[1]*12,frequency=.65+r[0]*.35;
    // Incremental flutter preserves parallax instead of resetting to a seed each frame.
    const flutterX=(Math.sin(this.precipTime*frequency+phase)-Math.sin(oldTime*frequency+phase))*.9;
    const flutterZ=(Math.cos(this.precipTime*.53+phase)-Math.cos(oldTime*.53+phase))*.55;
    const x=offset[j]=wrap(offset[j]+wind*.22*step+flutterX-dx,-18,36);
    const y=offset[j+1]=wrap(offset[j+1]-(1.45+r[2]*.95)*step-dy,-8,24);
    const z=offset[j+2]=wrap(offset[j+2]+wind*.07*step+flutterZ-dz,-18,36);
    this.flakeDummy.position.set(x,y,z);
    this.flakeDummy.rotation.set(this.precipTime*(.8+r[0])+phase,this.precipTime*.3,phase);
    this.flakeDummy.scale.setScalar((.6+r[2]*1.2)*smooth(1,3.2,Math.hypot(x,y,z)));
    this.flakeDummy.updateMatrix();this.snowflakes.setMatrixAt(i,this.flakeDummy.matrix);
   }
   this.snowflakes.count=n;this.snowflakes.instanceMatrix.needsUpdate=true;
  }
 }
 // Coordinate shifts and camera cuts must never become a sudden weather gust.
 resetMotion(camera){this.previousCamera.copy(camera.position);this.cameraDelta.set(0,0,0);this.cameraVelocity.set(0,0,0);this.motionReady=true;}
 rebase(x,z){this.previousCamera.x-=x;this.previousCamera.z-=z;}
 dispose(){this.snowflakes.removeFromParent();this.snowflakes.geometry.dispose();this.snowflakes.material.dispose();this.snowflakes.dispose();this.scene.remove(this.precip);this.precip.geometry.dispose();this.precip.material.dispose()}
}
