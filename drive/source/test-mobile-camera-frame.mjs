import assert from 'node:assert/strict';
import {PerspectiveCamera,Mesh,BoxGeometry,MeshBasicMaterial,Vector3} from 'three/webgpu';
import {MobileCameraFrame,observeMobileCameraWindow} from './mobile-camera-frame.mjs';
const truck=new Mesh(new BoxGeometry(2.5,2.8,5.5),new MeshBasicMaterial()),frame=new MobileCameraFrame();frame.setSubject(truck);
let checks=0;
for(const [width,height,top,bottom] of [[390,710,320,420],[375,667,320,377],[390,844,320,554],[768,1024,330,730],[1024,768,90,520],[844,390,80,220]]){
 const camera=new PerspectiveCamera(48,width/height,.1,1500);
 for(const altitude of [0,140])for(const yaw of [0,Math.PI/2,Math.PI,-1.2])for(const pitch of [0,.7]){
  frame.restore(camera);truck.position.set(480,altitude,-600);truck.rotation.set(pitch,yaw,.2);
  camera.position.copy(truck.position).add(new Vector3(Math.sin(yaw)*14,5+pitch*14,Math.cos(yaw)*14));
  const safe={width,height,left:width*.1,right:width*.9,top,bottom};
  for(let i=0;i<10;i++){
   const b=frame.apply(camera,truck,safe,1/60);
   assert(b.left*width>=safe.left-.01&&b.right*width<=safe.right+.01,'Truck clipped horizontally');
   assert(b.top*height>=top-.01&&b.bottom*height<=bottom+.01,'Truck hidden behind a mobile overlay');checks++;
  }
  frame.restore(camera);assert.equal(camera.zoom,1);assert(!camera.view?.enabled,'Projection must not leak into the intro, hood view, camp or desktop');
 }
}
const camera=new PerspectiveCamera(48,390/710,.1,1500);truck.position.set(0,0,0);camera.position.set(0,4,13);
frame.apply(camera,truck,{width:390,height:710,top:210,bottom:520},1);
const tight=frame.apply(camera,truck,{width:390,height:710,top:325,bottom:410},1/60);assert(tight.top*710>325&&tight.bottom*710<410);
console.log(`Mobile camera: ${checks} fits across phone/tablet orientations, altitude, pitch and orbit; expanding overlays and camera-mode restoration passed.`);

// Judge Dean LLC — stationary scenery must not zoom or translate when a card
// appears, wraps, collapses or leaves. The same reserve is used when empty.
{
 let gameRect={left:0,top:0,right:390,bottom:844},windowRect={left:14,top:304,right:376,bottom:560},reads=0,rafId=0;
 const listeners=new Map(),frames=new Map(),observers=[];
 const node=rect=>({hidden:false,getClientRects(){return this.hidden?[]:[rect()]},getBoundingClientRect(){reads++;return rect()}});
 const transientRect={left:14,right:376,top:124,bottom:124},tip=node(()=>transientRect),quip=node(()=>transientRect),status=node(()=>({left:14,right:376,top:636,bottom:820}));
 const clearance=node(()=>windowRect),game={...node(()=>gameRect),get clientWidth(){return gameRect.right-gameRect.left},get clientHeight(){return gameRect.bottom-gameRect.top},querySelector(selector){return selector.includes('tip')?tip:selector==='#quip'?quip:selector==='.driving-hud'?status:null}};
 const media={matches:false,addEventListener:(name,fn)=>listeners.set('media',fn),removeEventListener:()=>listeners.delete('media')};
 const view={matchMedia:()=>media,getComputedStyle:()=>({visibility:'visible'}),requestAnimationFrame:fn=>{frames.set(++rafId,fn);return rafId},cancelAnimationFrame:id=>frames.delete(id),addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),ResizeObserver:class{constructor(fn){this.fn=fn;observers.push(this)}observe(){}disconnect(){this.closed=true}},MutationObserver:class{observe(){}disconnect(){}}};
 const doc={getElementById:id=>id==='game'?game:id==='driving-view-window'?clearance:null};
 const observed=observeMobileCameraWindow(doc,view);
 const flush=()=>{for(const fn of frames.values())fn();frames.clear();};
 const notify=()=>{for(const observer of observers)if(!observer.closed)observer.fn();flush();};
 const pose=new Mesh(new BoxGeometry(2.5,2.8,5.5),new MeshBasicMaterial()),subjectFrame=new MobileCameraFrame();subjectFrame.setSubject(pose);
 const camera=new PerspectiveCamera(48,390/844,.1,1500);camera.position.set(0,5,14);
 const first=subjectFrame.apply(camera,pose,observed.current,1),projection=Array.from(camera.projectionMatrix.elements),reserve={...observed.current};
 for(const [name,visible,height] of [['short quip',false,30],['long quip',false,92],['expanded tip',true,168],['changed advice',true,146],['compact at 20s',true,70],['expanded by driver',true,168],['dismissed tip',false,0],['boards notice',false,48],['deep water + boards',false,96]]){
  tip.hidden=!visible;transientRect.bottom=transientRect.top+height;notify();
  assert.deepEqual(observed.current,reserve,`${name} changed the driving window`);
  const bounds=subjectFrame.apply(camera,pose,observed.current,1/60);
  assert.deepEqual(bounds,first,`${name} moved the stationary truck on screen`);
  assert.deepEqual(Array.from(camera.projectionMatrix.elements),projection,`${name} changed perspective`);
 }
 const before=reads;for(let i=0;i<120;i++)subjectFrame.apply(camera,pose,observed.current,1/60);assert.equal(reads,before,'The render loop must not measure DOM text');
 gameRect={left:5,top:10,right:1029,bottom:778};windowRect={left:327,top:90,right:781,bottom:666};media.matches=true;listeners.get('resize')();flush();
 assert.deepEqual(observed.current,{enabled:true,width:1024,height:768,left:322,right:776,top:80,bottom:656},'Orientation changes still update the actual viewport-relative clearance');
 gameRect={left:0,top:0,right:1440,bottom:900};media.matches=false;listeners.get('media')();flush();assert.equal(observed.current.enabled,false,'Desktop keeps the regular chase camera');
 listeners.get('resize')();observed.dispose();assert.equal(frames.size,0);assert.equal(listeners.size,0);assert(observers.every(o=>o.closed));
 console.log('Message stability: nine message states preserve the exact projection and truck position; cached layout, rotation, desktop restore and observer cleanup passed.');
}
