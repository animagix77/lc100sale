import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const buffer=readFileSync(new URL('../lc100.glb',import.meta.url));assert.equal(buffer.readUInt32LE(0),0x46546c67);const gltf=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)));
const index=name=>gltf.nodes.findIndex(n=>n.name===name),node=name=>gltf.nodes[index(name)];
assert(node('Body')&&node('LC100_Root'),'Named chassis/root required by the game');
const hinges=new Map(gltf.nodes.filter(n=>n.extras?.damage_panel).map(n=>[n.extras.damage_panel,n]));
assert.deepEqual([...hinges.keys()].sort(),['hood','leftFrontDoor','leftRearDoor','rightFrontDoor','rightRearDoor','tailgate']);
for(const hinge of hinges.values()){
 assert(node('Body').children.includes(index(hinge.name)));
 assert(hinge.extras.damage_hinge.length===3&&hinge.extras.damage_hinge.every(Number.isFinite));
}
assert(hinges.get('hood').children.includes(index('Astra body / crowned bonnet')));
for(const side of ['Left','Right']){
 for(const panel of ['front fender skin','front door skin','rear door skin','rear quarter skin']){
  const name=side+' '+panel;
  const parent=panel.endsWith('door skin')?hinges.get(side.toLowerCase()+(panel.startsWith('front')?'FrontDoor':'RearDoor')):node('Body');
  assert(parent.children.includes(index(name))&&node(name).mesh!==undefined,'Missing body panel: '+name);
 }
 const lampPrefix='Rear lamps / '+side.toLowerCase()+' ';
 for(const [part,reflector] of [
  ['tailgate red housing','ruby'],['fixed quarter red housing','ruby'],
  ['reverse gate','clear'],['reverse quarter','clear'],
  ['indicator gate','clear'],['indicator quarter','clear']
 ]){
  const lamp=node(lampPrefix+part);
  assert(lamp?.mesh!==undefined,'Missing rear lamp: '+lampPrefix+part);
  const mount=part.startsWith('tailgate')||part.endsWith(' gate')?hinges.get('tailgate'):node('Body');
  assert(mount.children.includes(index(lamp.name)),'Wrong lamp mounting: '+lamp.name);
  for(const primitive of gltf.meshes[lamp.mesh].primitives){
   assert.equal(gltf.materials[primitive.material].name,'Rear lamps / '+reflector+' reflector cells');
  }
 }
}
for(const corner of ['FL','FR','RL','RR']){
 const susp=node('Susp_'+corner),steer=node('Steer_'+corner),roll=node('Roll_'+corner);assert(susp&&steer&&roll,'Each wheel needs separate suspension, steering and rolling pivots');assert(susp.children.includes(index('Steer_'+corner)));assert(steer.children.includes(index('Roll_'+corner)));assert(roll.children?.length>0,'Rolling pivot must contain geometry');assert(Math.abs(Math.abs(susp.translation[0])-.962)<.001,'Spacer track matches the contact points');assert(Math.abs(susp.translation[2]-(corner[0]==='F'?-1.42:1.43))<.001,'Axles match the physics wheelbase');
}
assert(node('RadioAntenna')&&node('Antenna_1')&&node('Antenna_2')&&node('Antenna_3'),'Power antenna rig required');assert(node('LC100_Root').children.includes(index('RadioAntenna')),'Antenna must remain outside batched Body');assert(node('Antenna_1').children.includes(index('Antenna_2')));assert(node('Antenna_2').children.includes(index('Antenna_3')));
let triangles=0;for(const n of gltf.nodes){if(n.mesh===undefined)continue;for(const p of gltf.meshes[n.mesh].primitives){triangles+=gltf.accessors[p.indices].count/3;assert(p.attributes.NORMAL!==undefined);if(gltf.materials[p.material].pbrMetallicRoughness?.baseColorTexture)assert(p.attributes.TEXCOORD_0!==undefined,'Textured body must retain UVs')}}
assert(triangles<105000,'Mobile geometry budget');assert(buffer.length<5000000,'Model download budget');console.log({model:'Photo-matched LC100',triangles,bytes:buffer.length,rig:'valid',textureCoordinates:'valid'});
