import * as THREE from 'three/webgpu';
import {uniform,positionLocal,normalLocal,mx_noise_float,smoothstep} from 'three/tsl';

export class VehicleSnow {
 constructor(truck){
  this.amount=uniform(0);this.meshes=[];
  this.material=new THREE.MeshStandardNodeMaterial({color:'#eff3f5',roughness:.97,metalness:0,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  // Stable local-space patches grow together as snow settles. No screen-space shimmer.
  const noise=mx_noise_float(positionLocal.mul(13)).mul(.5).add(.5);
  this.material.opacityNode=smoothstep(noise.mul(.65),noise.mul(.65).add(.3),this.amount).mul(smoothstep(.52,.82,normalLocal.y));
  this.material.positionNode=positionLocal.add(normalLocal.mul(this.amount.mul(.014).add(.003)));
  const body=truck.getObjectByName('Body');
  const sources=[];body?.traverse(mesh=>{if(mesh.isMesh)sources.push(mesh)});
  for(const source of sources){
   const g=source.geometry,p=g.getAttribute('position'),n=g.getAttribute('normal');if(!p||!n)continue;
   const positions=[],normals=[],index=g.index;
   for(let t=0;t<(index?index.count:p.count);t+=3){
    const ids=[0,1,2].map(k=>index?index.getX(t+k):t+k);
    const y=ids.reduce((v,i)=>v+p.getY(i),0)/3,z=ids.reduce((v,i)=>v+p.getZ(i),0)/3;
    const up=ids.reduce((v,i)=>v+n.getY(i),0)/3;
    // Roof and hood only: leave glass, lamps, grille, tyres and lower bodywork clear.
    if(up<.52||!(y>1.82||(y>1.15&&z<-.85)))continue;
    for(const i of ids){positions.push(p.getX(i),p.getY(i),p.getZ(i));normals.push(n.getX(i),n.getY(i),n.getZ(i))}
   }
   if(!positions.length)continue;
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
   const overlay=new THREE.Mesh(geometry,this.material);overlay.name='Settled snow';overlay.receiveShadow=true;
   // Child coordinates match the underlying surface without touching its paint or lights.
   source.add(overlay);this.meshes.push(overlay);
  }
 }
 update(dt,weather){
  if(!Number.isFinite(dt)||dt<=0)return;
  const snow=THREE.MathUtils.clamp(weather.snow||0,0,1),rain=THREE.MathUtils.clamp(weather.rain||0,0,1);
  const rate=snow>.02?snow/95:-(1+rain*2)/150;
  this.amount.value=THREE.MathUtils.clamp(this.amount.value+rate*dt,0,1);
 }
 dispose(){for(const mesh of this.meshes){mesh.removeFromParent();mesh.geometry.dispose()}this.meshes=[];this.material.dispose()}
}
