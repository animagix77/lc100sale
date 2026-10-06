import * as THREE from 'three/webgpu';
export class RecoveryView{
 constructor(scene,truck,model,recovery){this.truck=truck;this.recovery=recovery;this.models=[];this.mounts=[];this.a=new THREE.Vector3();this.b=new THREE.Vector3();this.q=new THREE.Quaternion();
  for(let i=0;i<2;i++){
   const mount=new THREE.Object3D();mount.position.set(i===0?-.29:.29,2.045,.92);truck.add(mount);this.mounts.push(mount);
   // Two dark straps anchor each board to the rack while stowed.
   const straps=new THREE.Group();for(const z of [-.36,.36]){const strap=new THREE.Mesh(new THREE.BoxGeometry(.35,.016,.035),new THREE.MeshStandardMaterial({color:'#24272a',roughness:.8}));strap.position.set(0,.055,z);straps.add(strap)}mount.add(straps);mount.userData.straps=straps;
  }
  // Center both mounts between the rack crossbars (z approx .2 and 1.6). Extra boards split from those positions
  // for four-wheel recovery and disappear back into the same stowed silhouette.
  for(let i=0;i<4;i++){const board=model.clone(true);board.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true});board.visible=i<2;scene.add(board);this.models.push(board)}
 }
 update(){const r=this.recovery;this.truck.updateMatrixWorld(true);for(let i=0;i<4;i++){const mesh=this.models[i],mount=this.mounts[i%2];mesh.visible=i<2||r.state!=='roof';mount.getWorldPosition(this.a);mount.getWorldQuaternion(this.q);mount.userData.straps.visible=r.state==='roof';
   if(r.state==='roof'){mesh.position.copy(this.a);mesh.quaternion.copy(this.q);continue}
   const b=r.boards[i];if(!b)continue;this.b.set(b.position.x-r.physics.origin.x,b.position.y,b.position.z-r.physics.origin.z);
   const raw=r.state==='deploying'?Math.min(1,r.age/.85):r.state==='stowing'?1-Math.min(1,r.age/.75):1,t=raw*raw*(3-2*raw);
   mesh.position.lerpVectors(this.a,this.b,t);mesh.position.y+=Math.sin(t*Math.PI)*.65;mesh.quaternion.copy(this.q).slerp(b.rotation,t);
  }}
}
