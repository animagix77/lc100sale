import * as THREE from 'three/webgpu';
import {RAPIER} from './physics.mjs';
// Reuse the rendered geometry and instance transforms so tyres, body and log agree.
// Heavy driftwood is fixed; grass and loose seaweed remain pass-through scenery.
export class BeachObstacles {
 constructor(physics){this.p=physics;this.key='';this.colliders=[];this.handles=new Set();this.kinds=new Map();physics.obstacles=this;}
 refresh(life){
  if(this.key===life.key)return;this.clear();this.key=life.key;
  const matrix=new THREE.Matrix4(),v=new THREE.Vector3();
  for(const mesh of [life.logs,life.rocks,life.trunks].filter(Boolean)){const g=mesh.geometry,a=g.attributes.position;
  const indices=g.index?new Uint32Array(g.index.array):Uint32Array.from({length:a.count},(_,i)=>i);
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,matrix);const vertices=new Float32Array(a.count*3);
   for(let j=0;j<a.count;j++){v.fromBufferAttribute(a,j).applyMatrix4(matrix);v.toArray(vertices,j*3)}
   const c=this.p.world.createCollider(RAPIER.ColliderDesc.trimesh(vertices,indices).setFriction(.85).setRestitution(.02));
   this.colliders.push(c);this.handles.add(c.handle);this.kinds.set(c.handle,mesh===life.rocks?'rock':'wood');
  }
  }
 }
 kind(collider){return collider?this.kinds.get(collider.handle):undefined}
 has(collider){return !!collider&&this.handles.has(collider.handle)}
 clear(){for(const c of this.colliders)this.p.world.removeCollider(c,false);this.colliders=[];this.handles.clear();this.kinds.clear();this.key='';}
 dispose(){this.clear();if(this.p.obstacles===this)this.p.obstacles=null;}
}
