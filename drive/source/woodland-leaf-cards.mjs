// Judge Dean LLC — branch-anchored foliage clusters with an open lower crown.
import * as THREE from 'three/webgpu';
const rand=(a,b)=>{const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n)};
export function woodlandLeafCards(mobile=false){
 const positions=[],normals=[],uvs=[],colors=[],indices=[];
 // Overlapping leafy lobes follow the branching stem. Crossed inclined sprays
 // fill each lobe in depth; upright rings read as thin torn sheets from the road.
 // Desktop folds the same source image, while mobile remains at 30 triangles.
 const limbs=[
  {x:.72,y:3.40,z:.20,angle:.30,width:2.28},
  {x:-.78,y:4.40,z:.52,angle:2.55,width:2.32},
  {x:.10,y:5.18,z:-.72,angle:4.80,width:2.23},
  {x:.54,y:5.80,z:.58,angle:1.00,width:2.08},
  {x:-.12,y:6.50,z:.02,angle:3.55,width:1.90},
 ];
 let card=0;
 for(const [limbIndex,limb] of limbs.entries())for(let spray=0;spray<(mobile?3:6);spray++,card++){
  const around=spray*Math.PI*2/(mobile?3:6),angle=limb.angle+around;
  const center=new THREE.Vector3(limb.x+Math.cos(angle)*.22,limb.y+(rand(card,7)-.5)*.30,limb.z+Math.sin(angle)*.22);
  const width=limb.width*(mobile?.93:.66)*(.92+rand(card,9)*.16),height=width*(.76+rand(card,11)*.09);
  const pitch=[-.78,.48,1.24][spray%3]+(rand(card,13)-.5)*.25;
  const rotation=new THREE.Euler(pitch,angle+(rand(card,15)-.5)*.25,(rand(card,17)-.5)*.44);
  const folded=!mobile,columns=folded?3:2,at=positions.length/3,shade=.79+rand(limbIndex,19)*.16;
  for(let row=0;row<2;row++)for(let col=0;col<columns;col++){
   const u=col/(columns-1),v=row,fold=folded&&col===1?width*.13:0;
   const p=new THREE.Vector3((u-.5)*width,(v-.5)*height,fold).applyEuler(rotation).add(center);
   // Normals describe each leafy branch volume, not a flat sheet. A modest up
   // component avoids the uniformly bright crown caps of an upward-only field.
   const normal=new THREE.Vector3(p.x*.82,.40+(p.y-3.4)*.12,p.z*.82).normalize();
   positions.push(...p.toArray());normals.push(...normal.toArray());uvs.push(card%2===0?u:1-u,card%5===0?1-v:v);colors.push(shade*.93,shade,shade*.87);
  }
  for(let col=0;col<columns-1;col++){const a=at+col,b=a+1,c=b+columns,d=a+columns;indices.push(a,b,d,b,c,d);}
 }
 const geometry=new THREE.BufferGeometry();
 for(const [name,data,size] of [['position',positions,3],['normal',normals,3],['uv',uvs,2],['color',colors,3]])geometry.setAttribute(name,new THREE.Float32BufferAttribute(data,size));
 geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
