const chapters=[
  {
    "tag": "THE TRUCK",
    "title": "Big V8.<br>Small workload.",
    "body": "4.7 liters. 220,718 miles shown. Roughly 1,340 miles a year since I bought her in 2018. I bought a Land Cruiser and gave it a desk job.",
    "href": "#ownership",
    "link": "Meet the owner’s truck"
  },
  {
    "tag": "THE SETUP",
    "title": "Overqualified<br>for the mulch run.",
    "body": "Old Man Emu suspension, BFGoodrich KM3s and Bora spacers. A little taller, a little wider. The garden center remains deeply unimpressed.",
    "href": "#history",
    "link": "See the equipment & service"
  },
  {
    "tag": "THE PRACTICAL BITS",
    "title": "Bring the gear.<br>All of it. Apparently.",
    "body": "A 2-inch hitch receiver, Malone crossbars and fold-away rear seats. The cargo setup earned its keep on our camping trips. Packing light was never a family policy.",
    "href": "#outdoor-title",
    "link": "See the camping years"
  },
  {
    "tag": "THE BIG MAYBE",
    "title": "A hobby.<br>With a VIN.",
    "body": "$TBD. Still considering a sale. The mechanic recommends an EVAP solenoid, canister and gas cap replacement; that work is next. Apparently I needed a whole website and another repair bill to discover I’m attached.",
    "href": "#verdict",
    "link": "Help decide: keep or sell?"
  }
];
const $=id=>document.getElementById(id);
const tour=$('tour'),slider=$('scrubber'),video=$('orbit-video'),poster=$('scene-poster');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let progress=0,last=-2,queued=false,videoReady=false,targetTime=0;
const introFraction=.08;
let pendingFocus=null;
const clamp=n=>Math.max(0,Math.min(1,n));
const orbitProgress=()=>clamp((progress-introFraction)/(1-introFraction));
chapters.forEach((c,i)=>{const b=document.createElement('button');b.textContent=String(i+1).padStart(2,'0');b.setAttribute('aria-label',`Chapter ${i+1}: ${c.tag.toLowerCase()}`);b.addEventListener('click',()=>go(i));$('chapter-dots').append(b)});
// The clip stays paused; scrolling requests the latest time instead of playing it.
const videoBackdrop=$('video-backdrop'),videoContext=videoBackdrop.getContext('2d');
function paintVideoFrame(){
 if(!videoReady)return;
 video.dataset.scrubTime=video.currentTime.toFixed(3);
 videoContext.drawImage(video,0,0,videoBackdrop.width,videoBackdrop.height);
 $('tour-progress').textContent=`${Math.round(progress*100)}%`;
 updateDetail(last);
}
function seekVideo(){
 if(videoReady&&!video.seeking&&Math.abs(video.currentTime-targetTime)>1/48){video.dataset.scrubTarget=targetTime.toFixed(3);video.currentTime=targetTime;}
}
video.addEventListener('seeked',()=>{paintVideoFrame();seekVideo()});
function paintPosterFrame(){
 if(videoReady||!poster.naturalWidth)return;
 videoContext.drawImage(poster,0,0,videoBackdrop.width,videoBackdrop.height);
 videoBackdrop.hidden=false;
}
function useVideo(){
 videoReady=Number.isFinite(video.duration)&&video.duration>0;
 if(!videoReady)return;
 video.pause();video.hidden=false;poster.hidden=true;videoBackdrop.hidden=false;
 paintVideoFrame();render(progress,true);
}
video.addEventListener('loadeddata',useVideo);
video.addEventListener('error',()=>{
 videoReady=false;video.hidden=true;poster.hidden=false;
 paintPosterFrame();render(progress,true);
});
poster.addEventListener('load',paintPosterFrame);

function setDetailState(n,detail){
 if(window.lcCallout?.prepare(detail?n:null)===false)return false;
 const panel=$('inspection-detail'),open=$('detail-open');
 panel.hidden=!detail;panel.dataset.detail=String(n);
 $('bubble-video').hidden=!detail?.live;$('bubble-photo').hidden=!!detail?.live;
 open.hidden=!detail||(n!==0&&n!==2&&n!==5);
 if(n===0){open.dataset.photo=document.querySelector('#photo-27-engine-cover .photo-open').dataset.photo;open.dataset.photoSource='false';open.setAttribute('aria-label','Open the cleaned V8 detail')}
 if(n===2){open.dataset.photo=document.querySelector('#photo-08-cargo .photo-open').dataset.photo;open.dataset.photoSource='false';open.setAttribute('aria-label','Open the rear cargo photo')}
 if(n===5){open.dataset.photo=document.querySelector('#photo-24-grab-handle .photo-open').dataset.photo;open.dataset.photoSource='true';open.setAttribute('aria-label','Open the front grab-handle photo')}

 return true;
}
window.addEventListener('lc100:callout-ready',()=>updateDetail(last));
function revealDetail(n){
 window.lcCallout?.show(n);
}
function updateDetail(n){
 if(progress<introFraction)n=-1;else if(n===2){const phase=(orbitProgress()-.5)*4;n=phase<.38?2:phase<.68?3:5;}else if(n===3)n=-1;
 if(videoReady)updateVideoDetail(n);
 else setDetailState(n,null);
}

function updateVideoDetail(n){
 const detail=n===0?{src:'assets/gallery/27-engine-cover-edited.jpg',label:'4.7L V8',size:'cover',position:'50% 61%'}:
 n===1?{src:'assets/gallery/07-tire-source.jpg',label:'KM3 · 2019',size:'cover',position:'center'}:
 n===2?{src:'assets/gallery/08-cargo-with-left-jump-seat-edited.png',label:'REAR CARGO',size:'165%',position:'50% 67%'}:
 n===3?{live:true,label:'ROOF BARS'}:
 n===5?{src:'assets/gallery/24-grab-handle.jpeg',label:'GRAB HANDLE',size:'250%',position:'51% 42%'}:null;
 if(!setDetailState(n,detail)||!detail)return;
 const bubble=$('bubble'),base=$('orbit-pin').getBoundingClientRect(),r=video.getBoundingClientRect();
 $('inspection-detail').dataset.detail=String(n);
 // Match the video's cover crop so callout dots stay on the same body part after resizing.
 const scale=Math.max(r.width/video.videoWidth,r.height/video.videoHeight);
 const imageWidth=video.videoWidth*scale,imageHeight=video.videoHeight*scale;
 const [positionX,positionY]=getComputedStyle(video).objectPosition.split(' ').map(value=>parseFloat(value)/100);
 const imageLeft=r.left-base.left+(r.width-imageWidth)*(Number.isFinite(positionX)?positionX:.5);
 const imageTop=r.top-base.top+(r.height-imageHeight)*(Number.isFinite(positionY)?positionY:.5);
 const t=video.currentTime;
 const rearX=.87-Math.min(1,Math.max(0,(t-1.25)/.8))*.044;
 const hoodX=.63-.075*Math.min(1,Math.max(0,(t-.7)/.8));
 const cargoX=.923-.055*Math.min(1,Math.max(0,(t-2.02)/.67));
 const pointX=n===0?hoodX:n===2?cargoX:n===3?.68:rearX,pointY=n===0?.545:n===2?.60:n===3?.39:.72;
 const x=imageLeft+pointX*imageWidth,y=imageTop+pointY*imageHeight;
 const width=bubble.offsetWidth,height=bubble.offsetHeight;
 bubble.style.right='auto';bubble.style.left=`${Math.max(16,Math.min(base.width-width-16,x-width/2))}px`;
 let top=Math.max(16,imageTop+.38*imageHeight-height-24);
 if(innerWidth<=700){
  const newDetail=n===2||n===3;
  top=Math.max(top,document.querySelector('.tour-copy').getBoundingClientRect().bottom-base.top+(newDetail?8:16));
  const limit=newDetail?document.querySelector('.orbit-bottom').getBoundingClientRect().top-base.top-16:imageTop+.38*imageHeight-16;
  if(top+height>limit){window.lcCallout?.prepare(null,{immediate:true});$('inspection-detail').hidden=true;return;}
 }
 bubble.style.top=`${top}px`;
 if(detail.live){
  // Magnify the roof from the exact paused video frame, keeping the crop in sync with scrubbing.
  const canvas=$('bubble-video'),crop=160;
  const sx=Math.max(0,Math.min(video.videoWidth-crop,pointX*video.videoWidth-crop/2));
  const sy=Math.max(0,Math.min(video.videoHeight-crop,pointY*video.videoHeight-crop/2));
  canvas.getContext('2d').drawImage(video,sx,sy,crop,crop,0,0,canvas.width,canvas.height);
 }else{
  $('bubble-photo').style.backgroundImage=`url('${detail.src}')`;
  $('bubble-photo').style.backgroundSize=detail.size;$('bubble-photo').style.backgroundPosition=detail.position;
 }
 $('bubble-label').textContent=detail.label;
 document.querySelector('.leader').toggleAttribute('hidden',n===5);
 $('leader-point').setAttribute('cx',x);$('leader-point').setAttribute('cy',y);
 const bubbleX=parseFloat(bubble.style.left)+width/2;
 $('leader-path').setAttribute('d',`M ${x} ${y} L ${bubbleX} ${top+height}`);
 revealDetail(n);
}
function render(p,forceDetail=false){
 progress=clamp(p);const op=orbitProgress(),n=progress<introFraction-.0005?-1:Math.min(chapters.length-1,Math.floor(op*chapters.length+.003));
 slider.value=Math.round(progress*1000);slider.setAttribute('aria-valuetext',n<0?'Introduction':`Chapter ${n+1} of ${chapters.length}: ${chapters[n].tag.toLowerCase()}`);
 $('tour-progress').textContent=Math.round(progress*100)+'%';
 const chapterChanged=n!==last;
 if(chapterChanged){
  if(pendingFocus&&pendingFocus.chapter!==n)pendingFocus=null;
  const direction=n>last?1:-1,initial=last===-2;
  const changeCopy=()=>{
   const focusRequest=pendingFocus?.chapter===n?pendingFocus:null;
   const source=focusRequest?.from,active=document.activeElement;
   const shouldFocus=focusRequest&&(active===source||(active===document.body&&(source?.disabled||source?.closest('[hidden]'))));
   if(focusRequest)pendingFocus=null;
   const intro=n<0;$('launch').hidden=!intro;$('walkaround').hidden=intro;
   $('orbit-pin').classList.toggle('inspecting',!intro);
   if(!intro){
    const c=chapters[n];$('tour-issue-link').href=c.href;$('tour-issue-link').textContent=c.link;
    $('chapter').textContent=`0${n+1} / 04`;$('tag').textContent=c.tag;
    $('tour-title').innerHTML=c.title;$('tour-body').textContent=c.body;window.lcMotion?.chapter(n);
   }else window.lcMotion?.intro();
   updateDetail(n);
   // Focus only after the destination is revealed, and preserve any newer user focus.
   if(shouldFocus)$(focusRequest.id).focus({preventScroll:true});
  };
  if(window.lcMotion?.transition)window.lcMotion.transition(changeCopy,direction,initial);else changeCopy();
  Array.from($('chapter-dots').children).forEach((b,i)=>b.setAttribute('aria-current',String(i===n)));
  $('previous').disabled=n<0;$('next').disabled=n===chapters.length-1;last=n;
 }
 if(videoReady){targetTime=progress*Math.max(0,video.duration-.04);seekVideo()}
 if(chapterChanged||forceDetail)updateDetail(n);
}
function tourDistance(){const overlap=Math.max(0,-parseFloat(getComputedStyle(document.querySelector('.page-content')).marginTop)||0);return tour.offsetHeight-innerHeight-overlap}
function scrollProgress(){const rect=tour.getBoundingClientRect(),distance=tourDistance();return distance>0?-rect.top/distance:progress}
// Native wheel/touch scrolling freely scrubs the video. Chapter buttons remain optional shortcuts.
const chapterStops=[0,...Array.from({length:chapters.length+1},(_,i)=>introFraction+i/chapters.length*(1-introFraction))];
function onScroll(){queued=false;if(!reduced.matches)render(scrollProgress());}
function setProgress(p){p=clamp(p);if(!reduced.matches)window.scrollTo({top:tour.offsetTop+p*tourDistance(),behavior:'instant'});render(p)}
function go(i,focusId){i=Math.max(-1,Math.min(chapters.length-1,i));pendingFocus=focusId?{chapter:i,id:focusId,from:document.activeElement}:null;setProgress(i<0?0:introFraction+i/chapters.length*(1-introFraction))}
slider.addEventListener('input',()=>setProgress(Number(slider.value)/1000));
slider.addEventListener('keydown',event=>{
 const forward=['ArrowRight','ArrowUp','PageUp'],back=['ArrowLeft','ArrowDown','PageDown'];
 if(![...forward,...back,'Home','End'].includes(event.key))return;
 event.preventDefault();
 const index=chapterStops.reduce((best,stop,i)=>Math.abs(stop-progress)<Math.abs(chapterStops[best]-progress)?i:best,0);
 const next=event.key==='Home'?0:event.key==='End'?chapterStops.length-1:Math.max(0,Math.min(chapterStops.length-1,index+(forward.includes(event.key)?1:-1)));
 setProgress(chapterStops[next]);
});
$('start-tour').addEventListener('click',()=>go(0,'tour-title'));$('previous').addEventListener('click',()=>go(last-1,last===0?'start-tour':null));$('next').addEventListener('click',()=>go(last+1,last===chapters.length-2?'tour-title':null));
window.addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(onScroll)}},{passive:true});window.addEventListener('resize',()=>render(reduced.matches?progress:scrollProgress(),true));
reduced.addEventListener('change',()=>{render(progress,true);if(!reduced.matches)setProgress(progress);});render(0);onScroll();

// Cached media may have loaded before this controller attached its listeners.
paintPosterFrame();
if(video.readyState>=2)useVideo();
