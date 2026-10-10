// Judge Dean LLC — moving deck visuals and safe recovery interactions.
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {DrivePhysics} from './physics.mjs';
import {Recovery} from './recovery.mjs';
import {CanyonBridgeView} from './canyon-bridge-view.mjs';
const p=await DrivePhysics.create(),scene=new THREE.Scene(),view=new CanyonBridgeView(scene,p),recovery=new Recovery(p);
p.reset(665,-470,79);for(let i=0;i<600;i++)p.step(1/120,{brake:true});
assert(p.vehicle.wheelIsInContact(0));const velocity=p.rb.linvel();
assert.equal(recovery.request(),'bridge');assert.equal(recovery.state,'roof');assert.equal(recovery.boards.length,0);assert.deepEqual(p.rb.linvel(),velocity,'Rejection never freezes the chassis');
recovery.pending=true;recovery.step(1/120);assert.equal(recovery.pending,false);assert.equal(recovery.result,'bridge');
view.update(5);assert(view.group.visible);assert.equal(view.logs.count,200);assert(view.ropes.count>=120);
const mat=new THREE.Matrix4(),point=new THREE.Vector3();view.logs.getMatrixAt(100,mat);point.setFromMatrixPosition(mat);const segment=p.bridge.poses()[10];assert(Math.abs(point.y-segment.position.y)<.3,'Logs use live segment pose');
p.rebase(640,-480);view.update(6);assert.equal(view.group.position.x,-640);assert.equal(view.group.position.z,480);view.logs.getMatrixAt(100,mat);point.setFromMatrixPosition(mat);assert(Math.abs(point.x-665)<1,'World-coordinate deck visuals survive rebase');
assert([...mat.elements].every(Number.isFinite));view.dispose();assert.equal(scene.children.length,0);recovery.clear();p.dispose();console.log('Bridge view follows moving/rebased deck; recovery rejects immediate and queued deployment without freezing vehicle.');
