// Native disclosures keep their semantics; motion can reverse from any point.
(() => {
 const preference=matchMedia('(prefers-reduced-motion: reduce)'),controls=new Map();
 document.querySelectorAll('.issue-row').forEach(row=>{
  const summary=row.querySelector('summary'),copy=row.querySelector('.issue-copy');
  let expanded=row.open,animation=null,copyAnimation=null;
  function settle(){
   animation?.cancel();copyAnimation?.cancel();animation=null;copyAnimation=null;
   row.open=expanded;row.classList.remove('is-expanding');
   row.dataset.expanded=String(expanded);summary.setAttribute('aria-expanded',String(expanded));copy.inert=!expanded;
  }
  function setExpanded(next){
   if(next===expanded&&!animation&&row.open===next)return;
   const from=row.getBoundingClientRect().height,style=getComputedStyle(copy);
   const opacity=row.open?style.opacity:'0',transform=row.open?style.transform:'translateY(8px)';
   expanded=next;animation?.cancel();copyAnimation?.cancel();animation=null;copyAnimation=null;
   row.dataset.expanded=String(next);summary.setAttribute('aria-expanded',String(next));copy.inert=!next;
   if(preference.matches||!row.animate){settle();return;}
   row.open=true;
   const to=next?row.getBoundingClientRect().height:summary.getBoundingClientRect().height+parseFloat(getComputedStyle(row).borderBottomWidth);
   row.classList.add('is-expanding');
   const duration=next?380:280,easing='cubic-bezier(.22,.61,.36,1)';
   animation=row.animate([{height:from+'px'},{height:to+'px'}],{duration,easing,fill:'both'});
   copyAnimation=copy.animate([{opacity,transform},{opacity:next?1:0,transform:next?'translateY(0)':'translateY(-4px)'}],{duration:next?300:180,easing,fill:'both'});
   animation.onfinish=settle;
  }
  summary.addEventListener('click',event=>{event.preventDefault();setExpanded(!expanded)});
  // Direct native changes (including assistive technology) remain authoritative.
  row.addEventListener('toggle',()=>{if(!animation){expanded=row.open;settle()}else if(!row.open){expanded=false;settle()}});
  controls.set(row,{setExpanded,settle});settle();
 });
 function openDetail(detail){if(!detail)return;const control=controls.get(detail);if(control)control.setExpanded(true);else detail.open=true;}
 function revealTarget(){
  if(!location.hash)return;
  let target;try{target=document.getElementById(decodeURIComponent(location.hash.slice(1)))}catch{return}
  if(target)openDetail(target.matches('details')?target:target.closest('details'));
 }
 document.addEventListener('click',event=>{
  const link=event.target.closest('a[href^="#"]');if(!link)return;
  const id=link.getAttribute('href').slice(1),target=document.getElementById(id);
  if(target?.matches('details'))openDetail(target);
 });
 window.addEventListener('hashchange',revealTarget);revealTarget();
 window.addEventListener('resize',()=>controls.forEach(control=>control.settle()));
 preference.addEventListener('change',()=>{if(preference.matches)controls.forEach(control=>control.settle())});
})();
// Outdoor album supports touch, trackpads, buttons and keyboard navigation.
(() => {
 const track=document.getElementById('outdoor-track');if(!track)return;
 const cards=[...track.children],prev=document.getElementById('outdoor-prev'),next=document.getElementById('outdoor-next'),count=document.getElementById('outdoor-count');
 let index=0,queued=false;
 function update(){queued=false;const left=track.getBoundingClientRect().left;index=cards.reduce((best,card,i)=>Math.abs(card.getBoundingClientRect().left-left)<Math.abs(cards[best].getBoundingClientRect().left-left)?i:best,0);prev.disabled=track.scrollLeft<2;next.disabled=track.scrollLeft>=track.scrollWidth-track.clientWidth-2;count.textContent=`${String(index+1).padStart(2,'0')} / ${String(cards.length).padStart(2,'0')}`;}
 function go(delta){const target=cards[Math.max(0,Math.min(cards.length-1,index+delta))];track.scrollTo({left:track.scrollLeft+target.getBoundingClientRect().left-track.getBoundingClientRect().left,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
 prev.addEventListener('click',()=>go(-1));next.addEventListener('click',()=>go(1));
 track.addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(update)}},{passive:true});
 track.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();go(e.key==='ArrowRight'?1:-1)}});window.addEventListener('resize',update);update();
})();

// Decorative trim-path builds play once; the factual text stays visible throughout.
(() => {
 const icons=[...document.querySelectorAll('.history-icon-motion')];
 const preference=matchMedia('(prefers-reduced-motion: reduce)');
 if(preference.matches||!('IntersectionObserver' in window))return;
 const observer=new IntersectionObserver(entries=>{
  for(const entry of entries){
   if(!entry.isIntersecting)continue;
   const icon=entry.target.querySelector('.history-icon-motion');
   icon.style.setProperty('--icon-delay',innerWidth>1000?(icons.indexOf(icon)*120)+'ms':'0ms');
   icon.classList.add('is-drawing');observer.unobserve(entry.target);
  }
 },{threshold:.4,rootMargin:'0px 0px -8% 0px'});
 icons.forEach(icon=>{icon.classList.add('motion-ready');observer.observe(icon.closest('li'))});
 preference.addEventListener('change',()=>{
  if(!preference.matches)return;
  observer.disconnect();icons.forEach(icon=>icon.classList.remove('motion-ready','is-drawing'));
 });
})();
