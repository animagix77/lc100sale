// Motion is decorative: all content remains visible without JavaScript or animation.
(()=>{
 const preference=matchMedia('(prefers-reduced-motion: reduce)');
 const active=new Set();
 function animate(node,keyframes,options){
  if(!node||preference.matches||!node.animate)return;
  const animation=node.animate(keyframes,options);active.add(animation);
  animation.onfinish=animation.oncancel=()=>active.delete(animation);return animation;
 }
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
 const ensureMask=node=>node?.querySelector(':scope>.masked-ink')||wrapLine(node);
 ['.eyebrow','.intro','.asking-note'].forEach(selector=>ensureMask(launch.querySelector(selector)));
 let pendingChange=null,exiting=false;
 function finishExit(){
  clearText();exiting=false;const change=pendingChange;pendingChange=null;change?.();
 }
 function transition(change,direction=1,initial=false){
  pendingChange=change;
  if(initial||preference.matches||!launch.animate){finishExit();return;}
  if(exiting)return; // Finish the current exit, then reveal only the latest requested chapter.
  exiting=true;
  const root=launch.hidden?document.querySelector('.tour-copy'):launch;
  const ink=Array.from(root.querySelectorAll('.masked-ink'));
  const other=Array.from(root.querySelectorAll('.button,#tour-evidence')).filter(node=>!node.hidden);
  const starts=[...ink,...other].map(node=>({node,transform:getComputedStyle(node).transform,opacity:getComputedStyle(node).opacity}));
  clearText();
  const animations=starts.map(({node,transform,opacity},i)=>{
   const masked=node.classList.contains('masked-ink');
   const a=animate(node,[{transform,opacity},{transform:`translateY(${masked?(direction<0?115:-115):direction<0?8:-8}${masked?'%':'px'})`,opacity:masked?1:0}],{duration:masked?420:260,delay:masked?Math.min(i*35,70):0,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
   if(a)textAnimations.add(a);return a?.finished.catch(()=>{});
  });
  Promise.all(animations).then(()=>{if(exiting)finishExit()});
 }
 function intro(){
  clearText();if(preference.matches)return;
  reveal(ensureMask(launch.querySelector('.eyebrow')));
  launchLines.forEach((line,i)=>reveal(line,70+i*100,true));
  reveal(ensureMask(launch.querySelector('.intro')),300);reveal(ensureMask(launch.querySelector('.asking-note')),380);
 }

 window.lcMotion={
  intro,transition,
  detail(node){animate(node,[{opacity:0,transform:'scale(1.16)'},{opacity:1,transform:'scale(1)'}],{duration:700,easing:'cubic-bezier(.22,.61,.36,1)',fill:'backwards'})},
  chapter(index){
   clearText();
   const title=document.getElementById('tour-title');
   const lines=title.innerHTML.split(/<br\s*\/?\s*>/i);
   title.replaceChildren(...lines.map(text=>{const mask=document.createElement('span');mask.className='text-mask';mask.textContent=text;wrapLine(mask);return mask}));
   const chapter=ensureMask(document.getElementById('chapter')),tag=ensureMask(document.getElementById('tag'));
   const body=ensureMask(document.getElementById('tour-body')),link=ensureMask(document.getElementById('tour-issue-link'));
   if(preference.matches)return;
   reveal(chapter);reveal(tag,50);
   title.querySelectorAll('.masked-ink').forEach((line,i)=>reveal(line,70+i*100,true));
   reveal(body,280);reveal(link,360);
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
 // The scroll controller starts the intro reveal when that section is visible.
 const photo=document.getElementById('photo-large');photo?.addEventListener('load',()=>animate(photo,[{opacity:.3},{opacity:1}],{duration:180,easing:'ease-out'}));
 preference.addEventListener('change',()=>{if(preference.matches){if(exiting)finishExit();Array.from(active).forEach(a=>a.cancel());outgoing?.remove();outgoingBackdrop?.remove()}});
})();
