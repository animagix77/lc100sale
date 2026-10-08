import * as THREE from 'three/webgpu';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const C={rubber:'#262a2a',glass:'#203a43',metal:'#bfc5b8',dark:'#414c48',skin:'#c99571',hair:'#493b34'};
const paint=(g,hex)=>{const c=new THREE.Color(hex),a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b}g.setAttribute('color',new THREE.BufferAttribute(a,3));return g};
export function combine(parts){const gs=parts.map(g=>{const a=g.index?g.toNonIndexed():g;for(const k of Object.keys(a.attributes))if(!['position','normal','color'].includes(k))a.deleteAttribute(k);return a});const out=mergeGeometries(gs);for(const g of new Set([...parts,...gs]))g.dispose();out.computeBoundingSphere();return out}
const box=(x,y,z,w,h,d,c)=>paint(new THREE.BoxGeometry(w,h,d).translate(x,y,z),c);
const pebble=(x,y,z,rx,ry,rz,c)=>paint(new THREE.IcosahedronGeometry(1,1).scale(rx,ry,rz).translate(x,y,z),c);
function beam(a,b,r,c){const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),g=new THREE.CylinderGeometry(r*.85,r,p.distanceTo(q),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),q.clone().sub(p).normalize()));g.translate(...p.add(q).multiplyScalar(.5).toArray());return paint(g,c)}
function panel(points,width,c){const s=new THREE.Shape();points.forEach(([z,y],i)=>i?s.lineTo(z,y):s.moveTo(z,y));s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:width,bevelEnabled:true,bevelSize:.045,bevelThickness:.045,bevelSegments:1,steps:1,curveSegments:1});g.translate(0,0,-width/2);g.rotateY(-Math.PI/2);return paint(g,c)}
function wheel(x,y,z,r=.45){const parts=[],t=paint(new THREE.CylinderGeometry(r,r,.32,12),C.rubber);t.rotateZ(Math.PI/2);t.translate(x,y,z);parts.push(t);for(const side of [-1,1]){const hub=paint(new THREE.CylinderGeometry(r*.52,r*.52,.025,8),C.metal);hub.rotateZ(Math.PI/2);hub.translate(x+side*.17,y,z);parts.push(hub);const cap=paint(new THREE.CylinderGeometry(.075,.075,.045,8),C.dark);cap.rotateZ(Math.PI/2);cap.translate(x+side*.19,y,z);parts.push(cap)}for(let i=0;i<14;i++){const a=i*Math.PI/7,g=box(0,0,0,.37,.10,.14,C.rubber);g.rotateX(a);g.translate(x,y+Math.cos(a)*r,z+Math.sin(a)*r);parts.push(g)}return combine(parts)}
export function vehicleGeometry({kind='suv',color='#c8aa70',hood=false,door=false,snow=false}={}){
 const g=[],pickup=kind==='pickup',boxy=kind==='boxy',length=pickup?5.1:boxy?4.05:4.7,front=-length/2,rear=length/2;
 g.push(panel([[front,.62],[front+.12,1.03],[front+.9,1.15],[rear-.15,1.15],[rear,1.0],[rear,.55],[front+.1,.55]],1.85,color));
 g.push(box(0,.49,0,1.5,.18,length-.3,C.dark),box(0,.71,front-.07,2,.22,.20,C.dark),box(0,.68,rear+.04,2,.18,.18,C.dark));
 // Separate hood/engine cavity. Raised hood has a visible hinge and underside.
 const hoodZ=front+.55,hoodG=box(0,0,-.48,1.66,.10,.98,color);
 if(hood){g.push(box(0,1.13,hoodZ,1.54,.10,.90,C.dark),box(0,1.23,hoodZ,.65,.25,.55,'#717a71'),beam([.5,1.3,hoodZ],[.6,1.3,hoodZ+.4],.075,C.rubber));hoodG.rotateX(1.05);hoodG.translate(0,1.22,front+1.1);}else hoodG.translate(0,1.19,front+1.1);g.push(hoodG);
 const cabinFront=front+1.08,cabinRear=pickup?.50:rear-.17,roofFront=cabinFront+.44,roofRear=cabinRear-.14,roofY=boxy?2.08:2.02;
 g.push(panel([[cabinFront,1.16],[roofFront,roofY],[roofRear,roofY],[cabinRear,1.16]],1.70,color));
 const windshield=box(0,0,0,1.48,roofY-1.23,.035,C.glass);windshield.rotateX(.47);windshield.translate(0,(roofY+1.25)/2,cabinFront+.23);g.push(windshield);
 const rearGlass=box(0,0,0,1.48,.55,.03,C.glass);rearGlass.rotateX(-.14);rearGlass.translate(0,1.65,cabinRear-.03);g.push(rearGlass);
 for(const side of [-1,1]){
  const n=pickup?2:boxy?2:3,span=cabinRear-cabinFront-.24,step=span/n;
  for(let i=0;i<n;i++){
   if(door&&side===-1&&i===0)continue;
   const z=cabinFront+.18+i*step+step/2;
   g.push(box(side*.915,1.64,z,.03,.53,step-.10,C.glass),box(side*.977,1.11,z+.14,.06,.055,.20,C.dark));
   g.push(box(side*.969,.87,z+step/2,.016,.43,.018,C.dark));
  }
  g.push(box(side*1.05,1.42,cabinFront+.23,.25,.17,.18,color));
  g.push(box(side*.98,.53,0,.13,.10,length*.58,C.dark));
  if(!pickup)g.push(beam([side*.67,roofY+.14,roofFront+.05],[side*.67,roofY+.14,roofRear-.05],.035,C.dark));
 }
 if(door){const d=combine([box(0,.93,.46,.10,.53,.90,color),box(0,1.55,.46,.075,.67,.92,color),box(-.055,1.60,.46,.025,.50,.77,C.glass),box(-.09,1.03,.76,.06,.06,.16,C.dark)]);d.rotateY(-1.0);d.translate(-.90,0,cabinFront+.08);g.push(d)}
 if(pickup){g.push(box(0,1.20,(.60+rear)/2,1.56,.05,rear-.70,C.dark));for(const side of [-1,1])g.push(box(side*.90,1.35,(.60+rear)/2,.14,.39,rear-.62,color));g.push(box(0,1.34,rear-.05,1.85,.38,.12,color),box(-.42,1.40,1.58,.52,.43,.7,'#887358'))}
 // Deliberately generic silhouettes: round lamps/slotted grille for the short 4x4.
 g.push(box(0,.94,front-.035,1.40,.32,.05,C.dark));
 if(boxy){for(let i=-3;i<=3;i++)g.push(box(i*.115,.95,front-.08,.045,.24,.035,'#a6b1a6'));for(const side of [-1,1]){const lamp=paint(new THREE.CylinderGeometry(.16,.16,.04,10),'#f4dfac');lamp.rotateX(Math.PI/2);lamp.translate(side*.69,1.02,front-.075);g.push(lamp)}const spare=wheel(0,0,0,.42);spare.rotateY(Math.PI/2);spare.translate(0,1.35,rear+.20);g.push(spare);}else for(const side of [-1,1])g.push(box(side*.67,1.02,front-.07,.37,.22,.08,'#e8ddbe'));
 for(const side of [-1,1]){g.push(box(side*.76,.98,rear+.01,.20,.30,.08,'#b95c49'));for(const z of [front+.84,rear-.77]){g.push(wheel(side*.98,.46,z));g.push(box(side*.96,1.00,z,.18,.12,1.05,color));}}
 if(snow){g.push(box(0,roofY+.08,(roofFront+roofRear)/2,1.70,.12,roofRear-roofFront,'#d9e3dc'),box(0,1.27,hoodZ,1.56,.09,.82,'#d9e3dc'))}
 return combine(g);
}
export function personGeometry({pose='seated',woman=false,coat='#ba6549'}={}){
 const g=[],skin=C.skin,hip=pose==='seated'?.53:.96,head=pose==='seated'?1.18:1.67;
 g.push(pebble(0,hip+.27,0,.23,.32,.15,coat),box(0,hip-.03,0,.31,.15,.24,'#344955'));
 for(const s of [-1,1]){
  const a=[s*.12,hip-.05,0],k=pose==='seated'?[s*.18,.46,-.39]:[s*.14,.48,0],f=pose==='seated'?[s*.20,.13,-.47]:[s*.17,.12,-.04];
  g.push(beam(a,k,.10,'#40515d'),beam(k,f,.08,'#40515d'),box(f[0],.075,f[2]-.06,.17,.15,.31,'#343c3b'));
 }
 g.push(beam([0,hip+.48,0],[0,head-.13,-.03],.075,skin),pebble(0,head,pose==='seated'?-.12:0,.145,.19,.14,skin));
 const faceZ=pose==='seated'?-.12:0;g.push(pebble(0,head-.015,faceZ-.145,.038,.042,.038,skin),box(0,head-.085,faceZ-.134,.065,woman?.047:.023,.020,'#5c3933'));for(const side of [-1,1])g.push(box(side*.058,head+.035,faceZ-.127,.035,.021,.02,'#343535'));
 if(woman){g.push(pebble(0,head+.065,.055,.16,.17,.15,C.hair),pebble(0,head,.21,.085,.12,.09,C.hair));}
 else {g.push(pebble(0,head+.13,-.11,.155,.085,.15,'#c9b088'),box(0,head+.12,-.25,.29,.04,.18,'#c9b088'));}
 for(const side of [-1,1]){
  const shoulder=[side*.21,hip+.43,0];
  const elbow=pose==='seated'?[side*.22,hip+.22,-.37]:side===-1?[-.40,1.27,-.08]:[.45,1.52,-.10];
  const hand=pose==='seated'?[side*.12,head-.03,-.23]:side===-1?[-.24,1.12,-.03]:[.67,1.62,-.33];
  g.push(beam(shoulder,elbow,.073,coat),beam(elbow,hand,.057,skin),pebble(...hand,.062,.080,.052,skin));
 }
 if(pose==='seated')g.push(box(0,.23,.04,.56,.45,.44,'#81796e'));
 return combine(g);
}
