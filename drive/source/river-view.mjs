import * as THREE from 'three/webgpu';
import {positionGeometry,positionWorld,cameraPosition,vec2,vec3,float,sin,abs,smoothstep,mix,color,texture,uv,mx_noise_float,cos,normalize,transformNormalToView,attribute,dot,max,pow,reflect} from 'three/tsl';
import {riverZ,riverWidth,riverLevel} from './expedition.mjs';
import {baseHeight} from './terrain.mjs';
import {riverRock} from './river-rocks.mjs';
export class RiverView{
 constructor(scene,ocean){
  this.scene=scene;this.ocean=ocean;
  const positions=[],indices=[],uvs=[],depths=[],riffles=[],nx=ocean.mobile?696:1112,nz=ocean.mobile?28:40;
  // Half-metre desktop tessellation resolves the tyre-scale crest and trough.
  // River geometry uses absolute coordinates; only the mesh origin is rebased.
  for(let i=0;i<=nx;i++){
   const x=-36+i*556/nx,near=[];
   for(let col=Math.floor(x/3)-1;col<=Math.floor(x/3)+2;col++)for(let row=-4;row<=4;row++){const rock=riverRock(col,row);if(rock)near.push(rock)}
   for(let j=0;j<=nz;j++){
    const side=j/nz*2-1,z=riverZ(x)+side*(riverWidth(x)+.9),h=riverLevel(x),depth=Math.max(0,h-baseHeight(x,z));
    positions.push(x,h,z);uvs.push(i/nx,j/nz);depths.push(depth);
    let turbulence=0;
    for(const rock of near){
     const along=rock.x-x,across=z-rock.z,exposed=Math.max(0,Math.min(1,(rock.y+rock.sy*.46-h+.16)*4));
     // Downstream streaks and small bow turbulence at exposed stone shoulders.
     const eddy=Math.exp(-((along-1.1)**2/5+across*across/.5));
     const rim=Math.exp(-((along+.3)**2/.4+across*across/.7));
     turbulence=Math.max(turbulence,(eddy*.65+rim*.7)*exposed);
    }
    riffles.push(turbulence);
    if(i<nx&&j<nz){const a=i*(nz+1)+j,b=a+nz+1;indices.push(a,a+1,b,b,a+1,b+1)}
   }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setAttribute('riverDepth',new THREE.Float32BufferAttribute(depths,1));geo.setAttribute('riffle',new THREE.Float32BufferAttribute(riffles,1));geo.setIndex(indices);geo.computeVertexNormals();
  const world=positionWorld.xz.add(ocean.origin),t=ocean.clock;
  const wakeAt=p=>texture(ocean.wakeTexture,p.sub(ocean.wakeOrigin).div(ocean.wakeSpan).mul((ocean.wake.size-1)/ocean.wake.size).add(.5/ocean.wake.size)).level(0);
  const wakeVertex=wakeAt(positionGeometry.xz),wake=wakeAt(world);
  const phase=positionGeometry.x.mul(.9).add(positionGeometry.z.mul(1.8)).sub(t.mul(2.2)),ripple=sin(phase).mul(.035).add(sin(positionGeometry.x.mul(2.3).add(t.mul(3.1))).mul(.015));
  const mat=new THREE.MeshStandardNodeMaterial({metalness:0,transparent:true,depthWrite:false,side:THREE.DoubleSide});
  mat.positionNode=vec3(positionGeometry.x,positionGeometry.y.add(ripple).add(wakeVertex.r),positionGeometry.z);
  const depth=attribute('riverDepth','float'),riffle=attribute('riffle','float');
  const flowNoise=mx_noise_float(vec3(world.x.add(t.mul(1.25)).mul(1.4),world.y.mul(3.2),float(4))).mul(.5).add(.5);
  const fine=mx_noise_float(vec3(world.x.add(t.mul(.85)).mul(3.8),world.y.mul(4.8),float(12)));
  const phaseWorld=world.x.mul(.9).add(world.y.mul(1.8)).sub(t.mul(2.2));
  const nxWorld=float(-.052).sub(cos(phaseWorld).mul(.0315)).sub(cos(world.x.mul(2.3).add(t.mul(3.1))).mul(.0345)).sub(wake.g).add(fine.mul(.018));
  const nzWorld=cos(phaseWorld).mul(-.063).sub(wake.b).add(flowNoise.sub(.5).mul(.065));
  const normal=normalize(vec3(nxWorld,1,nzWorld));mat.normalNode=transformNormalToView(normal);
  const eye=normalize(cameraPosition.sub(positionWorld)),fresnel=pow(float(1).sub(max(dot(eye,normal),0)),5).mul(.72).add(.025),skyRay=reflect(eye.negate(),normal);
  const sky=mix(ocean.skyHorizon,ocean.skyTop,smoothstep(.025,.65,skyRay.y));
  const broken=smoothstep(.50,.76,flowNoise),foam=riffle.mul(broken).mul(.65).add(wake.a.mul(smoothstep(.3,.7,flowNoise))).max(ocean.tireFoamNode).min(.9);
  const water=mix(color('#6a9284'),color('#1c575a'),smoothstep(.08,.65,depth));
  mat.colorNode=mix(water,color('#e0ebe4'),foam);
  mat.emissiveNode=sky.mul(fresnel).mul(ocean.brightness).mul(float(1).sub(foam.mul(.65)));
  mat.roughnessNode=mix(float(.16),float(.32),foam.add(riffle.mul(.2)).min(1));
  mat.opacityNode=mix(float(.26),float(.76),smoothstep(.025,.65,depth)).add(fresnel.mul(.4)).max(foam.mul(.90)).min(.97).mul(smoothstep(0,.09,depth)).mul(float(1).sub(smoothstep(.88,1,abs(uv().y.sub(.5).mul(2)))));
  this.mesh=new THREE.Mesh(geo,mat);this.mesh.receiveShadow=true;this.mesh.renderOrder=1;this.mesh.frustumCulled=false;scene.add(this.mesh);
 }
 update(origin){this.mesh.position.set(-origin.x,0,-origin.z)}
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose()}
}
