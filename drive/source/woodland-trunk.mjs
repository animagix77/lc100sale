// Judge Dean LLC — shared rooted trunks with tapered branch forks and bark UVs.
import * as THREE from 'three/webgpu';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export function woodlandTrunkGeometry(mobile=false){
 const positions=[],uvs=[],indices=[],sides=mobile?8:10;
 // A buried root collar, fluted buttress and gently wandering stem. Keeping the
 // same radial joints between rings prevents folded/self-intersecting surfaces.
 const rings=[[-.8,.44],[0,.48],[.32,.31],[1.15,.24],[2.65,.21],[4.1,.17],[5.45,.12],[6.35,.065]];
 for(let r=0;r<rings.length;r++){
  const [y,radius]=rings[r],cx=Math.sin(y*.74)*.10,cz=(Math.cos(y*.83)-1)*.045;
  for(let j=0;j<=sides;j++){
   const angle=j/sides*Math.PI*2,flute=1+Math.cos(angle*4+.35)*(.035+.13*Math.exp(-Math.max(0,y)*3));
   positions.push(cx+Math.cos(angle)*radius*flute,y,cz+Math.sin(angle)*radius*flute);uvs.push(j/sides,y/5.5);
  }
 }
 for(let r=0;r<rings.length-1;r++)for(let j=0;j<sides;j++){
  const a=r*(sides+1)+j,b=a+1,c=b+sides+1,d=a+sides+1;indices.push(a,d,b,b,d,c);
 }
 for(let j=1;j<sides-1;j++){indices.push(0,j,j+1);const top=(rings.length-1)*(sides+1);indices.push(top,top+j+1,top+j);}
 const trunk=new THREE.BufferGeometry();trunk.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));trunk.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));trunk.setIndex(indices);trunk.computeVertexNormals();
 // UVs need a seam; lighting does not. Average the duplicated radial endpoints.
 const normals=trunk.attributes.normal,aNormal=new THREE.Vector3(),bNormal=new THREE.Vector3();
 for(let r=0;r<rings.length;r++){const a=r*(sides+1),b=a+sides;aNormal.fromBufferAttribute(normals,a).add(bNormal.fromBufferAttribute(normals,b)).normalize();normals.setXYZ(a,aNormal.x,aNormal.y,aNormal.z);normals.setXYZ(b,aNormal.x,aNormal.y,aNormal.z);}
 const parts=[trunk];
 // Forks start inside the stem and end within the foliage. Their exact triangles
 // join the normal obstacle collider, including the roots, without extra bodies.
 for(const [start,end,radius] of [
  [[.06,3.25,-.03],[.88,4.8,.22],.11],
  [[.02,3.9,-.08],[-.92,5.2,.53],.095],
  [[-.02,4.55,-.07],[.18,5.75,-.96],.075],
 ]){
  const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),length=a.distanceTo(b),g=new THREE.CylinderGeometry(radius*.26,radius,length,5,1,false);
  // Preserve photographed bark's scale as branch lengths change.
  const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setY(i,(start[1]+uv.getY(i)*length)/5.5);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize()));g.translate(...a.add(b).multiplyScalar(.5).toArray());parts.push(g);
 }
 const geometry=mergeGeometries(parts);for(const part of parts)part.dispose();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
