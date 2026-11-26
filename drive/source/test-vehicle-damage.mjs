// Judge Dean LLC. A panel only loosens after it receives its own damage.
import assert from 'node:assert/strict';
import {DAMAGE_PANELS, VehicleDamage} from './vehicle-damage.mjs';
import {readJourney,saveJourney} from './journey-ui.mjs';

const damage = new VehicleDamage();
function contact(x, z, nx, nz, severity = .65, ny = 0) {
  return {point: {x, y: .35, z}, normal: {x: nx, y: ny, z: nz}, severity};
}

const leftFront = contact(-.85, -.26, -1, 0);
for (const hit of [
  {...leftFront, severity: .29}, {...leftFront, severity: NaN}, {...leftFront, point: null},
  contact(.85, .7, 1, 0, 1, 3), contact(.85, -1.5, 1, 0), contact(.85, 1.65, 1, 0),
  contact(0, -2.12, 0, 1), {source: 'pebble', energy: 1}, {source: 'chassis', energy: 1},
]) {
  for (let i = 0; i < 20; i++) assert.equal(damage.hit(hit), null);
}
assert.deepEqual(damage.snapshot(), {});
assert.equal(damage.hasDamage, false);

const hits = new Map([
  ['leftFrontDoor', leftFront], ['rightFrontDoor', contact(.85, -.26, 1, 0)],
  ['leftRearDoor', contact(-.85, .71, -1, 0)], ['rightRearDoor', contact(.85, .71, 1, 0)],
  ['hood', contact(-.85, -2.12, -.1, -1)], ['tailgate', contact(.85, 2.12, .12, 1)],
]);
assert.equal(hits.size, DAMAGE_PANELS.length);
for (const [panel, event] of hits) {
  damage.reset();
  assert.deepEqual(damage.hit(event), {panel, stage: 'secure', changedStage: false});
  assert.deepEqual(damage.hit(event), {panel, stage: 'loose', changedStage: true});
  assert.deepEqual(damage.hit(event), {panel, stage: 'loose', changedStage: false});
  assert.deepEqual(damage.hit(event), {panel, stage: 'unlatched', changedStage: true});
  assert.equal(damage.hit(event), null);
  for (const other of DAMAGE_PANELS) if (other !== panel) assert.equal(damage.stage(other), 'secure');
}

damage.reset();
assert.equal(damage.hit({...leftFront, severity: 9}).stage, 'loose');
damage.hit(hits.get('tailgate'));
const prior = damage.snapshot();
const reloaded = new VehicleDamage();
reloaded.restore(JSON.parse(JSON.stringify(prior)));
assert.deepEqual(reloaded.snapshot(), prior);
assert.equal(reloaded.hasDamage, true);
assert.deepEqual(reloaded.hit(hits.get('tailgate')), damage.hit(hits.get('tailgate')));
reloaded.restore({hood: 999, leftFrontDoor: -20, rightFrontDoor: '80', tailgate: Infinity, bumper: 100});
assert.deepEqual(reloaded.snapshot(), {hood: 100});
for (const legacy of [undefined, null, [], 'old']) {
  reloaded.restore(legacy);
  assert.equal(reloaded.hasDamage, false);
}
const checkpoint = {next:3, choices:{dunes:'islands'}};
const route = {snapshot:()=>checkpoint}, camp = {snapshot:()=>({tent:null,fire:false})};
const store = new Map();
globalThis.localStorage = {getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)};
assert(saveJourney(route,camp));
reloaded.restore(readJourney().damage);
assert.equal(reloaded.hasDamage,false);
assert(saveJourney(route,camp,damage));
reloaded.restore(readJourney().damage);
assert.deepEqual(reloaded.snapshot(),damage.snapshot());
reloaded.reset();
assert(saveJourney(route,camp,reloaded));
assert.deepEqual(readJourney().damage,{});
assert.deepEqual(readJourney().route,checkpoint);
assert.equal(store.size,1);
delete globalThis.localStorage;
console.log('Panel damage: directional contact, progressive latch failure, isolated panels, severity cap and saved wear passed.');

const {DrivePhysics,RAPIER} = await import('./physics.mjs');
const p = await DrivePhysics.create();
try {
  p.world.createCollider(RAPIER.ColliderDesc.cuboid(150,.1,150).setTranslation(0,-.1,0));
  p.world.createCollider(RAPIER.ColliderDesc.cuboid(4,2,.5).setTranslation(0,2,-13));
  p.reset(0,0,0);
  for(let i=0;i<300;i++)p.step(1/120,{brake:true});
  p.rb.setLinvel({x:0,y:0,z:-16},true);
  const wreck=new VehicleDamage();
  for(let i=0;i<220;i++){
    p.step(1/120,{gas:true});
    for(const event of p.damageEvents.splice(0))wreck.hit(event);
  }
  assert(wreck.peakCrush>=65,'A highway-speed physical impact can crush pristine bodywork in one hit');
  assert.equal(wreck.stage('hood'),'unlatched');
  assert(['leftFrontDoor','rightFrontDoor'].some(id=>wreck.stage(id)==='unlatched'));
  const atWall=p.position().z;
  for(let i=0;i<480;i++)p.step(1/120,{reverse:true});
  assert(p.position().z>atWall+3,'The wreck backs away under its own power');
  const restored=new VehicleDamage();restored.restore(JSON.parse(JSON.stringify(wreck.snapshot())));
  assert.deepEqual(restored.snapshot(),wreck.snapshot());
  restored.reset();assert.deepEqual(restored.snapshot(),{});
  console.log('Physical wall strike, single-hit door release, saved crush and powered drive-away passed.',wreck.snapshot());
} finally {p.dispose();}
