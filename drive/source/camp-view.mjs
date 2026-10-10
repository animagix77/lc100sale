// Judge Dean LLC — silver insulated hub tent, bounded campfire and placement preview.
import * as THREE from 'three/webgpu';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CAMP} from './expedition.mjs';
import {FIRE_SITE} from './camp.mjs';
export class CampView{
 constructor(scene,field,{reduced=false}={}){
  this.scene=scene;this.field=field;this.reduced=reduced;this.root=new THREE.Group();scene.add(this.root);this.tent=new THREE.Group();this.preview=new THREE.Group();this.root.add(this.tent,this.preview);this.resources=[];
  const mat=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.72,...extra});this.resources.push(m);return m};
  const fabric=quiltTexture();this.resources.push(fabric);
  const silver=mat('#eef1ef',{metalness:.22,roughness:.48,map:fabric,bumpMap:fabric,bumpScale:.012,side:THREE.DoubleSide});
  const trim=mat('#424c4e',{roughness:.87}),binding=mat('#a2afae',{metalness:.22,roughness:.63}),screen=mat('#596568',{roughness:1}),floor=mat('#44413b');
  const mesh=(geo,m,parent=this.tent)=>{this.resources.push(geo);const o=new THREE.Mesh(geo,m);o.castShadow=o.receiveShadow=true;parent.add(o);return o};
  const seamPoints=[],roofPoints=[],roofUV=[],roofIndices=[];
  const ring=Array.from({length:6},(_,i)=>new THREE.Vector3(Math.sin(i*Math.PI/3)*1.95,0,Math.cos(i*Math.PI/3)*1.95));
  mesh(new THREE.CylinderGeometry(1.97,1.97,.055,6),floor).position.y=.028;
  const surface=(i,u,v,offset=0)=>{
   const a=ring[i],b=ring[(i+1)%6],normal=a.clone().add(b).normalize();
   const p=a.clone().lerp(b,u).multiplyScalar(1-.09*v);
   p.y=v*(1.76+.06*Math.sin(Math.PI*u));
   // Broad panel tension, without noisy dents or rigid triangular folds.
   p.addScaledVector(normal,.22*Math.sin(Math.PI*u)*Math.sin(Math.PI*v)+offset);
   return p;
  };
  const patch=(sample,nu,nv,m,su=5,sv=5)=>{
   const points=[],uv=[],indices=[];
   for(let v=0;v<=nv;v++)for(let u=0;u<=nu;u++){const p=sample(u/nu,v/nv);points.push(...p.toArray());uv.push(u/nu*su,v/nv*sv);}
   for(let v=0;v<nv;v++)for(let u=0;u<nu;u++){const k=v*(nu+1)+u;indices.push(k,k+1,k+nu+1,k+1,k+nu+2,k+nu+1);}
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return mesh(g,m);
  };
  const seam=(points)=>{for(let j=1;j<points.length;j++)seamPoints.push(points[j-1],points[j]);};
  const radialPatch=(i,cu,cv,inner,outer,m,offset)=>{
   return patch((u,v)=>{const angle=-u*Math.PI*2,r=inner+(outer-inner)*v;return surface(i,cu+Math.cos(angle)*r/1.95,cv+Math.sin(angle)*r/1.78,offset);},40,3,m);
  };
  for(let i=0;i<6;i++){
   patch((u,v)=>surface(i,u,v),16,14,silver).name='Bowed fabric panel';
   // Substantial perimeter binding stays readable at the chase camera distance.
   patch((u,v)=>surface(i,u,.018+v*.045,.007),16,1,trim);
   patch((u,v)=>surface(i,u,.974+v*.026,.009),16,1,trim);
   for(const edge of [0,1])patch((u,v)=>surface(i,edge===0?u*.016:1-u*.016,v,.007),1,14,binding);
   for(const [u0,v0,u1,v1] of [[0,0,.5,.5],[1,0,.5,.5],[0,1,.5,.5],[1,1,.5,.5]])seam(Array.from({length:13},(_,j)=>surface(i,u0+(u1-u0)*j/12,v0+(v1-v0)*j/12,.009)));
   const hub=mesh(new THREE.SphereGeometry(.045,10,6),trim);hub.position.copy(surface(i,.5,.5,.022));
   const normal=ring[i].clone().add(ring[(i+1)%6]).normalize();
   const pull=mesh(new THREE.TorusGeometry(.048,.009,5,14,Math.PI*1.65),trim);pull.position.copy(surface(i,.5,.475,.052));pull.lookAt(pull.position.clone().add(normal));
   const doorSide=i===0||i===3,cu=doorSide?.73:.5,cv=.76;
   radialPatch(i,cu,cv,.255,.305,binding,.015).name='Padded window frame';
   radialPatch(i,cu,cv,.238,.263,trim,.024);
   radialPatch(i,cu,cv,0,.238,screen,.030).name='Mesh window';
   if(doorSide){
    const doorShape=(u,v,inset=0)=>{const x=(u-.5)*2,w=.205-inset,low=.045+inset,top=.62+(.27-inset)*Math.sqrt(Math.max(0,1-x*x));return surface(i,.27+x*w,low+v*(top-low),.020+inset*.18);};
    patch((u,v)=>doorShape(u,v),16,14,trim).name='Arched door zipper';
    patch((u,v)=>doorShape(u,v,.018),16,14,silver,2,4.2).name='Closed fabric door';
    seam(Array.from({length:20},(_,j)=>doorShape(.51,j/19,.018).addScaledVector(normal,.008)));
    const tab=mesh(new THREE.BoxGeometry(.026,.072,.014),trim);tab.position.copy(surface(i,.285,.49,.054));tab.lookAt(tab.position.clone().add(normal));
   }
  }
  // One welded roof gives continuous normals instead of six flat triangle highlights.
  const sectors=96,rings=10;
  roofPoints.push(0,2.18,0);roofUV.push(5,5);
  for(let r=1;r<=rings;r++)for(let j=0;j<sectors;j++){
   const a=j/sectors*6,i=Math.floor(a),u=a-i,edge=surface(i,u,1),t=r/rings;
   roofPoints.push(edge.x*t,edge.y+(2.18-edge.y)*(1-t*t),edge.z*t);roofUV.push(5+edge.x*t*2.5,5+edge.z*t*2.5);
  }
  for(let j=0;j<sectors;j++)roofIndices.push(0,1+j,1+(j+1)%sectors);
  for(let r=1;r<rings;r++)for(let j=0;j<sectors;j++){const a=1+(r-1)*sectors+j,b=1+(r-1)*sectors+(j+1)%sectors,c=a+sectors,d=b+sectors;roofIndices.push(a,c,b,b,c,d);}
  const roofGeo=new THREE.BufferGeometry();roofGeo.setAttribute('position',new THREE.Float32BufferAttribute(roofPoints,3));roofGeo.setAttribute('uv',new THREE.Float32BufferAttribute(roofUV,2));roofGeo.setIndex(roofIndices);roofGeo.computeVertexNormals();mesh(roofGeo,silver).name='Continuous curved roof';
  for(let i=0;i<6;i++){const edge=surface(i,0,1);seam(Array.from({length:15},(_,j)=>{const t=j/14;return new THREE.Vector3(edge.x*t,edge.y+(2.18-edge.y)*(1-t*t)+.009,edge.z*t)}));}
  const seams=new THREE.BufferGeometry().setFromPoints(seamPoints),lineMat=new THREE.LineBasicMaterial({color:'#768789'});this.resources.push(seams,lineMat);this.tent.add(new THREE.LineSegments(seams,lineMat));
  // Merge opaque parts by material to keep the added detail cheap on phones.
  for(const material of [silver,trim,binding,screen,floor]){
   const parts=this.tent.children.filter(o=>o.isMesh&&o.material===material);if(parts.length<2)continue;
   const transformed=parts.map(o=>{o.updateMatrix();const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrix);return g;});
   const geometry=mergeGeometries(transformed);for(const g of transformed)g.dispose();
   for(const o of parts)o.removeFromParent();mesh(geometry,material).name='Batched shelter details';
  }

  // Ghost is one inexpensive hull; the detailed shelter is only drawn after confirmation.
  const ghostMat=mat('#76cbb0',{transparent:true,opacity:.35,depthWrite:false});this.ghostMat=ghostMat;
  const hull=mesh(new THREE.CylinderGeometry(1.88,1.95,1.75,6),ghostMat,this.preview);hull.position.y=.9;
  const roof=mesh(new THREE.ConeGeometry(1.88,.5,6),ghostMat,this.preview);roof.position.y=2.02;
  hull.castShadow=roof.castShadow=false;
  this.fireGroup=new THREE.Group();this.root.add(this.fireGroup);
  const stone=mat('#6f6b61'),wood=mat('#392a22'),ember=mat('#e4601f',{emissive:'#ff4b08',emissiveIntensity:1.5});
  for(let i=0;i<12;i++){const r=mesh(new THREE.IcosahedronGeometry(.19,1),stone,this.fireGroup);r.position.set(Math.sin(i/12*Math.PI*2)*.8,.12,Math.cos(i/12*Math.PI*2)*.8);r.scale.y=.7;}
  for(let i=0;i<4;i++){const log=mesh(new THREE.CylinderGeometry(.10,.13,1.15,7),wood,this.fireGroup);log.rotation.z=Math.PI/2;log.rotation.y=i*Math.PI/4;log.position.y=.16+i*.04;}
  this.coals=mesh(new THREE.SphereGeometry(.48,12,6),ember,this.fireGroup);this.coals.scale.y=.12;this.coals.position.y=.10;
  const fireMat=new THREE.MeshBasicMaterial({color:'#ffb446',transparent:true,opacity:.7,depthWrite:false});this.resources.push(fireMat);this.flames=[];
  for(let i=0;i<9;i++){const flame=mesh(new THREE.SphereGeometry(1,8,6),fireMat,this.fireGroup);this.flames.push(flame);}
  const smokeMat=new THREE.MeshBasicMaterial({color:'#79736a',transparent:true,opacity:.13,depthWrite:false});this.resources.push(smokeMat);this.smoke=[];for(let i=0;i<8;i++)this.smoke.push(mesh(new THREE.SphereGeometry(1,8,6),smokeMat,this.fireGroup));
  // Translucent effects must not create solid silhouettes in the sun shadow map.
  for(const particle of [...this.flames,...this.smoke])particle.castShadow=false;
  this.glow=new THREE.PointLight('#ffac59',0,15,2);this.glow.position.y=1;this.fireGroup.add(this.glow);
  const boundary=new THREE.BufferGeometry().setFromPoints(Array.from({length:81},(_,i)=>{const x=CAMP.x+Math.sin(i/80*Math.PI*2)*(CAMP.radius-3),z=CAMP.z+Math.cos(i/80*Math.PI*2)*(CAMP.radius-3);return new THREE.Vector3(x,field.height(x,z)+.04,z)}));const boundaryMat=new THREE.LineBasicMaterial({color:'#a9d1b3',transparent:true,opacity:.6});this.resources.push(boundary,boundaryMat);this.boundary=new THREE.Line(boundary,boundaryMat);this.root.add(this.boundary);
  this.tent.visible=this.preview.visible=this.boundary.visible=false;
 }
 update(state,origin,time){
  this.root.position.set(-origin.x,0,-origin.z);
  this.tent.visible=!!state.tent;if(state.tent){this.tent.position.set(state.tent.x,state.tent.y,state.tent.z);this.tent.rotation.y=state.tent.yaw;}
  this.preview.visible=this.boundary.visible=state.placing;if(state.candidate){this.preview.position.set(state.candidate.x,this.field.height(state.candidate.x,state.candidate.z)+.05,state.candidate.z);this.preview.rotation.y=state.candidate.yaw;this.ghostMat.color.set(state.result.ok?'#7ee2ac':'#e36b5c');}
  this.fireGroup.position.set(FIRE_SITE.x,this.field.height(FIRE_SITE.x,FIRE_SITE.z),FIRE_SITE.z);
  this.coals.visible=state.fire;this.glow.intensity=state.fire?35*(1+(this.reduced?0:Math.sin(time*6)*.10)):0;
  this.smoke.forEach((s,i)=>{s.visible=state.fire;const age=(time*.15+i/8)%1;s.position.set(age*.9,1+age*3,.1+age*.35);s.scale.setScalar(.10+Math.sin(age*Math.PI)*.48);});
  this.flames.forEach((f,i)=>{f.visible=state.fire;const phase=(time*(this.reduced?.28:.8)+i*.137)%1;f.position.set(Math.sin(i*2.4)*.25*(1-phase),.3+phase*.7,Math.cos(i*2.4)*.25*(1-phase));f.scale.set(.12*(1-phase),.26*(1-phase),.12*(1-phase));});
 }
 dispose(){this.root.removeFromParent();for(const r of this.resources)r.dispose();}
}

// Seamless hex quilting and restrained fibre grain; generated locally, no photo texture.
function quiltTexture(){
 const w=192,h=224,data=new Uint8Array(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  let nearest=Infinity;
  for(let c=Math.floor(x/48)-1;c<=Math.floor(x/48)+1;c++)for(let r=Math.floor(y/56)-1;r<=Math.floor(y/56)+1;r++){
   const dx=Math.abs(x-c*48),dy=Math.abs(y-(r*56+(c%2)*28));
   nearest=Math.min(nearest,Math.max(dy/28,(dx*.875+dy*.5)/28));
  }
  const edge=Math.max(0,1-Math.abs(1-nearest)*13),grain=Math.sin(x*2.71+y*5.17)*2;
  const value=Math.round(224-22*edge+grain+5*Math.cos(nearest*Math.PI)),k=(y*w+x)*4;data[k]=data[k+1]=data[k+2]=value;data[k+3]=255;
 }
 const texture=new THREE.DataTexture(data,w,h);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
}
