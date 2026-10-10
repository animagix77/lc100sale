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
  // Fit immediately when UI expands; ease back in when the clear area grows.
  this.zoom=Math.min(fit,this.zoom+(fit-this.zoom)*(1-Math.exp(-Math.max(0,dt)*3)));
  camera.zoom=this.zoom;camera.updateProjectionMatrix();b=this.bounds(camera,subject);
  camera.setViewOffset(width,height,((b.left+b.right)/2-(left+right)/2/width)*width,((b.top+b.bottom)/2-(top+bottom)/2/height)*height,width,height);
  this.applied=true;return this.bounds(camera,subject);
 }
}

// Measurements are cached on layout changes, never read in the render loop.
export function observeMobileCameraWindow(doc=document,view=window){
 const game=doc.getElementById('game'),coarse=view.matchMedia('(any-pointer:coarse)');
 const nodes=['.topbar','.expedition-map','.destination .trail-tip','.bottom','#quip','.driving-hud','#journey-controls','.drive-range','#joystick','#ebrake'].map(s=>game.querySelector(s)).filter(Boolean);
 let pending=0,current={enabled:false};
 const rect=selector=>{const e=game.querySelector(selector);if(!e||!e.getClientRects().length||view.getComputedStyle(e).visibility==='hidden')return null;return e.getBoundingClientRect();};
 function measure(){
  pending=0;const width=game.clientWidth,height=game.clientHeight,portrait=height>width;
  current={enabled:coarse.matches||width<=700||(portrait&&width<=1050),width,height,left:14,right:width-14,top:72,bottom:height-24};
  if(!current.enabled)return;
  if(portrait){
   for(const selector of ['.expedition-map','.destination .trail-tip','#quip','.bottom']){const r=rect(selector);if(r)current.top=Math.max(current.top,r.bottom+12);}
   const hud=rect('.driving-hud');if(hud)current.bottom=hud.top-12;
  }else{
   const stick=rect('#joystick'),brake=rect('#ebrake');current.left=Math.max(14,stick?stick.right+16:width*.20);current.right=Math.min(width-14,brake?brake.left-16:width*.80);
   const header=rect('.topbar');if(header)current.top=Math.max(current.top,header.bottom+10);
   // On a wide screen, use the space between advice and the map instead of
   // squeezing the truck into the sliver below both navigation columns.
   const tip=rect('.destination .trail-tip'),map=rect('.expedition-map');
   if(tip&&tip.right>current.left){if(current.right-tip.right>width*.22)current.left=tip.right+12;else current.top=Math.max(current.top,tip.bottom+10);}
   if(map&&map.left<current.right&&map.left-current.left>width*.22)current.right=map.left-12;
   for(const selector of ['#journey-controls','.drive-range','.bottom']){const r=rect(selector);if(r&&r.left<current.right&&r.right>current.left)current.bottom=Math.min(current.bottom,r.top-12);}
  }
 }
 const schedule=()=>{if(!pending)pending=view.requestAnimationFrame(measure);};
 const resize=new view.ResizeObserver(schedule);resize.observe(game);nodes.forEach(e=>resize.observe(e));
 const mutations=new view.MutationObserver(schedule);for(const e of nodes)mutations.observe(e,{attributes:true,attributeFilter:['class','hidden']});
 coarse.addEventListener('change',schedule);view.addEventListener('resize',schedule);measure();
 return {get current(){return current;},dispose(){resize.disconnect();mutations.disconnect();coarse.removeEventListener('change',schedule);view.removeEventListener('resize',schedule);if(pending)view.cancelAnimationFrame(pending);}};
}
