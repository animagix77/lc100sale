import * as THREE from 'three/webgpu';
import {positionGeometry,positionWorld,positionView,cameraWorldMatrix,cameraPosition,vec3,float,sin,smoothstep,mix,color,texture,mx_noise_float,normalize,transformNormalToView,attribute,dot,max,pow,reflect} from 'three/tsl';
import {riverZ,riverWidth,riverLevel,riverBounds,riverProfile} from './expedition.mjs';
import {baseHeight} from './terrain.mjs';
import {riverRock} from './river-rocks.mjs';
import {RIVER_WAKE_LIMITS} from './ocean-height.mjs';
export class RiverView{
 constructor(scene,ocean){
  this.scene=scene;this.ocean=ocean;
  const positions=[],indices=[],uvs=[],depths=[],beds=[],riffles=[],nx=ocean.mobile?696:1112,nz=ocean.mobile?28:40;
  // Half-metre desktop tessellation resolves the tyre-scale crest and trough.
  // River geometry uses absolute coordinates; only the mesh origin is rebased.
  for(let i=0;i<=nx;i++){
   const x=riverBounds.minX+i*(riverBounds.maxX-riverBounds.minX)/nx,near=[];
   for(let col=Math.floor(x/3)-1;col<=Math.floor(x/3)+2;col++)for(let row=-4;row<=4;row++){const rock=riverRock(col,row);if(rock)near.push(rock)}
   for(let j=0;j<=nz;j++){
    const side=j/nz*2-1,z=riverZ(x)+side*riverWidth(x),h=riverLevel(x),profile=riverProfile(x,z),depth=Math.max(0,profile.depth);
    positions.push(x,h,z);uvs.push(i/nx,j/nz);depths.push(depth);beds.push(baseHeight(x,z));
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
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setAttribute('riverDepth',new THREE.Float32BufferAttribute(depths,1));geo.setAttribute('riverBed',new THREE.Float32BufferAttribute(beds,1));geo.setAttribute('riffle',new THREE.Float32BufferAttribute(riffles,1));geo.setIndex(indices);geo.computeVertexNormals();
  const world=positionWorld.xz.add(ocean.origin),t=ocean.clock;
  const wakeAt=p=>texture(ocean.wakeTexture,p.sub(ocean.wakeOrigin).div(ocean.wakeSpan).mul((ocean.wake.size-1)/ocean.wake.size).add(.5/ocean.wake.size)).level(0);
  const wakeVertex=wakeAt(positionGeometry.xz),wake=wakeAt(world);
  const depth=attribute('riverDepth','float'),bed=attribute('riverBed','float'),riffle=attribute('riffle','float');
  const energy=smoothstep(0,RIVER_WAKE_LIMITS.edgeDepth,depth),mouth=smoothstep(-48,-28,positionGeometry.x);
  // Keep this displacement identical to waterSurfaceHeight: no full-height wakes
  // along a zero-depth bank, and no trough can cut through the shallow bed.
  const phase=positionGeometry.x.mul(.9).add(positionGeometry.z.mul(1.8)).sub(t.mul(2.2));
  const ripple=sin(phase).mul(.012).add(sin(positionGeometry.x.mul(2.3).add(t.mul(3.1))).mul(.006)).mul(energy);
  const wakeHeight=wakeVertex.r.max(depth.mul(-RIVER_WAKE_LIMITS.troughDepth)).min(depth.mul(RIVER_WAKE_LIMITS.crestDepth).min(RIVER_WAKE_LIMITS.crest)).mul(energy);
  const inland=positionGeometry.y.add(ripple).add(wakeHeight),tidal=ocean.surfaceNode(positionGeometry.x,positionGeometry.z).add(wakeVertex.r);
  const mat=new THREE.MeshPhysicalNodeMaterial({metalness:0,ior:1.333,transparent:true,depthWrite:false,side:THREE.FrontSide});
  mat.positionNode=vec3(positionGeometry.x,mix(tidal,inland,mouth),positionGeometry.z);
  const flowNoise=mx_noise_float(vec3(world.x.add(t.mul(1.25)).mul(1.4),world.y.mul(3.2),float(4))).mul(.5).add(.5);
  const fine=mx_noise_float(vec3(world.x.add(t.mul(.85)).mul(3.8),world.y.mul(4.8),float(12)));
  // Derivatives use the displaced triangles, including the actual bow wave and
  // bank transition. Small current ripples only add detail to that geometry.
  const geometricNormal=positionView.dFdx().cross(positionView.dFdy()).normalize().transformDirection(cameraWorldMatrix);
  const normal=normalize(geometricNormal.add(vec3(fine.mul(.018),0,flowNoise.sub(.5).mul(.035)).mul(energy)));
  mat.normalNode=transformNormalToView(normal);
  const eye=normalize(cameraPosition.sub(positionWorld)),fresnel=pow(float(1).sub(max(dot(eye,normal),0)),5).mul(.72).add(.025),skyRay=reflect(eye.negate(),normal);
  const sky=mix(ocean.skyHorizon,ocean.skyTop,smoothstep(.025,.65,skyRay.y));
  const wetDepth=positionWorld.y.sub(bed).max(0),wetEdge=smoothstep(0,.045,wetDepth);
  const broken=smoothstep(.50,.76,flowNoise),foam=riffle.mul(broken).mul(.34).add(wake.a.mul(smoothstep(.25,.65,flowNoise)).add(smoothstep(.18,.85,wake.r).mul(.24)).mul(energy)).max(ocean.tireFoamNode).min(.92).mul(wetEdge);
  const water=mix(color('#70938a'),color('#225556'),smoothstep(.03,.48,wetDepth));
  mat.colorNode=mix(water,color('#e0ebe4'),foam);
  mat.emissiveNode=sky.mul(fresnel).mul(.55).mul(ocean.brightness).mul(float(1).sub(foam.mul(.65)));
  mat.roughnessNode=mix(float(.24),float(.38),foam.add(riffle.mul(.2)).min(1));
  mat.opacityNode=mix(float(.18),float(.69),smoothstep(.025,.48,wetDepth)).add(fresnel.mul(.4)).max(foam.mul(.90)).min(.95).mul(wetEdge).mul(smoothstep(-48,-36,world.x));
  this.mesh=new THREE.Mesh(geo,mat);this.mesh.receiveShadow=true;this.mesh.renderOrder=1;this.mesh.frustumCulled=false;scene.add(this.mesh);
 }
 update(origin){this.mesh.position.set(-origin.x,0,-origin.z)}
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose()}
}
