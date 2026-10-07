import * as THREE from 'three/webgpu';
import {RAPIER} from './physics.mjs';
// Reuse the rendered geometry and instance transforms so tyres, body and log agree.
// Keep the colliders shared by neighbouring scenery cells. Rebuilding hundreds of
// unchanged triangle meshes in one frame makes a noticeable streaming pause.
export class BeachObstacles {
 constructor(physics,{radius=55}={}){this.p=physics;this.radius=radius;this.key='';this.colliders=[];this.handles=new Set();this.kinds=new Map();this.groups=new Map();this.geometryCache=new WeakMap();this.matrix=new THREE.Matrix4();this.vertex=new THREE.Vector3();physics.obstacles=this;}
 refresh(life){
  const origin=this.p.origin||{x:0,z:0},position=this.p.position?.(),limited=Number.isFinite(this.radius)&&Number.isFinite(position?.x)&&Number.isFinite(position?.z);
  // An 8m grid keeps refreshes bounded. The half-cell diagonal margin ensures
  // at least `radius` metres of exact collision in every direction, even at a
  // cell corner; include the object's full radius so long logs never pop solid.
  const cx=limited?Math.floor(position.x/8):0,cz=limited?Math.floor(position.z/8):0,centerX=cx*8+4,centerZ=cz*8+4,rangeKey=limited?cx+','+cz:'all';
  const key=life.key+'|'+(life.ridgeRocks?.userData.detailKey||'')+'|'+(life.lavaRocks?.userData.detailKey||'')+'|'+origin.x+','+origin.z+'|'+rangeKey;if(this.key===key)return;this.key=key;
  const active=new Set();
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
    mesh.getMatrixAt(i,this.matrix);const e=this.matrix.elements,x=e[12]+origin.x,y=e[13],z=e[14]+origin.z;
    if(limited){const scale=Math.max(Math.hypot(e[0],e[1],e[2]),Math.hypot(e[4],e[5],e[6]),Math.hypot(e[8],e[9],e[10])),reach=this.radius+Math.SQRT2*4+geometry.radius*scale;if((x-centerX)**2+(z-centerZ)**2>reach*reach)continue}
    // Rotation and scale are independent of floating origin. Matching world
    // positions with a sub-millimetre tolerance only covers Float32 translation
    // rounding; the actual collider translation always uses the current matrix.
    const shapeKey=[e[0],e[1],e[2],e[4],e[5],e[6],e[8],e[9],e[10]].join(','),candidates=previous.get(shapeKey);
    let entry=candidates?.find(v=>remaining.has(v)&&Math.abs(v.x-x)<.001&&Math.abs(v.y-y)<.001&&Math.abs(v.z-z)<.001);
    if(entry){
     remaining.delete(entry);const c=entry.collider;
     if(entry.localX!==e[12]||entry.y!==y||entry.localZ!==e[14])c.setTranslation({x:e[12],y,z:e[14]});
     Object.assign(entry,{x,y,z,localX:e[12],localZ:e[14]});
    }else{
     const tx=e[12],ty=e[13],tz=e[14],vertices=new Float32Array(a.count*3);this.matrix.setPosition(0,0,0);
     for(let j=0;j<a.count;j++){this.vertex.fromBufferAttribute(a,j).applyMatrix4(this.matrix);this.vertex.toArray(vertices,j*3)}
     const collider=this.p.world.createCollider(RAPIER.ColliderDesc.trimesh(vertices,geometry.indices).setTranslation(tx,ty,tz).setFriction(.85).setRestitution(.02));
     entry={collider,x,y,z,localX:tx,localZ:tz};this.handles.add(collider.handle);this.kinds.set(collider.handle,kind);
    }
    entries.push(entry);let bucket=buckets.get(shapeKey);if(!bucket)buckets.set(shapeKey,bucket=[]);bucket.push(entry);
   }
   for(const entry of remaining)this.remove(entry);
   this.groups.set(mesh,{key:groupKey,geometry,entries,buckets});
  }
  for(const [mesh,group]of this.groups)if(!active.has(mesh)){for(const entry of group.entries)this.remove(entry);this.groups.delete(mesh)}
  this.colliders=[];for(const group of this.groups.values())for(const entry of group.entries)this.colliders.push(entry.collider);
 }
 remove(entry){const c=entry.collider;this.p.world.removeCollider(c,false);this.handles.delete(c.handle);this.kinds.delete(c.handle);}
 kind(collider){return collider?this.kinds.get(collider.handle):undefined}
 has(collider){return !!collider&&this.handles.has(collider.handle)}
 clear(){for(const group of this.groups.values())for(const entry of group.entries)this.remove(entry);this.groups.clear();this.colliders=[];this.handles.clear();this.kinds.clear();this.key='';}
 dispose(){this.clear();this.geometryCache=new WeakMap();if(this.p.obstacles===this)this.p.obstacles=null;}
}
