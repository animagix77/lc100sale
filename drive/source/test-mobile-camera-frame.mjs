import assert from 'node:assert/strict';
import {PerspectiveCamera,Mesh,BoxGeometry,MeshBasicMaterial,Vector3} from 'three/webgpu';
import {MobileCameraFrame} from './mobile-camera-frame.mjs';
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
