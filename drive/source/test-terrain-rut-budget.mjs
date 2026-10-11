import assert from 'node:assert/strict';
import {Scene} from 'three/webgpu';
import {SandField} from './terrain.mjs';
import {TerrainView} from './terrain-view.mjs';
import {DrivePhysics,RAPIER} from './physics.mjs';
const field=new SandField(),physics=await DrivePhysics.create(field),view=new TerrainView(new Scene(),physics,field);
view.update(0,-64);
// Four rut patches touch the four independent tiles at one grid corner.
const patches=[[-1,-65],[1,-65],[-1,-63],[1,-63]],before=new Map();
for(const [x,z] of patches){const key=`${Math.floor(x/32)},${Math.floor(z/32)}`,tile=view.tiles.get(key),k=(z*2-tile.tz*64)*65+x*2-tile.tx*64;before.set(key,{x,z,tile,k,y:tile.mesh.geometry.attributes.position.getY(k)});for(let n=0;n<5;n++)field.stamp(x,z,1,.3,1);}
const oldCollider=view.collider.bind(view),created=[];view.collider=t=>{created.push(`${t.tx},${t.tz}`);return oldCollider(t)};
for(let frame=0;frame<4;frame++){
 const count=created.length;view.refresh({budgeted:true});assert(created.length-count<=1,'A driving frame installs at most one rut collider');physics.world.step();
 for(const [key,p] of before){
  const updated=created.includes(key),visible=p.tile.mesh.geometry.attributes.position.getY(p.k),expected=updated?field.height(p.x,p.z):p.y;
  assert(Math.abs(visible-expected)<1e-4,'Visible geometry is either wholly old or current');
  const ray=new RAPIER.Ray({x:p.x,y:visible+5,z:p.z},{x:0,y:-1,z:0}),hit=p.tile.collider.castRay(ray,8,true);
  assert(hit!==null&&Math.abs(hit-5)<.02,'The collider and visible deformation remain aligned within each tile');
 }
 // A second stamp reaches a queued tile before it is processed. No stale
 // snapshot can overwrite it, and it should not need a duplicate rebuild.
 if(frame===0)field.stamp(1,-63,1,.3,1);
}
assert.equal(created.length,4);assert.equal(view.rutQueue.length,0);assert.equal(field.dirty.size,0);
for(const [x,z] of patches)field.stamp(x,z,1,.3,1);
for(let frame=4;frame<8;frame++)view.refresh({budgeted:true});assert.equal(created.length,4,'Do not increase deformation work to 60 rebuilds per second');
view.refresh({budgeted:true});assert.equal(created.length,5);
view.refresh();assert.equal(created.length,8,'Explicit refresh drains the remainder atomically per tile');assert.equal(field.dirty.size,0);assert.equal(view.rutQueue.length,0);
// Saturated ruts still mark tiles dirty. Their unchanged geometry must not
// turn one budgeted call into a scan of the entire resident terrain grid.
let scans=0;const oldApply=view.applyRuts.bind(view);view.applyRuts=t=>{scans++;return oldApply(t)};view.tick=0;for(const key of view.tiles.keys())field.dirty.add(key);
view.refresh({budgeted:true});assert.equal(scans,1);assert.equal(created.length,8);assert.equal(view.rutQueue.length,24);view.refresh();
view.dispose();physics.dispose();console.log('Rut updates keep the existing cadence, limit driving frames to one collider, preserve queued wheel stamps and keep physical/visible heights identical.');
