// Motion is decorative: all content remains visible without JavaScript or animation.
(()=>{
 const preference=matchMedia('(prefers-reduced-motion: reduce)');
 const active=new Set();
 function animate(node,keyframes,options){
  if(!node||preference.matches||!node.animate)return;
  const animation=node.animate(keyframes,options);active.add(animation);
  animation.onfinish=animation.oncancel=()=>active.delete(animation);return animation;
 }
 function rise(node,delay=0){return animate(node,[{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],{duration:720,delay,easing:'cubic-bezier(.22,.61,.36,1)',fill:'backwards'})}
 let outgoing=null,outgoingBackdrop=null,frameAnimation=null;
 const textAnimations=new Set();
 function clearText(){for(const a of textAnimations){a.cancel();active.delete(a)}textAnimations.clear();}
 function reveal(node,delay=0,line=false){
  const frames=line?[{transform:'translateY(115%)'},{transform:'translateY(0)'}]:[{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}];
  const a=animate(node,frames,{duration:line?720:460,delay,easing:'cubic-bezier(.22,.61,.36,1)',fill:'backwards'});
  if(a){textAnimations.add(a);a.onfinish=a.oncancel=()=>{textAnimations.delete(a);active.delete(a)}}
 }
 function wrapLine(node){
  node.classList.add('text-mask');
  const ink=document.createElement('span');ink.className='masked-ink';
  ink.append(...Array.from(node.childNodes));node.append(ink);return ink;
 }
 const launch=document.getElementById('launch');
 const launchLines=Array.from(launch.querySelectorAll('h1>span,h1>em'),wrapLine);
 function intro(){
  clearText();if(preference.matches)return;
  reveal(launch.querySelector('.eyebrow'));
  launchLines.forEach((line,i)=>reveal(line,70+i*100,true));
  reveal(launch.querySelector('.intro'),300);reveal(launch.querySelector('.asking-note'),380);
 }

 window.lcMotion={
  intro,
  chapter(index){
   clearText();
   const title=document.getElementById('tour-title');
   const lines=title.innerHTML.split(/<br\s*\/?\s*>/i);
   title.replaceChildren(...lines.map(text=>{const mask=document.createElement('span');mask.className='text-mask';mask.textContent=text;wrapLine(mask);return mask}));
   if(preference.matches)return;
   reveal(document.getElementById('chapter'));reveal(document.getElementById('tag'),50);
   title.querySelectorAll('.masked-ink').forEach((line,i)=>reveal(line,70+i*100,true));
   reveal(document.getElementById('tour-body'),280);reveal(document.getElementById('tour-issue-link'),360);
  },
  frame(src){
   const img=document.getElementById('tour-image');if(img.getAttribute('src')===src)return;
   frameAnimation?.cancel();outgoing?.remove();outgoingBackdrop?.remove();outgoing=null;outgoingBackdrop=null;
   if(!preference.matches&&img.complete&&img.naturalWidth){
    const backdrop=document.querySelector('.orbit-backdrop');const oldBackdrop=backdrop.cloneNode(false);oldBackdrop.style.backgroundImage=getComputedStyle(backdrop).backgroundImage;backdrop.after(oldBackdrop);outgoingBackdrop=oldBackdrop;
    const old=img.cloneNode(false);old.removeAttribute('id');old.removeAttribute('fetchpriority');old.className='orbit-outgoing';old.alt='';old.setAttribute('aria-hidden','true');img.after(old);outgoing=old;
    frameAnimation=animate(old,[{opacity:1},{opacity:0}],{duration:140,easing:'ease-out'});animate(oldBackdrop,[{opacity:1},{opacity:0}],{duration:140,easing:'ease-out'});
    if(frameAnimation){const thisAnimation=frameAnimation;thisAnimation.onfinish=thisAnimation.oncancel=()=>{active.delete(thisAnimation);old.remove();oldBackdrop.remove();if(outgoing===old)outgoing=null;if(outgoingBackdrop===oldBackdrop)outgoingBackdrop=null}}
   }
   img.src=src;
  }
 };
 if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){observer.unobserve(entry.target);rise(entry.target,Number(entry.target.dataset.revealDelay)||0)}}),{threshold:.08,rootMargin:'0px 0px -24px 0px'});
  document.querySelectorAll('.section-title>*,.condition-grid>article,.timeline>article,.photo-card,.spec-strip>div,.buyer-banner>*,.inspection-evidence>*,.closing>*,.ownership-note,.missing-evidence,.engine-history>*').forEach((node,i)=>{node.dataset.revealDelay=String(i%3*55);observer.observe(node)});
 }
 // The scroll controller starts the intro reveal when that section is visible.
 const photo=document.getElementById('photo-large');photo?.addEventListener('load',()=>animate(photo,[{opacity:.3},{opacity:1}],{duration:180,easing:'ease-out'}));
 preference.addEventListener('change',()=>{if(preference.matches){Array.from(active).forEach(a=>a.cancel());outgoing?.remove();outgoingBackdrop?.remove()}});
})();
