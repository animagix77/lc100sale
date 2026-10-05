// Content arrives at the reading position; the orbit and map own their own motion.
(() => {
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 if(reduced.matches||!Element.prototype.animate)return;
 const selector=[
  '.page-content h2','.page-content h3','.page-content p',
  '.page-content .editorial-photo','.page-content .comparison-card',
  '.page-content .issue-row','.page-content .service-row','.page-content .spec-strip>div',
  '.page-content .history-fact-copy','.page-content .sale-meta','.page-content .buyer-actions',
  '.page-content .purchase-link','.page-content .vehicle-vin','.page-content .outdoor-controls',
  '.page-content .comparison-controls','.page-content .gallery-outro',
  '.page-content .editorial-link','.page-content .primary-action',
  '.page-content .gallery-heading>.button','.page-content .status','.page-content .intro-disclosure',
  'footer>span','footer>p'
 ].join(',');
 const candidates=[...document.querySelectorAll(selector)].filter(n=>!n.closest('dialog,.ownership-journey,.issue-copy'));
 const records=candidates.filter(n=>!candidates.some(parent=>parent!==n&&parent.contains(n))).map(node=>{
  const heading=node.matches('h2,h3')&&!node.matches('.price-amount');
  const photo=node.matches('.editorial-photo');
  const record={node,heading,photo,lines:null,ink:null,counter:null,played:false,animations:new Set()};
  if(heading){
   const groups=[[]];[...node.childNodes].forEach(child=>{if(child.nodeName==='BR')groups.push([]);else groups.at(-1).push(child)});
   record.lines=groups.filter(g=>g.length).map(group=>{
    const mask=document.createElement('span'),ink=document.createElement('span');
    mask.className='scroll-headline-line';ink.className='scroll-headline-ink';ink.append(...group);mask.append(ink);return {mask,ink};
   });
   node.replaceChildren(...record.lines.map(line=>line.mask));node.classList.add('reveal-heading');
  }
  const stat=node.querySelector('.spec-strip strong');
  if(stat){const ink=document.createElement('span');ink.className='stat-ink';ink.append(...stat.childNodes);stat.append(ink);record.ink=ink;record.isStat=true;}
  node.classList.add('reveal-unit','reveal-pending');if(photo)node.classList.add('reveal-photo');
  node.dataset.revealState='pending';
  // Eyebrow, title and intro share a cue: title first, supporting text afterwards.
  const scope=node.closest('.editorial-heading,.story-heading,.intro-copy,.evidence-copy,.outdoor-heading,.closing,.condition-priority');
  const title=scope?.querySelector('h2,h3');
  record.trigger=title||node;
  record.delay=title?(node.matches('.eyebrow,.status')?0:heading?100:980):0;
  if(title&&!heading&&!node.matches('.eyebrow,.status')){
   const siblings=[...scope.querySelectorAll('p,a,.buyer-actions,.sale-meta,.purchase-link,.intro-disclosure')];
   record.delay+=Math.min(3,Math.max(0,siblings.indexOf(node)-1))*110;
  }
  if(node.matches('.history-fact-copy'))record.delay=700;
  return record;
 });
 const counterAnimations=new Set();
 for(const record of records){
  if(!record.isStat)continue;
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

 const pending=new Set(records);let queued=false;
 const easing='cubic-bezier(.22,.61,.36,1)';
 function animate(record,node,keyframes,duration,delay){
  const animation=node.animate(keyframes,{duration,delay,easing,fill:'backwards'});
  record.animations.add(animation);
  animation.onfinish=animation.oncancel=()=>{record.animations.delete(animation);if(!record.animations.size)record.node.dataset.revealState='shown'};
 }
 function finish(record){
  record.played=true;pending.delete(record);record.node.classList.remove('reveal-pending');
  [...record.animations].forEach(a=>a.cancel());record.node.dataset.revealState='shown';
 }
 function play(record,offset=0){
  if(record.played)return;record.played=true;pending.delete(record);
  record.node.classList.remove('reveal-pending');record.node.dataset.revealState='building';
  const delay=record.delay+offset;
  if(record.heading){
   record.lines.forEach(({ink},i)=>animate(record,ink,[{transform:'translateY(115%)'},{transform:'translateY(0)'}],900,delay+i*220));
  }else if(record.photo){
   animate(record,record.node,[{opacity:0,clipPath:'inset(10% 0 0 0)',transform:'translateY(24px)'},{opacity:1,clipPath:'inset(0)',transform:'translateY(0)'}],950,delay);
   const img=record.node.querySelector('img');if(img)animate(record,img,[{transform:'scale(1.045)'},{transform:'scale(1)'}],1100,delay);
  }else animate(record,record.node,[{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],650,delay);
  if(record.counter&&!record.counter.played)roll(record.counter);
 }
 function render(){
  queued=false;if(reduced.matches)return;
  const atBottom=scrollY+innerHeight>=document.documentElement.scrollHeight-4;
  const positions=[...pending].map(record=>({record,rect:record.node.getBoundingClientRect(),trigger:record.trigger.getBoundingClientRect()}));
  let lastTop=-Infinity,offset=0;
  for(const {record,rect,trigger} of positions){
   if(!rect.width||!rect.height||rect.right<=0||rect.left>=innerWidth)continue;
   if(rect.bottom<=0){finish(record);continue;}
   if(trigger.top>innerHeight*.60&&!(atBottom&&rect.top<innerHeight))continue;
   if(!record.delay&&!record.heading){offset=Math.abs(rect.top-lastTop)<30?Math.min(offset+140,420):0;lastTop=rect.top}else offset=0;
   play(record,offset);
  }
 }
 function queue(){if(!queued){queued=true;requestAnimationFrame(render)}}
 // Capture also catches horizontal photo/comparable lanes without hijacking scrolling.
 document.addEventListener('scroll',queue,{passive:true,capture:true});window.addEventListener('resize',queue);
 document.addEventListener('focusin',event=>{records.filter(r=>r.node.contains(event.target)).forEach(finish)});
 document.addEventListener('click',event=>{const link=event.target.closest('a[href^="#"]');if(link)queue()});
 window.addEventListener('hashchange',queue);window.addEventListener('pageshow',queue);
 reduced.addEventListener('change',()=>{if(reduced.matches){records.forEach(finish);counterAnimations.forEach(a=>a.cancel())}else queue()});
 queue();
})();
