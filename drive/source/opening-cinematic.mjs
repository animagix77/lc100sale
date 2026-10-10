// Judge Dean LLC — a terrain-safe opening shot with an explicit driving handoff.
import * as THREE from 'three/webgpu';
const ease=t=>t*t*(3-2*t);
export class OpeningShot{
 constructor(){this.active=false;this.time=0;this.position=new THREE.Vector3();this.aim=new THREE.Vector3();this.rotation=new THREE.Quaternion();this.matrix=new THREE.Matrix4();}
 start(camera,{anchor,forward,resumed=false,reduced=false,heightAt=()=>-Infinity,waterAt=()=>-Infinity}){
  this.time=0;this.duration=resumed?4.2:10;this.active=!reduced;this.heightAt=heightAt;this.waterAt=waterAt;
  this.end={position:camera.position.clone(),quaternion:camera.quaternion.clone(),fov:camera.fov};
  this.anchor=new THREE.Vector3(anchor.x,anchor.y+.65,anchor.z);const f=new THREE.Vector3(forward.x,0,forward.z).normalize(),r=new THREE.Vector3(-f.z,0,f.x);
  const framing=Math.max(1,Math.min(1.75,.85/camera.aspect));
  const point=([side,y,ahead])=>this.anchor.clone().addScaledVector(r,side*framing).addScaledVector(f,ahead*framing).add(new THREE.Vector3(0,y,0));
  const offsets=resumed?[[-8,5,8],[-10,5,-2]]:[[-23,12,18],[-15,7,12],[-9,2.3,6],[-9,2.9,-5]];
  const points=offsets.map(point);points.push(this.end.position.clone());this.path=new THREE.CatmullRomCurve3(points,false,'centripetal');
  if(this.active)this.apply(camera);return this.active;
 }
 apply(camera){
  const t=Math.min(1,this.time/this.duration),u=ease(t);this.path.getPoint(u,this.position);
  this.position.y=Math.max(this.position.y,this.heightAt(this.position.x,this.position.z)+1.3,this.waterAt(this.position.x,this.position.z)+1.5);
  this.matrix.lookAt(this.position,this.anchor,new THREE.Vector3(0,1,0));this.rotation.setFromRotationMatrix(this.matrix);
  // Blend into the exact existing chase/camp pose, avoiding a snap at control handoff.
  const handoff=ease(Math.max(0,(t-.90)/.10));this.rotation.slerp(this.end.quaternion,handoff);
  camera.position.copy(this.position);camera.quaternion.copy(this.rotation);camera.fov=48+(this.end.fov-48)*handoff;camera.updateProjectionMatrix();
  return t;
 }
 update(dt,camera){if(!this.active)return false;this.time+=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));this.apply(camera);if(this.time>=this.duration)this.finish(camera);return this.active;}
 finish(camera){if(!this.end)return;camera.position.copy(this.end.position);camera.quaternion.copy(this.end.quaternion);camera.fov=this.end.fov;camera.updateProjectionMatrix();this.active=false;}
}
export class OpeningCinematic{
 constructor({camera,onFinish=()=>{},document:doc=document}){
  this.camera=camera;this.doc=doc;this.onFinish=onFinish;this.shot=new OpeningShot();this.active=false;
  this.dialog=doc.createElement('dialog');this.dialog.className='opening-film';this.dialog.setAttribute('aria-label','Opening cinematic');
  this.dialog.innerHTML='<div class="opening-frame" aria-hidden="true"></div><div class="opening-titles"><p class="opening-eyebrow">JUDGE DEAN LLC PRESENTS</p><h1>LC<span>100</span></h1><p class="opening-name">OFF THE CLOCK</p><p class="opening-line">No errands. Just adventure.</p></div><p class="opening-chapter" aria-live="polite"></p><button class="opening-skip" type="button">Skip intro <span aria-hidden="true">↗</span></button>';
  doc.body.append(this.dialog);this.chapter=this.dialog.querySelector('.opening-chapter');this.titles=this.dialog.querySelector('.opening-titles');this.skip=this.dialog.querySelector('.opening-skip');
  this.cancel=e=>{e.preventDefault();this.finish()};this.click=()=>this.finish();this.key=e=>{if(!this.active||e.metaKey||e.ctrlKey||e.altKey)return;if(['Escape','Enter','Space'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)this.finish();}else if(['KeyW','KeyA','KeyS','KeyD','KeyL','KeyK','KeyR','KeyC','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();}};
  this.dialog.addEventListener('cancel',this.cancel);this.skip.addEventListener('click',this.click);doc.addEventListener('keydown',this.key,true);
 }
 start(options){if(this.active)this.finish();if(!this.shot.start(this.camera,options))return false;this.resumed=options.resumed;this.titles.hidden=!!this.resumed;this.active=true;this.dialog.dataset.resumed=String(!!this.resumed);this.doc.documentElement.classList.add('opening-cinematic');this.dialog.showModal();this.skip.focus({preventScroll:true});this.paint();return true;}
 paint(){const t=this.shot.time/this.shot.duration;this.dialog.style.setProperty('--opening-fade',String(Math.min(1,this.shot.time/.75,(this.shot.duration-this.shot.time)/.7)));this.titles.style.opacity=String(this.resumed?0:1-ease(Math.min(1,Math.max(0,(t-.38)/.18))));const text=this.resumed?'Your expedition continues.':t<.46?'THE COAST IS ONLY THE BEGINNING':t<.78?'FIND YOUR OWN WAY':'TAKE THE WHEEL';if(this.chapter.textContent!==text)this.chapter.textContent=text;}
 update(dt){if(!this.active)return;this.shot.update(dt,this.camera);this.paint();if(!this.shot.active)this.finish();}
 finish(){if(!this.active)return;this.active=false;this.shot.finish(this.camera);this.dialog.close();this.doc.documentElement.classList.remove('opening-cinematic');this.onFinish();}
 dispose(){this.active=false;this.shot.finish(this.camera);this.dialog.removeEventListener('cancel',this.cancel);this.skip.removeEventListener('click',this.click);this.doc.removeEventListener('keydown',this.key,true);this.dialog.remove();this.doc.documentElement.classList.remove('opening-cinematic');}
}
