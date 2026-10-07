import {waterExists} from './expedition.mjs';
import * as THREE from 'three/webgpu';
import {Fn,uniform,positionGeometry,positionWorld,cameraPosition,vec2,vec3,float,color,mix,sin,cos,pow,abs,max,normalize,dot,reflect,smoothstep,length,fract,mx_noise_float,texture} from 'three/tsl';
import {shore} from './terrain.mjs';
import {WakeField} from './wake-field.mjs';
import {waterSurfaceHeight} from './ocean-height.mjs';
// GPU swells, fine surface normals and view-dependent sunset reflection. World-space
// phase stays continuous while the mesh streams along the infinite coastline.
export class Ocean{
 constructor(scene,{mobile=false}={}){
  this.skyTop=uniform(new THREE.Color('#46576c'));this.skyHorizon=uniform(new THREE.Color('#b58073'));this.sunColor=uniform(new THREE.Color('#ffe2af'));this.sunDirection=uniform(new THREE.Vector3(-430,105,-650).normalize());this.brightness=uniform(1);this.waveScale=uniform(1);
  this.vehicleLights=Array.from({length:4},()=>({position:uniform(new THREE.Vector3()),direction:uniform(new THREE.Vector3(0,0,-1)),radiance:uniform(new THREE.Color(0,0,0)),cone:uniform(new THREE.Vector4(.9,.96,48,1.45))}));this.lightTarget=new THREE.Vector3();
  this.wheelFoam=Array.from({length:4},()=>uniform(new THREE.Vector4()));
  this.clock=uniform(0);this.origin=uniform(new THREE.Vector2());this.center=this.focus=Infinity;this.originKey='';this.mobile=mobile;this.nx=mobile?96:128;this.nz=mobile?176:256;this.nearX=mobile?64:80;this.shoreColumns=mobile?8:12;this.focusStep=mobile?10:8;
  this.wake=new WakeField({size:mobile?97:129,spacing:mobile?2/3:.5});this.wakePixels=new Uint16Array(this.wake.count*4);this.wakeTexture=new THREE.DataTexture(this.wakePixels,this.wake.size,this.wake.size,THREE.RGBAFormat,THREE.HalfFloatType);this.wakeTexture.minFilter=this.wakeTexture.magFilter=THREE.LinearFilter;this.wakeTexture.generateMipmaps=false;this.wakeTexture.needsUpdate=true;
  this.wakeOrigin=uniform(new THREE.Vector2());this.wakeSpan=(this.wake.size-1)*this.wake.spacing;this.lastTime=0;this.lastDisturbance=[-Infinity,-Infinity,-Infinity,-Infinity];this.disturbanceInterval=1/(mobile?24:30);
  const wakeAt=Fn(([x,z])=>texture(this.wakeTexture,vec2(x,z).sub(this.wakeOrigin).div(this.wakeSpan).mul((this.wake.size-1)/this.wake.size).add(.5/this.wake.size)).level(0));
  const t=this.clock,origin=this.origin;
  const coast=Fn(([z])=>float(-36).add(sin(z.mul(.006)).mul(8)).add(sin(z.mul(.019)).mul(3)));
  const height=Fn(([x,z])=>{
   const d=x.sub(coast(z)),offshore=float(1).sub(smoothstep(-25,2,d));
   const phase=d.mul(.30).sub(z.mul(.025)).add(sin(z.mul(.071)).mul(1.2)).add(sin(z.mul(.13)).mul(.3)).sub(t.mul(1.35));
   const swell=sin(phase).mul(.36).add(sin(d.mul(.14).add(z.mul(.046)).sub(t.mul(.78))).mul(.20));
   const cross=sin(x.mul(.41).add(z.mul(.23)).sub(t.mul(1.05))).mul(.065);
   return float(-.18).add(swell.add(cross).mul(offshore)).add(sin(t.mul(.8).sub(z.mul(.026))).mul(.075).mul(float(1).sub(offshore))).add(.18).mul(this.waveScale).sub(.18);
  });
  this.surfaceNode=height;
  const material=new THREE.MeshBasicNodeMaterial({transparent:true,depthWrite:false,side:THREE.FrontSide});
  material.positionNode=Fn(()=>{const world=positionGeometry.xz.add(origin);return vec3(positionGeometry.x,height(world.x,world.y).add(wakeAt(world.x,world.y).r),positionGeometry.z)})();
  const world=positionWorld.xz.add(origin),x=world.x,z=world.y,d=x.sub(coast(z));
  const wake=wakeAt(x,z),h=height(x,z).add(wake.r),detail=float(1).sub(smoothstep(30,150,length(cameraPosition.sub(positionWorld)))),fineA=mx_noise_float(vec3(x.mul(.65).add(t.mul(.18)),z.mul(.65),t.mul(.12))).mul(detail),fineB=mx_noise_float(vec3(x.mul(.75),z.mul(.75).sub(t.mul(.2)),float(17))).mul(detail);
  const n=normalize(vec3(height(x.sub(.14),z).sub(height(x.add(.14),z)).add(fineA.mul(.055)).sub(wake.g.mul(.28)),float(.28),height(x,z.sub(.14)).sub(height(x,z.add(.14))).add(fineB.mul(.055)).sub(wake.b.mul(.28))));
  const eye=normalize(cameraPosition.sub(positionWorld)),fresnel=pow(float(1).sub(max(dot(eye,n),0)),4).mul(.60).add(.04);
  const skyRay=reflect(eye.negate(),n);
  const reflectedSky=mix(this.skyHorizon,this.skyTop,smoothstep(.025,.60,skyRay.y));
  const deep=mix(color('#327e79'),color('#153b53'),smoothstep(2,100,d.negate()));
  const scatter=color('#45a399').mul(smoothstep(-.15,.35,h)).mul(.24);
  const sunDirection=this.sunDirection;
  const alignment=max(dot(eye,reflect(sunDirection.negate(),n)),0);
  const glitter=pow(alignment,120).mul(.12).add(pow(alignment,550).mul(.75));
  const reflected=reflectedSky.add(this.sunColor.mul(glitter));
  const waterColor=mix(deep.add(scatter),reflected,fresnel);
  // Broken crest foam and a separate wash front replace the previous straight stripes.
  const foamNoise=mx_noise_float(vec3(x.mul(.82).add(t.mul(.12)),z.mul(.82),t.mul(.20))).mul(.5).add(.5);
  const breakZone=smoothstep(-38,-17,d).mul(float(1).sub(smoothstep(-4,3,d)));
  const crestFoam=smoothstep(.12,.34,h).mul(breakZone).mul(smoothstep(.32,.68,foamNoise));
  const washPhase=sin(t.mul(.8).sub(z.mul(.026)).add(sin(z.mul(.16)).mul(.22)));
  const front=washPhase.mul(4.8).add(1.0).add(sin(z.mul(.46).add(t.mul(.35))).mul(.42));
  const wash=float(1).sub(smoothstep(.25,1.7,abs(d.sub(front)))).mul(smoothstep(.27,.62,foamNoise)).mul(.78);
  const lace=float(1).sub(smoothstep(.1,.65,abs(d.sub(front).add(2.2)))).mul(smoothstep(.55,.78,foamNoise)).mul(.3);
  // Tire-scale foam lives on the displaced water itself, so it cannot float above waves.
  // Two broken expanding arcs per wheel stay small; the existing wake carries foam away.
  let tireFoam=float(0);
  for(const wheel of this.wheelFoam){
   const offset=world.sub(wheel.xy),radius=length(offset),ragged=sin(offset.x.mul(19).add(offset.y.mul(13)).add(t.mul(2))).mul(.025);
   for(let j=0;j<2;j++){
    const phase=fract(wheel.w.add(j*.5)),ringRadius=phase.mul(1.05).add(.28);
    const ring=float(1).sub(smoothstep(.025,.10,abs(radius.add(ragged).sub(ringRadius))));
    const broken=smoothstep(.23,.52,foamNoise.add(sin(offset.x.mul(14).sub(offset.y.mul(17))).mul(.16)));
    tireFoam=max(tireFoam,ring.mul(broken).mul(float(1).sub(phase)).mul(wheel.z));
   }
  }
  this.tireFoamNode=tireFoam;
  const foam=max(max(max(crestFoam, wash.add(lace)),wake.a.mul(smoothstep(.18,.60,foamNoise))),tireFoam);
  // The custom water shader must explicitly receive the vehicle's local lights.
  // Wave/wake normals break the reflection into moving highlights (GGX specular).
  let vehicleSheen=vec3(0);
  for(const light of this.vehicleLights){
   const delta=light.position.sub(positionWorld),distance=length(delta).max(.15),L=delta.div(distance),H=normalize(L.add(eye)),nl=max(dot(n,L),0),nv=max(dot(n,eye),.03),nh=max(dot(n,H),0),vh=max(dot(eye,H),0);
   const cone=smoothstep(light.cone.x,light.cone.y,dot(L.negate(),light.direction)),range=float(1).sub(smoothstep(light.cone.z.mul(.65),light.cone.z,distance));
   const attenuation=cone.mul(range).div(float(1).add(pow(distance,light.cone.w)));
   const a2=float(.026),denom=nh.mul(nh).mul(a2.sub(1)).add(1),distribution=a2.div(denom.mul(denom).mul(Math.PI));
   const fres=float(.025).add(pow(float(1).sub(vh),5).mul(.975)),visibility=nl.div(nl.mul(.82).add(.18)).mul(nv.div(nv.mul(.82).add(.18)));
   const spec=distribution.mul(fres).mul(visibility).div(nl.mul(nv).mul(4).max(.02)).mul(nl);
   const response=spec.mul(2.6).add(nl.mul(.018).add(foam.mul(nl).mul(.10)));
   vehicleSheen=vehicleSheen.add(light.radiance.mul(attenuation).mul(response));
  }
  material.colorNode=mix(waterColor,color('#f5dec0'),foam).mul(this.brightness).add(vehicleSheen);

  material.opacityNode=mix(float(.94),float(.68),smoothstep(0,10,d)).mul(float(1).sub(smoothstep(8,12,d)));
  // One constant mesh covers the coast and horizon. Its dense patch follows
  // the truck offshore, so tyre wakes always reach actual surface vertices.
  // Reuse the buffers when the detail window moves; never add an overlay sheet.
  const count=(this.nx+1)*(this.nz+1),positions=new Float32Array(count*3),normals=new Float32Array(count*3),indices=new Uint32Array(this.nx*this.nz*6);
  this.columnOffsets=new Float64Array(this.nx+1);this.rowOffsets=new Float64Array(this.nz+1);
  const nearZ=mobile?128:192,outerZ=(this.nz-nearZ)/2,nearX=this.nearX;
  for(let i=0;i<=this.nx;i++)this.columnOffsets[i]=i<=nearX?12-i*40/nearX:-28-1172*Math.pow((i-nearX)/(this.nx-nearX),1.55);
  for(let j=0;j<=this.nz;j++)this.rowOffsets[j]=j<outerZ?-640+j*(592/outerZ):j<=outerZ+nearZ?-48+(j-outerZ)*96/nearZ:48+(j-outerZ-nearZ)*592/outerZ;
  let k=0;for(let j=0;j<=this.nz;j++)for(let i=0;i<=this.nx;i++){const a=j*(this.nx+1)+i;normals[a*3+1]=1;if(i<this.nx&&j<this.nz){const b=a+1,c=a+this.nx+1;indices.set([a,b,c,b,c+1,c],k);k+=6}}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setIndex(new THREE.BufferAttribute(indices,1));
  this.material=material;this.mesh=new THREE.Mesh(geometry,material);this.mesh.renderOrder=1;this.mesh.frustumCulled=false;scene.add(this.mesh);
 }
 update(p,time,origin){
  this.wake.move(p.x??shore(p.z),p.z);this.wake.step(Math.max(0,time-this.lastTime));this.lastTime=time;
  const values=this.wake.pack();for(let i=0;i<values.length;i++)this.wakePixels[i]=THREE.DataUtils.toHalfFloat(values[i]);this.wakeTexture.needsUpdate=true;this.wakeOrigin.value.set(this.wake.x,this.wake.z);
  this.clock.value=time;this.origin.value.set(origin.x,origin.z);
  // Integer fine-cell shifts preserve the exact local triangles and wave
  // samples during streaming, including the tablet's .625m by .75m cells.
  const center=Math.floor(p.z/6)*6,focus=Math.min(-8,-8+this.focusStep*Math.round(((p.x??shore(p.z))-shore(p.z)+8)/this.focusStep)),key=`${origin.x},${origin.z}`;
  if(center===this.center&&focus===this.focus&&key===this.originKey)return;
  this.center=center;this.focus=focus;this.originKey=key;
  // Keep the original shoreline detail while driving on the beach. Offshore,
  // reserve a few columns back to shore and retain tyre-scale spacing locally.
  const shoreColumns=focus< -8?this.shoreColumns:0,nearX=this.nearX,right=focus+20,left=focus-20,far=Math.min(-1200,left-256);
  for(let i=0;i<=this.nx;i++)this.columnOffsets[i]=i<shoreColumns?12+(right-12)*i/shoreColumns:i<=shoreColumns+nearX?right-(i-shoreColumns)*40/nearX:left-(left-far)*Math.pow((i-shoreColumns-nearX)/(this.nx-shoreColumns-nearX),1.55);
  const positions=this.mesh.geometry.attributes.position;
  for(let j=0;j<=this.nz;j++){
   const z=center+this.rowOffsets[j],coast=shore(z)-origin.x;
   for(let i=0;i<=this.nx;i++)positions.setXYZ(j*(this.nx+1)+i,coast+this.columnOffsets[i],-.18,z-origin.z);
  }
  positions.needsUpdate=true;
 }
 updateWheelFoam(dt,physics,time){
  const velocity=physics.rb?.linvel(),speed=velocity?Math.hypot(velocity.x,velocity.z):Math.abs(physics.speed);
  const still=1-Math.min(1,Math.max(0,(speed-.06)/.14)),k=1-Math.exp(-Math.min(dt,.1)*(still<1?18:5));
  this.wheelFoam.forEach((slot,i)=>{
   const v=slot.value,c=physics.vehicle.wheelContactPoint(i),contact=physics.vehicle.wheelIsInContact(i);
   let wet=false;
   if(contact&&c){const x=c.x+physics.origin.x,z=c.z+physics.origin.z;
    wet=waterExists(x,z)&&this.height(x,z,time)>c.y+.025;
    if(wet){v.x=x;v.y=z;}
   }
   v.z+=((wet?.60*still:0)-v.z)*k;
   v.w=(v.w+Math.min(dt,.1)*.42)%1;
  });
 }
 updateVehicleLights(rig){
  if(!rig)return;rig.truck.updateWorldMatrix(true,true);
  [ ...rig.beams,rig.rearGlow,rig.backup ].forEach((light,i)=>{const slot=this.vehicleLights[i];light.getWorldPosition(slot.position.value);light.target.getWorldPosition(this.lightTarget);slot.direction.value.copy(this.lightTarget).sub(slot.position.value).normalize();slot.radiance.value.copy(light.color).multiplyScalar(light.intensity);slot.cone.value.set(Math.cos(light.angle),Math.cos(light.angle*(1-light.penumbra)),light.distance,light.decay)});
 }
 height(x,z,time){return waterSurfaceHeight(x,z,time,this.waveScale.value,this.wake.sample(x,z))}
 disturb(mark,speed,heading,time=this.lastTime){
  const wheel=mark.wheel??0,since=time-this.lastDisturbance[wheel];
  if(since>=0&&since+1e-9<this.disturbanceInterval)return false;
  if(!this.wake.stamp(mark.x,mark.z,speed,mark.slip,heading))return false;
  this.lastDisturbance[wheel]=time;return true;
 }
 clear(){this.wake.clear();this.lastDisturbance.fill(-Infinity);this.wheelFoam.forEach((slot,i)=>slot.value.set(0,0,0,i*.21))}
 dispose(){this.mesh.geometry.dispose();this.material.dispose();this.wakeTexture.dispose()}
}
