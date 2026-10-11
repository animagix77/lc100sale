// Judge Dean LLC — grounded expedition markers; every sign is prepared before driving.
import * as THREE from 'three/webgpu';
import {texture,uniform,uv,vec2,vec3,positionLocal,sin} from 'three/tsl';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {WaypointRoute,WAYPOINT_COUNT} from './waypoints.mjs';
import {LANDMARKS,COASTAL_LANDMARKS,ROUTE_FORKS,LEGACY_SHELF} from './expedition.mjs';

// Visual shoulders only: checkpoint acceptance remains owned by WaypointRoute.
export const MARKER_HALF_WIDTH=5.2;
const PALETTE={next:{paper:'#f2a45f',ink:'#142b30',caption:'NEXT'},trail:{paper:'#d8d0b9',ink:'#203c41',caption:'TRAIL'},passed:{paper:'#294b49',ink:'#d2ddd2',caption:'PASSED'}};
const STATES=['next','trail','passed'];
const names=[...new Set([...LANDMARKS,...COASTAL_LANDMARKS,...Object.values(LEGACY_SHELF.replacements),...ROUTE_FORKS.flatMap(f=>f.options.flatMap(o=>Object.values(o.replacements)))].map(p=>p.name))];
function nameLines(ctx,name){
 const words=name.toUpperCase().split(' ');let first='',best=[name.toUpperCase()];
 for(let i=0;i<words.length-1;i++){
  first+=(i?' ':'')+words[i];const second=words.slice(i+1).join(' ');
  if(best.length===1||Math.max(ctx.measureText(first).width,ctx.measureText(second).width)<Math.max(...best.map(s=>ctx.measureText(s).width)))best=[first,second];
 }
 return ctx.measureText(name.toUpperCase()).width<=224?[name.toUpperCase()]:best;
}
function makeLabelAtlas(){
 const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1280;
 const ctx=canvas.getContext('2d'),cells=new Map();ctx.fillStyle='#172d32';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineCap=ctx.lineJoin='round';
 for(let state=0;state<STATES.length;state++)for(let leg=1;leg<=WAYPOINT_COUNT;leg++){
  const key=STATES[state],style=PALETTE[key],cell=state*WAYPOINT_COUNT+leg-1,x=cell%16*128,y=Math.floor(cell/16)*160;
  ctx.fillStyle=style.paper;ctx.fillRect(x,y,128,160);
  // Woven border, stitched hems and printed identity share one cached atlas.
  ctx.fillStyle=style.ink;ctx.strokeStyle=style.ink;ctx.globalAlpha=.24;ctx.lineWidth=1;ctx.strokeRect(x+8,y+8,112,144);
  for(let row=13;row<153;row+=7){ctx.fillRect(x+11,y+row,1,2);ctx.fillRect(x+116,y+row,1,2)}
  ctx.globalAlpha=.055;for(let row=15;row<149;row+=3)ctx.fillRect(x+14,y+row,100,1);
  ctx.globalAlpha=1;ctx.fillStyle=style.ink;ctx.font='600 13px monospace';ctx.fillText('LC100',x+64,y+25);
  ctx.font='bold 78px sans-serif';ctx.fillText(String(leg).padStart(2,'0'),x+64,y+79);
  ctx.fillRect(x+32,y+119,64,1);ctx.font='bold 12px monospace';ctx.fillText(style.caption,x+64+(key==='passed'?9:0),y+135);
  if(key==='passed'){
   // Authored check geometry matches ui-icons.svg; the number remains visible.
   ctx.strokeStyle=style.ink;ctx.lineWidth=1.75;ctx.beginPath();ctx.moveTo(x+23,y+135);ctx.lineTo(x+27,y+139);ctx.lineTo(x+34,y+131);ctx.stroke();
  }
  cells.set(`${key}:${leg}`,{x,y,width:128,height:160,label:String(leg).padStart(2,'0'),state:key});
 }
 ctx.font='bold 23px sans-serif';
 names.forEach((name,i)=>{
  const x=i%8*256,y=800+Math.floor(i/8)*80;ctx.fillStyle='#172d32';ctx.fillRect(x,y,256,80);
  ctx.strokeStyle='#758780';ctx.lineWidth=1;ctx.strokeRect(x+7,y+7,242,66);ctx.fillStyle='#fff2dc';
  const lines=nameLines(ctx,name);for(let line=0;line<lines.length;line++)ctx.fillText(lines[line],x+128,y+40+(line-(lines.length-1)/2)*25,224);
  cells.set(name,{x,y,width:256,height:80,label:name});
 });
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
 return {map,cells,width:canvas.width,height:canvas.height};
}
function markerTarget(point,route){
 const bridge=point.name==='Canyon bridge'||point.name==='The far bank';
 if(bridge)return {...point,dx:0,dz:1};
 // Camps are entered through the signs. The clearing stays free for existing
 // and newly placed tents; the logical arrival checkpoint remains at its centre.
 if(point.leg===route.count){const distance=route.camp.radius+4;return {...point,x:point.x-point.dx*distance,z:point.z-point.dz*distance,campEntrance:true}}
 return point;
}
const placementKey=t=>`${t.x},${t.z},${t.dx},${t.dz}`;
function plaqueClearance(t,half,field){
 const x=t.x+t.dz*half,z=t.z-t.dx*half,base=field.height(x,z)+1.015;let clearance=Infinity;
 for(const outward of [.05,.4,.8,1.2,1.6,2.02])for(const along of [-.065,0,.065])clearance=Math.min(clearance,base-field.height(x+t.dz*outward+t.dx*along,z-t.dx*outward+t.dz*along));
 return clearance;
}
function preparePlacements(field){
 const placements=new Map(),route=new WaypointRoute();
 for(const choices of [{dunes:'saddle',return:'mud'},{dunes:'shelf',return:'mud'},{dunes:'saddle',return:'bank'},{dunes:'shelf',return:'bank'},{dunes:'islands'}]){
  route.choices=choices;
  for(route.next=0;route.next<route.count;route.next++){
   const t=markerTarget(route.target(),route),key=placementKey(t);if(placements.has(key))continue;
   const bridge=t.name==='Canyon bridge'||t.name==='The far bank';
   placements.set(key,bridge?2.3:plaqueClearance(t,MARKER_HALF_WIDTH,field)<.25?4.2:MARKER_HALF_WIDTH);
  }
 }
 return placements;
}
function setCell(atlas,cell,offset,scale){
 const c=atlas.cells.get(cell);if(!c)throw Error(`Missing trail sign: ${cell}`);
 offset.value.set((c.x+1)/atlas.width,1-(c.y+c.height-1)/atlas.height);scale.value.set((c.width-2)/atlas.width,(c.height-2)/atlas.height);
}
function paint(g,hex){const c=new THREE.Color(hex),a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b}g.setAttribute('color',new THREE.BufferAttribute(a,3));return g}
function hardware(primary){
 const parts=[],h=primary?3.86:2.75,side=primary?-1:1;
 const box=(x,y,z,w,h,d,c)=>parts.push(paint(new THREE.BoxGeometry(w,h,d).translate(x,y,z),c));
 box(0,h/2-.045,0,.17,h+.09,.17,'#726753');
 box(-.071,h/2,0,.018,h-.05,.155,'#514d41');box(.071,h/2,-.075,.018,h-.02,.018,'#95846a');
 box(0,.11,0,.19,.31,.19,'#36433e');box(0,h-.025,0,.21,.09,.21,'#34433f');
 // Long grain grooves and irregular silvered faces read as weathered timber.
 for(let i=0;i<7;i++){const y=.33+i*(h-.6)/7;box(-.054+(i%4)*.034,y, .087,.004,.24+(i%3)*.12,.002,i%2?'#a59b81':'#45463c')}
 const span=primary?1.35:.64;box(side*span/2,h-.12,0,span,.065,.075,'#374a45');
 for(const x of [side*.16,side*(span-.12)]){
  const ring=paint(new THREE.TorusGeometry(.035,.01,4,8),'#ada792');ring.translate(x,h-.19,.0);parts.push(ring);
 }
 if(primary){
  box(-1.00,1.33,0,2.04,.63,.10,'#46514a');
  for(const x of [-1.90,-.10])for(const y of [1.12,1.54]){
   const bolt=paint(new THREE.CylinderGeometry(.019,.019,.125,6).rotateX(Math.PI/2).translate(x,y,0),'#b0b5a5');parts.push(bolt);
  }
 }
 const geometry=mergeGeometries(parts);for(const g of parts)g.dispose();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
// Separate front/back vertices retain legibility from either approach. Both
// faces deform in the same local coordinates, rather than crossing in the wind.
function panelGeometry({cloth=false}={}){
 const p=[],n=[],uvs=[],indices=[],cols=cloth?8:1,rows=cloth?12:1;
 for(let face=0;face<2;face++){
  const start=p.length/3;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
   const u=i/cols,v=j/rows,edge=1-v;
   p.push(u-.5,v-.5-(cloth?.025*Math.sin(u*Math.PI)*edge:0),(face?-1:1)*(cloth?.004:.056)+(cloth?Math.sin(u*Math.PI*2.0)*.018*edge:0));n.push(0,0,face?-1:1);uvs.push(face?1-u:u,v);
   if(j<rows&&i<cols){const a=start+j*(cols+1)+i,b=a+1,c=a+cols+1,d=c+1;indices.push(...(face?[a,c,b,b,c,d]:[a,b,c,b,d,c]));}
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}

export class WaypointView{
 constructor(scene,route,field,{reduced=false}={}){
  this.scene=scene;this.route=route;this.field=field;this.reduced=reduced;this.key='';this.groups=[];this.clock=uniform(0);
  this.placements=preparePlacements(field);this.labelAtlas=makeLabelAtlas();this.primaryGeometry=hardware(true);this.secondaryGeometry=hardware(false);this.flagGeometry=panelGeometry({cloth:true});this.signGeometry=panelGeometry();this.stripGeometry=new THREE.BoxGeometry(.19,.085,.19);
  this.hardwareMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94});
  this.materials=[];
  this.pool=Array.from({length:4},()=>{
   const root=new THREE.Group(),offset=uniform(new THREE.Vector2()),scale=uniform(new THREE.Vector2()),nameOffset=uniform(new THREE.Vector2()),nameScale=uniform(new THREE.Vector2()),phase=uniform(0);
   const flagMaterial=new THREE.MeshStandardNodeMaterial({map:this.labelAtlas.map,roughness:1}),signMaterial=new THREE.MeshStandardNodeMaterial({map:this.labelAtlas.map,roughness:.88});
   const flagColor=texture(this.labelAtlas.map,uv().mul(scale).add(offset)),signColor=texture(this.labelAtlas.map,uv().mul(nameScale).add(nameOffset));
   flagMaterial.colorNode=flagColor.rgb;flagMaterial.emissiveNode=flagColor.rgb.mul(.055);
   const free=positionLocal.y.negate().add(.5).clamp(0,1),wave=sin(this.clock.mul(1.6).add(positionLocal.x.mul(5)).add(positionLocal.y.mul(3)).add(phase)).mul(free.mul(free)).mul(reduced?0:.045);
   flagMaterial.positionNode=positionLocal.add(vec3(0,0,wave));signMaterial.colorNode=signColor.rgb;signMaterial.emissiveNode=signColor.rgb.mul(.035);
   const stripMaterial=new THREE.MeshStandardMaterial({color:PALETTE.trail.paper,roughness:.68,emissive:PALETTE.trail.paper,emissiveIntensity:.05});this.materials.push(stripMaterial);
   const posts=[],flags=[],strips=[];
   for(let i=0;i<2;i++){
    const post=new THREE.Group(),body=new THREE.Mesh(i?this.secondaryGeometry:this.primaryGeometry,this.hardwareMaterial),flag=new THREE.Mesh(this.flagGeometry,flagMaterial),strip=new THREE.Mesh(this.stripGeometry,stripMaterial);
    flag.scale.set(i?.47:1.16,i?.71:1.76,1);flag.position.set(i?.33:-.73,i?2.19:2.75,.015);strip.position.y=i?.77:1.81;
    body.castShadow=body.receiveShadow=true;flag.castShadow=flag.receiveShadow=true;post.add(body,flag,strip);posts.push(post);flags.push(flag);strips.push(strip);root.add(post);
   }
   const sign=new THREE.Mesh(this.signGeometry,signMaterial);sign.scale.set(1.91,.57,1);sign.position.set(-1,1.33,0);posts[0].add(sign);sign.receiveShadow=true;
   Object.assign(root.userData,{posts,flags,strips,sign,offset,scale,nameOffset,nameScale,phase,target:null,state:'trail',flagMaterial,signMaterial,stripMaterial});root.visible=false;scene.add(root);return root;
  });
 }
 clear(){for(const g of this.pool)g.visible=false;this.groups.length=0;this.key='';}
 refresh(origin,elapsed=0){
  this.clock.value=this.reduced?0:elapsed;
  const key=`${this.route.revision},${this.route.next},${origin.x},${origin.z}`;if(key===this.key)return;this.key=key;this.groups.length=0;
  // A reached campsite keeps its physical sign rather than disappearing.
  const points=this.route.complete?[this.route.target()]:this.route.nearby();
  for(let slot=0;slot<this.pool.length;slot++){
   const g=this.pool[slot],point=points[slot];g.visible=!!point;if(!point)continue;
   const t=markerTarget(point,this.route),half=this.placements.get(placementKey(t))??MARKER_HALF_WIDTH;
   const state=t.index<this.route.next?'passed':t.index===this.route.next?'next':'trail',d=g.userData;
   g.position.set(t.x-origin.x,0,t.z-origin.z);d.phase.value=t.x*.071+t.z*.019;d.stripMaterial.color.set(PALETTE[state].paper);d.stripMaterial.emissive.set(PALETTE[state].paper);d.stripMaterial.emissiveIntensity=state==='next'?.15:.05;
   for(let i=0;i<2;i++){
    const side=i===0?-1:1,x=t.x-side*t.dz*half,z=t.z+side*t.dx*half;
    d.posts[i].position.set(x-t.x,this.field.height(x,z),z-t.z);d.posts[i].rotation.y=Math.atan2(-t.dx,-t.dz);
   }
   setCell(this.labelAtlas,`${state}:${t.leg}`,d.offset,d.scale);setCell(this.labelAtlas,t.name,d.nameOffset,d.nameScale);
   d.target=t;d.halfWidth=half;d.state=state;this.groups.push(g);
  }
 }
 dispose(){
  this.clear();for(const g of this.pool){g.removeFromParent();g.userData.flagMaterial.dispose();g.userData.signMaterial.dispose()}this.pool.length=0;
  this.labelAtlas.map.dispose();this.hardwareMaterial.dispose();for(const m of this.materials)m.dispose();for(const g of [this.primaryGeometry,this.secondaryGeometry,this.flagGeometry,this.signGeometry,this.stripGeometry])g.dispose();
 }
}
