// Judge Dean LLC — gate geometry and labels stay stable through every route and rebase.
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {WaypointView} from './waypoint-view.mjs';
import {WaypointRoute,WAYPOINT_COUNT,GATE_HALF_WIDTH} from './waypoints.mjs';
import {ROUTE_FORKS} from './expedition.mjs';
import {warmSceneMaterials} from './scene-warmup.mjs';

const previousDocument=globalThis.document,paint=[],canvases=[];
globalThis.document={createElement(type){assert.equal(type,'canvas');const ctx={fillRect(...args){paint.push({kind:'background',color:this.fillStyle,args})},fillText(text,x,y){paint.push({kind:'text',text,x,y,color:this.fillStyle,font:this.font,align:this.textAlign,baseline:this.textBaseline})}},canvas={width:0,height:0,getContext(kind){assert.equal(kind,'2d');return ctx}};canvases.push(canvas);return canvas}};
const scene=new THREE.Scene(),route=new WaypointRoute(),field={height:(x,z)=>2+x*.017-z*.003},view=new WaypointView(scene,route,field);
const pool=[...view.pool],labels=pool.map(g=>g.userData.label),materials=labels.map(l=>l.material),graphs=materials.map(m=>m.colorNode),versions=materials.map(m=>m.version),atlasVersion=view.labelAtlas.map.version;
assert.equal(canvases.length,1);assert.equal(paint.filter(p=>p.kind==='text').length,WAYPOINT_COUNT*2+1);assert.equal(scene.children.length,4);assert(pool.every(g=>!g.visible));
assert.equal(canvases[0].width,2048);assert(canvases[0].height<=1024,'The atlas remains a small bounded startup upload');
assert(materials.every(m=>m.isSpriteNodeMaterial&&m.map===view.labelAtlas.map&&!m.depthWrite));
const close=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} ≈ ${b}`);
const xyz=(actual,x,y,z)=>{close(actual.x,x);close(actual.y,y);close(actual.z,z)};
function check(origin){
 view.refresh(origin);const expected=route.nearby();assert.equal(view.groups.length,expected.length);assert.equal(view.pool.length,4);assert.equal(scene.children.length,4);
 for(let slot=0;slot<4;slot++){
  const g=pool[slot],point=expected[slot];assert.equal(g.visible,!!point);assert.equal(g.userData.label,labels[slot]);if(!point)continue;
  const bridge=point.name==='Canyon bridge'||point.name==='The far bank',t=bridge?{...point,dx:0,dz:1}:point,half=bridge?2.3:GATE_HALF_WIDTH,active=t.index===route.next,passed=t.index<route.next,mat=view.materials[passed?2:active?0:1],{posts,flags,dashes,label,labelOffset}=g.userData;
  xyz(g.position,t.x-origin.x,0,t.z-origin.z);
  for(let i=0;i<2;i++){
   const side=i===0?-1:1,x=t.x-side*t.dz*half,z=t.z+side*t.dx*half,h=field.height(x,z);
   xyz(posts[i].position,x-t.x,h+1.6,z-t.z);xyz(flags[i].position,x-t.x,h+3.1,z-t.z);assert.equal(posts[i].material,mat);assert.equal(flags[i].material,mat);close(flags[i].rotation.y,i===1?Math.PI:0);
  }
  let n=0;for(let x=-half+.5;x<half;x+=1.2){const dash=dashes[n++];assert(dash.visible);assert.equal(dash.material,mat);xyz(dash.position,-t.dz*x,field.height(t.x-t.dz*x,t.z+t.dx*x)+.027,t.dx*x);close(dash.rotation.y,Math.atan2(-t.dx,-t.dz))}
  assert(dashes.slice(n).every(d=>!d.visible),'Bridge gates hide unused dash slots');
  xyz(label.scale,active?4:2.1,active?1.5:.79,1);xyz(label.position,0,Math.max(field.height(t.x-half,t.z),field.height(t.x+half,t.z))+3.7,0);
  // Match UV cell to the exact painted text and state, including all numbered
  // gates after the canyon insertion and the completed checkpoint checkmark.
  const column=Math.round(labelOffset.value.x*view.labelAtlas.columns),row=Math.round((1-labelOffset.value.y)*view.labelAtlas.rows)-1;
  const cell=paint.find(p=>p.kind==='text'&&p.x===column*256+128&&p.y===row*96+48);
  assert(cell);assert.equal(cell.text,passed?'✓':String(t.leg).padStart(2,'0'));assert.equal(cell.color,active?'#ffc381':'#eee9d9');assert.equal(cell.font,'bold 44px monospace');assert.equal(cell.align,'center');assert.equal(cell.baseline,'middle');
 }
 assert.deepEqual(materials.map(m=>m.version),versions);assert(materials.every((m,i)=>m.colorNode===graphs[i]&&labels[i].material===m));assert.equal(view.labelAtlas.map.version,atlasVersion);assert.equal(canvases.length,1,'No checkpoint or origin shift allocates another canvas or uploads a texture');
}
let cases=0;
for(let mask=0;mask<1<<ROUTE_FORKS.length;mask++){
 route.choices=Object.fromEntries(ROUTE_FORKS.map((f,i)=>[f.id,f.options[(mask>>i)&1].id]));route.revision++;
 for(let next=0;next<=WAYPOINT_COUNT;next++){route.next=route.passed=next;for(const origin of [{x:0,z:0},{x:512,z:-512}]){check(origin);cases++}}
}
route.next=route.passed=0;route.revision++;check({x:0,z:0});view.clear();assert(pool.every(g=>!g.visible));check({x:0,z:0});
// The startup helper must see all four sprite shaders, including a slot hidden
// near the first/last gate, and the same single atlas that later labels use.
let target=null,mrt=null,warmLabels=0;
const renderer={getRenderTarget:()=>target,getMRT:()=>mrt,setRenderTarget:v=>target=v,setMRT:v=>mrt=v,compileAsync:async()=>{assert(pool.every(g=>g.visible));assert(labels.every(l=>!l.frustumCulled))}};
await warmSceneMaterials(renderer,scene,new THREE.PerspectiveCamera(),{warmRender:()=>{scene.traverse(o=>{if(o.isSprite){assert.equal(o.material.map,view.labelAtlas.map);warmLabels++}})}});assert.equal(warmLabels,4);
let textureDisposals=0,materialDisposals=0;view.labelAtlas.map.addEventListener('dispose',()=>textureDisposals++);for(const material of materials)material.addEventListener('dispose',()=>materialDisposals++);
view.dispose();assert.equal(scene.children.length,0);assert.equal(textureDisposals,1);assert.equal(materialDisposals,4);globalThis.document=previousDocument;
console.log(`Waypoint view: ${cases} route/checkpoint/origin states preserve exact geometry and labels; four pooled gates and one warmed atlas avoid driving-time canvas/material/texture replacement.`);
