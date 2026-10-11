// Judge Dean LLC — trail marker readability, planting and resource continuity.
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {WaypointView,MARKER_HALF_WIDTH} from './waypoint-view.mjs';
import {WaypointRoute,GATE_HALF_WIDTH,WAYPOINT_COUNT} from './waypoints.mjs';
import {SandField} from './terrain.mjs';
import {warmSceneMaterials} from './scene-warmup.mjs';
const previousDocument=globalThis.document,paint=[],canvases=[];
globalThis.document={createElement(type){assert.equal(type,'canvas');const ctx={beginPath(){},moveTo(){},lineTo(){},stroke(){paint.push({check:true})},strokeRect(){},fillRect(){},fillText(text,x,y,max){paint.push({text,x,y,max})},measureText(text){return {width:text.length*13}}},canvas={width:0,height:0,getContext:()=>ctx};canvases.push(canvas);return canvas}};
const scene=new THREE.Scene(),route=new WaypointRoute(),field={height:(x,z)=>2+x*.017-z*.003},view=new WaypointView(scene,route,field);
const pool=[...view.pool],meshes=[],materials=new Set(),geometries=new Set();scene.traverse(o=>{if(o.isMesh){meshes.push(o);materials.add(o.material);geometries.add(o.geometry)}assert(!o.isSprite,'Markers must belong to the landscape, not billboards')});
for(const g of pool){materials.add(g.userData.flagMaterial);materials.add(g.userData.signMaterial)}for(const m of view.materials)materials.add(m);
const meshMaterials=meshes.map(m=>m.material);
const graphs=[...materials].map(m=>m.colorNode),versions=[...materials].map(m=>m.version),atlasVersion=view.labelAtlas.map.version;
assert.equal(canvases.length,1);assert.equal(pool.length,4);assert.equal(meshes.length,28);assert(pool.every(g=>!g.visible));
assert(view.labelAtlas.width*view.labelAtlas.height<=2048*1280,'One bounded startup atlas includes all routes');
assert.equal(paint.filter(p=>/^\d\d$/.test(p.text)).length,WAYPOINT_COUNT*3);assert.equal(paint.filter(p=>p.check).length,WAYPOINT_COUNT);
for(const name of ['Coastal shelf','Fern bank','Definitely not Home Depot','Island sunset camp'])assert(view.labelAtlas.cells.has(name),'Legacy, long and coastal names are prepainted');
for(const cell of view.labelAtlas.cells.values()){assert(cell.x>=0&&cell.y>=0&&cell.x+cell.width<=view.labelAtlas.width&&cell.y+cell.height<=view.labelAtlas.height)}
assert.equal(GATE_HALF_WIDTH,8,'Changing physical marker placement must not narrow checkpoint acceptance');
const close=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} ≈ ${b}`),point=new THREE.Vector3();
let cases=0;
function check(origin){
 view.refresh(origin,50);scene.updateMatrixWorld(true);
 const expected=route.complete?[route.target()]:route.nearby();assert.equal(view.groups.length,expected.length);assert.equal(scene.children.length,4);
 for(let slot=0;slot<pool.length;slot++){
  const g=pool[slot],original=expected[slot];let t=original;if(t?.leg===route.count)t={...t,x:t.x-t.dx*(route.camp.radius+4),z:t.z-t.dz*(route.camp.radius+4)};assert.equal(g.visible,!!t);if(!t)continue;
  const d=g.userData,bridge=['Canyon bridge','The far bank'].includes(t.name),dx=bridge?0:t.dx,dz=bridge?1:t.dz,half=d.halfWidth;assert(bridge?half===2.3:[4.2,MARKER_HALF_WIDTH].includes(half));
  assert.equal(d.target.name,t.name);assert.equal(d.state,t.index<route.next?'passed':t.index===route.next?'next':'trail');
  const cell=view.labelAtlas.cells.get(`${d.state}:${t.leg}`),name=view.labelAtlas.cells.get(t.name);
  close(d.offset.value.x,(cell.x+1)/view.labelAtlas.width);close(d.offset.value.y,1-(cell.y+cell.height-1)/view.labelAtlas.height);close(d.nameOffset.value.x,(name.x+1)/view.labelAtlas.width);
  for(let i=0;i<2;i++){
   const side=i?1:-1,x=t.x-side*dz*half,z=t.z+side*dx*half,post=d.posts[i];post.getWorldPosition(point);
   close(point.x+origin.x,x);close(point.z+origin.z,z);close(point.y,field.height(x,z));
   const face=new THREE.Vector3(0,0,1).applyQuaternion(post.quaternion);close(face.x,-dx);close(face.z,-dz);
   // Every sign vertex stays on its side of the road, including narrow bridge
   // approaches. A banner may flutter along travel, never across the corridor.
   post.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position;for(let v=0;v<p.count;v++){
    point.fromBufferAttribute(p,v).applyMatrix4(mesh.matrixWorld);const lateral=(point.x+origin.x-t.x)*(-dz)+(point.z+origin.z-t.z)*dx;
    assert(lateral*side>=half-.12,`${t.name} roadside hardware intrudes into the passage`);
   }});
  }
 }
 assert.deepEqual(meshes.map(m=>m.material),meshMaterials,'Advancement must not attach an unwarmed material');assert.deepEqual([...materials].map(m=>m.version),versions);assert.deepEqual([...materials].map(m=>m.colorNode),graphs);assert.equal(view.labelAtlas.map.version,atlasVersion);assert.equal(canvases.length,1,'Checkpoint/rebase must not allocate or upload labels');cases++;
}
for(const choices of [{dunes:'saddle',return:'mud'},{dunes:'shelf',return:'mud'},{dunes:'saddle',return:'bank'},{dunes:'shelf',return:'bank'},{dunes:'islands'}]){
 route.choices=choices;route.revision++;
 for(let next=0;next<=route.count;next++){route.next=route.passed=next;for(const origin of [{x:0,z:0},{x:512,z:-512},{x:-512,z:-256}])check(origin)}
}
assert.equal(view.groups.length,1,'Camp sign remains after the final checkpoint');assert.equal(view.groups[0].userData.state,'passed');
// Text backs use mirrored UV coordinates on opposite outward faces, so actual
// printed text reads left-to-right from both directions, with no doubleSide flip.
for(const geometry of [view.flagGeometry,view.signGeometry]){
 const p=geometry.attributes.position,u=geometry.attributes.uv,n=geometry.attributes.normal,half=p.count/2;
 for(let i=0;i<half;i++){close(p.getX(i),p.getX(i+half));close(p.getY(i),p.getY(i+half));close(u.getX(i)+u.getX(i+half),1);assert(n.getZ(i)>.95&&n.getZ(i+half)<-.95)}
}
assert(view.signGeometry.boundingBox.max.z>.05&&view.signGeometry.boundingBox.min.z<-.05,'Both sign faces must sit outside the solid backing');
view.clear();assert(pool.every(g=>!g.visible));check({x:0,z:0});
let target=null,mrt=null,warmed=0;const renderer={getRenderTarget:()=>target,getMRT:()=>mrt,setRenderTarget:v=>target=v,setMRT:v=>mrt=v,compileAsync:async()=>{assert(pool.every(g=>g.visible))}};
await warmSceneMaterials(renderer,scene,new THREE.PerspectiveCamera(),{warmRender:()=>{const attached=new Set();scene.traverse(o=>{if(o.material)attached.add(o.material)});for(const m of materials)assert(attached.has(m),'Every state uses a material warmed on an attached mesh');scene.traverse(o=>{if(o.material?.map===view.labelAtlas.map){assert(o.visible);assert(!o.frustumCulled);warmed++}})}});assert.equal(warmed,12,'All cloth/sign variants warm before gameplay');
let texturesDisposed=0,materialsDisposed=0,geometryDisposed=0;view.labelAtlas.map.addEventListener('dispose',()=>texturesDisposed++);for(const m of materials)m.addEventListener('dispose',()=>materialsDisposed++);for(const g of geometries)g.addEventListener('dispose',()=>geometryDisposed++);
view.dispose();assert.equal(scene.children.length,0);assert.equal(texturesDisposed,1);assert.equal(materialsDisposed,materials.size);assert.equal(geometryDisposed,geometries.size);
// Real curved terrain, rather than only the synthetic slope above: every
// destination plaque must clear the hillside across its complete footprint.
const realField=new SandField(),realRoute=new WaypointRoute(),realView=new WaypointView(scene,realRoute,realField);
let minimumClearance=Infinity,realCases=0;
for(const choices of [{dunes:'saddle',return:'mud'},{dunes:'shelf',return:'bank'},{dunes:'islands'}]){
 realRoute.choices=choices;realRoute.revision++;
 for(realRoute.next=0;realRoute.next<=realRoute.count;realRoute.next++){
  realView.refresh({x:0,z:0});scene.updateMatrixWorld(true);
  for(const g of realView.groups){
   const t=g.userData.target,post=g.userData.posts[0];
   for(let x=-2.02;x<=.021;x+=.06)for(const z of [-.066,0,.066]){
    point.set(x,1.015,z).applyMatrix4(post.matrixWorld);const clearance=point.y-realField.height(point.x,point.z);minimumClearance=Math.min(minimumClearance,clearance);assert(clearance>.1,`${t.name} plaque intersects terrain: ${clearance}`);
   }
   if(t.campEntrance)for(const p of g.userData.posts)p.traverse(mesh=>{if(!mesh.isMesh)return;const a=mesh.geometry.attributes.position;for(let i=0;i<a.count;i++){point.fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld);assert(Math.hypot(point.x-realRoute.camp.x,point.z-realRoute.camp.z)>realRoute.camp.radius+1,'Camp markers must stay outside all valid tent footprints')}});
  }
  realCases++;
 }
}
realView.dispose();
console.log(`Real terrain: ${realCases} checkpoint states clear every plaque by at least ${minimumClearance.toFixed(3)}m, and camp signs stand outside the tent clearing.`);
const still=new WaypointView(scene,route,field,{reduced:true});still.refresh({x:0,z:0},400);assert.equal(still.clock.value,0);still.dispose();globalThis.document=previousDocument;
console.log(`Trail markers: ${cases} route/legacy/coastal/rebase states, bridge clearance, planted supports, readable backs, final-camp retention, one warmed atlas and full cleanup passed.`);
