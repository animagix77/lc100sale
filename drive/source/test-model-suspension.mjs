// Judge Dean LLC. Check the published wheel mesh and the animated suspension against the game.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Group,Vector3,BufferGeometry,Float32BufferAttribute,Mesh} from 'three/webgpu';
import {RearAxleView} from './expedition-details.mjs';
import {fitTyreVisual} from './tyre-fit.mjs';
const buffer=readFileSync(new URL('../lc100.glb',import.meta.url));assert.equal(buffer.readUInt32LE(0),0x46546c67);const gltf=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)));
const index=name=>gltf.nodes.findIndex(n=>n.name===name),node=name=>gltf.nodes[index(name)];
const binaryStart=28+buffer.readUInt32LE(12);
function readPositions(primitive){
 const attr=gltf.accessors[primitive.attributes.POSITION],view=gltf.bufferViews[attr.bufferView];
 assert.equal(attr.componentType,5126);assert.equal(attr.type,'VEC3');
 const data=new Float32Array(attr.count*3);
 const start=binaryStart+(view.byteOffset||0)+(attr.byteOffset||0),stride=view.byteStride||12;
 for(let i=0;i<attr.count;i++)for(let j=0;j<3;j++)data[i*3+j]=buffer.readFloatLE(start+i*stride+j*4);
 return new Float32BufferAttribute(data,3);
}

// Compare real casing vertices to the dimensions used by collision and gearing.
for(const corner of ['FL','FR','RL','RR']){
 const roll=new Group(),casing=new Group();
 const source=node('Roll_'+corner).children.map(i=>gltf.nodes[i]).find(n=>n.extras?.lc100_v5_tire);
 assert(source,'Model must mark its tire casing before runtime batches it');
 casing.userData=source.extras;
 casing.position.fromArray(source.translation??[0,0,0]);casing.quaternion.fromArray(source.rotation??[0,0,0,1]);
 casing.scale.fromArray(source.scale??[1,1,1]);roll.add(casing);
 for(const primitive of gltf.meshes[source.mesh].primitives){
  const geometry=new BufferGeometry();geometry.setAttribute('position',readPositions(primitive));
  casing.add(new Mesh(geometry));
 }
 assert(fitTyreVisual(roll).distanceTo(new Vector3(1,1,1))<.00001,'Game tire and authored envelope match within export precision');
}
// Drive the exported suspension anchors through bump, droop and cross-axle travel.
const truck=new Group(),art=new Group(),axleSource=node('RearAxleArt');
assert(node('LC100_Root').children.includes(index('RearAxleArt')));
art.name=axleSource.name;art.position.fromArray(axleSource.translation);truck.add(art);
const bind=art.position.clone();
const attachments=gltf.nodes.filter(n=>n.extras?.axle_anchor).map(n=>{
 assert(node('LC100_Root').children.includes(index(n.name)),'Animated link must survive body batching');
 const link=new Group();link.userData=n.extras;link.position.fromArray(n.translation);truck.add(link);
 const start=new Vector3(...n.extras.chassis_anchor),pickup=new Vector3(...n.extras.axle_anchor);
 assert(link.position.distanceTo(start)<1e-6);
 return {link,start,pickup,end:pickup.clone().add(bind).sub(start)};
});
assert.equal(attachments.length,6);
const axle=new RearAxleView(truck);
assert.equal(truck.children.length,7,'The modeled axle replaces the procedural beam');
for(const [left,right] of [[.28,.28],[.15,.52],[.53,.15],[.51,.51]]){
 axle.update(left,right);truck.updateMatrixWorld(true);
 assert(Math.abs(art.position.y-(.76-(left+right)/2))<1e-9);
 for(const {link,start,pickup,end} of attachments){
  assert(new Vector3().applyMatrix4(link.matrix).distanceTo(start)<1e-6);
  assert(end.clone().applyMatrix4(link.matrix).distanceTo(pickup.clone().applyMatrix4(art.matrix))<1e-6);
 }
}
axle.dispose();
assert.equal(truck.children.length,7,'The truck owns its authored suspension meshes');
console.log('All four tire envelopes and six suspension attachments passed on the game model.');
