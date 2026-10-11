// Judge Dean LLC — attached cliff fractures inside the existing canyon envelope.
import * as THREE from 'three/webgpu';
import {baseHeight} from './terrain.mjs';
import {canyonCenterZ,canyonProfile,canyonRiver} from './canyon.mjs';
import {routeSample} from './expedition.mjs';
const rand=n=>{const v=Math.sin(n*127.1+94.3)*43758.5453;return v-Math.floor(v)};

export function canyonBankWidths(x,side){
 const middle=1.19+Math.sin(x*.21+side)*.07;
 const outer=Math.max(middle+.14,1.68+Math.sin(x*.083+side*.8)*.30+Math.sin(x*.29+side*1.4)*.17);
 return [.98,middle,outer];
}

export function canyonWallOutcrops(geometry,{limit=80}={}){
 const result=[],positions=geometry.attributes.position,matrix=new THREE.Matrix4(),normal=new THREE.Vector3(),along=new THREE.Vector3(),cross=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),center=new THREE.Vector3(),vertex=new THREE.Vector3();
 for(let cluster=0;cluster<16&&result.length<limit;cluster++){
  const side=cluster%2?1:-1,clusterX=611+(cluster+.5)*20.3+(rand(cluster+400)-.5)*9,band=.60+rand(cluster+770)*.23;
  for(let piece=0;piece<5&&result.length<limit;piece++){
   const seed=cluster*7+piece,x=clusterX+(piece-2)*2.3+(rand(seed+340)-.5)*1.2;
   const width=canyonProfile(x,canyonCenterZ(x)).halfWidth,z=canyonCenterZ(x)+side*(width*band+(rand(seed+870)-.5)*2.5),y=baseHeight(x,z),river=canyonRiver(x);
   if(y<river.level+5||y>71||routeSample(x,z).distance<13)continue;
   const sx=(baseHeight(x+.5,z)-baseHeight(x-.5,z)),sz=(baseHeight(x,z+.5)-baseHeight(x,z-.5));
   normal.set(-sx,1,-sz).normalize();along.set(1,sx,0).normalize();cross.crossVectors(along,normal).normalize();matrix.makeBasis(along,normal,cross);rotation.setFromRotationMatrix(matrix);
   scale.set(2.6+rand(seed+91)*2.4,.66+rand(seed+112)*.66,1.15+rand(seed+63)*1.3);center.set(x,y,z);matrix.compose(center,rotation,scale);
   // Fit to the actual curved wall, not just its central tangent. Bury at least
   // 60% of the rock vertices; fractures emerge from the cliff rather than float.
   const depth=[];for(let i=0;i<positions.count;i++){vertex.fromBufferAttribute(positions,i).applyMatrix4(matrix);depth.push(vertex.y-baseHeight(vertex.x,vertex.z));}
   depth.sort((a,b)=>a-b);center.y-=depth[Math.floor(depth.length*.60)]+.10;matrix.compose(center,rotation,scale);
   let exposed=0,buried=0,valid=true,peak=-Infinity;
   for(let i=0;i<positions.count;i++){
    vertex.fromBufferAttribute(positions,i).applyMatrix4(matrix);const above=vertex.y-baseHeight(vertex.x,vertex.z);peak=Math.max(peak,above);if(above<-.08)buried++;
    if(above>.05){exposed++;if(vertex.y>73||routeSample(vertex.x,vertex.z).distance<7){valid=false;break}}
   }
   if(valid&&exposed&&buried>=positions.count*.55&&peak>.25&&peak<3.5)result.push({matrix:matrix.clone(),cluster,side,peak});
  }
 }
 return result;
}
