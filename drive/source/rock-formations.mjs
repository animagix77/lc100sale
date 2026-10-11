// Judge Dean LLC — weathered, interlocking bedrock instead of isolated round lumps.
import * as THREE from 'three/webgpu';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

function ledge(seed,footing=false){
 const positions=[],indices=[],colors=[],sides=9;
 // Bevelled irregular rings form broad fractured faces with softened edges.
 // Each ring follows the same joints so the surface never crumples or self-intersects.
 const rings=[[footing?-2.5:-.48,.75],[-.35,1],[.28,.95],[.43,.70]];
 for(let ring=0;ring<rings.length;ring++)for(let j=0;j<sides;j++){
  const angle=j/sides*Math.PI*2,radius=.84+.13*Math.sin(j*7.3+seed),[y,bevel]=rings[ring];
  positions.push(Math.cos(angle)*radius*bevel,y+Math.sin(angle+seed)*.08,Math.sin(angle)*radius*bevel);
  const tone=.72+ring*.055;colors.push(tone,tone*.99,tone*.96);
 }
 for(let r=0;r<3;r++)for(let j=0;j<sides;j++){const a=r*sides+j,b=r*sides+(j+1)%sides,c=b+sides,d=a+sides;indices.push(a,d,b,b,d,c);}
 // Convex fan caps, with opposite winding below. All pieces are closed solids.
 for(let j=1;j<sides-1;j++){indices.push(0,j,(j+1));indices.push(27,27+j+1,27+j);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function rockFormationGeometry(){
 const pieces=[
  {s:[2.3,.86,1.6],p:[0,0,0],yaw:.12},
  {s:[1.6,1.48,1.15],p:[-.64,.45,-.35],yaw:-.32},
  {s:[1.28,.68,.99],p:[.86,.41,.30],yaw:.47},
  {s:[.72,.55,.66],p:[1.48,-.08,.55],yaw:.63},
 ].map((part,i)=>{const g=ledge(i*4.1,i===0);g.scale(...part.s);g.rotateY(part.yaw);g.translate(...part.p);return g;});
 const geometry=mergeGeometries(pieces);for(const piece of pieces)piece.dispose();geometry.computeBoundingSphere();return geometry;
}
