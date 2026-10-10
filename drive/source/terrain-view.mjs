import {groundSurface,groundNormal} from './ground-materials.mjs';
import {canyonProfile} from './canyon.mjs';
import * as THREE from 'three/webgpu';
import {attribute,uniform,positionWorld,vec2,sin,float,smoothstep,mix,vec3,mx_noise_float,cameraPosition} from 'three/tsl';
import {RAPIER} from './physics.mjs';
import {baseHeight,shore,smooth,noise,surfaceAt,beachRuts} from './terrain.mjs';
const SIZE=32,N=64;
const meadow=new THREE.Color('#697c48'),snowColor=new THREE.Color('#dce7ef'),mudColor=new THREE.Color('#594b3b'),stone=new THREE.Color('#777f80');
const canyonStone=new THREE.Color('#827a70'),canyonLayer=new THREE.Color('#565d5b');
const riverSoil=new THREE.Color('#66503a'),riverGravel=new THREE.Color('#8b8070');
const basalt=new THREE.Color('#39363b'),trailStone=new THREE.Color('#75646a');
const wet=new THREE.Color('#584c4b'),dry=new THREE.Color('#ce925c'),shadeColor=new THREE.Color('#885466'),crest=new THREE.Color('#dca165');
// Rut walls catch the sunset; compressed troughs stay visibly darker than untouched sand.
function rutShade(offset){return offset<0?1-Math.min(.44,-offset*1.6):1+Math.min(.13,offset*.85)}
export class TerrainView{
 constructor(scene,physics,field,{groundTextures=null}={}){this.groundTextures=groundTextures;this.scene=scene;this.p=physics;this.field=field;this.tiles=new Map();this.center='';this.tick=0;this.clock=uniform(0);this.origin=uniform(new THREE.Vector2());this.cache=new Map();this.pending=new Map();this.needed=new Set();this.farJob=null;this.farHidden=new Set();this.renderOrigin={...physics.origin};this.budget=3;this.focus={x:0,z:0};this.safetyGround=null;
 const world=positionWorld.xz.add(this.origin),z=world.y;
 const coast=float(-36).add(sin(z.mul(.006)).mul(8)).add(sin(z.mul(.019)).mul(3)),d=world.x.sub(coast);
 // Same wash phase as the surf. Persistent damp sand remains after the water retreats.
 const front=sin(this.clock.mul(.8).sub(z.mul(.026)).add(sin(z.mul(.16)).mul(.22))).mul(4.8).add(1).add(sin(z.mul(.46).add(this.clock.mul(.35))).mul(.42));
 const fresh=float(1).sub(smoothstep(front.add(7),front.add(11),d));
 const damp=float(1).sub(smoothstep(12,22,d));
 const detail=attribute('terrainDetail','vec4'),surface=attribute('surface','vec3'),compacted=smoothstep(.025,.16,attribute('deformation','float').negate());
 const close=float(1).sub(smoothstep(55,140,cameraPosition.distance(positionWorld)));
 const broad=mx_noise_float(vec3(world.x.mul(.12),positionWorld.y.mul(.18),world.y.mul(.12)));
 const grain=mx_noise_float(vec3(world.x.mul(2.8),positionWorld.y.mul(1.3),world.y.mul(2.8)));
 const layers=sin(positionWorld.y.mul(.85).add(broad.mul(8))).mul(.5).add(.5);
 const stratified=mix(float(1),layers.mul(.12).add(.88),detail.x);
 // Centimetre grains and irregular soil aggregates share world coordinates
 // with the ruts. Distance fades suppress distant sparkle and aliasing.
 const soil=float(1).sub(surface.y).mul(float(1).sub(detail.x)).mul(float(1).sub(surface.z));
 const fineFade=float(1).sub(smoothstep(8,32,cameraPosition.distance(positionWorld)));
 const grit=mx_noise_float(vec3(world.x.mul(32),float(2.3),world.y.mul(32)));
 const clumps=mx_noise_float(vec3(world.x.mul(8),float(7.1),world.y.mul(8)));
 const soilShade=clumps.mul(.18).add(grit.mul(.20).mul(fineFade)).mul(soil).mul(close).add(1);
 const textureShade=mix(soilShade.mul(broad.mul(.09).add(1).mul(grain.mul(.11).mul(close).mul(float(1).sub(surface.y.mul(.65))).add(1))),float(1),compacted.mul(.65));
 const photographed=groundTextures?(()=>{
  const forest=groundSurface(groundTextures,'forest',{scale:.18}),gravel=groundSurface(groundTextures,'gravel',{scale:.55}),rock=groundSurface(groundTextures,'stone',{scale:.30,triplanar:true});
  const noSnow=float(1).sub(surface.y),rockMask=detail.x.max(detail.z.mul(.65)).mul(noSnow).clamp(0,1),gravelMask=surface.x.mul(.85).add(detail.z).add(detail.y.mul(detail.w).mul(.65)).mul(noSnow).clamp(0,1),forestMask=detail.y.mul(noSnow).mul(float(1).sub(detail.x));
  const coverage=forestMask.max(gravelMask).max(rockMask).mul(float(1).sub(surface.z.mul(.8))).clamp(0,1);
  const tint=mix(vec3(1),attribute('color','vec3').mul(3.5).clamp(.16,1.15),detail.x);
  const albedo=mix(mix(forest.color,gravel.color,gravelMask),rock.color.mul(tint),rockMask);
  const data=mix(mix(forest.data,gravel.data,gravelMask),rock.data,rockMask);
  const moisture=surface.x.mul(.50).add(detail.z.mul(.65)).add(damp.mul(.25)).clamp(0,1);
  return {coverage,albedo,data,moisture};
 })():null;
 const make=flat=>{const mat=new THREE.MeshStandardNodeMaterial({roughness:1,metalness:0,flatShading:flat});mat.colorNode=attribute('color','vec3').mul(mix(float(1),float(.76),fresh)).mul(stratified).mul(textureShade);mat.roughnessNode=mix(mix(mix(float(.98),float(.30),damp.mul(.75).add(fresh.mul(.25))),float(.47),attribute('surface','vec3').x),float(.075),attribute('surface','vec3').z).mul(clumps.mul(.10).mul(soil).add(.95)).clamp(.06,1);if(photographed){
   const {coverage,albedo,data,moisture}=photographed;
   mat.colorNode=mix(mat.colorNode,albedo.mul(textureShade).mul(mix(float(.98),float(.69),moisture)),coverage.mul(.90));
   mat.roughnessNode=mix(mat.roughnessNode,mix(data.g.mul(.35).add(.60),float(.30),moisture),coverage);
   mat.aoNode=mix(float(1),data.b,coverage.mul(.45));
  }if(!flat){
   let relief=grain.mul(.022).add(clumps.mul(.012).add(grit.mul(.0025).mul(fineFade)).mul(soil)).add(layers.mul(detail.x).mul(.02)).mul(close).mul(float(1).sub(surface.z)).mul(mix(float(1),float(.25),compacted));
   if(photographed)relief=mix(relief,photographed.data.r.mul(.055).mul(close),photographed.coverage);
   mat.normalNode=groundNormal(relief);
  }return mat};
 this.material=make(false);this.farMaterial=make(true);this.far=null}
 // Row-sized work units keep procedural terrain off the critical render frame.
 // Only the initial load and explicit teleports drain these synchronously.
 *geometryRows(tx,tz,n=N,size=SIZE,far=false){
  const count=(n+1)**2,ps=new Float32Array(count*3),colors=new Float32Array(count*3),idx=new Uint32Array(n*n*6),heights=new Float32Array(count),deformations=new Float32Array(count),oldRuts=new Float32Array(count),baseColors=new Float32Array(count*3),surfaces=new Float32Array(count*3),details=new Float32Array(count*4),normals=far?new Float32Array(count*3):null,offset={...this.p.origin},c=new THREE.Color();
  // Near geometry used to evaluate the same procedural height five times per
  // vertex for slope tinting. Cache the padded half-metre grid once, yielding
  // each row, so collision-bearing tiles keep up with a 50-mph drive.
  const stride=n+5,gridHeights=!far&&size/n===.5?new Float64Array(stride*stride):null;
  if(gridHeights)for(let j=-2;j<=n+2;j++){for(let i=-2;i<=n+2;i++)gridHeights[(j+2)*stride+i+2]=baseHeight(tx+i*.5,tz+j*.5);yield;}
  for(let j=0;j<=n;j++){
   for(let i=0;i<=n;i++){
    const k=j*(n+1)+i,k3=k*3,k4=k*4,x=tx+i*size/n,z=tz+j*size/n,base=gridHeights?gridHeights[(j+2)*stride+i+2]:baseHeight(x,z),deformation=far?0:this.field.gridOffset(Math.round(x*2),Math.round(z*2)),y=base+deformation;
    const worn=far?0:beachRuts(x,z);oldRuts[k]=worn;
    ps[k3]=x-offset.x;ps[k3+1]=y;ps[k3+2]=z-offset.z;heights[k]=base;deformations[k]=deformation+worn;
    const d=x-shore(z);c.lerpColors(wet,dry,smooth(12,24,d));
    const sx=gridHeights?(gridHeights[(j+2)*stride+i+4]-gridHeights[(j+2)*stride+i])*.5:(baseHeight(x+1,z)-baseHeight(x-1,z))*.5,sz=gridHeights?(gridHeights[(j+4)*stride+i+2]-gridHeights[j*stride+i+2])*.5:(baseHeight(x,z+1)-baseHeight(x,z-1))*.5;
    c.lerp(shadeColor,smooth(-.2,.6,sx*.75+sz*.65)*.65);
    c.lerp(crest,Math.min(.14,Math.max(0,y)*.008));const surface=surfaceAt(x,z);c.lerp(meadow,surface.grass*.92).lerp(mudColor,surface.mud*.95).lerp(snowColor,surface.snow*.99).lerp(stone,surface.river*.60).lerp(wet,surface.puddle*.6).lerp(basalt,surface.volcanic*.97).lerp(trailStone,surface.volcanic*surface.trail*.45);// Brown alluvial soil and exposed gravel continue up both banks; no green carpet in the ford.
    c.lerp(mudColor,surface.grass*surface.trail*.30);
    c.lerp(riverSoil,surface.riverApproach*(1-surface.river)*.88).lerp(riverGravel,surface.riverApproach*(.14+.22*noise(x*1.3,z*1.3)));
    const gorge=canyonProfile(x,z),cliff=Math.max(surface.canyonRock*.62,gorge.length*gorge.influence*smooth(.45,1.5,Math.hypot(sx,sz)));
    c.lerp(canyonStone,cliff*.96).lerp(canyonLayer,cliff*(.16+.25*smooth(-.3,.5,Math.sin(y*.6+noise(x*.06,z*.06)*3))));
    c.multiplyScalar(.97+noise(x*.28,z*.28)*.06);
    surfaces[k3]=surface.mud;surfaces[k3+1]=surface.snow;surfaces[k3+2]=surface.puddle;details[k4]=Math.max(surface.volcanic,cliff);details[k4+1]=surface.grass;details[k4+2]=surface.river;details[k4+3]=surface.trail;
    c.multiplyScalar(rutShade(worn));baseColors[k3]=c.r;baseColors[k3+1]=c.g;baseColors[k3+2]=c.b;c.multiplyScalar(rutShade(deformation));colors[k3]=c.r;colors[k3+1]=c.g;colors[k3+2]=c.b;
    // Far shading uses face derivatives; an analytic normal avoids a whole-mesh
    // normal pass when the completed far buffer is swapped in.
    if(far){const inverse=1/Math.hypot(sx,1,sz);normals[k3]=-sx*inverse;normals[k3+1]=inverse;normals[k3+2]=-sz*inverse;}
    if(i<n&&j<n){const a=k,b=a+1,c=a+n+1,e=c+1,o=(j*n+i)*6;idx[o]=a;idx[o+1]=c;idx[o+2]=b;idx[o+3]=b;idx[o+4]=c;idx[o+5]=e;}
   }
   yield;
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(ps,3));g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.setAttribute('surface',new THREE.BufferAttribute(surfaces,3));g.setAttribute('terrainDetail',new THREE.BufferAttribute(details,4));g.setAttribute('deformation',new THREE.BufferAttribute(deformations,1));g.setIndex(new THREE.BufferAttribute(idx,1));
  if(far)g.setAttribute('normal',new THREE.BufferAttribute(normals,3));else{g.computeVertexNormals();g.userData.baseHeights=heights;g.userData.baseColors=baseColors;g.userData.oldRuts=oldRuts;}
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
  // Retire behind the truck independently: waiting for all 25 replacement tiles
  // let a fast, low-FPS drive retain hundreds of obsolete collision meshes.
  for(const [k,t] of this.tiles)if(!this.needed.has(k)){this.scene.remove(t.mesh);this.p.world.removeCollider(t.collider,false);t.collider=null;this.tiles.delete(k);this.cache.set(k,t);}
 }
 // Rendering can be delayed by a slow frame, but the physical driving surface
 // cannot. A small, matching half-metre patch covers ONLY missing terrain tiles
 // under the chassis and its next physics steps, then disappears when streaming
 // catches up. This has no visual/material work and never duplicates active ground.
 ensureGround(x,z,force=false){
  const missing=new Set();for(const dx of [-5,5])for(const dz of [-5,5]){const k=`${Math.floor((x+dx)/SIZE)},${Math.floor((z+dz)/SIZE)}`;if(!this.tiles.has(k))missing.add(k);}
  if(!missing.size){if(this.safetyGround){this.p.world.removeCollider(this.safetyGround.collider,false);this.safetyGround=null;}return;}
  const cx=Math.round(x/4)*4,cz=Math.round(z/4)*4,signature=`${cx},${cz}:${[...missing].sort().join(';')}`;
  if(!force&&this.safetyGround?.signature===signature)return;
  const n=32,ps=new Float32Array((n+1)**2*3),indices=[];
  for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
   const wx=cx-8+i*.5,wz=cz-8+j*.5,k=j*(n+1)+i;ps[k*3]=wx-this.p.origin.x;ps[k*3+1]=this.field.atGrid(Math.round(wx*2),Math.round(wz*2));ps[k*3+2]=wz-this.p.origin.z;
   if(i<n&&j<n&&missing.has(`${Math.floor((wx+.25)/SIZE)},${Math.floor((wz+.25)/SIZE)}`)){const b=k+1,c=k+n+1,e=c+1;indices.push(k,c,b,b,c,e);}
  }
  const collider=this.p.world.createCollider(RAPIER.ColliderDesc.trimesh(ps,new Uint32Array(indices)).setFriction(.9));
  if(this.safetyGround)this.p.world.removeCollider(this.safetyGround.collider,false);
  this.safetyGround={collider,signature};
 }
 // A nearby recovery can reuse resident ground. Only a missing wheel/body
 // footprint requires the synchronous teleport build before physics resumes.
 prepareSpawn(x,z){
  let ready=true;
  for(const dx of [-4,4])for(const dz of [-4,4])if(!this.tiles.has(`${Math.floor((x+dx)/SIZE)},${Math.floor((z+dz)/SIZE)}`))ready=false;
  this.update(x,z,!ready);
 }
 update(x,z,force=false){
  this.focus={x,z};
  const cx=Math.floor(x/SIZE),cz=Math.floor(z/SIZE),key=`${cx},${cz}`,previous=this.center.split(',').map(Number),teleport=this.center&&(Math.abs(cx-previous[0])>2||Math.abs(cz-previous[1])>2);
  if(!this.center||force||teleport){
   this.clearTiles();this.center=key;for(let b=-2;b<=2;b++)for(let a=-2;a<=2;a++){const tx=cx+a,tz=cz+b,k=`${tx},${tz}`,t=this.tile(tx,tz,this.geometry(tx*SIZE,tz*SIZE));this.scene.add(t.mesh);this.tiles.set(k,t);this.collider(t);}
   this.replaceFar(this.geometry((cx-18)*SIZE,(cz-18)*SIZE,296,1184,true),cx,cz);this.schedule(cx,cz);return;
  }
  if(key!==this.center){this.center=key;this.schedule(cx,cz);}
  const priority=(tx,tz)=>Math.hypot((tx+.5)*SIZE-x,(tz+.5)*SIZE-z);
  const stop=performance.now()+this.budget;let changed=false;
  // Promote one prebuilt tile at a time; even collider installation stays bounded.
  let cached=null;for(const k of this.needed){const t=this.cache.get(k);if(t&&!this.tiles.has(k)&&(!cached||priority(t.tx,t.tz)<priority(cached[1].tx,cached[1].tz)))cached=[k,t];}if(cached){this.activate(...cached);changed=true;}
  if(this.far.geometry.userData.grid&&!this.farJob&&(Math.abs(cx-this.farCenter.x)>=4||Math.abs(cz-this.farCenter.z)>=4))this.farJob={cx,cz,rows:this.geometryRows((cx-18)*SIZE,(cz-18)*SIZE,296,1184,true)};
  let farAdvanced=false;
  while(performance.now()<stop){
   let selected=null;for(const [k,job] of this.pending){if(!selected||priority(job.tx,job.tz)<priority(selected[1].tx,selected[1].tz))selected=[k,job];}
   // Once the driving neighbourhood is built, reserve one budgeted row for
   // the horizon. Waiting for the entire prefetch ring starved far terrain on
   // a continuous ascent, even though all nearby wheels already had ground.
   if(this.farJob&&(!selected||!farAdvanced&&priority(selected[1].tx,selected[1].tz)>SIZE*1.5)){const result=this.farJob.rows.next();farAdvanced=true;if(result.done){const {cx,cz}=this.farJob;this.replaceFar(result.value,cx,cz);this.farJob=null;break;}}
   else if(selected){const [k,job]=selected;job.rows??=this.geometryRows(job.tx*SIZE,job.tz*SIZE);const result=job.rows.next();if(result.done){this.pending.delete(k);this.cache.set(k,this.tile(job.tx,job.tz,result.value));break;}}
   else break;
  }
  const size=this.tiles.size;this.settle();if(changed||size!==this.tiles.size)this.syncFarHole();this.ensureGround(x,z);
 }
 clearTiles(){if(this.safetyGround){this.p.world.removeCollider(this.safetyGround.collider,false);this.safetyGround=null;}for(const t of this.tiles.values()){this.scene.remove(t.mesh);t.mesh.geometry.dispose();this.p.world.removeCollider(t.collider,false);}for(const t of this.cache.values())t.mesh.geometry.dispose();this.tiles.clear();this.cache.clear();for(const j of this.pending.values())j.rows?.return();this.pending.clear();this.farJob?.rows.return();this.farJob=null;}
 animate(time){this.groundTextures?.origin.value.set(this.p.origin.x,0,this.p.origin.z);this.clock.value=time;this.origin.value.set(this.p.origin.x,this.p.origin.z);}
 applyRuts(t){
  const g=t.mesh.geometry,a=g.attributes.position,c=g.attributes.color,{baseHeights,baseColors}=g.userData;let changed=false;
  for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){
   const k=j*(N+1)+i,offset=this.field.gridOffset(t.tx*N+i,t.tz*N+j),height=baseHeights[k]+offset;
   if(Math.abs(a.getY(k)-height)<1e-6)continue;const shade=rutShade(offset);a.setY(k,height);g.attributes.deformation.setX(k,offset+(g.userData.oldRuts?.[k]||0));c.setXYZ(k,baseColors[k*3]*shade,baseColors[k*3+1]*shade,baseColors[k*3+2]*shade);changed=true;
  }
  if(changed){a.needsUpdate=true;c.needsUpdate=true;g.attributes.deformation.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();}return changed;
 }
 refresh(){this.tick++;if(this.safetyGround&&this.field.dirty.size)this.ensureGround(this.focus.x,this.focus.z,true);for(const key of this.field.dirty){const t=this.tiles.get(key);if(t&&this.applyRuts(t))this.collider(t);}this.field.dirty.clear();}
 dispose(){this.clearTiles();if(this.far){this.scene.remove(this.far);this.far.geometry.dispose();this.far=null;}this.material.dispose();this.farMaterial.dispose();this.farHidden.clear();this.needed.clear();}
 rebase(){
  const dx=this.renderOrigin.x-this.p.origin.x,dz=this.renderOrigin.z-this.p.origin.z;
  for(const t of this.tiles.values()){t.mesh.position.x+=dx;t.mesh.position.z+=dz;const p=t.collider.translation();t.collider.setTranslation({x:p.x+dx,y:p.y,z:p.z+dz});}
  if(this.safetyGround){const p=this.safetyGround.collider.translation();this.safetyGround.collider.setTranslation({x:p.x+dx,y:p.y,z:p.z+dz});}
  if(this.far){this.far.position.x+=dx;this.far.position.z+=dz;}this.renderOrigin={...this.p.origin};
 }
}
