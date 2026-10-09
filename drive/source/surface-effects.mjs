import * as THREE from 'three/webgpu';
import {attribute,texture,uv,length,smoothstep,float,mx_noise_float,vec3} from 'three/tsl';
import {surfaceAt} from './terrain.mjs';
import {surfaceProfile,waterSurfaceHeight} from './ocean-height.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// A curved fan connects the flying droplets into a brief sheet of thrown water.
// One shared low-poly mesh serves every pooled burst, including on tablets.
function sprayFanGeometry(){
 const positions=[],uvs=[],indices=[],rows=6,cols=6;
 for(let z=0;z<=rows;z++)for(let x=0;x<=cols;x++){
  const u=z/rows,v=x/cols*2-1;
  positions.push(v*(.035+u*.5),Math.sin(u*Math.PI)*(.70-v*v*.19),u);uvs.push(x/cols,u);
  if(z<rows&&x<cols){const a=z*(cols+1)+x,b=a+cols+1;indices.push(a,b,a+1,a+1,b,b+1)}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
export class SurfaceEffects{
 constructor(scene,field,{mobile=false,random=Math.random,waterHeight=waterSurfaceHeight}={}){
  this.scene=scene;this.field=field;this.waterHeight=waterHeight;this.random=random;this.dummy=new THREE.Object3D();this.stats={sand:0,dust:0,powder:0,splash:0,sheet:0,wake:0};this.wakeStep=[0,0,0,0];this.dustStep=[0,0,0,0];this.powderStep=[0,0,0,0];this.lastEmission=[-Infinity,-Infinity,-Infinity,-Infinity];this.emissionInterval=1/(mobile?20:28);this.looseEmissionInterval=1/(mobile?16:22);this.looseBurstLimit=mobile?8:10;
  const pixels=new Uint8Array(64*64*4);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){const r=Math.hypot((x-31.5)/31.5,(y-31.5)/31.5),i=(y*64+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=Math.round(Math.pow(Math.max(0,1-r*r),2.2)*255)}
  this.sprite=new THREE.DataTexture(pixels,64,64,THREE.RGBAFormat);this.sprite.needsUpdate=true;this.sprite.magFilter=this.sprite.minFilter=THREE.LinearFilter;
  const make=(kind,count,geometry,color,opacity,sprite=false)=>{
   const alpha=new THREE.InstancedBufferAttribute(new Float32Array(count),1);geometry.setAttribute('effectAlpha',alpha);
   const Material=kind==='sheet'?THREE.MeshStandardNodeMaterial:THREE.MeshBasicNodeMaterial;
   const material=new Material({color,transparent:true,depthWrite:false,side:THREE.DoubleSide,...(kind==='sheet'?{roughness:.28,metalness:.04}:{})});
   material.opacityNode=sprite?texture(this.sprite).a.mul(attribute('effectAlpha','float')):attribute('effectAlpha','float');
   if(kind==='wake'){const radius=length(uv().sub(.5)).mul(2),edge=smoothstep(.70,.85,radius).mul(float(1).sub(smoothstep(.85,1,radius))),broken=smoothstep(-.35,.55,mx_noise_float(vec3(uv().mul(12),float(4))));material.opacityNode=attribute('effectAlpha','float').mul(edge).mul(broken)}
   if(kind==='sheet'){
    const edge=float(1).sub(smoothstep(.30,.5,uv().x.sub(.5).abs())),ends=smoothstep(0,.12,uv().y).mul(float(1).sub(smoothstep(.72,1,uv().y)));
    const torn=smoothstep(-.36,.34,mx_noise_float(vec3(uv().x.mul(12),uv().y.mul(8),float(9))));
    material.opacityNode=attribute('effectAlpha','float').mul(edge).mul(ends).mul(torn.mul(.72).add(.28));
   }
   const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.frustumCulled=false;mesh.renderOrder=kind==='wake'?2:3;scene.add(mesh);
   return {kind,mesh,alpha,opacity,cursor:0,particles:Array.from({length:count},()=>({life:0}))};
  };
  this.sand=make('sand',mobile?384:640,new THREE.OctahedronGeometry(.028,0),'#ffffff',.72);
  // Allocate tint before the preload compile, so the GPU includes instance color.
  this.sand.mesh.setColorAt(0,new THREE.Color('#e2af7b'));
  this.dust=make('dust',mobile?28:48,new THREE.PlaneGeometry(1,1),'#cfa174',.13,true);
  this.powder=make('powder',mobile?48:64,new THREE.PlaneGeometry(1,1),'#edf5fc',.44,true);
  this.wake=make('wake',mobile?64:110,new THREE.RingGeometry(.70,1,32),'#d9eee6',.18);
  this.splash=make('splash',mobile?360:576,new THREE.SphereGeometry(1,6,4),'#d6eee8',.56);
  this.sheet=make('sheet',mobile?24:40,sprayFanGeometry(),'#c3dad8',.42);
  this.pools=[this.sand,this.dust,this.powder,this.wake,this.splash,this.sheet];
  this.splashStep=[0,0,0,0];this.up=new THREE.Vector3(0,1,0);this.dropDirection=new THREE.Vector3();this.particleColor=new THREE.Color();
 }
 spawn(pool,values){const p=pool.particles[pool.cursor++%pool.particles.length];Object.assign(p,values,{life:values.ttl});this.stats[pool.kind]++;return p}
 emit(mark,heading,speed,time){
  const surface=surfaceAt(mark.x,mark.z),ground=Number.isFinite(mark.y)?mark.y:this.field.height(mark.x,mark.z),profile=surfaceProfile(mark,speed,ground,time,this.waterHeight(mark.x,mark.z,time));
  if(!profile.emit)return profile.wet;
  // Physics can stamp the same wheel several times in one rendered frame.
  // Gate each tire by elapsed time so high road speed cannot flood the pools.
  const since=time-this.lastEmission[mark.wheel];
  const loose=!profile.wet&&Math.max(surface.snow,surface.mud)>.25;
  if(since>=0&&since<(loose?this.looseEmissionInterval:this.emissionInterval))return profile.wet;
  this.lastEmission[mark.wheel]=time;
  const rand=this.random,fx=-Math.sin(heading),fz=-Math.cos(heading),dir=mark.dir||Math.sign(speed)||1;
  const slip=Math.min(6,mark.slip),pace=Math.min(7,Math.abs(speed)),sideSign=mark.wheel%2===0?-1:1;
  if(profile.wet){
   // Deeper, faster contact throws broad rearward fans. Puddles and crawling
   // never inherit the full crossing effect, and 50 mph stays within fixed pools.
   const waterPace=Math.min(22.352,Math.abs(speed)),spin=Math.min(2,slip*.20),depth=clamp((profile.water-ground-.025)/.55,0,1),wetStrength=.20+.80*Math.sqrt(depth),fast=clamp((waterPace-3)/16,0,1);
   const pulse=++this.splashStep[mark.wheel];
   if(waterPace+spin>.45&&pulse%(waterPace<2?2:1)===0){
    const count=waterPace>12?5:waterPace>5?4:waterPace>2?2:1;
    for(let j=0;j<count;j++){
     const outward=sideSign*(.10+waterPace*.14)*wetStrength*(.70+rand()*.6),back=(.65+waterPace*.42+spin*.25)*(.6+.4*wetStrength)*(.78+rand()*.45);
     const x=mark.x-fx*dir*.36+Math.cos(heading)*sideSign*.06,z=mark.z-fz*dir*.36-Math.sin(heading)*sideSign*.06;
     const water=this.waterHeight(x,z,time);if(!Number.isFinite(water)||water<=this.field.height(x,z)+.015)continue;
     this.spawn(this.splash,{x,z,y:water+.06,
      vx:-fx*dir*back+Math.cos(heading)*outward,vz:-fz*dir*back-Math.sin(heading)*outward,
      vy:(.42+waterPace*.29)*(.45+.55*wetStrength)+spin*.2+rand()*.42,size:.010+rand()*.009+fast*.022*wetStrength,ttl:.25+waterPace*.044+rand()*.10,angle:0});
    }
   }
   if(waterPace>5&&depth>.08&&pulse%2===0){
    this.spawn(this.sheet,{x:mark.x-fx*dir*.28,z:mark.z-fz*dir*.28,y:profile.water+.05,vx:0,vz:0,vy:0,
     size:.38+fast*1.65*wetStrength,height:.24+fast*2.05*wetStrength,length:.70+waterPace*.15,
     ttl:.36+fast*.27,angle:heading+(dir<0?Math.PI:0)+sideSign*.16});
   }
   // Low, spreading foam follows the displaced surface behind the rear tires.
   if(waterPace>.45&&mark.wheel>=2&&pulse%2===0)this.spawn(this.wake,{x:mark.x,z:mark.z,y:profile.water+.045,vx:0,vz:0,vy:0,size:.22+waterPace*.042*wetStrength,spread:.65+fast*.8,ttl:1.0+fast*.55+rand()*.35,angle:heading});
  }else{
   const snow=clamp(surface.snow,0,1),mud=clamp(surface.mud,0,1),heavy=Math.max(snow,mud),loosePace=Math.min(11.2,Math.abs(speed));
   const medium=snow>.35?'snow':mud>.3?'mud':'sand',solid=medium!=='sand';
   const count=Math.min(solid?this.looseBurstLimit:8,Math.ceil(.7+pace*.16+slip*(.65+mark.soft*1.05)+heavy*(4.2+loosePace*.28)));
   for(let j=0;j<count;j++){
    // Wet soil leaves in heavy clods; powder snow lifts in a broader bright fan.
    // A stronger arc is more readable than adding hundreds of tiny grains.
    const back=.6+pace*.12+slip*(.35+rand()*.35)+heavy*(.7+loosePace*.20),side=(rand()-.5)*(1.4+heavy*1.5)+sideSign*heavy*(.25+loosePace*.025);
    const launch=solid?.85+loosePace*.095+slip*.20+rand()*.85+snow*.40:.35+rand()*.65+slip*.16;
    this.spawn(this.sand,{
     medium,tint:medium==='snow'?(j%4===0?'#ccdfea':'#f4f9ff'):medium==='mud'?(j%4===0?'#86634a':'#493529'):'#e2af7b',
     x:mark.x-fx*dir*(solid?.32:.23)+(rand()-.5)*.20,z:mark.z-fz*dir*(solid?.32:.23)+(rand()-.5)*.20,y:ground+(solid?.22:.16),
     vx:-fx*dir*back+Math.cos(heading)*side,vz:-fz*dir*back-Math.sin(heading)*side,
     vy:launch,size:solid?(medium==='snow'?2.1:1.8)+rand()*.9+loosePace*.025+slip*.08:.5+rand(),
     ttl:solid?.64+rand()*.17+snow*.10:.40+rand()*.28,angle:rand()*6.28,
     gravity:medium==='snow'?6.0:medium==='mud'?9.0:7.8,stretch:medium==='mud'?1.45:1,retention:solid?.86:0,opacity:solid?1.32:1
    });
   }
   // Separate pacing prevents all four tires recycling the powder pool before
   // its fan opens. White puffs stay behind the wheels and below the rear glass.
   const powderPulse=snow>.25?++this.powderStep[mark.wheel]:0;
   if(powderPulse&&powderPulse%(mark.wheel<2?3:2)===0){
    const backward=1.05+loosePace*.19+slip*.17;
    this.spawn(this.powder,{x:mark.x-fx*dir*.38,z:mark.z-fz*dir*.38,y:ground+.25,
     vx:-fx*dir*backward+Math.cos(heading)*sideSign*.32,vz:-fz*dir*backward-Math.sin(heading)*sideSign*.32,
     vy:.60+snow*.24+loosePace*.055+slip*.055,size:(.56+loosePace*.042+slip*.025)*(.6+snow*.4),
     width:1.32,height:.82,ttl:.83+rand()*.17,angle:rand()*6.28});
   }
   if(profile.dust&&surface.snow<.15&&surface.mud<.15&&mark.wheel>=2&&++this.dustStep[mark.wheel]%2===0){
    this.spawn(this.dust,{x:mark.x,z:mark.z,y:ground+.14,vx:-fx*dir*(.5+pace*.15)+.3,vz:-fz*dir*(.5+pace*.15),vy:.06+rand()*.08,size:.20+pace*.035+mark.soft*.1+slip*.025,ttl:.65+rand()*.35,angle:rand()*6.28});
   }
  }
  return profile.wet;
 }
 update(dt,camera,origin,time){
  const d=this.dummy;
  for(const pool of this.pools){
   for(let i=0;i<pool.particles.length;i++){
    const p=pool.particles[i];
    if(p.life>0){
     p.life=Math.max(0,p.life-dt);const age=1-p.life/p.ttl;
     if(pool.kind==='wake'||pool.kind==='sheet'){const water=this.waterHeight(p.x,p.z,time);if(!Number.isFinite(water)||water<=this.field.height(p.x,p.z)+.015)p.life=0;else p.y=water+.045;}
     else{
      p.vy-=(pool.kind==='dust'?0:pool.kind==='powder'?.85:pool.kind==='splash'?9.81:p.gravity??7.8)*dt;
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
      const ground=this.field.height(p.x,p.z),floor=pool.kind==='splash'?Math.max(ground,this.waterHeight(p.x,p.z,time)):ground;
      if(p.y<floor){if(pool.kind==='dust'||pool.kind==='powder')p.y=floor+.12;else p.life=0}
     }
     d.position.set(p.x-origin.x,p.y,p.z-origin.z);
     const airborne=pool.kind==='dust'||pool.kind==='powder',solid=pool.kind==='sand'&&p.medium!=='sand';
     const fade=solid?1-Math.pow(clamp((age-.35)/.65,0,1),2):Math.pow(Math.max(0,1-age),pool.kind==='powder'?.85:airborne?1.3:1);
     if(airborne){
      d.quaternion.copy(camera.quaternion);d.rotateZ(p.angle);
      const size=p.size*(1+age*.85);d.scale.set(size*(p.width??1),size*(p.height??1),1);
     }else if(pool.kind==='wake'){
      d.rotation.set(-Math.PI/2,0,p.angle);const size=p.size+age*(p.spread??.65);d.scale.set(size*.8,size*1.45,1);
     }else if(pool.kind==='sheet'){
      d.rotation.set(0,p.angle,0);const growth=Math.min(1,age*8);d.scale.set(p.size*growth,p.height*growth*(1-age*.7),p.length*growth);
     }else if(pool.kind==='splash'){
      this.dropDirection.set(p.vx,p.vy,p.vz).normalize();d.quaternion.setFromUnitVectors(this.up,this.dropDirection);
      d.scale.set(p.size,p.size*(1.8+Math.min(2,Math.abs(p.vy)*.5)),p.size);
     }else{d.rotation.set(age*5,p.angle,age*3);const size=p.size*Math.max(.1,p.retention?Math.max(p.retention,1-age*.18):fade);d.scale.set(size,size/(p.stretch||1),size);}
     pool.alpha.setX(i,p.life>0?Math.min(1,pool.opacity*(p.opacity??1))*fade*(airborne?Math.min(1,age*12):1):0);
    }else{d.scale.setScalar(0);pool.alpha.setX(i,0)}
    d.updateMatrix();pool.mesh.setMatrixAt(i,d.matrix);if(pool.kind==='sand')pool.mesh.setColorAt(i,this.particleColor.set(p.tint||'#e2af7b'));
   }
   pool.mesh.instanceMatrix.needsUpdate=true;if(pool.mesh.instanceColor)pool.mesh.instanceColor.needsUpdate=true;pool.alpha.needsUpdate=true;
  }
 }
 clear(){for(const pool of this.pools)for(const p of pool.particles)p.life=0;this.lastEmission.fill(-Infinity);this.wakeStep.fill(0);this.dustStep.fill(0);this.powderStep.fill(0);this.splashStep.fill(0)}
 dispose(){for(const pool of this.pools){this.scene.remove(pool.mesh);pool.mesh.geometry.dispose();pool.mesh.material.dispose()}this.sprite.dispose()}
}
