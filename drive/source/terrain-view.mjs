import * as THREE from 'three/webgpu';
import {RAPIER} from './physics.mjs';
import {baseHeight,shore,smooth,noise} from './terrain.mjs';
const SIZE=32,N=64;
const wet=new THREE.Color('#805654'),dry=new THREE.Color('#ce925c'),shadeColor=new THREE.Color('#885466'),crest=new THREE.Color('#dca165');
// Rut walls catch the sunset; compressed troughs stay visibly darker than untouched sand.
function rutShade(offset){return offset<0?1-Math.min(.44,-offset*.82):1+Math.min(.08,offset*.5)}
export class TerrainView{
 constructor(scene,physics,field){this.scene=scene;this.p=physics;this.field=field;this.tiles=new Map();this.center='';this.tick=0;this.material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0});this.farMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true});this.far=null}
 geometry(tx,tz,n=N,size=SIZE,far=false,omit=null){
  const ps=[],colors=[],idx=[],heights=[],baseColors=[],offset=this.p.origin,c=new THREE.Color();
  for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
   const x=tx+i*size/n,z=tz+j*size/n,base=baseHeight(x,z),deformation=far?0:this.field.gridOffset(Math.round(x*2),Math.round(z*2)),y=base+deformation;
   ps.push(x-offset.x,y,z-offset.z);heights.push(base);
   const d=x-shore(z);c.lerpColors(wet,dry,smooth(6,27,d));
   const sx=(baseHeight(x+1,z)-baseHeight(x-1,z))*.5,sz=(baseHeight(x,z+1)-baseHeight(x,z-1))*.5;
   c.lerp(shadeColor,smooth(-.2,.6,sx*.75+sz*.65)*.65);
   c.lerp(crest,Math.min(.14,Math.max(0,y)*.008));c.multiplyScalar(.97+noise(x*.28,z*.28)*.06);
   baseColors.push(c.r,c.g,c.b);c.multiplyScalar(rutShade(deformation));colors.push(c.r,c.g,c.b);
   if(i<n&&j<n){
    const midx=x+size/n*.5,midz=z+size/n*.5;
    if(omit&&midx>=omit.x0&&midx<omit.x1&&midz>=omit.z0&&midz<omit.z1)continue;
    const a=j*(n+1)+i,b=a+1,c=a+n+1,e=c+1;idx.push(a,c,b,b,c,e);
   }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(idx);g.computeVertexNormals();
  // Cache undeformed heights/colors: digging only touches the sparse field and GPU buffers.
  if(!far){g.userData.baseHeights=new Float32Array(heights);g.userData.baseColors=new Float32Array(baseColors)}
  return g;
 }
 collider(tile){if(tile.collider)this.p.world.removeCollider(tile.collider,false);tile.collider=this.p.world.createCollider(RAPIER.ColliderDesc.trimesh(tile.mesh.geometry.attributes.position.array,new Uint32Array(tile.mesh.geometry.index.array)).setFriction(.9));}
 update(x,z,force=false){const cx=Math.floor(x/SIZE),cz=Math.floor(z/SIZE),key=`${cx},${cz}`;if(key!==this.center||force){this.center=key;const needed=new Set();for(let b=-2;b<=2;b++)for(let a=-2;a<=2;a++){const tx=cx+a,tz=cz+b,k=`${tx},${tz}`;needed.add(k);if(!this.tiles.has(k)){const g=this.geometry(tx*SIZE,tz*SIZE),mesh=new THREE.Mesh(g,this.material);mesh.receiveShadow=true;this.scene.add(mesh);const tile={tx,tz,mesh};this.tiles.set(k,tile);this.collider(tile)}}for(const [k,t] of this.tiles)if(!needed.has(k)){this.scene.remove(t.mesh);t.mesh.geometry.dispose();this.p.world.removeCollider(t.collider,false);this.tiles.delete(k)}if(this.far){this.scene.remove(this.far);this.far.geometry.dispose()}// Far vertices align to the near-tile perimeter exactly; no holes or overlapping sand.
 const farGeo=this.geometry((cx-18)*32,(cz-18)*32,296,1184,true,{x0:(cx-2)*32,x1:(cx+3)*32,z0:(cz-2)*32,z1:(cz+3)*32});this.far=new THREE.Mesh(farGeo,this.farMaterial);this.far.receiveShadow=true;this.scene.add(this.far)}
 }
 refresh(){
  this.tick++;
  for(const key of this.field.dirty){
   const t=this.tiles.get(key);if(!t)continue;
   const g=t.mesh.geometry,a=g.attributes.position,c=g.attributes.color,{baseHeights,baseColors}=g.userData;
   for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){
    const k=j*(N+1)+i,offset=this.field.gridOffset(t.tx*N+i,t.tz*N+j),shade=rutShade(offset);
    a.setY(k,baseHeights[k]+offset);c.setXYZ(k,baseColors[k*3]*shade,baseColors[k*3+1]*shade,baseColors[k*3+2]*shade);
   }
   a.needsUpdate=true;c.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();this.collider(t);
  }
  this.field.dirty.clear();
 }
 rebase(){for(const t of this.tiles.values()){this.scene.remove(t.mesh);t.mesh.geometry.dispose();this.p.world.removeCollider(t.collider,false)}this.tiles.clear();this.center='';const p=this.p.position();this.update(p.x,p.z,true)}
}
