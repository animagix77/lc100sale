// Judge Dean LLC — canvas-only orbit leaves driving fingers independent.
export function createTouchCamera({canvas,orbit,enabled=()=>true,onDrag=()=>{}}){
 const listeners=[];let pointer=null,startX=0,startY=0,lastX=0,lastY=0,scale=1,dragging=false,disposed=false;
 const canLook=()=>!disposed&&enabled();
 const originalTouchAction=canvas.style.getPropertyValue('touch-action');
 canvas.style.setProperty('touch-action','none');
 function listen(target,type,fn){target.addEventListener(type,fn,{passive:false});listeners.push([target,type,fn])}
 function reset(){
  const id=pointer;pointer=null;dragging=false;orbit.endDrag();
  try{if(id!==null&&canvas.hasPointerCapture(id))canvas.releasePointerCapture(id)}catch{/* Pointer already cancelled. */}
 }
 listen(canvas,'pointerdown',e=>{
  if(!canLook()||pointer!==null||e.button!==0)return;
  // Do not require isPrimary: the first finger may already be on the joystick.
  pointer=e.pointerId;startX=lastX=e.clientX;startY=lastY=e.clientY;
  const rect=canvas.getBoundingClientRect();scale=Math.max(1,Math.min(rect.width,rect.height));
  e.preventDefault();try{canvas.setPointerCapture(pointer)}catch{/* Detached canvas. */}
 });
 listen(canvas,'pointermove',e=>{
  if(e.pointerId!==pointer)return;
  if(!canLook()){reset();return}
  e.preventDefault();
  if(!dragging){
   if(Math.hypot(e.clientX-startX,e.clientY-startY)<6)return;
   dragging=true;orbit.beginDrag();onDrag();
  }
  orbit.drag(-(e.clientX-lastX)*Math.PI/scale,-(e.clientY-lastY)*1.8/scale);
  lastX=e.clientX;lastY=e.clientY;
 });
 for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(canvas,type,e=>{
  if(e.pointerId!==pointer)return;e.preventDefault();reset();
 });
 const view=canvas.ownerDocument?.defaultView;
 if(view){listen(view,'blur',reset);listen(view,'resize',reset)}
 return {reset,dispose(){
  if(disposed)return;disposed=true;reset();
  for(const [target,type,fn] of listeners)target.removeEventListener(type,fn);
  if(originalTouchAction)canvas.style.setProperty('touch-action',originalTouchAction);else canvas.style.removeProperty('touch-action');
 }};
}
