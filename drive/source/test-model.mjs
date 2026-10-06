import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const buffer=readFileSync(new URL('../lc100.glb',import.meta.url));assert.equal(buffer.readUInt32LE(0),0x46546c67);const gltf=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)));
const index=name=>gltf.nodes.findIndex(n=>n.name===name),node=name=>gltf.nodes[index(name)];
assert(node('Body')&&node('LC100_Root'),'Named chassis/root required by the game');
for(const corner of ['FL','FR','RL','RR']){
 const susp=node('Susp_'+corner),steer=node('Steer_'+corner),roll=node('Roll_'+corner);assert(susp&&steer&&roll,'Each wheel needs separate suspension, steering and rolling pivots');assert(susp.children.includes(index('Steer_'+corner)));assert(steer.children.includes(index('Roll_'+corner)));assert(roll.children?.length>0,'Rolling pivot must contain geometry');assert(Math.abs(Math.abs(susp.translation[0])-.962)<.001,'Spacer track matches the contact points');assert(Math.abs(susp.translation[2]-(corner[0]==='F'?-1.42:1.43))<.001,'Axles match the physics wheelbase');
}
assert(node('RadioAntenna')&&node('Antenna_1')&&node('Antenna_2')&&node('Antenna_3'),'Power antenna rig required');assert(node('LC100_Root').children.includes(index('RadioAntenna')),'Antenna must remain outside batched Body');assert(node('Antenna_1').children.includes(index('Antenna_2')));assert(node('Antenna_2').children.includes(index('Antenna_3')));
let triangles=0;for(const n of gltf.nodes){if(n.mesh===undefined)continue;for(const p of gltf.meshes[n.mesh].primitives){triangles+=gltf.accessors[p.indices].count/3;assert(p.attributes.NORMAL!==undefined);if(gltf.materials[p.material].pbrMetallicRoughness?.baseColorTexture)assert(p.attributes.TEXCOORD_0!==undefined,'Textured body must retain UVs')}}
assert(triangles<105000,'Mobile geometry budget');assert(buffer.length<5000000,'Model download budget');console.log({model:'Meshy adapted LC100',triangles,bytes:buffer.length,rig:'valid',textureCoordinates:'valid'});
