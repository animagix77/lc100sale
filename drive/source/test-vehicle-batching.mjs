import assert from 'node:assert/strict';
import {BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture, Vector3} from 'three/webgpu';
import {mergeRigid} from './vehicle-batching.mjs';

const body = new Group();
body.position.set(14, 0, -8);
const rubber = new MeshStandardMaterial({normalMap:new Texture()});
rubber.normalMap.channel = 1;
function add(name, material, x) {
  const geometry = new BoxGeometry();
  geometry.setAttribute('uv1', geometry.attributes.uv.clone());
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.position.x = x;
  body.add(mesh);
  return mesh;
}
add('Tire 1', rubber, -1);
add('Tire 2', rubber, 1);
const glass = new MeshStandardMaterial({transparent:true, opacity:.4});
const left = add('Left glass', glass, -1);
const right = add('Right glass', glass, 1);
const clear = new MeshStandardMaterial();
const indicator = add('Rear_lamps__left_indicator_gate', clear, -1);
const reverse = add('Rear_lamps__left_reverse_gate', clear, 1);
const named = add('Head reflector', new MeshStandardMaterial(), 0);
mergeRigid(body);
const batch = body.children.find(part => part.material === rubber);
assert.equal(body.children.length, 6);
assert.equal(batch.geometry.getAttribute('uv1').count, 48);
assert.equal(batch.geometry.index.count, 72);
batch.geometry.computeBoundingBox();
assert.deepEqual(batch.geometry.boundingBox.getSize(new Vector3()).toArray(), [3,1,1]);
assert.deepEqual(batch.geometry.boundingBox.getCenter(new Vector3()).toArray(), [0,0,0]);
for (const part of [left,right,indicator,reverse]) assert.equal(part.parent,body);
assert.ok(body.getObjectByName(named.name));
console.log('Vehicle batching preserves mapped surfaces, separate panes and independently lit lenses.');
