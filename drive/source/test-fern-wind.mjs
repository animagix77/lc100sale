// Judge Dean LLC — evaluate the actual foliage vertex displacement after instancing.
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {BeachLife} from './beach-life.mjs';
// Three runs custom positionNode after the instance matrix. Its positionLocal
// already includes riverbank elevation; the position attribute does not.
function evaluate(node,attributes,world){
 const visit=n=>{
  if(n.name==='positionLocal')return world;
  if(n.isInputNode)return n.value;
  if(n._attributeName)return attributes[n._attributeName];
  if(n.nodes)return n.nodes.flatMap(visit);
  if(n.components){const v=visit(n.node??n.sourceNode),parts=[...n.components].map(c=>v['xyzw'.indexOf(c)]);return parts.length===1?parts[0]:parts}
  if(n.node)return visit(n.node);
  const a=n.aNode?visit(n.aNode):undefined,b=n.bNode?visit(n.bNode):undefined;
  const map=fn=>Array.isArray(a)?a.map((v,i)=>fn(v,Array.isArray(b)?b[i]:b)):Array.isArray(b)?b.map(v=>fn(a,v)):fn(a,b);
  if(n.isOperatorNode){const op={'+':(a,b)=>a+b,'-':(a,b)=>a-b,'*':(a,b)=>a*b};assert(op[n.op],n.op);return map(op[n.op])}
  if(n.isMathNode){assert(Math[n.method],n.method);return map((a,b)=>b===undefined?Math[n.method](a):Math[n.method](a,b))}
  throw new Error('Unsupported shader node '+n.constructor.name);
 };return visit(node);
}
for(const mobile of [false,true]){
 const life=new BeachLife(new THREE.Scene(),{mobile}),mesh=life.shrubs,positions=mesh.geometry.attributes.position;
 life.windStrength.value=.65;
 let roots=0,maxMotion=0;
 for(const altitude of [0,14.2,26,108])for(const time of [0,.4,1.3,3,7]){
  life.time.value=time;
  for(let i=0;i<positions.count;i+=4){
   const vertex=[positions.getX(i),positions.getY(i),positions.getZ(i)],world=[248+vertex[0],altitude+vertex[1]*1.6,-336+vertex[2]],attrs={position:vertex,fernPhase:1.7};
   const result=evaluate(mesh.material.positionNode,attrs,world),motion=Math.hypot(...result.map((v,j)=>v-world[j]));maxMotion=Math.max(maxMotion,motion);
   if(vertex[1]<.035001){roots++;assert(motion<1e-6,'Fern roots must stay planted at every riverbank elevation')}
   assert(motion<.05,'Wind moves fronds by centimetres, never airborne metres');
   const seaLevel=[world[0],vertex[1]*1.6,world[2]],other=evaluate(mesh.material.positionNode,attrs,seaLevel);
   result.forEach((v,j)=>assert(Math.abs((v-world[j])-(other[j]-seaLevel[j]))<1e-10,'Elevation cannot amplify foliage motion'));
  }
 }
 assert(roots>50&&maxMotion>.001,'Both anchored roots and moving fronds were exercised');
 life.windStrength.value=0;assert.deepEqual(evaluate(mesh.material.positionNode,{position:[.2,.6,.1],fernPhase:1},[248,15,-336]),[248,15,-336],'Reduced motion keeps the complete fern stationary');
 // A tall rotated meadow tuft must flatten along the tire's WORLD direction,
 // by its scaled height. The custom position node runs after instancing.
 const grassNode=life.grass.material.positionNode;
 const world=[20,13.2,-9],attrs={position:[.1,.6,.22],grassBend:[0,1,-1],grassScaleY:2,windPhase:.8};
 const crushed=evaluate(grassNode,attrs,world);
 assert(Math.abs(crushed[2]-world[2]+1.2)<1e-7);
 assert(Math.abs(crushed[1]-12.024)<1e-7);
 life.windStrength.value=.3;
 for(const t of [0,2,6]){
  life.time.value=t;
  const root=evaluate(grassNode,{...attrs,position:[.1,0,.22]},world);
  assert.deepEqual(root,world,'Contact and wind both leave grass roots anchored');
  const grass=evaluate(grassNode,{...attrs,grassBend:[0,0,0]},world);
  const fern=evaluate(mesh.material.positionNode,{position:attrs.position,fernPhase:attrs.windPhase},world);
  for(const point of [grass,fern]){
   const x=point[0]-world[0],z=point[2]-world[2];
   assert(x>0&&Math.abs(z/x-.32)<1e-7,'Nearby sedges and fern fronds bend along the same prevailing breeze');
  }
 }
 life.dispose();console.log({mobile,roots,maxMotion});
}
