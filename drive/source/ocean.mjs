import * as THREE from 'three/webgpu';
import {Fn,uniform,positionGeometry,positionWorld,cameraPosition,vec2,vec3,float,color,mix,sin,cos,pow,abs,max,normalize,dot,reflect,smoothstep,length,mx_noise_float} from 'three/tsl';
import {shore} from './terrain.mjs';
// GPU swells, fine surface normals and view-dependent sunset reflection. World-space
// phase stays continuous while the mesh streams along the infinite coastline.
export class Ocean{
 constructor(scene,{mobile=false}={}){
  this.clock=uniform(0);this.origin=uniform(new THREE.Vector2());this.center=Infinity;this.originKey='';this.nx=mobile?100:144;this.nz=mobile?180:256;
  const t=this.clock,origin=this.origin;
  const coast=Fn(([z])=>float(-36).add(sin(z.mul(.006)).mul(8)).add(sin(z.mul(.019)).mul(3)));
  const height=Fn(([x,z])=>{
   const d=x.sub(coast(z)),offshore=float(1).sub(smoothstep(-25,2,d));
   const phase=d.mul(.30).sub(z.mul(.025)).add(sin(z.mul(.071)).mul(1.2)).add(sin(z.mul(.13)).mul(.3)).sub(t.mul(1.35));
   const swell=sin(phase).mul(.36).add(sin(d.mul(.14).add(z.mul(.046)).sub(t.mul(.78))).mul(.20));
   const cross=sin(x.mul(.41).add(z.mul(.23)).sub(t.mul(1.05))).mul(.065);
   return float(-.18).add(swell.add(cross).mul(offshore)).add(sin(t.mul(.8).sub(z.mul(.026))).mul(.075).mul(float(1).sub(offshore)));
  });
  const material=new THREE.MeshBasicNodeMaterial({transparent:true,depthWrite:false,side:THREE.FrontSide});
  material.positionNode=Fn(()=>{const world=positionGeometry.xz.add(origin);return vec3(positionGeometry.x,height(world.x,world.y),positionGeometry.z)})();
  const world=positionWorld.xz.add(origin),x=world.x,z=world.y,d=x.sub(coast(z));
  const h=height(x,z),detail=float(1).sub(smoothstep(30,150,length(cameraPosition.sub(positionWorld)))),fineA=mx_noise_float(vec3(x.mul(.65).add(t.mul(.18)),z.mul(.65),t.mul(.12))).mul(detail),fineB=mx_noise_float(vec3(x.mul(.75),z.mul(.75).sub(t.mul(.2)),float(17))).mul(detail);
  const n=normalize(vec3(height(x.sub(.14),z).sub(height(x.add(.14),z)).add(fineA.mul(.055)),float(.28),height(x,z.sub(.14)).sub(height(x,z.add(.14))).add(fineB.mul(.055))));
  const eye=normalize(cameraPosition.sub(positionWorld)),fresnel=pow(float(1).sub(max(dot(eye,n),0)),4).mul(.60).add(.04);
  const skyRay=reflect(eye.negate(),n);
  const reflectedSky=mix(color('#b58073'),color('#46576c'),smoothstep(.025,.60,skyRay.y));
  const deep=mix(color('#327e79'),color('#153b53'),smoothstep(2,100,d.negate()));
  const scatter=color('#45a399').mul(smoothstep(-.15,.35,h)).mul(.24);
  const sunDirection=normalize(vec3(-430,105,-650));
  const alignment=max(dot(eye,reflect(sunDirection.negate(),n)),0);
  const glitter=pow(alignment,120).mul(.12).add(pow(alignment,550).mul(.75));
  const reflected=reflectedSky.add(color('#ffe2af').mul(glitter));
  const waterColor=mix(deep.add(scatter),reflected,fresnel);
  // Broken crest foam and a separate wash front replace the previous straight stripes.
  const foamNoise=mx_noise_float(vec3(x.mul(.82).add(t.mul(.12)),z.mul(.82),t.mul(.20))).mul(.5).add(.5);
  const breakZone=smoothstep(-38,-17,d).mul(float(1).sub(smoothstep(-4,3,d)));
  const crestFoam=smoothstep(.12,.34,h).mul(breakZone).mul(smoothstep(.32,.68,foamNoise));
  const washPhase=sin(t.mul(.8).sub(z.mul(.026)).add(sin(z.mul(.16)).mul(.22)));
  const front=washPhase.mul(4.8).add(1.0).add(sin(z.mul(.46).add(t.mul(.35))).mul(.42));
  const wash=float(1).sub(smoothstep(.25,1.7,abs(d.sub(front)))).mul(smoothstep(.27,.62,foamNoise)).mul(.78);
  const lace=float(1).sub(smoothstep(.1,.65,abs(d.sub(front).add(2.2)))).mul(smoothstep(.55,.78,foamNoise)).mul(.3);
  const foam=max(crestFoam, wash.add(lace));
  material.colorNode=mix(waterColor,color('#f5dec0'),foam);
  material.opacityNode=mix(float(.94),float(.68),smoothstep(0,10,d)).mul(float(1).sub(smoothstep(8,12,d)));
  this.material=material;this.mesh=new THREE.Mesh(new THREE.BufferGeometry(),material);this.mesh.renderOrder=1;this.mesh.frustumCulled=false;scene.add(this.mesh);
 }
 update(p,time,origin){
  this.clock.value=time;this.origin.value.set(origin.x,origin.z);
  const center=Math.floor(p.z/32)*32,key=`${origin.x},${origin.z}`;
  if(center===this.center&&key===this.originKey)return;
  this.center=center;this.originKey=key;
  const positions=[],indices=[],nx=this.nx,nz=this.nz;
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
   const z=center-640+j*1280/nz,d=12-1212*Math.pow(i/nx,2.7);
   positions.push(shore(z)+d-origin.x,-.18,z-origin.z);
   if(i<nx&&j<nz){const a=j*(nx+1)+i,b=a+1,c=a+nx+1;indices.push(a,b,c,b,c+1,c)}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
  this.mesh.geometry.dispose();this.mesh.geometry=g;
 }
 dispose(){this.mesh.geometry.dispose();this.material.dispose()}
}
