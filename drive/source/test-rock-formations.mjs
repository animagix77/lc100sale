// Judge Dean LLC — visible, closed rock surfaces with outward triangle winding.
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {rockFormationGeometry} from './rock-formations.mjs';
import {MountainDetails} from './mountain-details.mjs';
import {baseHeight} from './terrain.mjs';
import {DrivePhysics,RAPIER} from './physics.mjs';
import {BeachObstacles} from './obstacles.mjs';
import {routeSample} from './expedition.mjs';
const geometry=rockFormationGeometry(),position=geometry.attributes.position,index=geometry.index.array;
const parent=Array.from({length:position.count},(_,i)=>i),root=i=>parent[i]===i?i:parent[i]=root(parent[i]);
const edge=new Map(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),n=new THREE.Vector3();
for(let i=0;i<index.length;i+=3){
 const ids=[index[i],index[i+1],index[i+2]];parent[root(ids[1])]=root(ids[0]);parent[root(ids[2])]=root(ids[0]);
 a.fromBufferAttribute(position,ids[0]);b.fromBufferAttribute(position,ids[1]);c.fromBufferAttribute(position,ids[2]);
 n.crossVectors(b.clone().sub(a),c.clone().sub(a));assert(n.lengthSq()>1e-10,'No degenerate triangles may enter shading or collision');
 for(let j=0;j<3;j++){const u=ids[j],v=ids[(j+1)%3],key=`${Math.min(u,v)},${Math.max(u,v)}`,record=edge.get(key)??{uses:0,winding:0};record.uses++;record.winding+=u<v?1:-1;edge.set(key,record);}
}
for(const record of edge.values()){assert.equal(record.uses,2,'Every ledge is a closed manifold solid');assert.equal(record.winding,0,'Adjacent triangles agree on outward winding');}
const volume=new Map(),bounds=new Map();
for(let i=0;i<index.length;i+=3){const part=root(index[i]);a.fromBufferAttribute(position,index[i]);b.fromBufferAttribute(position,index[i+1]);c.fromBufferAttribute(position,index[i+2]);volume.set(part,(volume.get(part)??0)+a.dot(b.clone().cross(c))/6);}
for(let i=0;i<position.count;i++){const part=root(i),box=bounds.get(part)??new THREE.Box3();box.expandByPoint(a.fromBufferAttribute(position,i));bounds.set(part,box);}
assert(volume.size>=3,'A formation contains overlapping geological ledges');for(const value of volume.values())assert(value>.01,'Each closed component has positive volume and outward faces');
const material=new THREE.MeshBasicMaterial({side:THREE.FrontSide}),mesh=new THREE.Mesh(geometry,material),ray=new THREE.Raycaster();mesh.updateMatrixWorld();
for(const box of bounds.values()){
 const center=box.getCenter(new THREE.Vector3());ray.set(new THREE.Vector3(center.x,10,center.z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(mesh,false)[0];
 assert(hit&&hit.face.normal.y>.4,'Top ledges must be visible and hit from above using front-face rendering');
}
for(const mobile of [false,true]){
 const physics=await DrivePhysics.create(),solid=new BeachObstacles(physics,{radius:Infinity}),view=new MountainDetails(new THREE.Scene(),{mobile});view.refresh({x:248,z:-336},{x:0,z:0});solid.refresh({key:'bedrock',ridgeRocks:view.rocks});physics.world.step();view.rocks.updateMatrixWorld();let near=0,rays=0;
 const transform=new THREE.Matrix4(),vertex=new THREE.Vector3();
 for(let i=0;i<view.rocks.count;i++){
  view.rocks.getMatrixAt(i,transform);let exposed=-Infinity,buried=Infinity;
  for(let j=0;j<position.count;j++){
   vertex.fromBufferAttribute(position,j).applyMatrix4(transform);const above=vertex.y-baseHeight(vertex.x,vertex.z);exposed=Math.max(exposed,above);buried=Math.min(buried,above);
   if(above>.05)assert(routeSample(vertex.x,vertex.z).distance>5.5,'Actual exposed rock vertices preserve the drivable corridor');
  }
  assert(exposed>.3,'Each instanced rock has an upper ledge visibly above terrain');assert(buried<-.1,'The deep footing joins the terrain rather than hovering');
  if(Math.hypot(transform.elements[12]-248,transform.elements[14]+336)<60){
   near++;
   if(rays<12){
    // Pick a real exposed face interior rather than a generic center ray, which
    // could pass through a gap and accidentally validate unrelated terrain.
    let candidate=null,clearance=.3;
    for(let j=0;j<index.length;j+=3){
     a.fromBufferAttribute(position,index[j]).applyMatrix4(transform);b.fromBufferAttribute(position,index[j+1]).applyMatrix4(transform);c.fromBufferAttribute(position,index[j+2]).applyMatrix4(transform);
     n.crossVectors(b.clone().sub(a),c.clone().sub(a)).normalize();if(n.y<.4)continue;
     const center=a.clone().add(b).add(c).multiplyScalar(1/3),above=center.y-baseHeight(center.x,center.z);if(above>clearance){candidate=center;clearance=above;}
    }
    assert(candidate,'Near formations have an exposed upward-facing ledge');
    const from=candidate.clone();from.y+=10;ray.set(from,new THREE.Vector3(0,-1,0));const visual=ray.intersectObject(view.rocks,false)[0];
    assert(visual&&visual.point.y-baseHeight(visual.point.x,visual.point.z)>.3,'The rendered first surface lies above local terrain');
    const hit=physics.world.castRay(new RAPIER.Ray(from,{x:0,y:-1,z:0}),20,true);
    assert(hit&&solid.has(hit.collider),'Ray contacts the actual formation collider');
    assert(Math.abs(from.y-hit.timeOfImpact-visual.point.y)<.002,'Visible ledge and physical contact agree within2mm');rays++;
   }
  }
 }
 assert(near>20,'Natural formations reach the first ford scenery rather than only distant mountains');
 assert.equal(rays,12,'Exercise several nearby ledges, not a single lucky ray');console.log({mobile,formations:view.rocks.count,within60m:near,matchedPhysicsRays:rays});solid.dispose();physics.dispose();view.dispose();
}
geometry.dispose();material.dispose();console.log('Bedrock geometry: closed solids, consistent winding, positive volumes, visible top faces, exposed ledges, buried footing and actual trail clearance passed.');
