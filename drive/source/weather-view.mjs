import * as THREE from 'three/webgpu';
import {uniform,positionLocal,mix,smoothstep} from 'three/tsl';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class WeatherView{
 constructor({scene,skyMat,sun,hemi,light,ocean,clouds,mobile=false,reduced=false}){
  Object.assign(this,{scene,sun,hemi,light,ocean,clouds,reduced});this.state={altitude:8,cloud:.2,wind:8,rain:0,snow:0,fog:false};this.time=0;
  this.top=uniform(new THREE.Color('#49355e'));this.horizon=uniform(new THREE.Color('#f2ad79'));this.low=uniform(new THREE.Color('#ed8a75'));const y=positionLocal.y.div(1200);skyMat.colorNode=mix(mix(this.low,this.horizon,smoothstep(-.03,.025,y)),this.top,smoothstep(.015,.30,y));
  this.colors={top:new THREE.Color(),horizon:new THREE.Color(),low:new THREE.Color(),light:new THREE.Color(),cloud:new THREE.Color(),water:new THREE.Color()};this.tmp=new THREE.Color();this.direction=new THREE.Vector3();
  this.count=mobile?220:420;this.positions=new Float32Array(this.count*6);this.seeds=Array.from({length:this.count},()=>[Math.random(),Math.random(),Math.random()]);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(this.positions,3));this.precip=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:'#cce1ea',transparent:true,opacity:.30,depthWrite:false}));this.precip.frustumCulled=false;scene.add(this.precip);this.set(this.state);
 }
 set(state){this.state=state;const {altitude:a,cloud:c}=state,night=a<-6,dusk=a<14;
  const palette=night?['#111b36','#46516f','#26364e']:dusk?['#49355e','#f2ad79','#ed8a75']:['#367898','#c4d2cc','#91b3b8'];
  ['top','horizon','low'].forEach((key,i)=>this.colors[key].set(palette[i]).lerp(this.tmp.set(night?'#252d40':'#7b8998'),c*.65));
  this.colors.light.set(night?'#b1c6ef':dusk?'#ffd39d':'#fff3db');this.colors.cloud.set(night?'#52617e':dusk?'#ffffff':'#d4e4e4').lerp(this.tmp.set('#778390'),c*.42);
  this.day=night?.12:clamp((a+6)/25,.3,1);this.brightness=night?.5:1;this.fogFar=state.fog?125:state.rain||state.snow?260:520;
 }
 update(dt,camera,p,renderer){
  const s=this.state,k=1-Math.exp(-dt*.6);this.time+=dt;
  for(const key of ['top','horizon','low'])this[key].value.lerp(this.colors[key],k);
  this.scene.fog.color.lerp(this.horizon.value,k);this.scene.fog.far+=(this.fogFar-this.scene.fog.far)*k;this.scene.fog.near+=(Math.min(180,this.fogFar*.3)-this.scene.fog.near)*k;
  this.hemi.color.lerp(this.colors.light,k);this.hemi.intensity+=((s.altitude<-6?1.1:1.8)-this.hemi.intensity)*k;
  this.light.color.lerp(this.colors.light,k);this.light.intensity+=((s.altitude<-6?.65:2.3*(1-s.cloud*.7))-this.light.intensity)*k;
  this.scene.environmentIntensity+=((s.altitude<-6?.22:.55)-this.scene.environmentIntensity)*k;
  const y=s.altitude<-6?200:Math.max(-70,Math.sin(s.altitude*Math.PI/180)*620);this.direction.set(-430,y,-650);
  this.sun.position.copy(camera.position).add(this.direction);this.sun.material.color.lerp(this.colors.light,k);this.sun.visible=s.cloud<.88&&!s.fog;this.sun.scale.setScalar(s.altitude<-6?.6:1);
  this.light.position.set(p.x+this.direction.x*.10,p.y+Math.max(20,y*.12),p.z+this.direction.z*.10);this.light.target.position.set(p.x,p.y,p.z);
  this.clouds.mesh.material.color.lerp(this.colors.cloud,k);this.clouds.mesh.count=Math.round(25+s.cloud*65);this.clouds.wind=1+s.wind/15;
  this.ocean.skyTop.value.copy(this.top.value);this.ocean.skyHorizon.value.copy(this.horizon.value);this.ocean.sunColor.value.copy(this.colors.light).multiplyScalar((1-s.cloud)*this.day);
  this.ocean.sunDirection.value.copy(this.direction).normalize();this.ocean.brightness.value+=(this.brightness-this.ocean.brightness.value)*k;this.ocean.waveScale.value+=((.8+Math.min(s.wind,60)/60*.7)-this.ocean.waveScale.value)*k;
  const strength=Math.max(s.rain,s.snow);this.precip.visible=strength>0&&!this.reduced;
  if(this.precip.visible){const snow=s.snow>0,fall=snow?2:15,n=Math.round(this.count*strength),span=32;this.precip.geometry.setDrawRange(0,n*2);this.precip.material.opacity=snow?.65:.30;
   for(let i=0;i<n;i++){const r=this.seeds[i],y=(r[1]*18-this.time*fall)%18,x=(r[0]-.5)*span+Math.sin(this.time+r[2]*10)*(snow?.8:.1),z=(r[2]-.5)*span,at=i*6;
    this.positions.set([p.x+x,p.y+((y+18)%18)-3,p.z+z,p.x+x+s.wind*.004,p.y+((y+18)%18)-3+(snow?.06:.65),p.z+z],at);
   }this.precip.geometry.attributes.position.needsUpdate=true;
  }
 }
 dispose(){this.scene.remove(this.precip);this.precip.geometry.dispose();this.precip.material.dispose()}
}
