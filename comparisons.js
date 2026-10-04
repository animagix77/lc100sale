(() => {
 const track=document.querySelector('#comparison-track');
 if(!track)return;
 const prev=document.querySelector('#compare-prev'),next=document.querySelector('#compare-next');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const update=()=>{prev.disabled=track.scrollLeft<=2;next.disabled=track.scrollLeft>=track.scrollWidth-track.clientWidth-2;};
 const move=direction=>{const card=track.querySelector('.comparison-card');const step=card.getBoundingClientRect().width+parseFloat(getComputedStyle(track).gap);track.scrollBy({left:direction*step,behavior:reduced.matches?'instant':'smooth'});};
 prev.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));
 track.addEventListener('scroll',update,{passive:true});
 track.addEventListener('keydown',event=>{if(event.target!==track)return;if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();move(event.key==='ArrowRight'?1:-1);}});
 window.addEventListener('resize',update);new ResizeObserver(update).observe(track);
 prev.parentElement.hidden=false;update();
})();
