// Judge Dean LLC — shared photographed ground surfaces, anchored across rebases.
import * as THREE from 'three/webgpu';
import {texture,uniform,positionWorld,positionView,normalView,normalWorldGeometry,positionGeometry,attribute,vec2,vec3,mx_noise_float,float,mix,smoothstep,cameraPosition} from 'three/tsl';
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
 const patch=smoothstep(-.28,.28,mx_noise_float(world.mul(.065).add(vec3(13.7,5.1,9.2))));
 // Sample each color/packed surface pair together. Height selects the edges of
 // overlapping gravel and litter instead of averaging two crisp photos into
 // a blurred midpoint. This reuses the same samples as the old orientation mix.
 const tile=(coords,rotated=true)=>{
  const colorA=texture(maps[name].color,coords).rgb,dataA=texture(maps[name].surface,coords).rgb;
  if(!rotated)return {color:colorA,data:dataA};
  const other=vec2(coords.x.mul(.8).sub(coords.y.mul(.6)),coords.x.mul(.6).add(coords.y.mul(.8))).add(vec2(.37,.71));
  const colorB=texture(maps[name].color,other).rgb,dataB=texture(maps[name].surface,other).rgb;
  const overlap=patch.mul(patch.oneMinus()).mul(4);
  const weight=smoothstep(.18,.82,patch.add(dataB.r.sub(dataA.r).mul(overlap).mul(.50)));
  return {color:mix(colorA,colorB,weight),data:mix(dataA,dataB,weight)};
 };
 if(!triplanar)return tile(uv);
 // Geometric normals avoid a dependency cycle with the detail normal below.
 const weights=normalWorldGeometry.abs().pow(4),sum=weights.x.add(weights.y).add(weights.z).max(.001);
 const a=tile(world.zy.mul(scale),!maps.mobile),b=tile(uv,!maps.mobile),c=tile(world.xy.mul(scale),!maps.mobile);
 const blend=key=>a[key].mul(weights.x).add(b[key].mul(weights.y)).add(c[key].mul(weights.z)).div(sum);
 return {color:blend('color'),data:blend('data')};
}
// Suppress subpixel relief at grazing angles as well as in the distance. This
// uses screen derivatives supported by both Three's WebGPU and WebGL2 paths.
export function groundDetailFade(worldXZ,frequency){
 const footprint=worldXZ.dFdx().length().max(worldXZ.dFdy().length()).mul(frequency);
 return float(1).sub(smoothstep(.18,.72,footprint));
}
export function groundNormal(relief,detailFade=float(1)){
 // Apply derivative-based filtering AFTER the height derivatives; nested
 // derivatives would be undefined on some mobile fragment shader backends.
 const dx=positionView.dFdx(),dy=positionView.dFdy(),r1=dy.cross(normalView),r2=normalView.cross(dx),det=dx.dot(r1);
 return normalView.mul(det.abs()).sub(r1.mul(relief.dFdx()).add(r2.mul(relief.dFdy())).mul(det.sign()).mul(detailFade)).normalize();
}
export function applyStoneSurface(material,maps,{scale=.65,strength=.025,weathered=false}={}){
 if(!maps)return;
 const stone=groundSurface(maps,'stone',{scale,triplanar:true}),near=float(1).sub(smoothstep(12,65,cameraPosition.distance(positionWorld)));
 // Retain per-instance weathering/biome tints, without multiplying old vertex paint.
 material.vertexColors=false;material.colorNode=stone.color.mul(2.15);material.roughnessNode=mix(float(.58),float(.96),stone.data.g);material.aoNode=mix(float(1),stone.data.b,.45);
 let relief=stone.data.r.mul(strength);
 if(weathered){
  const world=positionWorld.add(maps.origin),up=smoothstep(.25,.85,normalWorldGeometry.y),patch=mx_noise_float(world.mul(.9)).mul(.5).add(.5);
  // Geometry carries the local biome: moss belongs on sheltered woodland ledges,
  // never the barren canyon, snow or lava. Packed texture height breaks its edge.
  const woodland=attribute('rockHabitat','float');
  const moss=smoothstep(.38,.70,patch.add(stone.data.r.sub(.5).mul(.35))).mul(up).mul(woodland);
  const footing=float(1).sub(smoothstep(-.25,.36,positionGeometry.y)).mul(woodland);
  const mottled=mix(vec3(.17,.22,.10),vec3(.34,.37,.18),stone.data.r);
  material.colorNode=mix(material.colorNode,mottled,moss.mul(.66)).mul(mix(float(1),float(.78),footing));
  material.roughnessNode=material.roughnessNode.max(moss.mul(.2).add(.68));
  relief=relief.add(patch.mul(.018).mul(moss));
 }
 material.normalNode=groundNormal(relief.mul(near));material.needsUpdate=true;
}
