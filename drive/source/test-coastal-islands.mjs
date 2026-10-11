import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {COASTAL_LANDMARKS,COASTAL_CAMP,ISLANDS,SANDBARS,islandProfile,islandTerrainHeight,islandOceanBed,islandBathymetryStats,archipelagoRegion} from './coastal-islands.mjs';
import {baseHeight,surfaceAt,SandField} from './terrain.mjs';
import {oceanHeight,coastalWaterHeight,coastalWakeOffset,surfaceProfile} from './ocean-height.mjs';
import {Ocean} from './ocean.mjs';
import {RiverView} from './river-view.mjs';
import {TerrainView} from './terrain-view.mjs';
import {DrivePhysics,RAPIER} from './physics.mjs';

assert.equal(ISLANDS.length,3);assert.equal(SANDBARS.length,3);assert.equal(COASTAL_LANDMARKS.length,11);
for(const x of [-25,-14,0,128,386,660])for(const z of [0,-130,-220,-340,-560,-900]){
 assert.equal(islandProfile(x,z).influence,0,'Existing mainland remains outside the archipelago');
 assert.equal(islandTerrainHeight(x,z,123.456),123.456,'No coastal branch height leaks into original terrain');
}
const field=new SandField();let clearance=Infinity,maxGrade=0,routeSamples=0;
for(let i=3;i<COASTAL_LANDMARKS.length;i++){
 const a=COASTAL_LANDMARKS[i-1],b=COASTAL_LANDMARKS[i],length=Math.hypot(b.x-a.x,b.z-a.z),nx=(b.z-a.z)/length,nz=-(b.x-a.x)/length;
 for(let metres=0;metres<=length;metres+=.5){
  const t=metres/length,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;if(x>=-32)continue;
  for(const offset of [-3.4,-.962,.962,3.4]){
   const px=x+nx*offset,pz=z+nz*offset,h=field.height(px,pz);
   for(const time of [0,3,7,13,23])clearance=Math.min(clearance,h-oceanHeight(px,pz,time));
   const material=surfaceAt(px,pz);assert.equal(material.snow+material.volcanic+material.mud,0,'The scenic route never inherits snow, mud or lava');
   assert(material.soft<.3,'The signed driving corridor stays firm enough for a scenic crossing');
   routeSamples++;
  }
  const h0=field.height(x,z),h1=field.height(x+(b.x-a.x)/length*.5,z+(b.z-a.z)/length*.5);
  maxGrade=Math.max(maxGrade,Math.abs(h1-h0)*2);
 }
}
assert(clearance>.65,'A wide low-tide line stays exposed through the complete swell cycle');
assert(maxGrade<.16,'Island approaches have gradual grades, not raised causeway steps');
for(let angle=0;angle<Math.PI*2;angle+=.25)for(const radius of [0,8,17]){
 const x=COASTAL_CAMP.x+Math.cos(angle)*radius,z=COASTAL_CAMP.z+Math.sin(angle)*radius;
 assert(Math.abs(baseHeight(x,z)-COASTAL_CAMP.height)<1e-6,'The entire usable camp clearing is level');
}
for(let i=0;i<24;i++)field.stamp(-60,-186,1,.17,2,0);
assert(field.depthAt(-60,-186)>.04&&field.depthAt(-60,-186)<.08,'Pre-compacted traffic lines deform modestly instead of digging suspension-unloading holes');
const looseField=new SandField();for(let i=0;i<24;i++)looseField.stamp(-147,-204,1,.17,2,0);assert(looseField.deepest<-.1,'Untouched off-route sand still excavates visibly');
assert(field.gridOffset(-119,-372)>0||field.gridOffset(-121,-372)>0,'Excavated island sand is pushed into a shoulder');
assert(surfaceProfile({x:-60,z:-186,slip:0},4,baseHeight(-60,-186),1).dust,'Dry sandbars emit sand, not ocean spray');

const timings=[];let shallowSamples=0,maxBedError=0,coarseShoreTriangles=0,maxOldTriangleError=0,maxTextureError=0;
for(const mobile of [false,true]){
 const scene=new THREE.Scene(),ocean=new Ocean(scene,{mobile}),initial=islandBathymetryStats(),geometry=ocean.mesh.geometry,positions=geometry.attributes.position,beds=geometry.attributes.oceanBed;
 const bedTexture=ocean.islandBedTexture,textureVersion=bedTexture.version;
 assert.equal(bedTexture.type,THREE.HalfFloatType);assert.equal(bedTexture.minFilter,THREE.LinearFilter);assert.equal(bedTexture.generateMipmaps,false);
 assert(bedTexture.image.data.byteLength<350000,'Static shoreline texture adds less than 350KB');
 const textureBed=(x,z)=>{
  const g=ocean.islandBedGrid,a=Math.max(0,Math.min(g.width-1,x-g.x)),b=Math.max(0,Math.min(g.height-1,z-g.z)),i=Math.min(g.width-2,Math.floor(a)),j=Math.min(g.height-2,Math.floor(b)),u=a-i,v=b-j,k=j*g.width+i;
  const h=index=>THREE.DataUtils.fromHalfFloat(bedTexture.image.data[index]);
  return (h(k)*(1-u)+h(k+1)*u)*(1-v)+(h(k+g.width)*(1-u)+h(k+g.width+1)*u)*v;
 };
 assert(initial.ready&&initial.samples===initial.capacity);assert(initial.bytes<700000,'Preloaded bathymetry is bounded on mobile');
 for(let i=0;i<18;i++){
  const start=performance.now();ocean.update({x:-100-i*16,z:-180-i*8},i,{x:0,z:0});timings.push({mobile,ms:performance.now()-start});
  assert.equal(islandBathymetryStats().samples,initial.samples,'Navigating islands never generates new bathymetry');
  assert.equal(ocean.islandBedTexture,bedTexture);assert.equal(bedTexture.version,textureVersion,'Static shoreline texture never uploads again while driving');
  assert.equal(ocean.mesh.geometry,geometry,'Island water reuses its existing geometry and buffers');
  for(let v=0;v<positions.count;v+=97){
   const x=positions.getX(v),z=positions.getZ(v);if(!archipelagoRegion(x,z))continue;
   const bed=islandOceanBed(x,z,baseHeight);
   assert(Math.abs(beds.getX(v)-bed)<.001,'GPU bathymetry matches the CPU waterline after streaming');
   const raw=.3,natural=oceanHeight(x,z,i),rendered=natural+coastalWakeOffset(natural-bed,raw);
   assert(Math.abs(rendered-coastalWaterHeight(x,z,i,1,raw))<1e-6,'Gameplay and rendered water share attenuation and wake depth');
  }
 }
 // A broad horizon triangle can straddle a whole shoal. Sampling its three
 // vertex depths used to create metre-scale false ramps/foam. The packed
 // texture must recover the actual bed at interior pixels, independent of LOD.
 ocean.update({x:-195,z:-210},20,{x:0,z:0});
 const indices=geometry.index.array;
 for(let i=0;i<indices.length;i+=3){
  const a=indices[i],b=indices[i+1],c=indices[i+2],x=(positions.getX(a)+positions.getX(b)+positions.getX(c))/3,z=(positions.getZ(a)+positions.getZ(b)+positions.getZ(c))/3;
  if(!archipelagoRegion(x,z)||Math.max(Math.abs(positions.getX(a)-positions.getX(c)),Math.abs(positions.getZ(a)-positions.getZ(c)))<10)continue;
  const actual=islandOceanBed(x,z,baseHeight);if(actual< -3||actual>2)continue;
  const previous=(beds.getX(a)+beds.getX(b)+beds.getX(c))/3,error=Math.abs(textureBed(x,z)-actual);
  maxOldTriangleError=Math.max(maxOldTriangleError,Math.abs(previous-actual));maxTextureError=Math.max(maxTextureError,error);coarseShoreTriangles++;
  assert(error<.003,'Far-water fragment depth matches the CPU shoreline within half-float precision');
 }
 assert(positions.count<(mobile?18000:34000),'The archipelago does not grow the ocean vertex budget');
 // River and ocean have different geometry attributes. The shared swell must
 // receive this mesh's bed in both its displacement and fragment calculations.
 const sharedSurface=ocean.surfaceNode;let estuarySamples=0;
 ocean.surfaceNode=(x,z,bed)=>{assert.equal(bed?.getAttributeName?.(),'riverBed','Estuary supplies its own bed rather than requesting a missing oceanBed');estuarySamples++;return sharedSurface(x,z,bed)};
 const river=new RiverView(scene,ocean);assert.equal(estuarySamples,2);assert(!river.mesh.geometry.hasAttribute('oceanBed'));river.dispose();ocean.dispose();
}
assert(coarseShoreTriangles>40&&maxOldTriangleError>1,'The regression includes the original coarse-triangle shoreline artifact');
for(let z=-385.37;z<-130;z+=2.17)for(let x=-505.27;x<-32;x+=2.23){
 const h=baseHeight(x,z);if(h<.2&&h>-2.6){maxBedError=Math.max(maxBedError,Math.abs(islandOceanBed(x,z,baseHeight)-h));shallowSamples++;}
}
assert(shallowSamples>3000);assert(maxBedError<.10,'One-metre water bathymetry stays within ten centimetres at shallow margins');

const physics=await DrivePhysics.create(field),view=new TerrainView(new THREE.Scene(),physics,field);
for(const point of [COASTAL_LANDMARKS[3],COASTAL_LANDMARKS[7],COASTAL_CAMP]){
 view.update(point.x,point.z);physics.reset(point.x,point.z,field.height(point.x,point.z));physics.world.step();
 const height=field.height(point.x,point.z),hit=physics.world.castRay(new RAPIER.Ray({x:point.x+3,y:height+4,z:point.z},{x:0,y:-1,z:0}),8,true);
 assert(hit,'The exposed island route has real streamed collision geometry');
 assert(Math.abs(hit.timeOfImpact-(height+4-field.height(point.x+3,point.z)))<.03,'Visible island height and collider height agree');
 const tile=view.tiles.get(`${Math.floor(point.x/32)},${Math.floor(point.z/32)}`);
 assert(tile.mesh.geometry.attributes.islandCoast,'Island dry/wet material coordinates stream with the terrain');
}
view.dispose();physics.dispose();
console.log({routeSamples,minClearance:clearance,maxGrade,shallowSamples,maxBedError,coarseShoreTriangles,maxOldTriangleError,maxTextureError,bathymetry:islandBathymetryStats(),streamTimings:timings});
console.log('Coastal islands: original mainland protection, wide exposed crossings, shallow-water consistency, camp pad, deformation, collision and fixed streaming budget passed');
