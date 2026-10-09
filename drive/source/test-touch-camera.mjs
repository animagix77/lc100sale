// Judge Dean LLC — drag lifecycle and independent touch driving regression.
import assert from 'node:assert/strict';
import {CameraOrbit,TOUCH_CAMERA_HOLD} from './camera-orbit.mjs';
import {createTouchCamera} from './touch-camera.mjs';
import {createTouchControls} from './touch-controls.mjs';
class Element{
 constructor(rect={left:0,top:0,width:390,height:844}){
  this.rect=rect;this.listeners=new Map();this.captures=new Set();const styles=new Map(),classes=new Set();
  this.style={getPropertyValue:k=>styles.get(k)||'',setProperty:(k,v)=>styles.set(k,v),removeProperty:k=>styles.delete(k)};
  this.classList={add:k=>classes.add(k),remove:k=>classes.delete(k),toggle:(k,on)=>on?classes.add(k):classes.delete(k)};
 }
 getBoundingClientRect(){return this.rect} setAttribute(){}
 addEventListener(t,f){if(!this.listeners.has(t))this.listeners.set(t,new Set());this.listeners.get(t).add(f)}
 removeEventListener(t,f){this.listeners.get(t)?.delete(f)}
 setPointerCapture(id){this.captures.add(id)} hasPointerCapture(id){return this.captures.has(id)}
 releasePointerCapture(id){this.captures.delete(id);this.emit('lostpointercapture',{pointerId:id})}
 emit(type,props={}){const e={pointerId:2,pointerType:'touch',button:0,isPrimary:false,clientX:200,clientY:300,defaultPrevented:false,preventDefault(){this.defaultPrevented=true},...props};for(const f of this.listeners.get(type)||[])f(e);return e}
}
const view=new Element(),doc=new Element();doc.defaultView=view;
const canvas=new Element();canvas.ownerDocument=doc;canvas.style.setProperty('touch-action','pan-y');
const orbit=new CameraOrbit();let enabled=true,drags=0;
const controls=createTouchCamera({canvas,orbit,enabled:()=>enabled,onDrag:()=>drags++});
const tick=seconds=>{for(let i=0;i<Math.round(seconds*60);i++)orbit.update(1/60,new Set())};
canvas.emit('pointerdown');canvas.emit('pointermove',{clientX:202});canvas.emit('pointerup');
assert.equal(drags,0);assert.equal(orbit.active,false,'a tap is not a camera change');
const joystick=new Element({left:0,top:0,width:140,height:140}),ebrake=new Element();ebrake.ownerDocument=doc;
const driving=createTouchControls({joystick,ebrake});
joystick.emit('pointerdown',{pointerId:1,clientX:70,clientY:0});ebrake.emit('pointerdown',{pointerId:3});
const driveState={...driving.state};assert(driveState.gas>0&&driveState.handbrake);
canvas.emit('pointerdown');canvas.emit('pointermove',{clientX:300,clientY:240});
assert.equal(drags,1);assert(orbit.yaw<-.7&&orbit.pitch>.2,'horizontal and vertical swipes orbit');
assert.deepEqual(driving.state,driveState,'camera finger leaves both driving fingers alone');
const yaw=orbit.yaw,pitch=orbit.pitch;
canvas.emit('pointerdown',{pointerId:4});canvas.emit('pointermove',{pointerId:4,clientX:10});canvas.emit('pointerup',{pointerId:4});
assert.equal(orbit.yaw,yaw);assert(orbit.dragging,'another scenery finger cannot steal the gesture');
tick(8);assert.equal(orbit.yaw,yaw,'no recenter while the camera finger is held');
canvas.emit('pointerup');assert(!orbit.dragging&&!canvas.captures.size);tick(TOUCH_CAMERA_HOLD-.1);
assert.equal(orbit.yaw,yaw,'view is held for five seconds after release');tick(.2);
assert(!orbit.active&&Math.abs(orbit.yaw)<Math.abs(yaw));tick(3);assert.equal(orbit.yaw,0);assert.equal(orbit.pitch,0);
assert.deepEqual(driving.state,driveState,'automatic return never changes driving input');
// A new drag restarts the timer; arrow-key camera input keeps its existing hold.
canvas.emit('pointerdown');canvas.emit('pointermove',{clientX:260});canvas.emit('pointerup');tick(4);
canvas.emit('pointerdown');canvas.emit('pointermove',{clientX:270});canvas.emit('pointerup');tick(4);assert(orbit.active);
orbit.nudge('ArrowRight');tick(8);assert(orbit.active&&orbit.returnAfter===null);
for(const event of ['pointercancel','lostpointercapture']){
 canvas.emit('pointerdown');canvas.emit('pointermove',{clientX:250});canvas.emit(event);assert(!orbit.dragging&&!canvas.captures.size);tick(8);assert.equal(orbit.yaw,0);
}
for(const event of ['blur','resize']){
 canvas.emit('pointerdown');canvas.emit('pointermove',{clientX:270});view.emit(event);assert(!orbit.dragging&&!canvas.captures.size);
}
canvas.emit('pointerdown');canvas.emit('pointermove',{clientX:250});enabled=false;canvas.emit('pointermove',{clientX:260});assert(!orbit.dragging&&!canvas.captures.size);
assert(!canvas.emit('pointerdown').defaultPrevented,'disabled or paused view cannot capture');enabled=true;
assert(!canvas.emit('pointerdown',{button:2}).defaultPrevented,'secondary buttons remain untouched');
canvas.emit('pointerdown');canvas.emit('pointermove',{clientX:50000,clientY:-50000});assert(Math.abs(orbit.yaw)<=Math.PI&&orbit.pitch<=1.15);
controls.reset();assert(!orbit.dragging&&!canvas.captures.size);const resetYaw=orbit.yaw;canvas.emit('pointermove',{clientX:0});assert.equal(orbit.yaw,resetYaw);
controls.dispose();controls.dispose();driving.dispose();assert.equal(canvas.style.getPropertyValue('touch-action'),'pan-y');
assert([...canvas.listeners.values(),...view.listeners.values(),...doc.listeners.values()].every(s=>s.size===0));
canvas.emit('pointerdown');assert.equal(canvas.captures.size,0);
// Equal automatic-return behavior at the supported render rates.
const results=[30,60,120].map(fps=>{const o=new CameraOrbit();o.beginDrag();o.drag(1,.3);o.endDrag();for(let i=0;i<fps*7;i++)o.update(1/fps,new Set());return o});
assert(results.every(o=>Math.abs(o.yaw)<.0001&&Math.abs(o.pitch)<.0001&&!o.active));
console.log('Touch camera passed: drag, tap threshold, multitouch driving, hold/restart/return, keyboard handoff, cancellation, pause guard, resize, disposal and frame rates.');
