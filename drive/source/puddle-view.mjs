import * as THREE from 'three/webgpu';
import {uniform,attribute,positionWorld,cameraPosition,vec3,float,sin,smoothstep,mix,color,mx_noise_float,normalize,transformNormalToView,dot,max,pow,reflect} from 'three/tsl';
import {MUD_PUDDLES} from './mud-puddles.mjs';
import {baseHeight} from './terrain.mjs';

// Clip the waterline against the exact half-metre triangles used by terrain and
// collision. Horizontal tops have natural shores, not floating circular decals.
export function buildPuddleGeometry(){
 const positions=[],depths=[],ids=[];
 const append=(poly,p)=>{
  for(let i=1;i<poly.length-1;i++)for(const v of [poly[0],poly[i],poly[i+1]]){positions.push(v.x,p.level+.003,v.z);depths.push(Math.max(0,p.level-v.h));ids.push(p.index);}
 };
 for(const p of MUD_PUDDLES){
  const minX=Math.floor((p.x-p.radius)*2)/2,maxX=Math.ceil((p.x+p.radius)*2)/2,minZ=Math.floor((p.z-p.radius)*2)/2,maxZ=Math.ceil((p.z+p.radius)*2)/2;
  const vertex=(x,z)=>({x,z,h:baseHeight(x,z)});
  for(let z=minZ;z<maxZ;z+=.5)for(let x=minX;x<maxX;x+=.5){
   const a=vertex(x,z),b=vertex(x+.5,z),c=vertex(x,z+.5),d=vertex(x+.5,z+.5);
   for(const triangle of [[a,c,b],[b,c,d]]){
    // Surveyed rims enclose every wet triangle. Only retain pools belonging to
    // this basin; unrelated downhill terrain can never become a water sheet.
    if(triangle.some(v=>Math.hypot(v.x-p.x,v.z-p.z)>p.radius*1.15))continue;
    const clipped=[];
    for(let i=0;i<3;i++){
     const a=triangle[i],b=triangle[(i+1)%3],insideA=a.h<p.level,insideB=b.h<p.level;
     if(insideA)clipped.push(a);
     if(insideA!==insideB){const t=(p.level-a.h)/(b.h-a.h);clipped.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,h:p.level});}
    }
    if(clipped.length>=3)append(clipped,p);
   }
  }
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('puddleDepth',new THREE.Float32BufferAttribute(depths,1));geometry.setAttribute('puddleId',new THREE.Float32BufferAttribute(ids,1));geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
export class MudPuddles{
 constructor(scene,{ocean,reduced=false}={}){
  this.origin=uniform(new THREE.Vector2());this.anchor=uniform(new THREE.Vector2());this.rain=uniform(0);this.clock=uniform(0);this.reduced=reduced;
  const world=positionWorld.xz.add(this.origin),time=this.clock,depth=attribute('puddleDepth','float');
  const noise=mx_noise_float(vec3(world.x.mul(7).add(time.mul(.25)),world.y.mul(7),float(8)));
  // Raindrop rings repeat in offset world cells and disturb normals only. Their
  // very small displacement cannot open holes in a centimetres-deep pool.
  const cell=world.mul(1.75),local=cell.fract().sub(.5),seed=sin(cell.x.floor().mul(127.1).add(cell.y.floor().mul(311.7))).mul(43758.5).fract();
  const age=time.mul(1.2).add(seed).fract(),radial=local.length();
  const ring=float(1).sub(smoothstep(.025,.07,radial.sub(age.mul(.64)).abs())).mul(float(1).sub(age)).mul(this.rain);
  const normal=normalize(vec3(noise.mul(.009).add(ring.mul(.025)),1,noise.mul(.012).sub(ring.mul(.021))));
  const eye=normalize(cameraPosition.sub(positionWorld)),fresnel=pow(float(1).sub(max(dot(eye,normal),0)),5).mul(.7).add(.08),ray=reflect(eye.negate(),normal);
  const horizon=ocean?.skyHorizon??color('#84928c'),top=ocean?.skyTop??color('#536876'),brightness=ocean?.brightness??float(1),sky=mix(horizon,top,smoothstep(.02,.7,ray.y));
  const material=new THREE.MeshPhysicalNodeMaterial({ior:1.333,metalness:0,transparent:true,depthWrite:false,side:THREE.FrontSide});
  material.normalNode=transformNormalToView(normal);
  material.colorNode=mix(color('#57452e'),color('#667577'),fresnel.mul(.6)).add(ring.mul(.035));
  material.emissiveNode=sky.mul(fresnel).mul(.46).mul(brightness);
  material.roughnessNode=float(.12).add(this.rain.mul(.08));
  material.opacityNode=smoothstep(0,.025,depth).mul(float(.46).add(fresnel.mul(.46))).mul(float(1).sub(smoothstep(45,80,positionWorld.xz.distance(this.anchor))));
  this.mesh=new THREE.Mesh(buildPuddleGeometry(),material);this.mesh.name='rain-filled-trail-puddles';this.mesh.receiveShadow=true;this.mesh.renderOrder=2;this.mesh.frustumCulled=false;scene.add(this.mesh);
  this.stats={pools:MUD_PUDDLES.length,triangles:this.mesh.geometry.attributes.position.count/3};
 }
 update(p,origin,time,rain=0){
  this.origin.value.set(origin.x,origin.z);this.anchor.value.set(p.x-origin.x,p.z-origin.z);this.clock.value=this.reduced?0:time;this.rain.value=this.reduced?0:Math.max(0,Math.min(1,rain));this.mesh.position.set(-origin.x,0,-origin.z);
  this.mesh.visible=MUD_PUDDLES.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<84);
 }
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
