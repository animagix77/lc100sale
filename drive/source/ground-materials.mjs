// Judge Dean LLC — shared photographed ground surfaces, anchored across rebases.
import * as THREE from 'three/webgpu';
import {texture,uniform,positionWorld,positionView,normalView,normalWorldGeometry,vec3,float,mix,smoothstep,cameraPosition} from 'three/tsl';
export async function loadGroundTextures({mobile=false,loader=new THREE.TextureLoader()}={}){
 const names=['forest','gravel','stone'],suffix=mobile?'-512':'',entries=names.flatMap(name=>['color','surface'].map(kind=>({name,kind,path:`textures/terrain/${name}-${kind}${suffix}.jpg`})));
 const results=await Promise.allSettled(entries.map(async entry=>{
  const map=await loader.loadAsync(entry.path);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=mobile?2:4;map.colorSpace=entry.kind==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;map.needsUpdate=true;return {...entry,map};
 }));
 if(results.some(r=>r.status==='rejected')){for(const r of results)if(r.status==='fulfilled')r.value.map.dispose();return null;}
 const maps={origin:uniform(new THREE.Vector3()),mobile};for(const r of results){const {name,kind,map}=r.value;maps[name]??={};maps[name][kind]=map;}
 maps.canopy=await loader.loadAsync(`textures/terrain/riparian-canopy-v1${suffix}.webp`).catch(()=>null);
 if(maps.canopy){maps.canopy.colorSpace=THREE.SRGBColorSpace;maps.canopy.anisotropy=mobile?2:4;maps.canopy.needsUpdate=true;}
 maps.dispose=()=>{for(const name of names)for(const kind of ['color','surface'])maps[name][kind].dispose();maps.canopy?.dispose();};return maps;
}
export function groundSurface(maps,name,{scale=1,triplanar=false}={}){
 const world=positionWorld.add(maps.origin),uv=world.xz.mul(scale);
 const sample=map=>{
  if(!triplanar)return texture(map,uv);
  // Geometric normals avoid a dependency cycle with the detail normal below.
  const weights=normalWorldGeometry.abs().pow(4),sum=weights.x.add(weights.y).add(weights.z).max(.001);
  return texture(map,world.zy.mul(scale)).mul(weights.x).add(texture(map,uv).mul(weights.y)).add(texture(map,world.xy.mul(scale)).mul(weights.z)).div(sum);
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
