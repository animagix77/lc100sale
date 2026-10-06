import * as THREE from 'three/webgpu';
import {attribute,texture,uv,length,smoothstep,float,mx_noise_float,vec3} from 'three/tsl';
import {surfaceProfile,oceanHeight} from './ocean-height.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class SurfaceEffects{
 constructor(scene,field,{mobile=false,random=Math.random,waterHeight=oceanHeight}={}){
  this.scene=scene;this.field=field;this.waterHeight=waterHeight;this.random=random;this.dummy=new THREE.Object3D();this.stats={sand:0,dust:0,splash:0,wake:0};this.wakeStep=[0,0,0,0];this.dustStep=[0,0,0,0];
  const pixels=new Uint8Array(64*64*4);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){const r=Math.hypot((x-31.5)/31.5,(y-31.5)/31.5),i=(y*64+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=Math.round(Math.pow(Math.max(0,1-r*r),2.2)*255)}
  this.sprite=new THREE.DataTexture(pixels,64,64,THREE.RGBAFormat);this.sprite.needsUpdate=true;this.sprite.magFilter=this.sprite.minFilter=THREE.LinearFilter;
  const make=(kind,count,geometry,color,opacity,sprite=false)=>{
   const alpha=new THREE.InstancedBufferAttribute(new Float32Array(count),1);geometry.setAttribute('effectAlpha',alpha);
   const material=new THREE.MeshBasicNodeMaterial({color,transparent:true,depthWrite:false,side:THREE.DoubleSide});
   material.opacityNode=sprite?texture(this.sprite).a.mul(attribute('effectAlpha','float')):attribute('effectAlpha','float');
   if(kind==='wake'){const radius=length(uv().sub(.5)).mul(2),edge=smoothstep(.70,.85,radius).mul(float(1).sub(smoothstep(.85,1,radius))),broken=smoothstep(-.35,.55,mx_noise_float(vec3(uv().mul(12),float(4))));material.opacityNode=attribute('effectAlpha','float').mul(edge).mul(broken)}
   const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.frustumCulled=false;mesh.renderOrder=kind==='wake'?2:3;scene.add(mesh);
   return {kind,mesh,alpha,opacity,cursor:0,particles:Array.from({length:count},()=>({life:0}))};
  };
  this.sand=make('sand',mobile?160:260,new THREE.OctahedronGeometry(.028,0),'#e2af7b',.72);
  this.dust=make('dust',mobile?28:48,new THREE.PlaneGeometry(1,1),'#cfa174',.13,true);
  this.wake=make('wake',mobile?64:110,new THREE.RingGeometry(.70,1,32),'#d9eee6',.18);
  this.pools=[this.sand,this.dust,this.wake];
 }
 spawn(pool,values){const p=pool.particles[pool.cursor++%pool.particles.length];Object.assign(p,values,{life:values.ttl});this.stats[pool.kind]++;return p}
 emit(mark,heading,speed,time){
  const ground=this.field.height(mark.x,mark.z),profile=surfaceProfile(mark,speed,ground,time);
  if(!profile.emit)return profile.wet;
  const rand=this.random,fx=-Math.sin(heading),fz=-Math.cos(heading),dir=mark.dir||Math.sign(speed)||1;
  const slip=Math.min(6,mark.slip),pace=Math.min(7,Math.abs(speed)),sideSign=mark.wheel%2===0?-1:1;
  if(profile.wet){
   // Overlapping expanding ellipses leave a short foamy tire wake that follows the waves.
   if(pace>.45&&mark.wheel>=2&&++this.wakeStep[mark.wheel]%2===0)this.spawn(this.wake,{x:mark.x,z:mark.z,y:profile.water+.045,vx:0,vz:0,vy:0,size:.22+pace*.025,ttl:1.0+rand()*.35,angle:heading});
  }else{
   const count=Math.min(8,Math.ceil(.7+pace*.16+slip*(.65+mark.soft*1.05)));
   for(let j=0;j<count;j++){
    const back=.6+pace*.12+slip*(.35+rand()*.35),side=(rand()-.5)*1.4;
    this.spawn(this.sand,{x:mark.x+(rand()-.5)*.24,z:mark.z+(rand()-.5)*.24,y:ground+.14,vx:-fx*dir*back+Math.cos(heading)*side,vz:-fz*dir*back-Math.sin(heading)*side,vy:.35+rand()*.65+slip*.16,size:.5+rand(),ttl:.40+rand()*.28,angle:rand()*6.28});
   }
   if(profile.dust&&mark.wheel>=2&&++this.dustStep[mark.wheel]%2===0){
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
     if(pool.kind==='wake')p.y=this.waterHeight(p.x,p.z,time)+.045;
     else{
      p.vy-=(pool.kind==='dust'?0:7.8)*dt;
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
      const ground=this.field.height(p.x,p.z),floor=ground;
      if(p.y<floor){if(pool.kind==='dust')p.y=floor+.12;else p.life=0}
     }
     d.position.set(p.x-origin.x,p.y,p.z-origin.z);
     const fade=Math.pow(Math.max(0,1-age),pool.kind==='dust'?1.3:1);
     if(pool.kind==='dust'){
      d.quaternion.copy(camera.quaternion);d.rotateZ(p.angle);
      const size=p.size*(pool.kind==='dust'?1+age*.85:1);d.scale.set(size,size,1);
     }else if(pool.kind==='wake'){
      d.rotation.set(-Math.PI/2,0,p.angle);const size=p.size+age*.65;d.scale.set(size*.8,size*1.45,1);
     }else{d.rotation.set(age*5,p.angle,age*3);d.scale.setScalar(p.size*Math.max(.1,fade));}
     pool.alpha.setX(i,p.life>0?pool.opacity*fade*(pool.kind==='dust'?Math.min(1,age*12):1):0);
    }else{d.scale.setScalar(0);pool.alpha.setX(i,0)}
    d.updateMatrix();pool.mesh.setMatrixAt(i,d.matrix);
   }
   pool.mesh.instanceMatrix.needsUpdate=true;pool.alpha.needsUpdate=true;
  }
 }
 clear(){for(const pool of this.pools)for(const p of pool.particles)p.life=0}
 dispose(){for(const pool of this.pools){this.scene.remove(pool.mesh);pool.mesh.geometry.dispose();pool.mesh.material.dispose()}this.sprite.dispose()}
}
