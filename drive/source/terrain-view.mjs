import * as THREE from 'three/webgpu';
import {attribute,uniform,positionWorld,vec2,sin,float,smoothstep,mix,vec3,mx_noise_float,normalView,positionView,cameraPosition} from 'three/tsl';
import {RAPIER} from './physics.mjs';
import {baseHeight,shore,smooth,noise,surfaceAt} from './terrain.mjs';
const SIZE=32,N=64;
const meadow=new THREE.Color('#697c48'),snowColor=new THREE.Color('#dce7ef'),mudColor=new THREE.Color('#594b3b'),stone=new THREE.Color('#777f80');
const riverSoil=new THREE.Color('#66503a'),riverGravel=new THREE.Color('#8b8070');
const basalt=new THREE.Color('#39363b'),trailStone=new THREE.Color('#75646a');
const wet=new THREE.Color('#584c4b'),dry=new THREE.Color('#ce925c'),shadeColor=new THREE.Color('#885466'),crest=new THREE.Color('#dca165');
// Rut walls catch the sunset; compressed troughs stay visibly darker than untouched sand.
function rutShade(offset){return offset<0?1-Math.min(.44,-offset*.82):1+Math.min(.08,offset*.5)}
export class TerrainView{
 constructor(scene,physics,field){this.scene=scene;this.p=physics;this.field=field;this.tiles=new Map();this.center='';this.tick=0;this.clock=uniform(0);this.origin=uniform(new THREE.Vector2());this.cache=new Map();this.pending=new Map();this.needed=new Set();this.farJob=null;this.farHidden=new Set();this.renderOrigin={...physics.origin};this.budget=3;
 const world=positionWorld.xz.add(this.origin),z=world.y;
 const coast=float(-36).add(sin(z.mul(.006)).mul(8)).add(sin(z.mul(.019)).mul(3)),d=world.x.sub(coast);
 // Same wash phase as the surf. Persistent damp sand remains after the water retreats.
 const front=sin(this.clock.mul(.8).sub(z.mul(.026)).add(sin(z.mul(.16)).mul(.22))).mul(4.8).add(1).add(sin(z.mul(.46).add(this.clock.mul(.35))).mul(.42));
 const fresh=float(1).sub(smoothstep(front.add(7),front.add(11),d));
 const damp=float(1).sub(smoothstep(12,22,d));
 const detail=attribute('terrainDetail','vec4'),surface=attribute('surface','vec3');
 const close=float(1).sub(smoothstep(55,140,cameraPosition.distance(positionWorld)));
 const broad=mx_noise_float(vec3(world.x.mul(.12),positionWorld.y.mul(.18),world.y.mul(.12)));
 const grain=mx_noise_float(vec3(world.x.mul(2.8),positionWorld.y.mul(1.3),world.y.mul(2.8)));
 const layers=sin(positionWorld.y.mul(.85).add(broad.mul(8))).mul(.5).add(.5);
 const stratified=mix(float(1),layers.mul(.12).add(.88),detail.x);
 const textureShade=broad.mul(.09).add(1).mul(grain.mul(.11).mul(close).mul(float(1).sub(surface.y.mul(.65))).add(1));
 const make=flat=>{const mat=new THREE.MeshStandardNodeMaterial({roughness:1,metalness:0,flatShading:flat});mat.colorNode=attribute('color','vec3').mul(mix(float(1),float(.76),fresh)).mul(stratified).mul(textureShade);mat.roughnessNode=mix(mix(mix(float(.98),float(.30),damp.mul(.75).add(fresh.mul(.25))),float(.47),attribute('surface','vec3').x),float(.075),attribute('surface','vec3').z);if(!flat){
   const relief=grain.mul(.022).add(layers.mul(detail.x).mul(.02)).mul(close).mul(float(1).sub(surface.z));
   const dx=positionView.dFdx(),dy=positionView.dFdy(),r1=dy.cross(normalView),r2=normalView.cross(dx),det=dx.dot(r1);
   mat.normalNode=normalView.mul(det.abs()).sub(r1.mul(relief.dFdx()).add(r2.mul(relief.dFdy())).mul(det.sign())).normalize();
  }return mat};
 this.material=make(false);this.farMaterial=make(true);this.far=null}
 // Row-sized work units keep procedural terrain off the critical render frame.
 // Only the initial load and explicit teleports drain these synchronously.
 *geometryRows(tx,tz,n=N,size=SIZE,far=false){
  const count=(n+1)**2,ps=new Float32Array(count*3),colors=new Float32Array(count*3),idx=new Uint32Array(n*n*6),heights=new Float32Array(count),baseColors=new Float32Array(count*3),surfaces=new Float32Array(count*3),details=new Float32Array(count*4),normals=far?new Float32Array(count*3):null,offset={...this.p.origin},c=new THREE.Color();
  for(let j=0;j<=n;j++){
   for(let i=0;i<=n;i++){
    const k=j*(n+1)+i,k3=k*3,k4=k*4,x=tx+i*size/n,z=tz+j*size/n,base=baseHeight(x,z),deformation=far?0:this.field.gridOffset(Math.round(x*2),Math.round(z*2)),y=base+deformation;
    ps[k3]=x-offset.x;ps[k3+1]=y;ps[k3+2]=z-offset.z;heights[k]=base;
    const d=x-shore(z);c.lerpColors(wet,dry,smooth(12,24,d));
    const sx=(baseHeight(x+1,z)-baseHeight(x-1,z))*.5,sz=(baseHeight(x,z+1)-baseHeight(x,z-1))*.5;
    c.lerp(shadeColor,smooth(-.2,.6,sx*.75+sz*.65)*.65);
    c.lerp(crest,Math.min(.14,Math.max(0,y)*.008));const surface=surfaceAt(x,z);c.lerp(meadow,surface.grass*.92).lerp(mudColor,surface.mud*.95).lerp(snowColor,surface.snow*.99).lerp(stone,surface.river*.60).lerp(wet,surface.puddle*.6).lerp(basalt,surface.volcanic*.97).lerp(trailStone,surface.volcanic*surface.trail*.45);// Brown alluvial soil and exposed gravel continue up both banks; no green carpet in the ford.
    c.lerp(riverSoil,surface.riverApproach*(1-surface.river)*.88).lerp(riverGravel,surface.riverApproach*(.14+.22*noise(x*1.3,z*1.3)));
    c.multiplyScalar(.97+noise(x*.28,z*.28)*.06);
    surfaces[k3]=surface.mud;surfaces[k3+1]=surface.snow;surfaces[k3+2]=surface.puddle;details[k4]=surface.volcanic;details[k4+1]=surface.grass;details[k4+2]=surface.river;details[k4+3]=surface.trail;
    baseColors[k3]=c.r;baseColors[k3+1]=c.g;baseColors[k3+2]=c.b;c.multiplyScalar(rutShade(deformation));colors[k3]=c.r;colors[k3+1]=c.g;colors[k3+2]=c.b;
    // Far shading uses face derivatives; an analytic normal avoids a whole-mesh
    // normal pass when the completed far buffer is swapped in.
    if(far){const inverse=1/Math.hypot(sx,1,sz);normals[k3]=-sx*inverse;normals[k3+1]=inverse;normals[k3+2]=-sz*inverse;}
    if(i<n&&j<n){const a=k,b=a+1,c=a+n+1,e=c+1,o=(j*n+i)*6;idx[o]=a;idx[o+1]=c;idx[o+2]=b;idx[o+3]=b;idx[o+4]=c;idx[o+5]=e;}
   }
   yield;
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(ps,3));g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.setAttribute('surface',new THREE.BufferAttribute(surfaces,3));g.setAttribute('terrainDetail',new THREE.BufferAttribute(details,4));g.setIndex(new THREE.BufferAttribute(idx,1));
  if(far)g.setAttribute('normal',new THREE.BufferAttribute(normals,3));else{g.computeVertexNormals();g.userData.baseHeights=heights;g.userData.baseColors=baseColors;}
  g.userData.origin=offset;g.userData.grid={tx,tz,n,size};g.computeBoundingSphere();return g;
 }
 geometry(tx,tz,n=N,size=SIZE,far=false){const rows=this.geometryRows(tx,tz,n,size,far);let result;do{result=rows.next()}while(!result.done);return result.value;}
 placeGeometry(g){const old=g.userData.origin??this.p.origin,now=this.p.origin;if(old.x!==now.x||old.z!==now.z){g.translate(old.x-now.x,0,old.z-now.z);g.userData.origin={...now};}}
 tile(tx,tz,g){this.placeGeometry(g);const mesh=new THREE.Mesh(g,this.material);mesh.receiveShadow=true;return {tx,tz,mesh};}
 collider(tile){if(tile.collider)this.p.world.removeCollider(tile.collider,false);tile.collider=this.p.world.createCollider(RAPIER.ColliderDesc.trimesh(tile.mesh.geometry.attributes.position.array,tile.mesh.geometry.index.array).setTranslation(tile.mesh.position.x,0,tile.mesh.position.z).setFriction(.9));}
 activate(k,t){this.placeGeometry(t.mesh.geometry);t.mesh.position.set(0,0,0);this.applyRuts(t);this.collider(t);this.scene.add(t.mesh);this.tiles.set(k,t);this.cache.delete(k);}
 replaceFar(g,cx,cz){this.placeGeometry(g);if(this.far){this.scene.remove(this.far);this.far.geometry.dispose();}this.far=new THREE.Mesh(g,this.farMaterial);this.far.receiveShadow=true;this.scene.add(this.far);this.farCenter={x:cx,z:cz};this.farHidden.clear();this.syncFarHole();}
 syncFarHole(){
  if(!this.far?.geometry.userData.grid)return;const g=this.far.geometry,{tx,tz,n,size}=g.userData.grid,step=size/n,index=g.index,arr=index.array,next=new Set(this.tiles.keys());let changed=false;
  const paint=(key,hide)=>{const [x,z]=key.split(',').map(Number),i0=Math.round((x*SIZE-tx)/step),j0=Math.round((z*SIZE-tz)/step),cells=SIZE/step;
   for(let j=Math.max(0,j0);j<Math.min(n,j0+cells);j++){const from=Math.max(0,i0),to=Math.min(n,i0+cells);if(to<=from)continue;for(let i=from;i<to;i++){const a=j*(n+1)+i,b=a+1,c=a+n+1,e=c+1,o=(j*n+i)*6;arr[o]=a;arr[o+1]=hide?a:c;arr[o+2]=hide?a:b;arr[o+3]=hide?a:b;arr[o+4]=hide?a:c;arr[o+5]=hide?a:e;}index.addUpdateRange((j*n+from)*6,(to-from)*6);changed=true;}
  };
  for(const k of this.farHidden)if(!next.has(k))paint(k,false);for(const k of next)if(!this.farHidden.has(k))paint(k,true);if(changed)index.needsUpdate=true;this.farHidden=next;
 }
 schedule(cx,cz){
  this.needed.clear();const retained=new Set();for(let b=-3;b<=3;b++)for(let a=-3;a<=3;a++){const tx=cx+a,tz=cz+b,k=`${tx},${tz}`;retained.add(k);if(Math.abs(a)<=2&&Math.abs(b)<=2)this.needed.add(k);if(!this.tiles.has(k)&&!this.cache.has(k)&&!this.pending.has(k))this.pending.set(k,{tx,tz,rows:null});}
  for(const [k,t] of this.cache)if(!retained.has(k)){t.mesh.geometry.dispose();this.cache.delete(k);}for(const [k,j] of this.pending)if(!retained.has(k)){j.rows?.return();this.pending.delete(k);}
 }
 settle(){
  if([...this.needed].some(k=>!this.tiles.has(k)))return;
  for(const [k,t] of this.tiles)if(!this.needed.has(k)){this.scene.remove(t.mesh);this.p.world.removeCollider(t.collider,false);t.collider=null;this.tiles.delete(k);this.cache.set(k,t);}
 }
 // A nearby recovery can reuse resident ground. Only a missing wheel/body
 // footprint requires the synchronous teleport build before physics resumes.
 prepareSpawn(x,z){
  let ready=true;
  for(const dx of [-4,4])for(const dz of [-4,4])if(!this.tiles.has(`${Math.floor((x+dx)/SIZE)},${Math.floor((z+dz)/SIZE)}`))ready=false;
  this.update(x,z,!ready);
 }
 update(x,z,force=false){
  const cx=Math.floor(x/SIZE),cz=Math.floor(z/SIZE),key=`${cx},${cz}`,previous=this.center.split(',').map(Number),teleport=this.center&&(Math.abs(cx-previous[0])>2||Math.abs(cz-previous[1])>2);
  if(!this.center||force||teleport){
   this.clearTiles();this.center=key;for(let b=-2;b<=2;b++)for(let a=-2;a<=2;a++){const tx=cx+a,tz=cz+b,k=`${tx},${tz}`,t=this.tile(tx,tz,this.geometry(tx*SIZE,tz*SIZE));this.scene.add(t.mesh);this.tiles.set(k,t);this.collider(t);}
   this.replaceFar(this.geometry((cx-18)*SIZE,(cz-18)*SIZE,296,1184,true),cx,cz);this.schedule(cx,cz);return;
  }
  if(key!==this.center){this.center=key;this.schedule(cx,cz);}
  const stop=performance.now()+this.budget;let changed=false;
  // Promote one prebuilt tile at a time; even collider installation stays bounded.
  for(const k of this.needed){const t=this.cache.get(k);if(t&&!this.tiles.has(k)){this.activate(k,t);changed=true;break;}}
  if(this.far.geometry.userData.grid&&!this.farJob&&(Math.abs(cx-this.farCenter.x)>=4||Math.abs(cz-this.farCenter.z)>=4))this.farJob={cx,cz,rows:this.geometryRows((cx-18)*SIZE,(cz-18)*SIZE,296,1184,true)};
  while(performance.now()<stop){
   let selected=null;for(const [k,job] of this.pending){if(!selected||this.needed.has(k)&&!this.needed.has(selected[0]))selected=[k,job];}
   if(selected){const [k,job]=selected;job.rows??=this.geometryRows(job.tx*SIZE,job.tz*SIZE);const result=job.rows.next();if(result.done){this.pending.delete(k);this.cache.set(k,this.tile(job.tx,job.tz,result.value));break;}}
   else if(this.farJob){const result=this.farJob.rows.next();if(result.done){const {cx,cz}=this.farJob;this.replaceFar(result.value,cx,cz);this.farJob=null;break;}}
   else break;
  }
  const size=this.tiles.size;this.settle();if(changed||size!==this.tiles.size)this.syncFarHole();
 }
 clearTiles(){for(const t of this.tiles.values()){this.scene.remove(t.mesh);t.mesh.geometry.dispose();this.p.world.removeCollider(t.collider,false);}for(const t of this.cache.values())t.mesh.geometry.dispose();this.tiles.clear();this.cache.clear();for(const j of this.pending.values())j.rows?.return();this.pending.clear();this.farJob?.rows.return();this.farJob=null;}
 animate(time){this.clock.value=time;this.origin.value.set(this.p.origin.x,this.p.origin.z);}
 applyRuts(t){
  const g=t.mesh.geometry,a=g.attributes.position,c=g.attributes.color,{baseHeights,baseColors}=g.userData;let changed=false;
  for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){
   const k=j*(N+1)+i,offset=this.field.gridOffset(t.tx*N+i,t.tz*N+j),height=baseHeights[k]+offset;
   if(Math.abs(a.getY(k)-height)<1e-6)continue;const shade=rutShade(offset);a.setY(k,height);c.setXYZ(k,baseColors[k*3]*shade,baseColors[k*3+1]*shade,baseColors[k*3+2]*shade);changed=true;
  }
  if(changed){a.needsUpdate=true;c.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();}return changed;
 }
 refresh(){this.tick++;for(const key of this.field.dirty){const t=this.tiles.get(key);if(t&&this.applyRuts(t))this.collider(t);}this.field.dirty.clear();}
 dispose(){this.clearTiles();if(this.far){this.scene.remove(this.far);this.far.geometry.dispose();this.far=null;}this.material.dispose();this.farMaterial.dispose();this.farHidden.clear();this.needed.clear();}
 rebase(){
  const dx=this.renderOrigin.x-this.p.origin.x,dz=this.renderOrigin.z-this.p.origin.z;
  for(const t of this.tiles.values()){t.mesh.position.x+=dx;t.mesh.position.z+=dz;const p=t.collider.translation();t.collider.setTranslation({x:p.x+dx,y:p.y,z:p.z+dz});}
  if(this.far){this.far.position.x+=dx;this.far.position.z+=dz;}this.renderOrigin={...this.p.origin};
 }
}
