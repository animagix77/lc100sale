// Judge Dean LLC — fractured, interlocking bedrock with irregular ridge silhouettes.
import * as THREE from 'three/webgpu';
import {ConvexGeometry} from 'three/addons/geometries/ConvexGeometry.js';
import {mergeGeometries,toCreasedNormals,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

function fracturedBlock(seed,footing=false){
 const points=[],outline=[[-.96,-.53],[-.39,-.96],[.47,-.84],[.95,-.24],[.77,.51],[.12,.92],[-.68,.71],[-1,.08]];
 // Unequal joint lengths and an offset high ridge form broken wedges rather
 // than concentric horizontal caps. Hull construction keeps every piece a
 // closed convex solid even where a shoulder point lies inside a fracture.
 for(let j=0;j<outline.length;j++){
  const [u,v]=outline[j],jitter=.96+.05*Math.sin(seed+j*3.1),x=u*jitter,z=v*jitter;
  points.push(new THREE.Vector3(x*.73,footing?-2.5:-.52,z*.73));
  points.push(new THREE.Vector3(x,-.24+x*.11-z*.05,z));
  const shoulder=.17+x*.18-z*.16+.11*Math.sin(seed+j*2.3);
  points.push(new THREE.Vector3(x*.83-.07,shoulder,z*.83+.04));
 }
 const ridge=[[-.53,.59,-.21],[-.06,.70,-.08],[.43,.46,-.19],[.39,.30,.34],[-.18,.39,.48],[-.58,.46,.19]];
 for(const [x,y,z] of ridge)points.push(new THREE.Vector3(x+.04*Math.sin(seed),y+.055*Math.cos(seed+x*4),z+.07*Math.cos(seed)));
 const g=new ConvexGeometry(points),a=g.attributes.position,colors=[];
 for(let i=0;i<a.count;i++){
  const x=a.getX(i),y=a.getY(i),z=a.getZ(i),tone=.77+Math.max(-.7,Math.min(.7,y))*.10+.035*Math.sin(x*4.2+z*3.7+seed);
  colors.push(tone,tone*.99,tone*.96);
 }
 g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return g;
}
export function rockFormationGeometry(){
 const pieces=[
  {s:[1.95,.91,1.46],p:[-.08,-.03,0],r:[-.04,.12,-.06]},
  {s:[1.33,1.15,1.10],p:[-.57,.34,-.30],r:[.15,-.32,-.23]},
  {s:[1.06,.86,.91],p:[.89,.13,.25],r:[-.19,.47,.26]},
  {s:[.63,.61,.62],p:[1.48,-.11,.56],r:[.12,.63,-.20]},
 ].map((part,i)=>{const g=fracturedBlock(i*4.1,i===0),matrix=new THREE.Matrix4().compose(new THREE.Vector3(...part.p),new THREE.Quaternion().setFromEuler(new THREE.Euler(...part.r)),new THREE.Vector3(...part.s));g.applyMatrix4(matrix);return g;});
 const merged=mergeGeometries(pieces);for(const piece of pieces)piece.dispose();
 // Retain the previous formation envelope: existing plant clearings, safe
 // route shoulders and the deep buried footing need no placement migration.
 merged.computeBoundingBox();const box=merged.boundingBox,a=merged.attributes.position;
 let reach=0;for(let i=0;i<a.count;i++)reach=Math.max(reach,Math.hypot(a.getX(i),a.getZ(i)));
 const horizontal=Math.min(1,2.20/reach),vertical=3.42/(box.max.y-box.min.y),offset=-2.22-box.min.y*vertical;
 merged.scale(horizontal,vertical,horizontal);merged.translate(0,offset,0);
 // Split normals only at genuine fracture planes; rendered triangles are the
 // same closed surfaces supplied to the exact obstacle collision geometry.
 const creased=toCreasedNormals(merged,.48),geometry=mergeVertices(creased,1e-6);
 creased.dispose();merged.dispose();geometry.computeBoundingSphere();return geometry;
}
