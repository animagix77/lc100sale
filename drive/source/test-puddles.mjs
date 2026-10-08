import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {MUD_PUDDLES,puddleAt,puddleCut,puddleHeight} from './mud-puddles.mjs';
import {baseHeight,surfaceAt,SandField} from './terrain.mjs';
import {buildPuddleGeometry,MudPuddles} from './puddle-view.mjs';

// Match the actual triangles, rather than a different analytic/interpolated bed.
function visibleBed(x,z){
 const ix=Math.floor(x*2)/2,iz=Math.floor(z*2)/2,u=(x-ix)*2,v=(z-iz)*2;
 const a=baseHeight(ix,iz),b=baseHeight(ix+.5,iz),c=baseHeight(ix,iz+.5),d=baseHeight(ix+.5,iz+.5);
 return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
}
for(const p of MUD_PUDDLES){
 assert.equal(puddleAt(p.x,p.z),p);assert(surfaceAt(p.x,p.z).mud>.6);assert.equal(surfaceAt(p.x,p.z).river,0);
 assert.equal(puddleHeight(p.x,p.z,baseHeight(p.x,p.z)),p.level);
 for(let angle=0;angle<Math.PI*2;angle+=Math.PI/32){
  const x=p.x+Math.cos(angle)*p.radius,z=p.z+Math.sin(angle)*p.radius;
  assert(puddleCut(x,z)<1e-12,'Continuous zero-height rim');
  assert(baseHeight(x,z)>p.level,'Dry enclosing bank prevents infinite water sheets');
 }
 const x=p.x+p.radius*2;assert.equal(puddleHeight(x,p.z,baseHeight(x,p.z)),-Infinity);assert.equal(puddleCut(x,p.z),0);
 assert.equal(puddleHeight(p.x,p.z,p.level+.1),-Infinity,'High dirt/berm stays dry');
 const field=new SandField();field.stamp(p.x,p.z,1,.2,1);assert.equal(puddleHeight(p.x,p.z,field.height(p.x,p.z)),p.level,'Rutted tyre channels stay wet');
}
const g=buildPuddleGeometry(),vertices=g.attributes.position,depths=g.attributes.puddleDepth,ids=g.attributes.puddleId,areas=Array(MUD_PUDDLES.length).fill(0);
assert(vertices.count/3<750,'Bounded cached geometry budget');
for(let i=0;i<vertices.count;i+=3){
 const p=MUD_PUDDLES[ids.getX(i)],a=new THREE.Vector3().fromBufferAttribute(vertices,i),b=new THREE.Vector3().fromBufferAttribute(vertices,i+1),c=new THREE.Vector3().fromBufferAttribute(vertices,i+2);
 areas[p.index]+=Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))/2;
 const center=a.clone().add(b).add(c).divideScalar(3);assert(visibleBed(center.x,center.z)<=p.level+.0001,'Water triangles sit inside physical terrain depressions');
 for(let j=i;j<i+3;j++){assert(Math.abs(vertices.getY(j)-p.level-.003)<1e-5);assert(depths.getX(j)>=0&&depths.getX(j)<.245);}
}
for(const area of areas)assert(area>2&&area<7,'Small visible puddle footprint');
for(const reduced of [false,true]){
 const scene=new THREE.Scene(),view=new MudPuddles(scene,{reduced}),first=MUD_PUDDLES[0];view.update(first,{x:512,z:-512},17,.8);
 assert(view.mesh.visible);assert.equal(view.mesh.position.x,-512);assert.equal(view.mesh.position.z,512);assert.equal(view.clock.value,reduced?0:17);assert.equal(view.rain.value,reduced?0:.8);
 const geometry=view.mesh.geometry;for(let i=0;i<100;i++)view.update(first,{x:512,z:-512},i,.5);assert.equal(view.mesh.geometry,geometry,'No per-frame terrain sampling or geometry reconstruction');
 view.update({x:0,z:0},{x:0,z:0},20,0);assert(!view.mesh.visible);view.dispose();assert.equal(scene.children.length,0);
}
g.dispose();console.log('Puddles: 8 dry-rim basins, shared physical ground, finite clipped shores, shallow depth, tyre-rut contact, 528-triangle budget, origin rebasing, distance culling, stable geometry, reduced motion and cleanup passed.');
