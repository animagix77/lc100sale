// Judge Dean LLC — canyon river, gravel margins and flow around exposed boulders.
import {RAPIDS,riverMistParticle} from './canyon-rapids.mjs';
import {groundSurface,groundNormal,applyStoneSurface} from './ground-materials.mjs';
import * as THREE from 'three/webgpu';
import {uv,attribute,uniform,positionLocal,positionWorld,positionView,normalView,vec3,float,sin,mix,color,mx_noise_float,smoothstep} from 'three/tsl';
import {canyonRiver} from './canyon.mjs';
import {baseHeight} from './terrain.mjs';
const random=n=>{const v=Math.sin(n*127.1+94.3)*43758.5453;return v-Math.floor(v)};
export class CanyonRiverView{
 constructor(parent,{mobile=false,reduced=false}={}){
  this.mobile=mobile;this.reduced=reduced;this.mistDummy=new THREE.Object3D();
  this.group=new THREE.Group();this.group.name='Canyon river';parent.add(this.group);this.clock=uniform(0);this.resources=[];
  const start=603,end=950,steps=238,across=18,ps=[],indices=[],edges=[],froth=[],flow=[],sides=[];
  this.rocks=[];
  for(let i=0;i<64;i++){
   const x=start+5+random(i+30)*(end-start-12),r=canyonRiver(x),side=i%2?1:-1,channel=i%9===0;
   const z=r.z+side*r.halfWidth*(channel?.12+random(i+21)*.35:1.07+random(i+40)*.45),size=channel?.65+random(i+2)*.65:.5+random(i+2)*1.3;
   this.rocks.push({x,z,y:baseHeight(x,z)+size*.30,sx:size*(1.3+random(i+1)*.6),sy:size*(.60+random(i+4)*.3),sz:size,channel});
  }
  for(let i=0;i<=steps;i++){
   const x=start+(end-start)*i/steps,r=canyonRiver(x),near=this.rocks.filter(b=>Math.abs(b.x-x)<11);
   for(let j=0;j<=across;j++){
    const side=j/across*2-1,z=r.z+side*r.halfWidth;
    ps.push(x,r.level,z);edges.push(Math.abs(side));flow.push(x-start);sides.push(side);
    let foam=0;for(const b of near){const dx=x-b.x,dz=z-b.z;foam=Math.max(foam,Math.exp(-((dx-b.sx*2)**2/(b.sx*10)+dz*dz/(b.sz*b.sz*.65)))*.8,Math.exp(-((dx+b.sx*.7)**2/(b.sx*b.sx*.5)+dz*dz/(b.sz*b.sz)))*.9)}
    froth.push(foam);if(i<steps&&j<across){const a=i*(across+1)+j,b=a+across+1;indices.push(a,b,a+1,a+1,b,b+1)}
   }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));geometry.setAttribute('riverEdge',new THREE.Float32BufferAttribute(edges,1));geometry.setAttribute('riverFoam',new THREE.Float32BufferAttribute(froth,1));geometry.setAttribute('riverFlow',new THREE.Float32BufferAttribute(flow,1));geometry.setAttribute('riverSide',new THREE.Float32BufferAttribute(sides,1));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mat=new THREE.MeshPhysicalNodeMaterial({roughness:.22,metalness:0,ior:1.333,clearcoat:.28,clearcoatRoughness:.18,side:THREE.DoubleSide});
  const t=this.clock,world=positionLocal,edge=attribute('riverEdge','float'),side=attribute('riverSide','float'),wake=attribute('riverFoam','float');
  // Every moving layer shares x - speed*time: all whitewater travels downstream.
  // Signed channel coordinates follow the river bends rather than sliding across banks.
  const along=world.x.sub(t.mul(RAPIDS.speed));
  const coarse=mx_noise_float(vec3(along.mul(.28),float(4),side.mul(3.5))).mul(.5).add(.5);
  const fine=mx_noise_float(vec3(along.mul(1.5),float(7),side.mul(19))).mul(.5).add(.5);
  const stretched=mx_noise_float(vec3(along.mul(.16),float(11),side.mul(17))).mul(.5).add(.5);
  const crest=sin(along.mul(1.45).add(side.mul(3)).add(coarse.mul(2.5))).mul(.5).add(.5);
  // Anchored rapids build over shallow shelves and boulder wakes; foam leaves them.
  const shoal=sin(world.x.mul(.14).add(side.mul(1.1))).mul(.5).add(.5);
  const turbulence=wake.mul(.85).add(smoothstep(.65,.95,shoal).mul(.65)).clamp(0,1);
  const streak=smoothstep(.53,.74,stretched).mul(.42);
  const breaking=smoothstep(.48,.78,coarse.mul(.42).add(fine.mul(.22)).add(crest.mul(.36))).mul(turbulence.mul(.9).add(.23));
  const edgeFade=float(1).sub(smoothstep(.86,1,edge));
  const foam=breaking.add(streak).mul(edgeFade).clamp(0,.9);
  const waterColor=mix(color('#103b3d'),color('#477e79'),coarse.mul(.38).add(edge.mul(.19)));
  mat.colorNode=mix(waterColor,color('#d0ded2'),foam);mat.roughnessNode=mix(float(.19),float(.64),foam);
  const relief=fine.mul(.06).add(crest.mul(.036)).mul(float(1).add(turbulence.mul(1.7)));
  const dx=positionView.dFdx(),dy=positionView.dFdy(),r1=dy.cross(normalView),r2=normalView.cross(dx),det=dx.dot(r1);
  mat.normalNode=normalView.mul(det.abs()).sub(r1.mul(relief.dFdx()).add(r2.mul(relief.dFdy())).mul(det.sign())).normalize();
  this.water=new THREE.Mesh(geometry,mat);this.water.receiveShadow=true;this.group.add(this.water);this.resources.push(geometry,mat);
  this.makeBanks(start,end,steps);this.makeRocks();this.makeMist();
 }
 makeBanks(start,end,steps){
  const ps=[],idx=[],cs=[],c=new THREE.Color();for(const side of [-1,1]){const offset=ps.length/3;
   for(let i=0;i<=steps;i++){const x=start+(end-start)*i/steps,r=canyonRiver(x);
    for(let j=0;j<3;j++){const offsetWidth=[.98,1.22,1.85][j],z=r.z+side*r.halfWidth*offsetWidth;ps.push(x,baseHeight(x,z)+.035,z);c.set(j===0?'#56635d':j===1?'#7c7f6e':'#8c8574').multiplyScalar(.9+random(i+side*37)*.18);cs.push(c.r,c.g,c.b);if(i<steps&&j<2){const a=offset+i*3+j,b=a+3;idx.push(a,b,a+1,a+1,b,b+1)}}
   }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(cs,3));geo.setIndex(idx);geo.computeVertexNormals();const mat=new THREE.MeshStandardNodeMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide});const mesh=new THREE.Mesh(geo,mat);mesh.receiveShadow=true;this.group.add(mesh);this.bankMesh=mesh;this.resources.push(geo,mat);
 }
 setGroundTextures(maps){
  if(!maps)return;
  applyStoneSurface(this.rockMesh.material,maps,{scale:.45,strength:.03});
  const gravel=groundSurface(maps,'gravel',{scale:.6}),world=positionWorld.add(maps.origin);
  const level=float(35.1).sub(world.x.sub(665).mul(.007)),wet=float(1).sub(smoothstep(.12,1.2,world.y.sub(level)));
  const mat=this.bankMesh.material;mat.vertexColors=false;mat.colorNode=gravel.color.mul(mix(float(.95),float(.58),wet));mat.roughnessNode=mix(gravel.data.g.mul(.3).add(.65),float(.30),wet);mat.aoNode=mix(float(1),gravel.data.b,.4);mat.normalNode=groundNormal(gravel.data.r.mul(.025));mat.needsUpdate=true;
 }
 makeRocks(){
  const geo=new THREE.IcosahedronGeometry(1,1),position=geo.attributes.position;for(let i=0;i<position.count;i++){const x=position.getX(i),y=position.getY(i),z=position.getZ(i),n=1+Math.sin(x*7+y*4+z*9)*.13;position.setXYZ(i,x*n,y*n,z*n)}geo.computeVertexNormals();
  const mat=new THREE.MeshStandardNodeMaterial({color:'#747b70',roughness:.91});const strata=sin(positionLocal.y.mul(6).add(positionLocal.x.mul(.2))).mul(.05).add(.95);mat.colorNode=color('#747b70').mul(strata);
  const rocks=new THREE.InstancedMesh(geo,mat,this.rocks.length+200),d=new THREE.Object3D(),c=new THREE.Color();let n=0;
  for(const b of this.rocks){d.position.set(b.x,b.y,b.z);d.scale.set(b.sx,b.sy,b.sz);d.rotation.set(random(n+66)*.3,random(n+68)*6.28,random(n+71)*.35);d.updateMatrix();rocks.setMatrixAt(n,d.matrix);rocks.setColorAt(n++,c.set('#bfc7be').multiplyScalar(.64+random(n+5)*.30));}
  for(let i=0;i<200;i++){const x=605+random(i+441)*343,r=canyonRiver(x),side=i%2?1:-1,z=r.z+side*r.halfWidth*(1.08+random(i+333)*.65),s=.10+random(i+451)*.24;d.position.set(x,baseHeight(x,z)+s*.2,z);d.scale.set(s*1.6,s*.7,s);d.rotation.set(0,random(i+532)*6.28,0);d.updateMatrix();rocks.setMatrixAt(n,d.matrix);rocks.setColorAt(n++,c.set('#bfc1b6').multiplyScalar(.65+random(i+451)*.3));}
  rocks.count=n;rocks.castShadow=rocks.receiveShadow=true;this.group.add(rocks);this.rockMesh=rocks;this.resources.push(geo,mat);
 }
 makeMist(){
  const count=this.mobile?RAPIDS.mistMobile:RAPIDS.mistDesktop,geo=new THREE.PlaneGeometry(1,1);
  geo.setAttribute('mistAlpha',new THREE.InstancedBufferAttribute(new Float32Array(count),1));
  const mat=new THREE.MeshBasicNodeMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide});
  const radial=float(1).sub(smoothstep(.08,.5,uv().sub(.5).length()));
  const billow=mx_noise_float(vec3(uv().x.mul(5).add(this.clock.mul(.065)),uv().y.mul(4),float(3))).mul(.24).add(.76);
  mat.colorNode=color('#c3d4d1');mat.opacityNode=radial.mul(radial).mul(billow).mul(attribute('mistAlpha','float'));
  this.mist=new THREE.InstancedMesh(geo,mat,count);this.mist.frustumCulled=false;this.mist.renderOrder=3;this.group.add(this.mist);this.resources.push(geo,mat);
 }
 update(time,camera){
  const clock=this.reduced?0:time;this.clock.value=clock;
  const alphas=this.mist.geometry.attributes.mistAlpha,d=this.mistDummy;
  for(let i=0;i<this.mist.count;i++){const p=riverMistParticle(i,clock);d.position.set(p.x,p.y,p.z);d.scale.set(p.width,p.height,1);if(camera)d.quaternion.copy(camera.quaternion);else d.rotation.set(-.4,0,0);d.updateMatrix();this.mist.setMatrixAt(i,d.matrix);alphas.setX(i,p.alpha);}
  alphas.needsUpdate=true;this.mist.instanceMatrix.needsUpdate=true;
 }
 dispose(){this.group.removeFromParent();this.rockMesh.dispose();this.mist.dispose();for(const r of this.resources)r.dispose();}
}
