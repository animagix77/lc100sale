import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {LANDMARKS,routeSample,riverApproach,riverProfile,riverZ,riverWidth,riverLevel} from './expedition.mjs';
import {SandField,baseHeight,surfaceAt} from './terrain.mjs';
import {TerrainView} from './terrain-view.mjs';
import {BeachLife} from './beach-life.mjs';
import {riverRocksNear} from './river-rocks.mjs';

const onSegment=(index,t)=>{const a=LANDMARKS[index],b=LANDMARKS[index+1];return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t}};
const fernIndex=LANDMARKS.findIndex(p=>p.name==='Fern creek crossing');
assert(fernIndex>0,'Fern creek crossing remains in the itinerary');
const banks=[
 ['Rocky ford entry',LANDMARKS[6]],
 ['Rocky ford exit',onSegment(7,.48)],
 ['Fern creek entry',LANDMARKS[fernIndex]],
 ['Fern creek exit',onSegment(fernIndex,.7)]
];
const field=new SandField(),terrain=new TerrainView(new THREE.Scene(),{origin:{x:0,z:0}},field);
for(const [name,p] of banks){
 const s=surfaceAt(p.x,p.z);
 assert.equal(s.river,0,name+' is an actual dry approach');
 assert(s.riverApproach>.8,name+' continues the crossing trail beyond the water');
 assert(s.mud>.55&&s.grass<.15,name+' has muddy ground rather than a grass carpet');
 const g=terrain.geometry(p.x,p.z,1,1),c=g.attributes.color;
 assert(c.getX(0)>c.getY(0)&&c.getY(0)>c.getZ(0),name+' renders with brown soil/gravel color');
 assert(g.attributes.surface.getX(0)>.55,name+' carries mud into the terrain material');
 g.dispose();
 const r=routeSample(p.x,p.z);
 for(const sign of [-1,1]){
  const x=p.x-r.dz*14*sign,z=p.z+r.dx*14*sign,bank=surfaceAt(x,z);
  if(routeSample(x,z).distance<8)continue; // The new alternate trail can occupy the old side probe.
  assert.equal(riverApproach(x,z),0,'Approach clearing stays inside all trail corridors');
  if(bank.river<.05)assert(bank.grass>.25,'Lush grass survives on the adjacent dry riverbanks');
  else assert(bank.grass<.01,'Adjacent wet channel remains free of meadow color');
 }
}
terrain.dispose();
for(const p of [onSegment(6,.85),onSegment(fernIndex,.35)]){
 const s=surfaceAt(p.x,p.z);
 assert(s.river>.9,'Probe lies within the actual crossing channel');
 assert(s.grass<.01,'The wet ford bed is not covered in meadow color');
}
assert.equal(riverApproach(190,-278),0,'The meadow remains outside the approach treatment');
assert(surfaceAt(190,-278).grass>.9,'The meadow retains its grass');
for(const x of [248,465])for(const side of [-1,1]){
 const z=riverZ(x)+side*riverWidth(x);
 assert(Math.abs(baseHeight(x,z)-riverLevel(x))<1e-8,'Both existing waterlines remain grounded');
}

const matrix=new THREE.Matrix4(),vertex=new THREE.Vector3();
function assertClearFoliage(mesh,origin,label){
 const positions=mesh.geometry.attributes.position;
 let radius=0;for(let v=0;v<positions.count;v++)radius=Math.max(radius,Math.hypot(positions.getX(v),positions.getZ(v)));
 for(let i=0;i<mesh.count;i++){
  mesh.getMatrixAt(i,matrix);const e=matrix.elements,x=e[12]+origin.x,z=e[14]+origin.z;
  assert(riverApproach(x,z)<.2,label+' roots leave the muddy approaches clear');
  const reach=radius*Math.max(Math.hypot(e[0],e[2]),Math.hypot(e[8],e[10])),r=routeSample(x,z),profile=riverProfile(x,z);
  if(r.distance-reach>4.5||profile.distance-profile.width-reach>18)continue;
  for(let v=0;v<positions.count;v++){
   vertex.fromBufferAttribute(positions,v).applyMatrix4(matrix);vertex.x+=origin.x;vertex.z+=origin.z;
   assert(riverApproach(vertex.x,vertex.z)<.999,label+' footprint does not intrude into the bare approach core');
  }
 }
}

for(const mobile of [false,true])for(const p of [{x:248,z:-336},{x:466,z:-331}]){
 const scene=new THREE.Scene(),life=new BeachLife(scene,{mobile}),origin={x:0,z:0};life.refresh(p,origin);
 assert(life.stats.trees>35&&life.stats.shrubs>60,'Both crossings retain substantial woodland');
 assertClearFoliage(life.grass,origin,'Grass');assertClearFoliage(life.shrubs,origin,'Fern');
 const rocks=riverRocksNear(p.x,p.z,65),approach=rocks.filter(r=>r.approach);
 assert.deepEqual(riverRocksNear(p.x,p.z,65),rocks,'Approach stone placement is deterministic');
 for(const side of [-1,1]){
  const onBank=approach.filter(r=>Math.sign(r.z-riverZ(r.x))===side);
  assert(onBank.length>=3,'Both banks have exposed approach stones');
  assert(onBank.some(r=>life.samples.some(s=>s.kind==='rock'&&Math.hypot(s.x-r.x,s.z-r.z)<.001)),'Approach stones reach the rendered/collidable rock mesh on both banks');
 }
 for(const rock of approach){
  assert.equal(rock.wet,false);assert.equal(riverProfile(rock.x,rock.z).wet,0,'Approach stones stay on the dry banks');
  assert(rock.sy<.5,'Low embedded stones keep the marked crossing passable');
  assert(Math.abs(rock.y-baseHeight(rock.x,rock.z))<.1,'Approach stones sit on the existing ground');
 }
 for(const mesh of [life.grass,life.shrubs,life.trunks,life.rocks])assert(mesh.count<=mesh.instanceMatrix.count,'Approach scenery respects instance capacities');
 assert.equal(life.rocks.instanceMatrix.count,480,'Approach detail keeps the existing rock budget');
 const before=life.rocks.instanceMatrix.array.slice();life.refresh({x:p.x+.2,z:p.z+.2},origin);assert.deepEqual(life.rocks.instanceMatrix.array,before,'Rocks stay fixed within a scenery cell');
 const shifted={x:512,z:-512};life.refresh(p,shifted);assertClearFoliage(life.grass,shifted,'Rebased grass');assertClearFoliage(life.shrubs,shifted,'Rebased fern');
 life.dispose();assert.equal(scene.children.length,0);
 console.log({mobile,crossing:p.x,approachStones:approach.length});
}
console.log('River approaches: brown muddy ground, clear plant footprints, lush banks, deterministic exposed stones, both fords and unchanged waterlines passed.');
