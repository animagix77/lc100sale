// Four registered photographic planes. The original photo remains the accessible fallback.
(() => {
 const photo=document.querySelector('#photo-15-beach-penthouse .photo-open');
 if(!photo)return;
 const eligible=matchMedia('(min-width:701px) and (hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)');
 const planes=[['sky',3,2],['dunes',7,4],['contact',15,4],['camp',15,4],['foreground',25,8]];
 let stage=null,loading=false,ready=false,visible=false,frame=0,last=0,x=0,y=0,targetX=0,targetY=0;
 const reset=()=>{targetX=targetY=x=y=0;cancelAnimationFrame(frame);frame=0;last=0;stage?.querySelectorAll('img').forEach(img=>img.style.removeProperty('transform'));};
 function tick(time){
  frame=0;
  if(!ready||!visible||!eligible.matches||document.hidden){reset();return;}
  const dt=last?Math.min(time-last,48):16;last=time;
  const ease=1-Math.exp(-dt/145);x+=(targetX-x)*ease;y+=(targetY-y)*ease;
  stage.querySelectorAll('img').forEach((img,i)=>{const [,dx,dy]=planes[i];img.style.transform=`translate3d(${(-x*dx).toFixed(3)}px,${(-y*dy).toFixed(3)}px,0) scale(1.065)`;});
  if(Math.abs(targetX-x)+Math.abs(targetY-y)>.001)frame=requestAnimationFrame(tick);else last=0;
 }
 function queue(){if(!frame&&ready&&visible&&eligible.matches&&!document.hidden)frame=requestAnimationFrame(tick);}
 async function load(){
  if(loading||ready||!eligible.matches)return;loading=true;
  const next=document.createElement('span');next.className='camp-depth';next.setAttribute('aria-hidden','true');
  try{
   await Promise.all(planes.map(async([name])=>{const img=new Image();img.alt='';img.draggable=false;img.className=`camp-plane camp-${name}`;img.decoding='async';img.src=`assets/camp-parallax/${name}.${name==='contact'?'svg':'webp'}`;next.append(img);await img.decode();}));
   stage=next;photo.append(stage);ready=true;photo.classList.toggle('camp-depth-ready',eligible.matches);
  }catch{next.remove();}finally{loading=false;}
 }
 photo.addEventListener('pointermove',event=>{
  if(event.pointerType!=='mouse'||!eligible.matches)return;
  const rect=photo.getBoundingClientRect();
  targetX=Math.max(-1,Math.min(1,2*(event.clientX-rect.left)/rect.width-1));
  targetY=Math.max(-1,Math.min(1,2*(event.clientY-rect.top)/rect.height-1));queue();
 },{passive:true});
 photo.addEventListener('pointerleave',()=>{targetX=targetY=0;queue();});
 photo.addEventListener('dragstart',event=>{if(ready&&eligible.matches)event.preventDefault();});
 photo.addEventListener('blur',()=>{targetX=targetY=0;queue();});
 const preload=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))load();},{rootMargin:'400px'});
 const visibility=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible)reset();});
 preload.observe(photo);visibility.observe(photo);
 eligible.addEventListener('change',()=>{reset();photo.classList.toggle('camp-depth-ready',ready&&eligible.matches);if(eligible.matches&&visible)load();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
 window.addEventListener('resize',reset,{passive:true});
})();
