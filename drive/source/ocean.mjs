import {buildOceanWaveProfile,oceanWavePhase} from './ocean-wave-profile.mjs';
import {OceanGridStream} from './ocean-grid-stream.mjs';
import {waterExists,COASTAL_WATER_EXTENT} from './expedition.mjs';
import * as THREE from 'three/webgpu';
import {Fn,uniform,positionGeometry,positionWorld,cameraPosition,vec2,vec3,float,color,mix,sin,cos,pow,abs,max,normalize,dot,reflect,smoothstep,length,fract,mx_noise_float,texture,attribute} from 'three/tsl';
import {shore,baseHeight} from './terrain.mjs';
import {WakeField} from './wake-field.mjs';
import {waterSurfaceHeight,COASTAL_WAKE_LIMITS} from './ocean-height.mjs';
import {archipelagoRegion,islandOceanBed,preloadIslandBathymetry,islandBathymetryGrid} from './coastal-islands.mjs';
// GPU swells, fine surface normals and view-dependent sunset reflection. World-space
// phase stays continuous while the mesh streams along the infinite coastline.
export class Ocean{
 constructor(scene,{mobile=false}={}){
  preloadIslandBathymetry(baseHeight);
  const grid=islandBathymetryGrid(baseHeight),islandPixels=new Uint16Array(grid.data.length);
  for(let i=0;i<islandPixels.length;i++)islandPixels[i]=THREE.DataUtils.toHalfFloat(grid.data[i]);
  this.islandBedGrid={x:grid.x,z:grid.z,width:grid.width,height:grid.height,spacing:grid.spacing};
  this.islandBedTexture=new THREE.DataTexture(islandPixels,grid.width,grid.height,THREE.RedFormat,THREE.HalfFloatType);
  this.islandBedTexture.minFilter=this.islandBedTexture.magFilter=THREE.LinearFilter;this.islandBedTexture.generateMipmaps=false;this.islandBedTexture.needsUpdate=true;
  this.skyTop=uniform(new THREE.Color('#46576c'));this.skyHorizon=uniform(new THREE.Color('#b58073'));this.sunColor=uniform(new THREE.Color('#ffe2af'));this.sunDirection=uniform(new THREE.Vector3(-430,105,-650).normalize());this.brightness=uniform(1);this.waveScale=uniform(1);
  this.cloudColor=uniform(new THREE.Color('#d9c0aa'));this.cloudCover=uniform(.2);
  this.vehicleLights=Array.from({length:4},()=>({position:uniform(new THREE.Vector3()),direction:uniform(new THREE.Vector3(0,0,-1)),radiance:uniform(new THREE.Color(0,0,0)),cone:uniform(new THREE.Vector4(.9,.96,48,1.45))}));this.lightTarget=new THREE.Vector3();
  this.wheelFoam=Array.from({length:4},()=>uniform(new THREE.Vector4()));
  this.clock=uniform(0);this.origin=uniform(new THREE.Vector2());this.center=this.focus=Infinity;this.originKey='';this.bedRows=new Map();this.mobile=mobile;this.nx=mobile?96:128;this.nz=mobile?176:256;this.nearX=mobile?64:80;this.shoreColumns=mobile?8:12;this.focusStep=mobile?10:8;
  this.wake=new WakeField({size:mobile?97:129,spacing:mobile?2/3:.5});this.wakePixels=new Uint16Array(this.wake.count*4);this.wakeTexture=new THREE.DataTexture(this.wakePixels,this.wake.size,this.wake.size,THREE.RGBAFormat,THREE.HalfFloatType);this.wakeTexture.minFilter=this.wakeTexture.magFilter=THREE.LinearFilter;this.wakeTexture.generateMipmaps=false;this.wakeTexture.needsUpdate=true;
  this.wakeOrigin=uniform(new THREE.Vector2());this.wakeSpan=(this.wake.size-1)*this.wake.spacing;this.lastTime=0;this.lastDisturbance=[-Infinity,-Infinity,-Infinity,-Infinity];this.disturbanceInterval=1/(mobile?24:30);
  const wakeAt=Fn(([x,z])=>texture(this.wakeTexture,vec2(x,z).sub(this.wakeOrigin).div(this.wakeSpan).mul((this.wake.size-1)/this.wake.size).add(.5/this.wake.size)).level(0));
  const t=this.clock,origin=this.origin;
  const coast=Fn(([z])=>float(-36).add(sin(z.mul(.006)).mul(8)).add(sin(z.mul(.019)).mul(3)));
  const bed=attribute('oceanBed','float');
  const islandRegion=Fn(([x,z])=>float(1).sub(smoothstep(-32,-25,x)).mul(smoothstep(-535,-505,x)).mul(smoothstep(-420,-385,z)).mul(float(1).sub(smoothstep(-130,-105,z))));
  // Bed depth must be sampled per pixel, not interpolated across the very broad
  // horizon triangles. The latter stretched a narrow shoal into bright wedges
  // of foam and flooded portions of the distant sandbars.
  const bedAt=Fn(([x,z,fallback])=>{
   const uv=vec2(x.sub(grid.x).add(.5).div(grid.width),z.sub(grid.z).add(.5).div(grid.height));
   return islandRegion(x,z).greaterThan(0).select(texture(this.islandBedTexture,uv).level(0).r,fallback);
  });
  this.islandBedNode=bedAt;
  // One formula builds both CPU contact heights and these shader nodes.
  // Existing bed data also resolves the low, rutted mainland foreshore.
  const nodeMath={add:(a,b)=>float(a).add(b),sub:(a,b)=>float(a).sub(b),mul:(a,b)=>float(a).mul(b),sin,cos,smooth:smoothstep,max,min:(a,b)=>float(a).min(b)};
  const profileAt=(x,z,ground)=>buildOceanWaveProfile(nodeMath,{d:x.sub(coast(z)),z,time:t,depth:float(-.18).sub(bedAt(x,z,ground)),scale:this.waveScale});
  const surface=Fn(([x,z,ground])=>profileAt(x,z,ground).height);
  // The estuary reuses the swell function with its own riverBed attribute.
  // Pass the bed explicitly so shared shader nodes never require an attribute
  // that exists only on a different mesh's geometry.
  const height=(x,z)=>surface(x,z,bed);
  this.surfaceNode=surface;
  const limits=COASTAL_WAKE_LIMITS;
  const coastalGain=Fn(([depth,raw])=>{
   const d=max(depth,0),limit=raw.greaterThanEqual(0).select(d.mul(limits.crestDepth).min(limits.crest),d.mul(limits.troughDepth).min(limits.trough));
   return limit.div(limit.add(abs(raw)).max(.000001)).mul(smoothstep(0,limits.edgeDepth,d));
  });
  const coastalWake=Fn(([depth,raw])=>raw.mul(coastalGain(depth,raw)));
  this.coastalWakeNode=coastalWake;this.coastalWakeGainNode=coastalGain;
  const material=new THREE.MeshBasicNodeMaterial({transparent:true,depthWrite:false,side:THREE.FrontSide});
  material.positionNode=Fn(()=>{const world=positionGeometry.xz.add(origin);return vec3(positionGeometry.x,height(world.x,world.y).add(coastalWake(height(world.x,world.y).sub(bedAt(world.x,world.y,bed)),wakeAt(world.x,world.y).r)),positionGeometry.z)})();
  const world=positionWorld.xz.add(origin),x=world.x,z=world.y,d=x.sub(coast(z)),profile=profileAt(x,z,bed);
  const wake=wakeAt(x,z),base=height(x,z),depth=max(base.sub(bedAt(x,z,bed)),0),offset=coastalWake(depth,wake.r),h=base.add(offset),detail=float(1).sub(smoothstep(30,150,length(cameraPosition.sub(positionWorld)))),fineA=mx_noise_float(vec3(x.mul(.65).add(t.mul(.18)),z.mul(.65),t.mul(.12))).mul(detail),fineB=mx_noise_float(vec3(x.mul(.75),z.mul(.75).sub(t.mul(.2)),float(17))).mul(detail);
  // The derivative of the same soft saturation damps wake normals; the
  // existing analytic swells keep the distant sea smooth at every mesh LOD.
  const limit=wake.r.greaterThanEqual(0).select(depth.mul(limits.crestDepth).min(limits.crest),depth.mul(limits.troughDepth).min(limits.trough));
  const wakeGain=coastalGain(depth,wake.r),slopeGain=wakeGain.mul(limit.div(limit.add(abs(wake.r)).max(.000001)));
  const n=normalize(vec3(height(x.sub(.14),z).sub(height(x.add(.14),z)).add(fineA.mul(.055)).sub(wake.g.mul(slopeGain).mul(.28)),float(.28),height(x,z.sub(.14)).sub(height(x,z.add(.14))).add(fineB.mul(.055)).sub(wake.b.mul(slopeGain).mul(.28))));
  const eye=normalize(cameraPosition.sub(positionWorld)),fresnel=pow(float(1).sub(max(dot(eye,n),0)),4).mul(.60).add(.04);
  const skyRay=reflect(eye.negate(),n);
  // Distant water receives the same sky and cloud palette as the atmosphere.
  // Keep this in the existing surface pass; no scene reflection is rendered.
  const reflectedSky=mix(mix(this.skyHorizon,this.skyTop,smoothstep(.025,.60,skyRay.y)),this.cloudColor,this.cloudCover.mul(.32).mul(float(1).sub(smoothstep(.04,.72,skyRay.y))));
  const islands=islandRegion(x,z),lagoon=mix(mix(color('#75c9b2'),color('#216f82'),smoothstep(.2,4,depth)),color('#153b53'),smoothstep(4,28,depth));
  const deep=mix(mix(color('#327e79'),color('#153b53'),smoothstep(2,100,d.negate())),lagoon,islands);
  const scatter=color('#4b9d8d').mul(profile.crest).mul(profile.energy).mul(.16);
  const sunDirection=this.sunDirection;
  const alignment=max(dot(eye,reflect(sunDirection.negate(),n)),0);
  const glitter=pow(alignment,120).mul(.12).add(pow(alignment,550).mul(.75)).add(pow(alignment,18).mul(.055));
  const reflected=reflectedSky.add(this.sunColor.mul(glitter));
  // Water's body colour responds to available daylight as well as its depth.
  // Fixed turquoise formerly looked self-lit against the mauve coastal dusk.
  const ambient=mix(this.skyTop,this.skyHorizon,.62).mul(.60).add(this.sunColor.mul(.34)).add(.18).clamp(.18,1);
  const waterColor=mix(deep.add(scatter).mul(ambient),reflected,fresnel);
  // Foam travels with the wave that produced it. Depth, not a straight
  // shoreline stripe, determines where a crest breaks around reefs and islands.
  const foamNoise=mx_noise_float(vec3(x.sub(t.mul(.72)).mul(.48),z.mul(.64),float(4))).mul(.5).add(.5);
  const bubbles=mx_noise_float(vec3(x.sub(t.mul(.58)).mul(2.3),z.mul(2.0),t.mul(.08))).mul(.5).add(.5);
  const ragged=smoothstep(.26,.63,foamNoise),holes=mix(float(.60),smoothstep(.24,.62,bubbles),detail);
  const crestFoam=profile.breaker.mul(mix(float(.55),float(1),ragged)).mul(holes).mul(.90);
  const trailingFoam=profile.foamTrail.mul(smoothstep(.38,.72,foamNoise)).mul(holes).mul(.47);
  const wetFront=float(1).sub(smoothstep(.05,.34,depth));
  const wash=profile.wash.mul(wetFront).mul(ragged).mul(.66);
  const lace=wetFront.mul(profile.foamTrail.add(profile.wash).min(1)).mul(smoothstep(.56,.78,bubbles)).mul(.24);
  const whitecaps=profile.crest.mul(smoothstep(1.05,1.5,this.waveScale)).mul(smoothstep(2.0,6.0,depth)).mul(smoothstep(.66,.82,foamNoise)).mul(.52);
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
// Foam marks turbulent water, independently of the shallow-depth geometry limiter.
  // Multiplying by wakeGain hid the wake precisely where tyres churn the shallows.
  const naturalFoam=max(max(crestFoam,trailingFoam),wash.add(lace)).max(whitecaps).mul(smoothstep(.008,.09,depth));
  const foam=max(max(naturalFoam,wake.a.mul(smoothstep(.015,.12,depth)).mul(1.65).min(.92).mul(smoothstep(.12,.52,foamNoise))),tireFoam).min(.96);
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
  const foamColor=mix(color('#e8efed'),this.cloudColor,.22).mul(ambient.mul(.40).add(.60));
  material.colorNode=mix(waterColor,foamColor,foam).mul(this.brightness).add(vehicleSheen);

  // The old +12m cutoff crossed submerged sand. Let actual depth feather the
  // moving shoreline, suppressing nearly coplanar water/sand flicker. The mesh
  // ends well inside dry dunes; its outer safety fade is normally occluded.
  const shoreContact=smoothstep(.01,.12,depth);
  const mainlandOpacity=mix(float(.68),float(.94),smoothstep(.12,2,depth)).mul(shoreContact).mul(float(1).sub(smoothstep(COASTAL_WATER_EXTENT-4,COASTAL_WATER_EXTENT,d)));
  material.opacityNode=mix(mainlandOpacity,mix(float(.36),float(.94),smoothstep(.05,3,depth)).mul(smoothstep(.005,.10,depth)),islands);
  // One constant mesh covers the coast and horizon. Its dense patch follows
  // the truck offshore, so tyre wakes always reach actual surface vertices.
  // Reuse the buffers when the detail window moves; never add an overlay sheet.
  const count=(this.nx+1)*(this.nz+1),positions=new Float32Array(count*3),normals=new Float32Array(count*3),beds=new Float32Array(count),indices=new Uint32Array(this.nx*this.nz*6);
  this.columnOffsets=new Float64Array(this.nx+1);this.rowOffsets=new Float64Array(this.nz+1);
  const nearZ=mobile?128:192,outerZ=(this.nz-nearZ)/2,nearX=this.nearX;
  for(let i=0;i<=this.nx;i++)this.columnOffsets[i]=i<=nearX?12-i*40/nearX:-28-1172*Math.pow((i-nearX)/(this.nx-nearX),1.55);
  for(let j=0;j<=this.nz;j++)this.rowOffsets[j]=j<outerZ?-640+j*(592/outerZ):j<=outerZ+nearZ?-48+(j-outerZ)*96/nearZ:48+(j-outerZ-nearZ)*592/outerZ;
  let k=0;for(let j=0;j<=this.nz;j++)for(let i=0;i<=this.nx;i++){const a=j*(this.nx+1)+i;normals[a*3+1]=1;if(i<this.nx&&j<this.nz){const b=a+1,c=a+this.nx+1;indices.set([a,b,c,b,c+1,c],k);k+=6}}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setAttribute('oceanBed',new THREE.BufferAttribute(beds,1).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(new THREE.BufferAttribute(indices,1));
  this.surfDistance=1000;this.surfPhase=0;this.surfPoint={x:0,z:0};this.surfTarget={x:0,z:0};this.surfFrameTime=0;this.surfSample={time:-Infinity,x:Infinity,z:Infinity};
  this.material=material;this.mesh=new THREE.Mesh(geometry,material);this.mesh.renderOrder=1;this.mesh.frustumCulled=false;scene.add(this.mesh);
 }
 update(p,time,origin,{budgetMs=Infinity}={}){
  this.wake.move(p.x??shore(p.z),p.z);this.wake.step(Math.max(0,time-this.lastTime));this.lastTime=time;
  const values=this.wake.pack();for(let i=0;i<values.length;i++)this.wakePixels[i]=THREE.DataUtils.toHalfFloat(values[i]);this.wakeTexture.needsUpdate=true;this.wakeOrigin.value.set(this.wake.x,this.wake.z);
  this.clock.value=time;this.origin.value.set(origin.x,origin.z);this.updateSurf(p,time);
  this.gridStream??=new OceanGridStream(this);
  this.gridStream.update(p,origin,budgetMs);
 }

 // A nearby -1m contour is a useful surf source, including on island
 // shores. Sampling at 2.5Hz keeps terrain work out of the audio render path.
 updateSurf(p,time){
  const x=p.x??shore(p.z),z=p.z,last=this.surfSample,dt=Math.max(0,Math.min(.1,time-this.surfFrameTime)),snap=!Number.isFinite(last.time)||time<last.time||Math.hypot(x-last.x,z-last.z)>20;this.surfFrameTime=time;
  if(time-last.time>=.4||snap){
   const region=archipelagoRegion(x,z);
   if(region>.01){
    const sample=(a,b)=>islandOceanBed(a,b,baseHeight),bed=sample(x,z),gx=(sample(x+3,z)-sample(x-3,z))/6,gz=(sample(x,z+3)-sample(x,z-3))/6;
    const slope=Math.hypot(gx,gz),distance=Math.min(300,Math.abs(bed+1)/Math.max(.035,slope)),factor=Math.max(-60,Math.min(60,(-1-bed)/Math.max(.035,slope)));
    const islandDistance=distance,mainlandDistance=Math.abs(x-shore(z)+8);
    this.surfDistance=mainlandDistance*(1-region)+islandDistance*region;
    this.surfTarget.x=(shore(z)-8)*(1-region)+(x+gx/Math.max(.001,slope)*factor)*region;
    this.surfTarget.z=z+gz/Math.max(.001,slope)*factor*region;
   }else{this.surfDistance=Math.abs(x-shore(z)+8);this.surfTarget.x=shore(z)-8;this.surfTarget.z=z;}
   Object.assign(last,{time,x,z});
  }
  // Irregular shelves can move the estimated contour between samples. Ease
  // the sound source, so a new estimate cannot restart a breaking-wave cycle.
  if(snap){Object.assign(this.surfPoint,this.surfTarget);}else{
   const dx=this.surfTarget.x-this.surfPoint.x,dz=this.surfTarget.z-this.surfPoint.z,k=Math.min(1-Math.exp(-dt*2),4*dt/Math.max(.0001,Math.hypot(dx,dz)));
   this.surfPoint.x+=dx*k;this.surfPoint.z+=dz*k;
  }
  this.surfPhase=oceanWavePhase(this.surfPoint.x-shore(this.surfPoint.z),this.surfPoint.z,time);
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
 dispose(){this.gridStream?.dispose();this.bedRows.clear();this.mesh.geometry.dispose();this.material.dispose();this.wakeTexture.dispose();this.islandBedTexture.dispose()}
}
