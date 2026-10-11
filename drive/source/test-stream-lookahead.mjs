import assert from 'node:assert/strict';
import {Scene,BoxGeometry,InstancedMesh,MeshBasicMaterial,Matrix4} from 'three/webgpu';
import {streamLookahead,terrainStreamPriority} from './stream-lookahead.mjs';
import {TerrainView} from './terrain-view.mjs';
import {SandField} from './terrain.mjs';
import {DrivePhysics,RAPIER} from './physics.mjs';
import {BeachObstacles} from './obstacles.mjs';
const at={x:16,z:16},ahead=streamLookahead(at,{x:22.35,y:-100,z:0});
assert.equal(ahead.x,64);assert.equal(ahead.z,16);assert.deepEqual(streamLookahead(at,{x:.2,z:.2}),at,'Rocking must not churn prefetch direction');
assert.deepEqual(streamLookahead(at,{x:NaN,z:Infinity}),at);assert.deepEqual(streamLookahead(at,{x:-22.35,z:0}),{x:-32,z:16});
assert(Math.abs(Math.hypot(...Object.values(streamLookahead({x:0,z:0},{x:100,z:100})))-48)<1e-8,'Diagonal lookahead is bounded');
assert(terrainStreamPriority(3,0,16,16,ahead)<terrainStreamPriority(-3,0,16,16,ahead),'Forward outer ring wins preparation time');
assert(terrainStreamPriority(-1,0,16,16,ahead)<terrainStreamPriority(3,0,16,16,ahead),'Missing nearby ground wins regardless of heading');
const field=new SandField(),p=await DrivePhysics.create(field),view=new TerrainView(new Scene(),p,field);view.update(16,16);view.budget=.2;
for(let frame=0;frame<1000&&!view.cache.size;frame++)view.update(16,16,false,{lookahead:ahead});
assert(view.cache.has('3,0'),'The real row scheduler finishes the forward prefetched tile first');assert(!view.tiles.has('3,0'),'Prediction does not move the active terrain footprint');assert.equal(view.tiles.size,25);assert.equal(view.tiles.size+view.cache.size,26);
p.world.step();const y=field.height(16,16),hit=p.world.castRay(new RAPIER.Ray({x:16,y:y+3,z:16},{x:0,y:-1,z:0}),5,true,RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC);assert(hit&&Math.abs(hit.timeOfImpact-3)<.03,'Actual vehicle ground remains physical during anticipation');
view.dispose();
// Spare collision work follows travel direction while near objects stay ready
// even behind the truck. A reversal reprioritizes remaining work immediately.
const geometry=new BoxGeometry(2,2,2),material=new MeshBasicMaterial(),rocks=new InstancedMesh(geometry,material,4),life={key:'anticipation',rocks};
for(const [i,x] of [-40,40,46,-12].entries())rocks.setMatrixAt(i,new Matrix4().makeTranslation(x,1,0));p.reset(0,0,0);
const obstacles=new BeachObstacles(p,{budget:0,maxCreates:1});obstacles.refresh(life,{budgeted:true,lookahead:{x:48,z:0}});
const entries=obstacles.groups.get(rocks).entries;assert(entries.find(e=>e.x===-12).collider,'Near coverage behind us is unconditional');assert(entries.find(e=>e.x===46).collider,'Bounded spare work preloads the forward corridor');assert(!entries.find(e=>e.x===-40).collider);
obstacles.refresh(life,{budgeted:true,lookahead:{x:-48,z:0}});assert(entries.find(e=>e.x===-40).collider,'A reversal changes preparation without waiting for a cell change');
obstacles.dispose();rocks.dispose();geometry.dispose();material.dispose();p.dispose();
console.log('Anticipatory streaming: bounded velocity lead, rocking/reversal, real forward tile preparation, unchanged ground footprint and immediate collision safety passed.');
