import * as THREE from 'three/webgpu';
const rand=n=>{const v=Math.sin(n*127.1)*43758.5453;return v-Math.floor(v)};
// Broad, low-poly cloud banks: warm lit crowns, mauve undersides, no noisy texture.
export class SunsetClouds {
 constructor(scene,{reduced=false}={}){
  this.scene=scene;this.reduced=reduced;
  const g=new THREE.IcosahedronGeometry(1,1),p=g.attributes.position,c=[],low=new THREE.Color('#97718a'),high=new THREE.Color('#e9ad91'),mix=new THREE.Color();
  for(let i=0;i<p.count;i++){mix.lerpColors(low,high,THREE.MathUtils.smoothstep(p.getY(i),-.45,.75));c.push(mix.r,mix.g,mix.b)}
  g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));
  this.mesh=new THREE.InstancedMesh(g,new THREE.MeshBasicMaterial({vertexColors:true,fog:false,depthWrite:false,toneMapped:false}),90);this.mesh.frustumCulled=false;this.mesh.renderOrder=-1;scene.add(this.mesh);
  this.parts=[];this.dummy=new THREE.Object3D();
  for(let bank=0;bank<18;bank++){
   const angle=bank/18*Math.PI*2+.12,range=650+rand(bank+10)*240,x=Math.sin(angle)*range,z=Math.cos(angle)*range,y=55+rand(bank+40)*90,width=85+rand(bank+80)*70;
   for(let i=0;i<5;i++)this.parts.push({x:x+(i-2)*width*.36,y:y+Math.sin(i/4*Math.PI)*5+rand(bank*5+i+100)*3,z:z+rand(bank*5+i+200)*18,sx:width*(.40+rand(bank*5+i+300)*.25),sy:5+rand(bank*5+i+400)*6,sz:22+rand(bank*5+i+500)*22});
  }
 }
 update(camera,time){const d=this.dummy,drift=this.reduced?0:Math.sin(time*.008*(this.wind||1))*16;this.parts.forEach((p,i)=>{d.position.set(camera.position.x+p.x+drift,camera.position.y+p.y,camera.position.z+p.z);d.scale.set(p.sx,p.sy,p.sz);d.rotation.set(0,.2,0);d.updateMatrix();this.mesh.setMatrixAt(i,d.matrix)});this.mesh.instanceMatrix.needsUpdate=true;}
 dispose(){this.scene.remove(this.mesh);this.mesh.geometry.dispose();this.mesh.material.dispose();this.mesh.dispose();}
}
