// Reading content follows viewport position; the orbit's chapter transitions stay independent.
(() => {
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const candidates=[...document.querySelectorAll('.page-content h2,.page-content h3,.page-content p,.page-content .status,.page-content .timeline>article>span,.page-content .spec-strip>div>strong,.page-content .spec-strip>div>span,.page-content .ownership-stat>strong,.page-content .history-fact-copy>strong,.page-content .history-fact-copy>span,.page-content .sale-meta>span,.page-content .buyer-actions>a,.page-content .purchase-trigger,.page-content .photo-open>span,.page-content a,footer>span,footer>p')].filter(node=>!node.closest('dialog,.ownership-journey'));
 const records=candidates.filter(node=>!node.parentElement.closest('.scroll-text-mask')&&!candidates.some(parent=>parent!==node&&parent.contains(node))).map(node=>{
  const ink=document.createElement('span');ink.className='scroll-ink';ink.append(...node.childNodes);node.append(ink);node.classList.add('scroll-text-mask');
  return {node,ink,counter:null};
 });
 const active=new Set(),counterAnimations=new Set();
 const clamp=value=>Math.max(0,Math.min(1,value));
 const smooth=value=>value*value*(3-2*value);
 for(const record of records){
  if(!record.node.matches('.spec-strip strong,.ownership-stat>strong'))continue;
  const label=record.ink.textContent,spoken=document.createElement('span'),visual=document.createElement('span');
  spoken.className='sr-only';spoken.textContent=label;visual.className='stat-visual';visual.setAttribute('aria-hidden','true');
  const reels=[];
  for(const char of label){
   if(!/\d/.test(char)){const literal=document.createElement('span');literal.className='stat-static';literal.textContent=char===' '?'\u00a0':char;visual.append(literal);continue;}
   const mask=document.createElement('span'),reel=document.createElement('span');mask.className='stat-digit';reel.className='stat-reel';
   for(let digit=0;digit<30;digit++){const row=document.createElement('span');row.textContent=String(digit%10);reel.append(row)}
   const end=20+Number(char);reel.style.transform=`translateY(-${end}em)`;mask.append(reel);visual.append(mask);reels.push({reel,end});
  }
  record.ink.replaceChildren(spoken,visual);record.counter={reels,played:false};
 }
 function roll(counter){
  counter.played=true;
  counter.reels.forEach(({reel,end},i)=>{
   const animation=reel.animate([{transform:'translateY(0)'},{transform:`translateY(-${end}em)`}],{duration:1300+i*65,easing:'cubic-bezier(.18,.65,.25,1)',fill:'backwards'});
   counterAnimations.add(animation);animation.onfinish=animation.oncancel=()=>counterAnimations.delete(animation);
  });
 }
 let queued=false;
 function render(){
  queued=false;if(reduced.matches)return;
  const viewport=innerHeight;
  const atBottom=scrollY+viewport>=document.documentElement.scrollHeight-2;
  // Read geometry first, then write transforms without disturbing text layout.
  const positions=[...active].map(record=>({record,rect:record.node.getBoundingClientRect()}));
  for(const {record,rect} of positions){
   const entry=atBottom?1:smooth(clamp((viewport*.96-rect.top)/(viewport*.19)));
   const exit=smooth(clamp((viewport*.06-rect.bottom)/(viewport*.16)));
   record.ink.style.transform=`translateY(${((1-entry)-exit)*110}%)`;
   if(record.counter&&!record.counter.played&&entry>.8&&exit<.1)roll(record.counter);
  }
 }
 function queue(){if(!queued){queued=true;requestAnimationFrame(render)}}
 if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{
   for(const entry of entries){
    const record=records.find(item=>item.node===entry.target);
    if(entry.isIntersecting)active.add(record);
    else{active.delete(record);record.ink.style.transform=entry.boundingClientRect.top<0?'translateY(-110%)':'translateY(110%)'}
   }
   queue();
  },{rootMargin:'160px 0px',threshold:0});
  records.forEach(record=>observer.observe(record.node));
 }else records.forEach(record=>{record.ink.style.transform='none'});
 window.addEventListener('scroll',queue,{passive:true});window.addEventListener('resize',queue);
 reduced.addEventListener('change',()=>{
  if(reduced.matches){for(const animation of counterAnimations)animation.cancel();records.forEach(record=>{record.ink.style.transform='none'});}
  else queue();
 });
 if(reduced.matches)records.forEach(record=>{record.ink.style.transform='none'});
})();
