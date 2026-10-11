// Judge Dean LLC — static, layered branch cards; canopy roots never animate away.
import * as THREE from 'three/webgpu';
export function woodlandLeafCards(mobile=false){
 const positions=[],normals=[],uvs=[],colors=[],indices=[];
 const count=mobile?15:21;
 for(let i=0;i<count;i++){
  const tier=Math.floor(i/3),angle=i*2.399+.5+Math.sin(i*3.7)*.17;
  const radius=(tier<3?1.13:tier<5?.86:.40)*(1+Math.sin(i*1.8)*.18);
  const center=new THREE.Vector3(Math.cos(angle)*radius,4.50+tier*.46+Math.sin(i*2.2)*.13,Math.sin(angle)*radius);
  const width=(tier<3?2.32:1.9)+Math.sin(i*4.1)*.25,height=1.52+Math.cos(i*2.7)*.20;
  // Irregular overlapping branch tips make an airy lower crown and a tapered
  // apex. Bent foliage normals shade the whole crown, not individual flat cards.
  const rotation=new THREE.Euler((i%3-1)*.48+.10,angle,(i%2-.5)*.28),at=positions.length/3;
  const shade=.83+(i%5)*.032;
  for(const [x,y,u,v] of [[-.5,-.5,0,0],[.5,-.5,1,0],[.5,.5,1,1],[-.5,.5,0,1]]){
   const p=new THREE.Vector3(x*width,y*height,0).applyEuler(rotation).add(center);
   const normal=new THREE.Vector3(p.x*.7,.80+(p.y-4.5)*.32,p.z*.7).normalize();
   positions.push(...p.toArray());normals.push(...normal.toArray());uvs.push(u,v);colors.push(shade,shade,shade*.96);
  }
  indices.push(at,at+1,at+2,at,at+2,at+3);
 }
 const geometry=new THREE.BufferGeometry();
 for(const [name,data,size] of [['position',positions,3],['normal',normals,3],['uv',uvs,2],['color',colors,3]])geometry.setAttribute(name,new THREE.Float32BufferAttribute(data,size));
 geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
