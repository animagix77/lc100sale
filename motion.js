// Motion is decorative: all content remains visible without JavaScript or animation.
(()=>{
 const preference=matchMedia('(prefers-reduced-motion: reduce)');
 const active=new Set();
 function animate(node,keyframes,options){
  if(!node||preference.matches||!node.animate)return;
  const animation=node.animate(keyframes,options);active.add(animation);
  animation.onfinish=animation.oncancel=()=>active.delete(animation);return animation;
 }
 function rise(node,delay=0){return animate(node,[{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],{duration:560,delay,easing:'cubic-bezier(.2,.65,.25,1)',fill:'backwards'})}
 let outgoing=null,frameAnimation=null;
 window.lcMotion={
  chapter(){document.querySelectorAll('.tour-copy>*').forEach((node,i)=>{node.getAnimations().forEach(a=>a.cancel());rise(node,i*45)})},
  frame(src){
   const img=document.getElementById('tour-image');if(img.getAttribute('src')===src)return;
   frameAnimation?.cancel();outgoing?.remove();outgoing=null;
   if(!preference.matches&&img.complete&&img.naturalWidth){
    const old=img.cloneNode(false);old.removeAttribute('id');old.removeAttribute('fetchpriority');old.className='orbit-outgoing';old.alt='';old.setAttribute('aria-hidden','true');img.after(old);outgoing=old;
    frameAnimation=animate(old,[{opacity:1},{opacity:0}],{duration:180,easing:'ease-out'});
    if(frameAnimation){const thisAnimation=frameAnimation;thisAnimation.onfinish=thisAnimation.oncancel=()=>{active.delete(thisAnimation);old.remove();if(outgoing===old)outgoing=null}}
   }
   img.src=src;
  }
 };
 if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){observer.unobserve(entry.target);rise(entry.target,Number(entry.target.dataset.revealDelay)||0)}}),{threshold:.08,rootMargin:'0px 0px -24px 0px'});
  document.querySelectorAll('.section-title>*,.condition-grid>article,.timeline>article,.photo-card,.spec-strip>div,.buyer-banner>*,.inspection-evidence>*,.closing>*,.ownership-note,.missing-evidence').forEach((node,i)=>{node.dataset.revealDelay=String(i%3*55);observer.observe(node)});
 }
 document.querySelectorAll('.launch>*').forEach((node,i)=>rise(node,i*65));
 const photo=document.getElementById('photo-large');photo?.addEventListener('load',()=>animate(photo,[{opacity:.3},{opacity:1}],{duration:180,easing:'ease-out'}));
 preference.addEventListener('change',()=>{if(preference.matches){Array.from(active).forEach(a=>a.cancel());outgoing?.remove()}});
})();
