// Judge Dean LLC — shared photographed ground surfaces, anchored across rebases.
import * as THREE from 'three/webgpu';
import {texture,uniform,positionWorld,positionView,normalView,normalWorldGeometry,vec2,vec3,mx_noise_float,float,mix,smoothstep,cameraPosition} from 'three/tsl';
export async function loadGroundTextures({mobile=false,loader=new THREE.TextureLoader()}={}){
 const names=['forest','gravel','stone'],suffix=mobile?'-512':'',entries=names.flatMap(name=>['color','surface'].map(kind=>({name,kind,path:`textures/terrain/${name}-${kind}${suffix}.jpg`})));
 const results=await Promise.allSettled(entries.map(async entry=>{
  const map=await loader.loadAsync(entry.path);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=mobile?2:4;map.colorSpace=entry.kind==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;map.needsUpdate=true;return {...entry,map};
 }));
 if(results.some(r=>r.status==='rejected')){for(const r of results)if(r.status==='fulfilled')r.value.map.dispose();return null;}
 const maps={origin:uniform(new THREE.Vector3()),mobile};for(const r of results){const {name,kind,map}=r.value;maps[name]??={};maps[name][kind]=map;}
 maps.canopy=await loader.loadAsync(`textures/terrain/riparian-canopy-v1${suffix}.webp`).catch(()=>null);
 if(maps.canopy){maps.canopy.colorSpace=THREE.SRGBColorSpace;maps.canopy.anisotropy=mobile?2:4;maps.canopy.needsUpdate=true;}
 const bark=await Promise.allSettled(['color','surface'].map(async kind=>{
  const map=await loader.loadAsync(`textures/terrain/bark-${kind}${suffix}.jpg`);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=mobile?2:4;map.colorSpace=kind==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;return {kind,map};
 }));
 maps.bark=null;if(bark.every(r=>r.status==='fulfilled'))maps.bark=Object.fromEntries(bark.map(r=>[r.value.kind,r.value.map]));else for(const r of bark)if(r.status==='fulfilled')r.value.map.dispose();
 maps.dispose=()=>{for(const name of names)for(const kind of ['color','surface'])maps[name][kind].dispose();maps.canopy?.dispose();if(maps.bark)for(const map of Object.values(maps.bark))map.dispose();};return maps;
}
export function groundSurface(maps,name,{scale=1,triplanar=false}={}){
 const world=positionWorld.add(maps.origin),uv=world.xz.mul(scale);
 // Blend two orientations over broad world-space patches. The packed height,
 // roughness and albedo use the same footprint, including after origin rebases.
 const patch=smoothstep(-.28,.28,mx_noise_float(world.mul(.065).add(vec3(13.7,5.1,9.2))));
 const tile=(map,coords)=>{
  const rotated=vec2(coords.x.mul(.8).sub(coords.y.mul(.6)),coords.x.mul(.6).add(coords.y.mul(.8))).add(vec2(.37,.71));
  return mix(texture(map,coords),texture(map,rotated),patch);
 };
 const sample=map=>{
  if(!triplanar)return tile(map,uv);
  // Geometric normals avoid a dependency cycle with the detail normal below.
  const weights=normalWorldGeometry.abs().pow(4),sum=weights.x.add(weights.y).add(weights.z).max(.001);
  // Mobile cliffs retain three samples; horizontal ground gets both orientations.
  const projected=(coords)=>maps.mobile?texture(map,coords):tile(map,coords);
  return projected(world.zy.mul(scale)).mul(weights.x).add(projected(uv).mul(weights.y)).add(projected(world.xy.mul(scale)).mul(weights.z)).div(sum);
 };
 return {color:sample(maps[name].color).rgb,data:sample(maps[name].surface).rgb};
}
export function groundNormal(relief){
 const dx=positionView.dFdx(),dy=positionView.dFdy(),r1=dy.cross(normalView),r2=normalView.cross(dx),det=dx.dot(r1);
 return normalView.mul(det.abs()).sub(r1.mul(relief.dFdx()).add(r2.mul(relief.dFdy())).mul(det.sign())).normalize();
}
export function applyStoneSurface(material,maps,{scale=.65,strength=.025}={}){
 if(!maps)return;
 const stone=groundSurface(maps,'stone',{scale,triplanar:true}),near=float(1).sub(smoothstep(12,65,cameraPosition.distance(positionWorld)));
 // Retain per-instance weathering/biome tints, without multiplying old vertex paint.
 material.vertexColors=false;material.colorNode=stone.color.mul(2.15);material.roughnessNode=mix(float(.58),float(.96),stone.data.g);material.aoNode=mix(float(1),stone.data.b,.45);material.normalNode=groundNormal(stone.data.r.mul(strength).mul(near));material.needsUpdate=true;
}
