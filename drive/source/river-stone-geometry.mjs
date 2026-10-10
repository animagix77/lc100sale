// Judge Dean LLC — eroded river stones; this exact mesh also supplies collision.
import * as THREE from 'three/webgpu';
export function riverStoneGeometry(){
 const g=new THREE.IcosahedronGeometry(.4,2),p=g.attributes.position;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),wear=.91+.055*Math.sin(x*12+z*8)+.035*Math.cos(y*17-z*6);
  // Broad worn shoulders and shallow fractures stay inside the old obstacle envelope.
  p.setXYZ(i,x*1.4*wear,y*.7*(.94+.04*Math.sin(x*10-z*9))+.18,z*wear);
 }
 // Smooth shared positions rather than leaving every source triangle disconnected.
 const groups=new Map(),normal=new THREE.Vector3();g.computeVertexNormals();
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join(','),v=groups.get(key)??new THREE.Vector3();normal.fromBufferAttribute(g.attributes.normal,i);v.add(normal);groups.set(key,v);}
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join(',');normal.copy(groups.get(key)).normalize();g.attributes.normal.setXYZ(i,normal.x,normal.y,normal.z);}
 g.computeBoundingSphere();g.computeBoundingBox();return g;
}
