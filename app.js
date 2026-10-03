const chapters=[
 {
  "tag": "THE POWERTRAIN",
  "title": "Big V8 energy.<br>Retiree schedule.",
  "body": "The legendary 4.7-liter V8, with about 220,000 miles behind her. These days, she’s a driveway ornament with ambition.",
  "href": "#engine-history-title",
  "link": "Read the owner-reported history"
 },
 {
  "tag": "THE STANCE",
  "title": "A modest lift.<br>An immodest stance.",
  "body": "Old Man Emu suspension, BFGoodrich KM3s and Bora spacers. A little taller, a little wider, and wildly overqualified for the garden-center parking lot.",
  "href": "#history",
  "link": "See the equipment and service dates"
 },
 {
  "tag": "THE CARGO",
  "title": "Bring the gear.<br>Or two more people.",
  "body": "Two functional rear jump seats fold away for cargo. A 2-inch hitch receiver sits out back. Home Depot trips have a way of becoming a personality.",
  "href": "#photo-08-cargo",
  "link": "Explore the cargo photo"
 },
 {
  "tag": "THE ROOF",
  "title": "The spoiler left.<br>The bars stayed.",
  "body": "The rear spoiler is gone and a piece of roof-rack trim is missing. The Malone crossbars are included because I really don’t want to take them off. Negotiations with the sunroof are ongoing.",
  "href": "#roof-condition",
  "link": "Check the roof and sunroof notes"
 },
 {
  "tag": "THE DIAGNOSTICS",
  "title": "Three codes.<br>No hide-and-seek.",
  "body": "P2418 / P0442 / P0446. My mechanic suspects the area in these photos and recommended a body shop/welder. It’s a lead, not a confirmed diagnosis or repair estimate.",
  "href": "#mechanic-photos",
  "link": "Open the mechanic’s photos and notes"
 },
 {
  "tag": "THE CABIN",
  "title": "No running boards.<br>Plenty of commentary.",
  "body": "My wife curses me out on the way up; the grab handle does the heavy lifting. Bring a stool, or ask Jesus to bless you with additional height.",
  "href": "#cabin-condition",
  "link": "Read the cabin’s to-do list"
 },
 {
  "tag": "THE FUEL ECONOMY",
  "title": "Thirsty. Capable.<br>A little smug.",
  "body": "Nobody buys a V8 Land Cruiser to win at the pump. If a Wrangler or Rubicon is taking an unscheduled roadside break, try to wave politely. Jeep rivalry comes standard.",
  "href": "#fuel-economy",
  "link": "Check the stock MPG figures"
 },
 {
  "tag": "THE NEXT CHAPTER",
  "title": "A hobby.<br>With a VIN.",
  "body": "Your socket set deserves a purpose. If your idea of a good weekend involves a garage and a parts order, we should talk.",
  "href": "#contact",
  "link": "Arrange a viewing"
 }
];
const $=id=>document.getElementById(id);
const tour=$('tour'),slider=$('scrubber'),video=$('orbit-video'),poster=$('scene-poster');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let progress=0,last=-2,queued=false,videoReady=false,targetTime=0,frames=[],frameIndex=-1,sequence=null;
const introFraction=.12;
const clamp=n=>Math.max(0,Math.min(1,n));
const orbitProgress=()=>clamp((progress-introFraction)/(1-introFraction));
chapters.forEach((c,i)=>{const b=document.createElement('button');b.textContent=String(i+1).padStart(2,'0');b.setAttribute('aria-label',`Chapter ${i+1}: ${c.tag.toLowerCase()}`);b.addEventListener('click',()=>go(i));$('chapter-dots').append(b)});
// Keep the latest scroll target while a previous video seek is decoding.
function seekVideo(){if(videoReady&&!video.seeking&&Math.abs(video.currentTime-targetTime)>.025)video.currentTime=targetTime}
video.addEventListener('seeked',seekVideo);
video.addEventListener('loadeddata',()=>{videoReady=Number.isFinite(video.duration)&&video.duration>0;if(videoReady){video.hidden=false;poster.hidden=true;render(progress,true)}});
video.addEventListener('error',()=>{videoReady=false;video.hidden=true;poster.hidden=false});
fetch('assets/orbit-media.json').then(r=>r.ok?r.json():null).then(m=>{if(m?.ready&&typeof m.src==='string'&&m.src.startsWith('assets/')){video.src=m.src;video.load()}}).catch(()=>{});
fetch('assets/rotation-frames.json').then(r=>r.ok?r.json():null).then(m=>{
 if(!m?.ready||!window.LCSequence)return;
 sequence=new LCSequence(m,{onFrame:({frame,index,image})=>{
  if(videoReady)return;
  frameIndex=index;
  const img=$('tour-image');img.src=image.src;img.alt=frame.alt||frame.view;
  $('orbit-pin').style.setProperty('--orbit-image',`url("${image.src}")`);
  $('orbit-pin').dataset.frame=String(index);
  $('tour-progress').textContent=`${Math.round(frame.angle)}°`;
  updateDetail(last);
 }});
 frames=sequence.frames;render(progress);
}).catch(()=>{});

function updateDetail(n){
 const shown=frames[frameIndex];
 const aligned=shown&&Math.min(7,Math.floor(shown.angle/45+1e-8))===n;
 const detail=aligned&&!videoReady?(n===0?{point:[1050,505],label:'4.7L V8',src:'assets/gallery/06-engine-source.jpg',size:'cover',position:'center'}:n===1?{point:[1350,676],label:'KM3 · 2019',src:'assets/gallery/07-tire-source.jpg',size:'cover',position:'center'}:n===3?{point:[1210,392],label:'NO SPOILER'}:n===5?{point:[1245,470],label:'GRAB HANDLE',src:'assets/gallery/02-cabin-roof-source.jpg',size:'600%',position:'19% 38%'}:null):null;
 $('inspection-detail').hidden=!detail;
 $('inspection-detail').dataset.detail=String(n);
 $('detail-open').hidden=n!==5||!detail;
 if(!detail)return;
 const anchor=shown.anchors?.[n===1?'tire':n===3?'roof':n===5?'handle':'engine'];
 if(anchor)detail.point=[anchor[0]*1672,anchor[1]*941];
 document.querySelector('.leader').hidden=n!==0&&!anchor&&!shown.primary;
 const img=$('tour-image'),pin=$('orbit-pin'),r=img.getBoundingClientRect(),base=pin.getBoundingClientRect();
 const decoded=sequence?.current?.image||img;const iw=decoded.naturalWidth,ih=decoded.naturalHeight;if(!iw||!ih)return;
 const scale=Math.max(r.width/iw,r.height/ih),left=r.left-base.left+(r.width-iw*scale)/2,top=r.top-base.top+(r.height-ih*scale)/2;
 const x=left+detail.point[0]/1672*iw*scale,y=top+detail.point[1]/941*ih*scale;
 const bubble=$('bubble');
 // The stance frame's crossbars start just below 46% of the image height.
 const tireRoofTop=top+.46*ih*scale;
 // Keep the tire lens above the roof, with its leader anchored to the rear wheel.
 ['left','top','right'].forEach(property=>bubble.style.removeProperty(property));
 if(n===1||(n===5&&innerWidth>700)){
  const width=bubble.offsetWidth,height=bubble.offsetHeight,gap=innerWidth<=700?34:46;
  bubble.style.left=`${Math.max(16,Math.min(base.width-width-16,x-width/2))}px`;
  bubble.style.right='auto';bubble.style.top=`${Math.max(16,(n===1?tireRoofTop-(innerWidth<=700?16:24):y-gap)-height)}px`;
 }
 if(innerWidth<=700){
  const copyBottom=document.querySelector('.tour-copy').getBoundingClientRect().bottom-base.top;
  const currentTop=bubble.getBoundingClientRect().top-base.top;
  const targetTop=Math.max(currentTop,copyBottom+16);
  const controlsTop=document.querySelector('.orbit-bottom').getBoundingClientRect().top-base.top;
  const bottomLimit=n===1?Math.min(controlsTop-16,tireRoofTop-16):controlsTop-16;
  if(targetTop+bubble.offsetHeight>bottomLimit){$('inspection-detail').hidden=true;return}
  bubble.style.top=`${targetTop}px`;
 }
 const br=bubble.getBoundingClientRect(),bx=br.left-base.left+br.width/2,by=br.top-base.top+br.height;
 if(n===5){const cy=br.top-base.top+br.height/2,dx=x-bx,dy=y-cy,length=Math.hypot(dx,dy)||1;const edgeX=bx+dx/length*br.width/2,edgeY=cy+dy/length*br.height/2;$('leader-path').setAttribute('d',`M ${x} ${y} L ${edgeX} ${edgeY}`)}else $('leader-path').setAttribute('d',n===1?`M ${x} ${y} L ${bx} ${by}`:`M ${x} ${y} L ${bx-25} ${by+20} L ${bx} ${by}`);
 $('leader-point').setAttribute('cx',x);$('leader-point').setAttribute('cy',y);
 const zoom=br.width/(n===1?240:330)*1672/iw;
 if(detail.src){$('bubble-photo').style.backgroundImage=`url('${detail.src}')`;$('bubble-photo').style.backgroundSize=detail.size;$('bubble-photo').style.backgroundPosition=detail.position;$('bubble-label').textContent=detail.label;return}
 $('bubble-photo').style.backgroundImage=`url('${frames[frameIndex].src}')`;
 $('bubble-photo').style.backgroundSize=`${iw*zoom}px ${ih*zoom}px`;
 $('bubble-photo').style.backgroundPosition=`${br.width/2-detail.point[0]/1672*iw*zoom}px ${br.height/2-detail.point[1]/941*ih*zoom}px`;
 $('bubble-label').textContent=detail.label;
}
function render(p,forceDetail=false){
 progress=clamp(p);const op=orbitProgress(),n=progress<introFraction?-1:Math.min(7,Math.floor(op*8+.003));
 slider.value=Math.round(progress*1000);slider.setAttribute('aria-valuetext',n<0?'Introduction':`Chapter ${n+1} of 8: ${chapters[n].tag.toLowerCase()}`);
 if(videoReady)$('tour-progress').textContent=Math.round(op*360)+'°';else if(!frames.length)$('tour-progress').textContent='0°';
 const chapterChanged=n!==last;
 if(chapterChanged){const intro=n<0;$('launch').hidden=!intro;$('walkaround').hidden=intro;$('orbit-pin').classList.toggle('inspecting',!intro);$('tour-mode').textContent=intro?'ONE TRUCK. SEVERAL WEEKENDS.':'THE HONEST WALKAROUND';
 const showEvidence=n===4;$('tour-evidence').hidden=!showEvidence;$('orbit-pin').classList.toggle('showing-evidence',showEvidence);if(!intro){$('tour-issue-link').href=chapters[n].href;$('tour-issue-link').textContent=chapters[n].link;}
 if(!intro){const c=chapters[n];$('chapter').textContent=`0${n+1} / 08`;$('tag').textContent=c.tag;$('tour-title').innerHTML=c.title;$('tour-body').textContent=c.body;window.lcMotion?.chapter(n)}else{window.lcMotion?.intro()}
 Array.from($('chapter-dots').children).forEach((b,i)=>b.setAttribute('aria-current',String(i===n)));$('previous').disabled=intro;$('next').disabled=n===7;last=n;
 }
 if(videoReady){targetTime=op*Math.max(0,video.duration-.04);seekVideo()}
 else if(sequence){sequence.seek(op*360)}
 if(chapterChanged||forceDetail)updateDetail(n);
}
function scrollProgress(){const rect=tour.getBoundingClientRect(),distance=tour.offsetHeight-innerHeight;return distance>0?-rect.top/distance:progress}
// Let gestures scrub, then settle on a primary view. No snapping below the tour.
const snapStops=[0,...Array.from({length:9},(_,i)=>introFraction+i/8*(1-introFraction))];
let snapTimer=0,snapAnimation=0,snapping=false,draggingTimeline=false,touching=false;
let gestureStart=null,scrollDirection=0,previousScroll=scrollProgress();
const closestStop=p=>snapStops.reduce((best,stop)=>Math.abs(stop-p)<Math.abs(best-p)?stop:best,0);
let settledStop=closestStop(previousScroll);
function cancelSnap(){clearTimeout(snapTimer);cancelAnimationFrame(snapAnimation);snapping=false;}
function beginGesture(){
 if(snapping){cancelSnap();gestureStart=scrollProgress();}
 else if(gestureStart===null)gestureStart=scrollProgress();
}
function scheduleSnap(){
 clearTimeout(snapTimer);
 if(!snapping&&!touching&&!draggingTimeline&&!reduced.matches)snapTimer=setTimeout(()=>settleOrbit(true),50);
}
function settleOrbit(directional=false){
 clearTimeout(snapTimer);
 const raw=reduced.matches?progress:scrollProgress();
 if(raw<0||raw>1||$('photo-dialog').open||touching||draggingTimeline){gestureStart=null;return;}
 let target=closestStop(raw);
 // A short intentional wheel/touch gesture advances instead of bouncing back.
 if(directional&&gestureStart!==null&&scrollDirection&&Math.abs(raw-settledStop)*(tour.offsetHeight-innerHeight)>6&&target===settledStop){
  const index=snapStops.indexOf(target)+scrollDirection;
  target=snapStops[Math.max(0,Math.min(snapStops.length-1,index))];
 }
 gestureStart=null;scrollDirection=0;
 cancelSnap();settledStop=target;
 const distance=tour.offsetHeight-innerHeight;
 if(reduced.matches||distance<=0||Math.abs(target-raw)*distance<1){setProgress(target);return;}
 const from=window.scrollY,to=tour.offsetTop+target*distance,started=performance.now();
 snapping=true;
 function step(now){
  const t=Math.min(1,(now-started)/90),ease=t;
  window.scrollTo({top:from+(to-from)*ease,behavior:'instant'});
  render(raw+(target-raw)*ease);
  if(t<1)snapAnimation=requestAnimationFrame(step);
  else{snapping=false;previousScroll=target;setProgress(target);}
 }
 snapAnimation=requestAnimationFrame(step);
}
function onScroll(){
 queued=false;
 if(reduced.matches)return;
 const raw=scrollProgress();
 if(!snapping&&Math.abs(raw-previousScroll)>.0001){scrollDirection=Math.sign(raw-previousScroll);if(gestureStart===null&&!draggingTimeline)gestureStart=previousScroll;}
 previousScroll=raw;render(raw);
 if(!snapping)scheduleSnap();
}
function setProgress(p){p=clamp(p);if(!reduced.matches)window.scrollTo({top:tour.offsetTop+p*(tour.offsetHeight-innerHeight),behavior:'instant'});render(p)}
function go(i){cancelSnap();gestureStart=null;scrollDirection=0;i=Math.max(-1,Math.min(7,i));settledStop=i<0?0:introFraction+i/8*(1-introFraction);setProgress(settledStop)}
slider.addEventListener('pointerdown',()=>{cancelSnap();draggingTimeline=true;gestureStart=null;});
window.addEventListener('pointerup',()=>{if(draggingTimeline){draggingTimeline=false;settleOrbit();}});
window.addEventListener('pointercancel',()=>{if(draggingTimeline){draggingTimeline=false;settleOrbit();}});
slider.addEventListener('input',()=>{cancelSnap();const p=Number(slider.value)/1000;setProgress(reduced.matches?closestStop(p):p);if(!draggingTimeline&&!reduced.matches)snapTimer=setTimeout(()=>settleOrbit(),50);});
slider.addEventListener('change',()=>{if(!draggingTimeline)settleOrbit();});
slider.addEventListener('keydown',event=>{
 const forward=['ArrowRight','ArrowUp','PageUp'],back=['ArrowLeft','ArrowDown','PageDown'];
 if(![...forward,...back,'Home','End'].includes(event.key))return;
 event.preventDefault();cancelSnap();gestureStart=null;scrollDirection=0;
 const index=snapStops.indexOf(closestStop(progress));
 const next=event.key==='Home'?0:event.key==='End'?snapStops.length-1:Math.max(0,Math.min(snapStops.length-1,index+(forward.includes(event.key)?1:-1)));
 settledStop=snapStops[next];setProgress(settledStop);
});

window.addEventListener('wheel',()=>{beginGesture();scheduleSnap();},{passive:true});
window.addEventListener('touchstart',()=>{beginGesture();touching=true;clearTimeout(snapTimer);},{passive:true});
window.addEventListener('touchend',()=>{touching=false;scheduleSnap();},{passive:true});
window.addEventListener('touchcancel',()=>{touching=false;scheduleSnap();},{passive:true});
window.addEventListener('keydown',event=>{
 if(event.target.closest('input,button,a,dialog,textarea,select,[contenteditable]'))return;
 if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)){beginGesture();scheduleSnap();}
});
// In-page links and photo dialogs must never be pulled back into the tour.
document.addEventListener('click',event=>{if(event.target.closest('a,[data-photo]')){cancelSnap();gestureStart=null;}});
$('start-tour').addEventListener('click',()=>{go(0);$('tour-title').focus({preventScroll:true})});$('previous').addEventListener('click',()=>{go(last-1);if($('previous').disabled)$('start-tour').focus({preventScroll:true})});$('next').addEventListener('click',()=>{go(last+1);if($('next').disabled)$('tour-title').focus({preventScroll:true})});
window.addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(onScroll)}},{passive:true});window.addEventListener('resize',()=>{cancelSnap();gestureStart=null;render(reduced.matches?closestStop(progress):scrollProgress(),true);scheduleSnap();});
$('tour-image').addEventListener('load',()=>updateDetail(last));
reduced.addEventListener('change',()=>{cancelSnap();gestureStart=null;render(closestStop(progress),true);if(!reduced.matches)setProgress(progress);});render(0);onScroll();
