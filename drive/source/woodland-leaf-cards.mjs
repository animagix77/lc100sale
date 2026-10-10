// Judge Dean LLC — static, layered branch cards; canopy roots never animate away.
import * as THREE from 'three/webgpu';
export function woodlandLeafCards(mobile=false){
 const positions=[],normals=[],uvs=[],colors=[],indices=[];
 const count=mobile?15:21;
 for(let i=0;i<count;i++){
  const tier=Math.floor(i/3),angle=i*2.399+.5,radius=tier<4?1.18: .62;
  const center=new THREE.Vector3(Math.cos(angle)*radius,4.75+tier*.38,Math.sin(angle)*radius);
  const width=2.45-(tier>4?.28:0),height=1.75;
  // Vary card yaw and pitch so the canopy remains full from above and below.
  const rotation=new THREE.Euler((i%3-1)*.52,angle,(i%2-.5)*.24);
  const normal=new THREE.Vector3(0,0,1).applyEuler(rotation),at=positions.length/3;
  const shade=.80+(i%5)*.045;
  for(const [x,y,u,v] of [[-.5,-.5,0,0],[.5,-.5,1,0],[.5,.5,1,1],[-.5,.5,0,1]]){
   const p=new THREE.Vector3(x*width,y*height,0).applyEuler(rotation).add(center);
   positions.push(...p.toArray());normals.push(...normal.toArray());uvs.push(u,v);colors.push(shade,shade,shade*.96);
  }
  indices.push(at,at+1,at+2,at,at+2,at+3);
 }
 const geometry=new THREE.BufferGeometry();
 for(const [name,data,size] of [['position',positions,3],['normal',normals,3],['uv',uvs,2],['color',colors,3]])geometry.setAttribute(name,new THREE.Float32BufferAttribute(data,size));
 geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
