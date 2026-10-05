const chapters=[
  {
    "tag": "THE TRUCK",
    "title": "Big V8.<br>Small workload.",
    "body": "4.7 liters. 220,718 miles shown. Roughly 1,530 miles a year under my ownership. I bought a Land Cruiser and gave it a desk job.",
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
    "body": "$TBD. I’m considering a sale, but first I plan to chase the EVAP codes with a smoke test and get a body-shop estimate. Apparently I needed a whole website to discover I’m attached.",
    "href": "#verdict",
    "link": "Help decide: keep or sell?"
  }
];
const $=id=>document.getElementById(id);
const tour=$('tour'),slider=$('scrubber'),video=$('orbit-video'),poster=$('scene-poster');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let progress=0,last=-2,queued=false,videoReady=false,targetTime=0,frames=[],frameIndex=-1,sequence=null;
const introFraction=.08;
let pendingFocus=null,fallbackManifest=null;
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
video.addEventListener('loadeddata',()=>{
 videoReady=Number.isFinite(video.duration)&&video.duration>0;
 if(videoReady){
  video.pause();sequence?.destroy();sequence=null;
  video.hidden=false;poster.hidden=true;videoBackdrop.hidden=false;
  $('orbit-pin').classList.add('video-scene');
  paintVideoFrame();render(progress,true);
 }
});
video.addEventListener('error',()=>{
 videoReady=false;video.hidden=true;poster.hidden=false;videoBackdrop.hidden=true;
 $('orbit-pin').classList.remove('video-scene');
 startSequence();render(progress,true);
});
fetch('assets/orbit-media.json').then(r=>r.ok?r.json():null).then(m=>{
 if(m?.ready&&typeof m.src==='string'&&m.src.startsWith('assets/')){
  if(m.poster)video.poster=m.poster;
  video.src=m.src;video.load();
 }
}).catch(()=>{});
function startSequence(){
 if(videoReady||sequence||!fallbackManifest?.ready||!window.LCSequence)return;
 try{sequence=new LCSequence(fallbackManifest,{initialAngle:progress*360,onFrame:({frame,index,image})=>{
  if(videoReady)return;
  frameIndex=index;
  const img=$('tour-image');img.src=image.src;img.alt=frame.alt||frame.view;
  $('orbit-pin').style.setProperty('--orbit-image',`url("${image.src}")`);
  $('orbit-pin').dataset.frame=String(index);
  $('tour-progress').textContent=`${Math.round(frame.angle)}°`;
  updateDetail(last);
 }});frames=sequence.frames;}catch{sequence=null;}
}
fetch('assets/rotation-frames.json').then(r=>r.ok?r.json():null).then(m=>{
 fallbackManifest=m;startSequence();render(progress);
}).catch(()=>{});

let detailRevealed=-1;
function setDetailState(n,detail){
 const panel=$('inspection-detail'),open=$('detail-open');
 panel.hidden=!detail;panel.dataset.detail=String(n);
 $('bubble-video').hidden=!detail?.live;$('bubble-photo').hidden=!!detail?.live;
 open.hidden=!detail||(n!==0&&n!==2&&n!==5);
 if(n===0){open.dataset.photo=document.querySelector('#photo-27-engine-cover .photo-open').dataset.photo;open.dataset.photoSource='false';open.setAttribute('aria-label','Open the cleaned V8 detail')}
 if(n===2){open.dataset.photo=document.querySelector('#photo-08-cargo .photo-open').dataset.photo;open.dataset.photoSource='false';open.setAttribute('aria-label','Open the rear cargo photo')}
 if(n===5){open.dataset.photo=document.querySelector('#photo-24-grab-handle .photo-open').dataset.photo;open.dataset.photoSource='true';open.setAttribute('aria-label','Open the front grab-handle photo')}
 if(!detail)detailRevealed=-1;
}
function revealDetail(n){
 if(detailRevealed===n)return;detailRevealed=n;
 if(n===2||n===3)window.lcMotion?.detail($('bubble-video').hidden?$('bubble-photo'):$('bubble-video'));
}
function updateDetail(n){
 if(progress<introFraction)n=-1;else if(n===2){const phase=(orbitProgress()-.5)*4;n=phase<.38?2:phase<.68?3:5;}else if(n===3)n=-1;
 const shown=frames[frameIndex];
 if(videoReady){updateVideoDetail(n);return;}
 const aligned=shown&&Math.min(7,Math.floor(shown.angle/45+1e-8))===n;
 const detail=aligned&&!videoReady?(n===0?{point:[1050,505],label:'4.7L V8',src:'assets/gallery/27-engine-cover-edited.jpg',size:'cover',position:'50% 61%'}:n===1?{point:[1350,676],label:'KM3 · 2019',src:'assets/gallery/07-tire-source.jpg',size:'cover',position:'center'}:n===2?{point:[1250,555],label:'REAR CARGO',src:'assets/gallery/08-cargo-with-left-jump-seat-edited.png',size:'165%',position:'50% 67%'}:n===3?{point:[1120,360],label:'ROOF BARS'}:n===5?{point:[1245,470],label:'GRAB HANDLE',src:'assets/gallery/24-grab-handle.jpeg',size:'250%',position:'51% 42%'}:null):null;
 setDetailState(n,detail);
 if(!detail)return;
 const anchor=shown.anchors?.[n===1?'tire':n===2?'cargo':n===3?'roof':n===5?'handle':'engine'];
 if(anchor)detail.point=[anchor[0]*1672,anchor[1]*941];
 document.querySelector('.leader').toggleAttribute('hidden',n!==0&&!anchor&&!shown.primary);
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
 if(detail.src){revealDetail(n);$('bubble-photo').style.backgroundImage=`url('${detail.src}')`;$('bubble-photo').style.backgroundSize=detail.size;$('bubble-photo').style.backgroundPosition=detail.position;$('bubble-label').textContent=detail.label;return}
 $('bubble-photo').style.backgroundImage=`url('${frames[frameIndex].src}')`;
 $('bubble-photo').style.backgroundSize=`${iw*zoom}px ${ih*zoom}px`;
 $('bubble-photo').style.backgroundPosition=`${br.width/2-detail.point[0]/1672*iw*zoom}px ${br.height/2-detail.point[1]/941*ih*zoom}px`;
 $('bubble-label').textContent=detail.label;revealDetail(n);
}
function updateVideoDetail(n){
 const detail=n===0?{src:'assets/gallery/27-engine-cover-edited.jpg',label:'4.7L V8',size:'cover',position:'50% 61%'}:
 n===1?{src:'assets/gallery/07-tire-source.jpg',label:'KM3 · 2019',size:'cover',position:'center'}:
 n===2?{src:'assets/gallery/08-cargo-with-left-jump-seat-edited.png',label:'REAR CARGO',size:'165%',position:'50% 67%'}:
 n===3?{live:true,label:'ROOF BARS'}:
 n===5?{src:'assets/gallery/24-grab-handle.jpeg',label:'GRAB HANDLE',size:'250%',position:'51% 42%'}:null;
 setDetailState(n,detail);
 if(!detail)return;
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
  if(top+height>limit){$('inspection-detail').hidden=true;return;}
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
 $('bubble-label').textContent=detail.label;revealDetail(n);
 document.querySelector('.leader').toggleAttribute('hidden',n===5);
 $('leader-point').setAttribute('cx',x);$('leader-point').setAttribute('cy',y);
 const bubbleX=parseFloat(bubble.style.left)+width/2;
 $('leader-path').setAttribute('d',`M ${x} ${y} L ${bubbleX} ${top+height}`);
}
function render(p,forceDetail=false){
 progress=clamp(p);const op=orbitProgress(),n=progress<introFraction-.0005?-1:Math.min(chapters.length-1,Math.floor(op*chapters.length+.003));
 slider.value=Math.round(progress*1000);slider.setAttribute('aria-valuetext',n<0?'Introduction':`Chapter ${n+1} of ${chapters.length}: ${chapters[n].tag.toLowerCase()}`);
 if(videoReady)$('tour-progress').textContent=Math.round(progress*100)+'%';else if(!frames.length)$('tour-progress').textContent='0°';
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
   const showEvidence=false;$('tour-evidence').hidden=!showEvidence;
   $('orbit-pin').classList.toggle('showing-evidence',showEvidence);
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
 else if(sequence){sequence.seek(progress*360)}
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
$('tour-image').addEventListener('load',()=>updateDetail(last));
reduced.addEventListener('change',()=>{render(progress,true);if(!reduced.matches)setProgress(progress);});render(0);onScroll();
