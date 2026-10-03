// A local three-chapter map, independent of the continuous orbit above it.
(() => {
 const section=document.querySelector('.ownership-journey');
 if(!section)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const svg=section.querySelector('.journey-map svg');
 const route=svg.querySelector('.map-route');
 const truck=svg.querySelector('.map-truck');
 const stops=[...svg.querySelectorAll('.map-stop')];
 const chapters=[...section.querySelectorAll('.journey-chapter')];
 const buttons=[...section.querySelectorAll('[data-journey-stop]')];
 const status=section.querySelector('.journey-map-position');
 const pin=section.querySelector('.journey-pin');
 const cameras=[[70,275,530,402.8],[610,72,390,296.4],[485,80,360,273.6]];
 const overview=[0,0,1000,760];
 const names=['MARYLAND','LONG ISLAND','LEONIA, NJ'];
 const pathLength=route.getTotalLength();
 const islandProgress=svg.querySelector('.map-route-first').getTotalLength()/pathLength;
 const destinations=[0,islandProgress,1];
 const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,value));
 const mix=(a,b,t)=>a+(b-a)*t;
 const ease=t=>1-Math.pow(1-t,4);
 let camera=overview.slice(),position=0,current=-1,motion=null,frame=0;
 let settleFrame=0,settling=false,settleTimer=0,settleUnlockTimer=0,lastY=scrollY,direction=0;
 let touchHeld=false,pointerHeld=false;
 let staticLayout=false,travelSign=1;
 const heldScrollKeys=new Set();
 const hasScrollEnd='onscrollend' in document;
 const stateLabels=[...svg.querySelectorAll('.map-state-name')].map(label=>({label,bounds:label.getBBox()}));
 const textNodes=chapters.map(chapter=>[...chapter.querySelectorAll('h3,p,.journey-mileage')].map(node=>{
  const mask=document.createElement('span'),ink=document.createElement('span');
  mask.className='journey-text-mask';ink.className='journey-text-ink';
  ink.append(...node.childNodes);mask.append(ink);node.append(mask);return ink;
 }));
 const mileage=section.querySelector('.journey-mileage strong'),mileageReels=[];
 const spoken=document.createElement('span'),visual=document.createElement('span');
 spoken.className='sr-only';spoken.textContent=mileage.textContent;
 visual.className='stat-visual';visual.setAttribute('aria-hidden','true');
 for(const char of mileage.textContent){
  if(!/\d/.test(char)){const literal=document.createElement('span');literal.textContent=char;visual.append(literal);continue;}
  const mask=document.createElement('span'),reel=document.createElement('span');mask.className='stat-digit';reel.className='stat-reel';
  for(let digit=0;digit<30;digit++){const row=document.createElement('span');row.textContent=String(digit%10);reel.append(row);}
  const end=20+Number(char);reel.style.transform=`translateY(-${end}em)`;mask.append(reel);visual.append(mask);mileageReels.push({reel,end});
 }
 mileage.replaceChildren(spoken,visual);let mileagePlayed=false;
 function geometry(){
  const top=section.getBoundingClientRect().top+scrollY;
  return {top,distance:Math.max(1,section.offsetHeight-pin.offsetHeight)};
 }
 function draw(){
  const rect=svg.getBoundingClientRect(),contained=reduced.matches||staticLayout;
  svg.setAttribute('preserveAspectRatio',contained?'xMidYMid meet':'xMidYMid slice');
  const unitsPerPixel=1/(contained?Math.min(rect.width/camera[2],rect.height/camera[3]):Math.max(rect.width/camera[2],rect.height/camera[3]));
  const scale=.8*unitsPerPixel,truckScale=(rect.width<480?.6:.8)*unitsPerPixel;
  const visible=[camera[0]+(camera[2]-rect.width*unitsPerPixel)/2,camera[1]+(camera[3]-rect.height*unitsPerPixel)/2,rect.width*unitsPerPixel,rect.height*unitsPerPixel];
  svg.setAttribute('viewBox',camera.map(value=>value.toFixed(3)).join(' '));
  const point=route.getPointAtLength(position*pathLength);
  const before=route.getPointAtLength(Math.max(0,position*pathLength-.5));
  const after=route.getPointAtLength(Math.min(pathLength,position*pathLength+.5));
  const facing=(Math.sign(after.x-before.x)||1)*travelSign;
  // Hold the illustration upright and make it face the next regional stop.
  truck.setAttribute('transform',`translate(${point.x} ${point.y-18*truckScale}) scale(${truckScale})`);
  truck.querySelector('image').setAttribute('transform',`scale(${facing} 1)`);
  for(const stop of stops){
   const x=stop.dataset.x,y=stop.dataset.y;
   stop.setAttribute('transform',`translate(${x} ${y}) scale(${scale})`);
  }
  for(const {label,bounds} of stateLabels){
   label.style.opacity=bounds.x>visible[0]+8&&bounds.x+bounds.width<visible[0]+visible[2]-8&&bounds.y>visible[1]+6&&bounds.y+bounds.height<visible[1]+visible[3]-6?'1':'0';
  }
  // The route remains dotted; a clip grows the orange completed portion.
  svg.querySelector('#journey-route-reveal').setAttribute('stroke-dasharray',`${position*pathLength} ${pathLength}`);
 }
 function tick(now){
  frame=0;if(!motion)return;
  const progress=clamp((now-motion.started)/motion.duration),t=ease(progress);
  camera=motion.fromCamera.map((v,i)=>mix(v,motion.toCamera[i],t));
  position=mix(motion.fromPosition,motion.toPosition,t);draw();
  if(progress<1)frame=requestAnimationFrame(tick);else motion=null;
 }
 function textTransition(index,previous){
  const goingDown=index>previous||previous<0;
  chapters.forEach(chapter=>{chapter.style.visibility='';});
  if(previous>=0&&previous!==index){
   chapters[previous].style.visibility='visible';
   textNodes[previous].forEach((ink,i)=>{
    const start=getComputedStyle(ink).transform;
    for(const animation of ink.getAnimations())animation.cancel();
    const animation=ink.animate([{transform:start==='none'?'translateY(0)':start},{transform:`translateY(${goingDown?-110:110}%)`}],{duration:290,easing:'cubic-bezier(.55,0,1,1)',fill:'forwards'});
    if(i===textNodes[previous].length-1)animation.onfinish=()=>{if(current!==previous)chapters[previous].style.visibility='';};
   });
  }
  textNodes[index].forEach((ink,i)=>{
   for(const animation of ink.getAnimations())animation.cancel();
   ink.animate([{transform:`translateY(${goingDown?110:-110}%)`},{transform:'translateY(0)'}],{duration:650,delay:previous<0?60+i*55:300+i*55,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'});
  });
 }
 function select(index,animate=true){
  if(index===current)return;
  const previous=current;current=index;section.dataset.stop=String(index);
  chapters.forEach((chapter,i)=>{chapter.classList.toggle('is-active',i===index);chapter.setAttribute('aria-hidden',String(!reduced.matches&&!staticLayout&&i!==index));});
  buttons.forEach((button,i)=>{if(i===index)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');});
  stops.forEach((stop,i)=>stop.classList.toggle('is-current',i===index));
  status.textContent=names[index];
  if(frame)cancelAnimationFrame(frame);frame=0;motion=null;
  if(reduced.matches||staticLayout){
   textNodes.flat().forEach(ink=>ink.getAnimations().forEach(animation=>animation.cancel()));
   mileageReels.forEach(({reel})=>reel.getAnimations().forEach(animation=>animation.cancel()));
   camera=overview.slice();position=destinations[index];draw();return;
  }
  if(animate)textTransition(index,previous);
  if(index===2&&animate&&!mileagePlayed){
   mileagePlayed=true;mileageReels.forEach(({reel,end},i)=>reel.animate([{transform:'translateY(0)'},{transform:`translateY(-${end}em)`}],{duration:1300+i*70,delay:500,easing:'cubic-bezier(.18,.65,.25,1)',fill:'backwards'}));
  }
  if(!animate){camera=cameras[index].slice();position=destinations[index];motion=null;draw();return;}
  travelSign=Math.sign(destinations[index]-position)||1;
  motion={started:performance.now(),duration:innerWidth<=700?650:850,fromCamera:camera.slice(),toCamera:cameras[index],fromPosition:position,toPosition:destinations[index]};
  frame=requestAnimationFrame(tick);
 }
 let queued=false;
 function render(){
  queued=false;if(reduced.matches||staticLayout||settling)return;
  const {top,distance}=geometry(),progress=(scrollY-top)/distance;
  if(scrollY+innerHeight<top||scrollY>top+section.offsetHeight)return;
  let index=clamp(Math.round(progress*2),0,2);
  // A small dead zone prevents a trackpad hovering at a boundary from flickering.
  if(current>=0&&Math.abs(progress-(current+.5)/2)<.025&&index>current)index=current;
  if(current>0&&Math.abs(progress-(current-.5)/2)<.025&&index<current)index=current;
  select(index);
 }
 function queue(){if(!queued){queued=true;requestAnimationFrame(render);}}
 function cancelSettle(){
  clearTimeout(settleTimer);clearTimeout(settleUnlockTimer);if(settleFrame)cancelAnimationFrame(settleFrame);
  settleFrame=0;settling=false;
  queue();
 }
 function scrollToStop(index){
  cancelSettle();const {top,distance}=geometry();
  if(reduced.matches||staticLayout){select(index,false);chapters[index].scrollIntoView({block:'center',behavior:'instant'});return;}
  const from=scrollY,target=top+distance*index/2,started=performance.now();settling=true;
  select(index);
  function step(now){
   const t=clamp((now-started)/420);window.scrollTo({top:mix(from,target,ease(t)),behavior:'instant'});
   if(t<1)settleFrame=requestAnimationFrame(step);else{settleFrame=0;settleUnlockTimer=setTimeout(()=>{settling=false;queue();},240);}
  }
  settleFrame=requestAnimationFrame(step);
 }
 function settle(){
  if(settling||reduced.matches||staticLayout||touchHeld||pointerHeld||heldScrollKeys.size)return;
  const {top,distance}=geometry(),local=scrollY-top;
  if(local<0||local>distance)return;
  const index=clamp(Math.round(local/distance*2),0,2),target=top+distance*index/2;
  // Snap only near a stop. Both ends remain easy to leave with ordinary scrolling.
  if((index===0&&direction<0)||(index===2&&direction>0))return;
  if(Math.abs(scrollY-target)>innerHeight*.28||Math.abs(scrollY-target)<2)return;
  scrollToStop(index);
 }
 window.addEventListener('scroll',()=>{
  const change=scrollY-lastY;if(Math.abs(change)>1)direction=Math.sign(change);lastY=scrollY;queue();
  if(!settling&&!hasScrollEnd&&!touchHeld&&!pointerHeld){clearTimeout(settleTimer);settleTimer=setTimeout(settle,200);}
 },{passive:true});
 if(hasScrollEnd)document.addEventListener('scrollend',settle,{passive:true});
 window.addEventListener('wheel',cancelSettle,{passive:true});
 window.addEventListener('touchstart',()=>{touchHeld=true;cancelSettle();},{passive:true});
 window.addEventListener('pointerdown',()=>{pointerHeld=true;cancelSettle();},{passive:true});
 function releaseTouch(){touchHeld=false;if(!hasScrollEnd&&!settling)settleTimer=setTimeout(settle,200);}
 for(const event of ['touchend','touchcancel'])window.addEventListener(event,releaseTouch,{passive:true});
 for(const event of ['pointerup','pointercancel'])window.addEventListener(event,()=>{pointerHeld=false;},{passive:true});
 const scrollKeys=['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '];
 window.addEventListener('keydown',event=>{if(scrollKeys.includes(event.key)){heldScrollKeys.add(event.key);cancelSettle();}});
 window.addEventListener('keyup',event=>{if(!scrollKeys.includes(event.key))return;heldScrollKeys.delete(event.key);if(!hasScrollEnd&&!heldScrollKeys.size&&!settling)settleTimer=setTimeout(settle,200);});
 window.addEventListener('blur',()=>{heldScrollKeys.clear();touchHeld=false;pointerHeld=false;cancelSettle();});
 buttons.forEach((button,index)=>button.addEventListener('click',()=>scrollToStop(index)));
 function fitLayout(){
  section.classList.remove('is-static');
  const style=getComputedStyle(pin),padding=parseFloat(style.paddingTop)+parseFloat(style.paddingBottom);
  const copyHeight=Math.max(...chapters.map(chapter=>chapter.getBoundingClientRect().height));
  const controls=section.querySelector('.journey-controls');
  const controlHeight=controls.getBoundingClientRect().height+parseFloat(getComputedStyle(controls).marginTop);
  const heading=section.querySelector('.journey-copy>.eyebrow');
  const headingHeight=innerWidth>700?heading.getBoundingClientRect().height+parseFloat(getComputedStyle(heading).marginBottom):0;
  const mapHeight=section.querySelector('.journey-map').getBoundingClientRect().height;
  const gap=parseFloat(style.rowGap)||0;
  const required=copyHeight+controlHeight+padding+headingHeight+(innerWidth<=700?mapHeight+2*gap:0);
  staticLayout=!reduced.matches&&required>pin.offsetHeight;
  section.classList.toggle('is-static',staticLayout);
 }
 window.addEventListener('resize',()=>{
  cancelSettle();
  const previous=staticLayout;fitLayout();
  if(previous!==staticLayout){current=-1;select(0,false);}
  draw();queue();
 });
 function preference(){
  cancelSettle();if(frame)cancelAnimationFrame(frame);frame=0;motion=null;
  textNodes.flat().forEach(ink=>ink.getAnimations().forEach(animation=>animation.cancel()));
  mileageReels.forEach(({reel})=>reel.getAnimations().forEach(animation=>animation.cancel()));
  section.classList.add('is-enhanced');current=-1;fitLayout();
  if(reduced.matches||staticLayout){select(0,false);chapters.forEach(chapter=>chapter.removeAttribute('aria-hidden'));}
  else{camera=overview.slice();position=0;draw();render();}
 }
 reduced.addEventListener('change',preference);preference();
})();
