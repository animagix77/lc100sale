import * as THREE from 'three/webgpu';
import {RAPIER} from './physics.mjs';
// Judge Dean LLC — exact rendered shapes, prepared before the truck reaches them.
// Ordinary driving installs nearby collisions immediately, then spreads distant
// BVH construction across frames. Loading/recovery can still prepare all at once.
export class BeachObstacles {
 constructor(physics,{radius=55,immediateRadius=24,budget=1,maxCreates=6}={}){this.p=physics;this.radius=radius;this.immediateRadius=Math.min(radius,immediateRadius);this.budget=budget;this.maxCreates=maxCreates;this.key='';this.colliders=[];this.handles=new Set();this.kinds=new Map();this.groups=new Map();this.pending=new Set();this.geometryCache=new WeakMap();this.matrix=new THREE.Matrix4();this.vertex=new THREE.Vector3();physics.obstacles=this;}
 refresh(life,{budgeted=false}={}){
  const origin=this.p.origin||{x:0,z:0},position=this.p.position?.(),limited=Number.isFinite(this.radius)&&Number.isFinite(position?.x)&&Number.isFinite(position?.z);
  // The half-cell diagonal and full object radius cover cell corners, leaning
  // trees and long logs. The near guarantee is checked again on EVERY frame,
  // even while the scenery cell is unchanged or an outer queue is unfinished.
  const cx=limited?Math.floor(position.x/8):0,cz=limited?Math.floor(position.z/8):0,centerX=cx*8+4,centerZ=cz*8+4,rangeKey=limited?cx+','+cz:'all';
  const key=life.key+'|'+(life.ridgeRocks?.userData.detailKey||'')+'|'+(life.lavaRocks?.userData.detailKey||'')+'|'+origin.x+','+origin.z+'|'+rangeKey;let changed=false;
  if(this.key!==key){
   this.key=key;changed=true;const active=new Set();
   for(const mesh of [life.logs,life.rocks,life.trunks,life.ridgeRocks,life.lavaRocks].filter(Boolean)){
    active.add(mesh);const sourceKey=mesh.userData.detailKey||life.key,groupKey=sourceKey+'|'+origin.x+','+origin.z+'|'+rangeKey;
    let group=this.groups.get(mesh);if(group?.key===groupKey)continue;
    const g=mesh.geometry,a=g.attributes.position,indexVersion=g.index?.version||0;
    let geometry=this.geometryCache.get(g);
    if(!geometry||geometry.position!==a||geometry.version!==a.version||geometry.index!==g.index||geometry.indexVersion!==indexVersion){
     g.computeBoundingSphere();
     geometry={radius:g.boundingSphere.radius+g.boundingSphere.center.length(),position:a,version:a.version,index:g.index,indexVersion,indices:g.index?new Uint32Array(g.index.array):Uint32Array.from({length:a.count},(_,i)=>i)};this.geometryCache.set(g,geometry);
    }
    const previous=group?.geometry===geometry?group.buckets:new Map(),remaining=new Set(group?.entries||[]),entries=[],buckets=new Map(),kind=mesh===life.logs||mesh===life.trunks?'wood':'rock';
    for(let i=0;i<mesh.count;i++){
     mesh.getMatrixAt(i,this.matrix);const e=this.matrix.elements,x=e[12]+origin.x,y=e[13],z=e[14]+origin.z,scale=Math.max(Math.hypot(e[0],e[1],e[2]),Math.hypot(e[4],e[5],e[6]),Math.hypot(e[8],e[9],e[10])),objectRadius=geometry.radius*scale;
     if(limited){const reach=this.radius+Math.SQRT2*4+objectRadius;if((x-centerX)**2+(z-centerZ)**2>reach*reach)continue}
     // Match world positions and exact rotation/scale across reordering and
     // floating origins. Both installed shapes and queued work retain identity.
     const shapeKey=[e[0],e[1],e[2],e[4],e[5],e[6],e[8],e[9],e[10]].join(','),candidates=previous.get(shapeKey);
     let entry=candidates?.find(v=>remaining.has(v)&&Math.abs(v.x-x)<.001&&Math.abs(v.y-y)<.001&&Math.abs(v.z-z)<.001);
     if(entry){
      remaining.delete(entry);
      if(entry.collider&&(entry.localX!==e[12]||entry.y!==y||entry.localZ!==e[14]))entry.collider.setTranslation({x:e[12],y,z:e[14]});
      Object.assign(entry,{x,y,z,localX:e[12],localZ:e[14]});
     }else entry={collider:null,x,y,z,localX:e[12],localZ:e[14],transform:new Float32Array(e),geometry,objectRadius,kind};
     entries.push(entry);let bucket=buckets.get(shapeKey);if(!bucket)buckets.set(shapeKey,bucket=[]);bucket.push(entry);
    }
    for(const entry of remaining)this.remove(entry);
    this.groups.set(mesh,{key:groupKey,geometry,entries,buckets});
   }
   for(const [mesh,group]of this.groups)if(!active.has(mesh)){for(const entry of group.entries)this.remove(entry);this.groups.delete(mesh)}
   this.pending.clear();for(const group of this.groups.values())for(const entry of group.entries)if(!entry.collider)this.pending.add(entry);
  }
  if(this.pending.size){
   const candidates=[...this.pending];
   const distance=entry=>limited?Math.hypot(entry.x-position.x,entry.z-position.z)-entry.objectRadius:0;
   candidates.sort((a,b)=>distance(a)-distance(b));
   // The immediate zone is unconditional, including on a high-speed approach,
   // after rebasing and for geometry whose centre lies outside that zone.
   for(const entry of candidates)if(!budgeted||!limited||distance(entry)<=this.immediateRadius){this.create(entry);changed=true;}
   const stop=performance.now()+this.budget;let installed=0;
   for(const entry of candidates){
    if(entry.collider)continue;
    if(installed>=this.maxCreates||installed>0&&performance.now()>=stop)break;
    this.create(entry);changed=true;installed++;
   }
  }
  if(changed){this.colliders=[];for(const group of this.groups.values())for(const entry of group.entries)if(entry.collider)this.colliders.push(entry.collider);}
 }
 create(entry){
  const {geometry}=entry,a=geometry.position,vertices=new Float32Array(a.count*3);this.matrix.fromArray(entry.transform);this.matrix.setPosition(0,0,0);
  for(let j=0;j<a.count;j++){this.vertex.fromBufferAttribute(a,j).applyMatrix4(this.matrix);this.vertex.toArray(vertices,j*3)}
  const collider=this.p.world.createCollider(RAPIER.ColliderDesc.trimesh(vertices,geometry.indices).setTranslation(entry.localX,entry.y,entry.localZ).setFriction(.85).setRestitution(.02));
  entry.collider=collider;this.pending.delete(entry);this.handles.add(collider.handle);this.kinds.set(collider.handle,entry.kind);
 }
 remove(entry){this.pending.delete(entry);const c=entry.collider;if(!c)return;this.p.world.removeCollider(c,false);this.handles.delete(c.handle);this.kinds.delete(c.handle);}
 kind(collider){return collider?this.kinds.get(collider.handle):undefined}
 has(collider){return !!collider&&this.handles.has(collider.handle)}
 clear(){for(const group of this.groups.values())for(const entry of group.entries)this.remove(entry);this.groups.clear();this.pending.clear();this.colliders=[];this.handles.clear();this.kinds.clear();this.key='';}
 dispose(){this.clear();this.geometryCache=new WeakMap();if(this.p.obstacles===this)this.p.obstacles=null;}
}
