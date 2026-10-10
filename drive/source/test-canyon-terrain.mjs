// Judge Dean LLC — canyon collision geometry and abutment regression checks.
import assert from 'node:assert/strict';
import {CANYON,canyonHeight,canyonProfile,canyonRiver} from './canyon.mjs';
import {baseHeight,surfaceAt,SandField} from './terrain.mjs';
import {LANDMARKS} from './expedition.mjs';
const {x,z,height,span}=CANYON;
for(const side of [-1,1])for(let across=-4;across<=4;across+=.5){
 for(let outward=2;outward<=12;outward+=.5){
  const px=x+across,pz=z+side*(span/2+outward);
  assert(Math.abs(baseHeight(px,pz)-height)<1e-7,'Abutment is level with the bridge landing across both tyre paths');
  assert.equal(surfaceAt(px,pz).soft,0,'Anchored approaches cannot bog the tyres');
 }
}
// End-section undersides have at least8cm clearance at both banks.
for(const side of [-1,1])for(let dx=-2.1;dx<=2.1;dx+=.3)for(let inward=-.025;inward<=1.5;inward+=.1){
 const atZ=z+side*(span/2-inward);assert(baseHeight(x+dx,atZ)<79.56-.06*inward,'Bank cannot jack up a timber section from below');
}
for(let atZ=-548;atZ<=-502;atZ+=.5)for(const dx of [-2,0,2]){assert.equal(baseHeight(x+dx,atZ),80,'Long approach provides level turning and alignment room');assert.equal(surfaceAt(x+dx,atZ).soft,0);}
for(let dz=-24;dz<=24;dz+=.5){
 assert(baseHeight(x,z+dz)<height-14,'The bridge spans a genuine terrain gap without an invisible support road');
}
assert(baseHeight(x,z)<height-40,'Deep canyon remains visible below the deck');
const field=new SandField();
assert(Math.abs(field.height(x,z)-baseHeight(x,z))<1e-7,'Streamed collision height samples the same ravine');
for(const [px,pz] of [[248,-336],[475,-346],[493.8,-650.1],[640,-745],[-18,-60],[145,38]]){
 assert.equal(canyonHeight(px,pz,72.123),72.123,'Existing river, lava, coast and camp terrain stays outside the carve');
}
// The carve and smooth feather are continuous at both longitudinal ends and
// canyon rims, avoiding collision seams when streamed terrain tiles meet.
for(const px of [560,602,665,950,1020])for(const pz of [-535,-500,-470,-440,-405]){
 const h=canyonHeight(px,pz,90);
 assert(Number.isFinite(h));
 assert(Math.abs(canyonHeight(px+.0001,pz,90)-h)<.005);
 assert(Math.abs(canyonHeight(px,pz+.0001,90)-h)<.005);
 assert(canyonProfile(px,pz).influence>=0&&canyonProfile(px,pz).influence<=1);
}
// Check both tyre lanes along the new graded approaches, including the turn
// away from the far landing. Dynamic bridge traversal has its own physics test.
let maxGrade=0,maxCrossGrade=0;
const entryIndex=LANDMARKS.findIndex(p=>p.name==='Canyon bridge');
assert(entryIndex>0,'The canyon belongs to the continuous expedition');
for(let i=entryIndex-1;i<=entryIndex+2;i++){
 const a=LANDMARKS[i],b=LANDMARKS[i+1],length=Math.hypot(b.x-a.x,b.z-a.z),dx=(b.x-a.x)/length,dz=(b.z-a.z)/length;
 for(let t=0;t<length-.5;t+=.5){
  const px=a.x+dx*t,pz=a.z+dz*t;
  if(i===entryIndex&&pz>z-span/2-2&&pz<z+span/2+2)continue;
  for(const offset of [-.9,.9]){
   const tx=px+dz*offset,tz=pz-dx*offset;
   maxGrade=Math.max(maxGrade,Math.abs(baseHeight(tx+dx*.5,tz+dz*.5)-baseHeight(tx,tz))/.5);
  }
  maxCrossGrade=Math.max(maxCrossGrade,Math.abs(baseHeight(px+dz*.9,pz-dx*.9)-baseHeight(px-dz*.9,pz+dx*.9))/1.8);
 }
}
assert(maxGrade<.58,'Bridge approaches avoid abrupt terrain steps along either tyre lane');
assert(maxCrossGrade<.14,'Landing turns do not impose a steep lateral bank');
console.log({floor:baseHeight(x,z),drop:height-baseHeight(x,z),span,anchors:[baseHeight(x,z-span/2),baseHeight(x,z+span/2)]});
console.log({maxGrade,maxCrossGrade});
console.log('Canyon terrain, open span and firm abutment checks passed');

// River surface has one downstream grade and sits in a genuinely incised bed.
let previousWater=Infinity;
for(let px=602;px<=950;px+=6){
 const river=canyonRiver(px);assert(river.level<previousWater,'Water flows continuously downhill toward +X');previousWater=river.level;
 assert(Math.abs(baseHeight(px,river.z)-(river.level-.85))<1e-6,'River has a consistent physical bed rather than floating over a hollow');
 for(const side of [-1,1])assert(baseHeight(px,river.z+side*(river.halfWidth+3))>river.level+.35,'Dry gravel banks contain the ribbon');
 const p=canyonProfile(px,river.z),surface=surfaceAt(px,river.z);assert(p.exposedRock>.99);assert(surface.grass<1e-6,'Exposed canyon floor cannot grow grass');assert(surface.soft<1e-6,'Canyon rock is not loose sand');
 for(const side of [-1,1]){const pz=river.z+side*24,wall=canyonProfile(px,pz);if(wall.exposedRock>.999)assert(surfaceAt(px,pz).grass<1e-6,'Exposed cliffs cannot grow grass');}
}
console.log('Canyon shelves, bare rock and descending incised river checks passed');
