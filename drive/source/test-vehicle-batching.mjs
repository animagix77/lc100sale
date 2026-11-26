import assert from 'node:assert/strict';
import {BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture, Vector3} from 'three/webgpu';
import {mergeRigid} from './vehicle-batching.mjs';
import {VehicleDamage} from './vehicle-damage.mjs';
import {VehicleDamageView} from './vehicle-damage-view.mjs';

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

// The paint is shared everywhere on the truck. Each closure still needs an
// independent transform after batching, including its glazing and inner trim.
const truck=new Group(), coachwork=new Group();
coachwork.name='Body';
truck.add(coachwork);
const paint=new MeshStandardMaterial(), pane=new MeshStandardMaterial({transparent:true});
const closure=(id,hinge)=>{
  const group=new Group();
  group.userData.damage_panel=id;
  group.userData.damage_hinge=hinge;
  group.add(new Mesh(new BoxGeometry(),paint),new Mesh(new BoxGeometry(),pane));
  coachwork.add(group);
  return group;
};
const door=closure('leftFrontDoor',[-.965,.74,-.72]);
const opposite=closure('rightFrontDoor',[.965,.74,-.72]);
const hood=closure('hood',[0,1.378,-.966]);
const gate=closure('tailgate',[0,.85035,2.42251]);
const reverseLamp=new Mesh(new BoxGeometry(),paint);
reverseLamp.name='Rear_lamps__left_reverse_gate';
gate.add(reverseLamp);
coachwork.add(new Mesh(new BoxGeometry(),paint));
const view=new VehicleDamageView(truck), damage=new VehicleDamage();
mergeRigid(coachwork);
const whole=coachwork.children.find(part=>part.name.startsWith('Intact body /'));
assert(whole?.visible,'Closed truck should render one shared paint batch');
assert.equal(whole.geometry.index.count,5*36);
assert(whole.castShadow && whole.receiveShadow);
const closedGeometry=whole.geometry;
assert.equal(gate.children.length,3);
assert.equal(reverseLamp.parent,gate);
for(const group of [door,opposite,hood,gate]){
  assert.equal(group.children.filter(part=>part.material===paint && part!==reverseLamp).length,1);
  assert.equal(group.children.filter(part=>part.material===pane).length,1);
}
const zero=new Vector3();
view.update(1/60,damage,zero);
const strike={severity:1,point:{x:-1,z:0},normal:{x:-1,y:0,z:0}};
damage.hit({...strike,severity:.35});
view.update(1/60,damage,zero);
assert(whole.visible,'Minor wear should keep closed batching active');
damage.hit(strike);
view.update(1/60,damage,zero);
assert(!whole.visible);
assert(door.children.find(part=>part.material===paint).visible);
assert(door.rotation.y<0,'The driver door should open outwards');
assert.equal(opposite.rotation.y,0);
const hinge=new Vector3(...door.userData.damage_hinge);
assert(door.localToWorld(hinge.clone()).distanceTo(hinge)<1e-8);
damage.hit(strike);
const moving=new Vector3();
let max=0;
for(let frame=0;frame<250;frame++){
  moving.x=frame<48?frame/12:(96-frame)/12;
  view.update(1/60,damage,moving);
  max=Math.max(max,-door.rotation.y);
}
assert(max>.107 && max<=.651,'A failed latch allows a larger, bounded swing');
// Drive the existing hinge into its physical strap stop, then let it settle.
const hingeState=view.panels.find(p=>p.id==='leftFrontDoor');
hingeState.angle=.64;hingeState.angularSpeed=4;
const knock=view.update(1/60,damage,moving);
assert(knock?.side===-1 && knock.speed>1.15,'The driver door reports a knock at its actual stop');
let parkedKnocks=0;
for(let i=0;i<240;i++)if(view.update(1/60,damage,zero)&&i>120)parkedKnocks++;
assert.equal(parkedKnocks,0,'A settled open door has no continuing rattle');
damage.restore({hood:100,tailgate:100});
view.reset();
view.update(1/60,damage,zero);
assert(hood.rotation.x>0 && gate.rotation.x>0);
assert.equal(door.rotation.y,0);
const accessible=new VehicleDamageView(truck,{reduced:true});
accessible.update(1/60,damage,moving);
const resting=gate.rotation.x;
moving.z=-18;
accessible.update(1/60,damage,moving);
assert.equal(gate.rotation.x,resting,'Reduced motion keeps a visible, stable damaged pose');
damage.reset();
accessible.update(1/60,damage,zero);
assert(gate.position.length()<1e-10 && Math.abs(gate.rotation.x)<1e-10);
assert(whole.visible && whole.geometry===closedGeometry);
assert(!door.children.find(part=>part.material===paint).visible);
view.dispose();
console.log('Damage checks passed for per-panel batches, hinge placement, inertia, repair and reduced motion.');

// The bent panel is reversible and never edits the source mesh shared by other parts.
const rig=new Group(),shell=new Group(),nose=new Mesh(new BoxGeometry(1.8,.4,.8),paint);
shell.name='Body';rig.add(shell);shell.add(nose);nose.position.set(0,.95,-1.85);
const pristine=nose.geometry,original=pristine.attributes.position.array.slice();
const crushed=new VehicleDamage(),dentView=new VehicleDamageView(rig);
crushed.hit({severity:1,closing:16,impulse:22000,point:{x:-.7,z:-2},normal:{x:0,y:0,z:-1}});
dentView.update(1/60,crushed,zero);
assert.notEqual(nose.geometry,pristine);
assert.deepEqual(pristine.attributes.position.array,original);
assert(nose.geometry.attributes.position.getZ(0)>pristine.attributes.position.getZ(0)+.1);
assert([...nose.geometry.attributes.normal.array].every(Number.isFinite));
const deformed=nose.geometry;
dentView.update(1/60,crushed,zero);assert.equal(nose.geometry,deformed);
crushed.reset();dentView.update(1/60,crushed,zero);assert.equal(nose.geometry,pristine);
dentView.dispose();
