// Judge Dean LLC — keep the complete vehicle inside the unobscured mobile view.
import {Box3,Vector3} from 'three/webgpu';

export class MobileCameraFrame{
 constructor(){this.corners=[];this.points=Array.from({length:8},()=>new Vector3());this.center=new Vector3();this.zoom=1;this.applied=false;}
 setSubject(subject){
  // Capture the truck before lights, particles and other attached effects exist.
  subject.updateWorldMatrix(true,true);
  const box=new Box3().setFromObject(subject);
  this.corners=[];
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])this.corners.push(subject.worldToLocal(new Vector3(x,y,z)));
 }
 restore(camera){if(!this.applied)return;camera.clearViewOffset();camera.zoom=1;camera.updateProjectionMatrix();this.applied=false;}
 bounds(camera,subject){
  subject.updateWorldMatrix(true,false);camera.updateMatrixWorld();
  const bounds={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
  this.corners.forEach((corner,i)=>{const p=this.points[i].copy(corner).applyMatrix4(subject.matrixWorld).project(camera),x=(p.x+1)/2,y=(1-p.y)/2;bounds.left=Math.min(bounds.left,x);bounds.right=Math.max(bounds.right,x);bounds.top=Math.min(bounds.top,y);bounds.bottom=Math.max(bounds.bottom,y);});
  return bounds;
 }
 apply(camera,subject,{width,height,left=14,right=width-14,top=80,bottom=height-180},dt){
  if(!this.corners.length||right<=left||bottom<=top)return;
  this.restore(camera);
  this.center.set(0,0,0);for(const p of this.corners)this.center.add(p);this.center.multiplyScalar(1/8);subject.localToWorld(this.center);
  // Altitude and steep slopes must never send the aim above the vehicle.
  camera.lookAt(this.center);
  let b=this.bounds(camera,subject);
  const fit=Math.min(1,(right-left)/width/(b.right-b.left)*.9,(bottom-top)/height/(b.bottom-b.top)*.9);
  // Fit the stable driving window. Message visibility never changes this area.
  this.zoom=Math.min(fit,this.zoom+(fit-this.zoom)*(1-Math.exp(-Math.max(0,dt)*3)));
  camera.zoom=this.zoom;camera.updateProjectionMatrix();b=this.bounds(camera,subject);
  camera.setViewOffset(width,height,((b.left+b.right)/2-(left+right)/2/width)*width,((b.top+b.bottom)/2-(top+bottom)/2/height)*height,width,height);
  this.applied=true;return this.bounds(camera,subject);
 }
}

// Measurements are cached on layout changes, never read in the render loop.
export function observeMobileCameraWindow(doc=document,view=window){
 const game=doc.getElementById('game'),clearance=doc.getElementById('driving-view-window'),coarse=view.matchMedia('(any-pointer:coarse)');
 let pending=0,current={enabled:false};
 function measure(){
  pending=0;const width=game.clientWidth,height=game.clientHeight,portrait=height>width;
  current={enabled:coarse.matches||width<=700||(portrait&&width<=1050),width,height};
  if(!current.enabled)return;
  // CSS reserves room for the longest advice/status cards, even while empty.
  // Measuring live text (or its entrance translation) made the whole world
  // lurch on each message, automatic collapse, dismissal and board notice.
  if(!clearance?.getClientRects().length){current.enabled=false;return;}
  const r=clearance.getBoundingClientRect(),g=game.getBoundingClientRect();
  Object.assign(current,{left:r.left-g.left,right:r.right-g.left,top:r.top-g.top,bottom:r.bottom-g.top});
  if(current.right<=current.left||current.bottom<=current.top)current.enabled=false;
 }
 const schedule=()=>{if(!pending)pending=view.requestAnimationFrame(measure);};
 const resize=new view.ResizeObserver(schedule);resize.observe(game);if(clearance)resize.observe(clearance);
 coarse.addEventListener('change',schedule);view.addEventListener('resize',schedule);measure();
 return {get current(){return current;},dispose(){resize.disconnect();coarse.removeEventListener('change',schedule);view.removeEventListener('resize',schedule);if(pending)view.cancelAnimationFrame(pending);}};
}
