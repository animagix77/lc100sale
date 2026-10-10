import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {loadGroundTextures} from './ground-materials.mjs';
import {BeachLife} from './beach-life.mjs';
import {riverStoneGeometry} from './river-stone-geometry.mjs';
function loader(fail=''){
 const loaded=[],disposed=[];
 return {loaded,disposed,async loadAsync(path){if(path.includes(fail)&&fail)throw Error('offline');const map=new THREE.Texture();map.name=path;map.addEventListener('dispose',()=>disposed.push(path));loaded.push(map);return map;}};
}
for(const mobile of [false,true]){
 const source=loader(),maps=await loadGroundTextures({mobile,loader:source});
 assert.equal(source.loaded.length,7);assert.equal(maps.canopy.colorSpace,THREE.SRGBColorSpace);
 for(const name of ['forest','gravel','stone']){
  assert.equal(maps[name].color.colorSpace,THREE.SRGBColorSpace);assert.equal(maps[name].surface.colorSpace,THREE.NoColorSpace);
  assert.equal(maps[name].surface.wrapS,THREE.RepeatWrapping);
  assert.equal(maps[name].color.name.includes('-512'),mobile,'Device tier selects the intended texture size');
 }
 const scene=new THREE.Scene(),life=new BeachLife(scene,{mobile});
 const birth=life.crowns.geometry.attributes.sceneryBirth;
 life.setCanopyTexture(maps.canopy);life.refresh({x:248,z:-336},{x:0,z:0});
 assert.strictEqual(life.crowns.geometry.attributes.sceneryBirth,birth,'Arrival fades retain their instance storage');
 assert.strictEqual(life.crowns.geometry,life.crowns.userData.sceneryGhost.geometry,'Fading and solid crowns share the cutout geometry');
 assert.strictEqual(life.crowns.material.map,maps.canopy);
 assert.strictEqual(life.crowns.userData.sceneryGhost.material.map,maps.canopy);
 const g=life.crowns.geometry;
 assert.equal(g.index.count/3,mobile?30:42,'Layered foliage reduces the per-tree triangle budget');
 for(const a of Object.values(g.attributes))assert([...a.array].every(Number.isFinite));
 assert(g.boundingBox.min.y>3&&g.boundingBox.max.y<9,'Foliage stays attached above the tree trunk');
 life.refresh({x:255,z:-365},{x:512,z:-512});assert(life.crowns.count>20);
 life.dispose();assert.equal(scene.children.length,0);maps.dispose();assert.equal(source.disposed.length,7);
}
const failure=loader('gravel-surface');assert.equal(await loadGroundTextures({loader:failure}),null);assert.equal(failure.disposed.length,5,'Partial ground load releases all successful textures');
const optional=loader('canopy'),fallback=await loadGroundTextures({loader:optional});assert(fallback);assert.equal(fallback.canopy,null,'A failed foliage image retains photographed ground and procedural trees');fallback.dispose();assert.equal(optional.disposed.length,6);
const rock=riverStoneGeometry(),p=rock.attributes.position,n=rock.attributes.normal;
for(let i=0;i<p.count;i++){
 assert(Math.abs(p.getX(i))<=.56&&Math.abs(p.getZ(i))<=.4&&p.getY(i)>=-.10&&p.getY(i)<=.46,'Stone stays within the existing collider envelope');
 assert(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5,'Worn stones have normalized shading normals');
}
rock.dispose();console.log('Ground assets: device sizes, linear surface data, failure cleanup, cutout streaming and bounded stone colliders passed.');
