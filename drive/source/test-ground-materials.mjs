import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {loadGroundTextures} from './ground-materials.mjs';
import {BeachLife} from './beach-life.mjs';
import {TerrainView} from './terrain-view.mjs';
import {SandField} from './terrain.mjs';
import {riverStoneGeometry} from './river-stone-geometry.mjs';
function loader(fail=''){
 const loaded=[],disposed=[];
 return {loaded,disposed,async loadAsync(path){if(path.includes(fail)&&fail)throw Error('offline');const map=new THREE.Texture();map.name=path;map.addEventListener('dispose',()=>disposed.push(path));loaded.push(map);return map;}};
}
for(const mobile of [false,true]){
 const source=loader(),maps=await loadGroundTextures({mobile,loader:source});
 assert.equal(source.loaded.length,9);assert.equal(maps.canopy.colorSpace,THREE.SRGBColorSpace);
 for(const name of ['forest','gravel','stone']){
  assert.equal(maps[name].color.colorSpace,THREE.SRGBColorSpace);assert.equal(maps[name].surface.colorSpace,THREE.NoColorSpace);
  assert.equal(maps[name].surface.wrapS,THREE.RepeatWrapping);
  assert.equal(maps[name].color.name.includes('-512'),mobile,'Device tier selects the intended texture size');
 }
 // Material detail has a fixed sampling budget and cannot displace physical
 // terrain. Exercise real deformed geometry with/without photographed shading.
 const field=new SandField();field.stamp(0,-30,1,.3,1);const physics={origin:{x:0,z:0}},photo=new TerrainView(new THREE.Scene(),physics,field,{groundTextures:maps}),plain=new TerrainView(new THREE.Scene(),physics,field);
 const nodes=new Set(),visit=node=>{if(!node?.isNode||nodes.has(node))return;nodes.add(node);for(const child of node.getChildren())visit(child)};
 for(const channel of ['colorNode','normalNode','roughnessNode','aoNode'])visit(photo.material[channel]);
 const samples=[...nodes].filter(n=>n.isTextureNode);assert.equal(samples.length,mobile?14:20,'Sharper height blends reuse the original texture-fetch budget');
 assert.equal(new Set(samples.map(n=>n.value)).size,6,'All surface detail comes from the six startup-loaded terrain maps');
 assert.equal(photo.material.positionNode,null,'Shading relief never changes the route silhouette or wheel support');
 const a=photo.geometry(-2,-32,8,4),b=plain.geometry(-2,-32,8,4);
 assert.deepEqual(a.index.array,b.index.array);for(const key of Object.keys(a.attributes))assert.deepEqual(a.attributes[key].array,b.attributes[key].array,`Material quality leaves ${key} geometry unchanged`);
 const versions=samples.map(n=>n.value.version),normal=photo.material.normalNode;physics.origin={x:512,z:-512};photo.animate(12);assert.deepEqual(maps.origin.value.toArray(),[512,0,-512]);assert.equal(photo.material.normalNode,normal);assert.deepEqual(samples.map(n=>n.value.version),versions,'Rebasing updates uniforms without re-uploading textures or replacing shader graphs');
 a.dispose();b.dispose();photo.dispose();plain.dispose();
 const scene=new THREE.Scene(),life=new BeachLife(scene,{mobile});
 const birth=life.crowns.geometry.attributes.sceneryBirth;
 life.setCanopyTexture(maps.canopy);life.setBarkTextures(maps);assert(maps.bark&&life.trunks.material.normalNode);assert(life.trunks.userData.sceneryGhost.material.normalNode);life.refresh({x:248,z:-336},{x:0,z:0});
 assert.strictEqual(life.crowns.geometry.attributes.sceneryBirth,birth,'Arrival fades retain their instance storage');
 assert.strictEqual(life.crowns.geometry,life.crowns.userData.sceneryGhost.geometry,'Fading and solid crowns share the cutout geometry');
 assert.strictEqual(life.crowns.material.map,maps.canopy);
 assert.strictEqual(life.crowns.userData.sceneryGhost.material.map,maps.canopy);
 const g=life.crowns.geometry;
 assert.equal(g.index.count/3,mobile?30:120,'Mobile keeps its leaf budget while desktop gains smaller folded sprays');
 for(const a of Object.values(g.attributes))assert([...a.array].every(Number.isFinite));
 assert(g.boundingBox.min.y>2&&g.boundingBox.min.y<3&&g.boundingBox.max.y<9,'Foliage stays attached above the tree trunk');
 life.refresh({x:255,z:-365},{x:512,z:-512});assert(life.crowns.count>20);
 life.dispose();assert.equal(scene.children.length,0);maps.dispose();assert.equal(source.disposed.length,9);
}
const failure=loader('gravel-surface');assert.equal(await loadGroundTextures({loader:failure}),null);assert.equal(failure.disposed.length,5,'Partial ground load releases all successful textures');
const optional=loader('canopy'),fallback=await loadGroundTextures({loader:optional});assert(fallback);assert.equal(fallback.canopy,null,'A failed foliage image retains photographed ground and procedural trees');fallback.dispose();assert.equal(optional.disposed.length,8);
const rock=riverStoneGeometry(),p=rock.attributes.position,n=rock.attributes.normal;
for(let i=0;i<p.count;i++){
 assert(Math.abs(p.getX(i))<=.56&&Math.abs(p.getZ(i))<=.4&&p.getY(i)>=-.10&&p.getY(i)<=.46,'Stone stays within the existing collider envelope');
 assert(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5,'Worn stones have normalized shading normals');
}
rock.dispose();console.log('Ground assets: device sizes, linear surface data, failure cleanup, cutout streaming and bounded stone colliders passed.');

const missingBark=loader('bark-surface'),groundOnly=await loadGroundTextures({loader:missingBark});assert(groundOnly&&!groundOnly.bark,'Bark load failure leaves existing terrain and canopy usable');assert(missingBark.disposed.includes('textures/terrain/bark-color.jpg'));groundOnly.dispose();assert.equal(missingBark.disposed.length,8);
