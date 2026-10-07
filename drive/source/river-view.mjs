import * as THREE from 'three/webgpu';
import {positionGeometry,positionWorld,vec2,vec3,float,sin,abs,smoothstep,mix,color,texture,uv,mx_noise_float,cos,normalize,transformNormalToView} from 'three/tsl';
import {riverZ,riverWidth,riverLevel} from './expedition.mjs';
export class RiverView{
 constructor(scene,ocean){
  this.scene=scene;this.ocean=ocean;
  const positions=[],indices=[],uvs=[],nx=278,nz=24;
  for(let i=0;i<=nx;i++){const x=-36+i*2;for(let j=0;j<=nz;j++){const side=j/nz*2-1,z=riverZ(x)+side*(riverWidth(x)+.9);positions.push(x,riverLevel(x),z);uvs.push(i/nx,j/nz);if(i<nx&&j<nz){const a=i*(nz+1)+j,b=a+nz+1;indices.push(a,a+1,b,b,a+1,b+1)}}}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();
  const world=positionWorld.xz.add(ocean.origin),t=ocean.clock;
  const wake=texture(ocean.wakeTexture,positionGeometry.xz.sub(ocean.wakeOrigin).div(ocean.wakeSpan).mul((ocean.wake.size-1)/ocean.wake.size).add(.5/ocean.wake.size)).level(0);
  const ripple=sin(positionGeometry.x.mul(.9).add(positionGeometry.z.mul(1.8)).sub(t.mul(2.2))).mul(.035).add(sin(positionGeometry.x.mul(2.3).add(t.mul(3.1))).mul(.015));
  const mat=new THREE.MeshStandardNodeMaterial({roughness:.27,metalness:.06,transparent:true,depthWrite:false,side:THREE.DoubleSide});
  mat.positionNode=vec3(positionGeometry.x,positionGeometry.y.add(ripple).add(wake.r),positionGeometry.z);
  const flow=sin(world.x.mul(.8).add(world.y.mul(2)).add(t.mul(2.7))),flecks=mx_noise_float(vec3(world.x.mul(.9).add(t.mul(.5)),world.y.mul(1.3),t.mul(.25))).mul(.5).add(.5),foam=smoothstep(.72,1,flow).mul(smoothstep(.55,.8,flecks)).mul(.36).add(wake.a.mul(.6)).max(ocean.tireFoamNode);
  mat.normalNode=transformNormalToView(normalize(vec3(float(-.052).sub(cos(world.x.mul(.9).add(world.y.mul(1.8)).sub(t.mul(2.2))).mul(.0315)).sub(cos(world.x.mul(2.3).add(t.mul(3.1))).mul(.0345)),1,cos(world.x.mul(.9).add(world.y.mul(1.8)).sub(t.mul(2.2))).mul(-.063))));
  mat.colorNode=mix(color('#366e76'),color('#e3e7d1'),foam.min(.92));mat.opacityNode=float(.84).mul(float(1).sub(smoothstep(.85,1,abs(uv().y.sub(.5).mul(2)))));
  this.mesh=new THREE.Mesh(geo,mat);this.mesh.receiveShadow=true;this.mesh.renderOrder=1;this.mesh.frustumCulled=false;scene.add(this.mesh);
 }
 update(origin){this.mesh.position.set(-origin.x,0,-origin.z)}
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose()}
}
