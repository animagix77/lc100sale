const chapterNotes=[
 {tag:'THE POWERTRAIN',title:'Big V8 energy.<br>Retiree schedule.',body:'The legendary 4.7-liter V8, with approximately 220,000 miles. The owner reports the engine has never been rebuilt. Currently driven around 400 miles a year or less. Big adventure energy. A very part-time schedule.',label:'4.7L / V8',point:[350,400],crop:null,scale:1},
 {tag:'THE FUEL ECONOMY',title:'Thirsty. Capable.<br>A little smug.',body:'You don’t buy a V8 Land Cruiser to win at the pump. The owner reports trouble-free East Coast trips through rain and heavy snow. If a Wrangler or Rubicon is taking an unscheduled roadside break, try to wave politely. Fuel figures are below; Jeep rivalry is complimentary.',label:'MPG / STOCK EPA ESTIMATE',point:[800,460],crop:'83% 67%',scale:1.04},
 {tag:'THE STANCE',title:'A modest lift.<br>An immodest stance.',body:'Old Man Emu ~1.5-inch suspension and BFGoodrich KM3 tires, both fitted in 2019. 1.25-inch Bora spacers. Tire age and current condition still deserve a look.',label:'KM3 / 2019 INSTALL',point:[360,560],crop:'38% 83%',scale:1.09},
 {tag:'THE DIAGNOSTICS',title:'Three codes.<br>No subscription fee.',body:'Current owner-reported EVAP codes: P2418 / P0442 / P0446. Diagnosis and repair scope are unconfirmed.',label:'P2418 / P0442 / P0446',point:[520,340],crop:null,scale:1.02},
 {tag:'THE BODY',title:'The patina<br>has footnotes.',body:'Known rust and damage. Owner says it developed over the last seven years up here after ~200k miles in Maryland, despite light use. Owner reports a mechanic said no structural issues; no written inspection report has been provided. An independent inspection is encouraged.',label:'RUST / CLOSE-UP NEEDED',point:[720,515],crop:null,scale:1.08},
 {tag:'THE ROOF',title:'The spoiler left.<br>The bars stayed.',body:'Rear spoiler no longer present. A piece of roof-rack paneling / trim is missing. Sunroof has issues. Malone crossbars stay included. A 2-inch hitch receiver remains out back. The exact missing trim location still needs a clearer photo.',label:'SPOILER / ABSENT',point:[600,100],crop:'57% 8%',scale:1.02},
 {tag:'THE CABIN',title:'Business class.<br>Passenger side only.',body:'Driver’s seat has a tear. Passenger heated seat works; driver’s does not. Radio works; bass does not. The normal horn control is out; an added dash button is the workaround.',label:'CABIN / PHOTOS NEEDED',point:[560,340],crop:null,scale:1},
 {tag:'THE NEXT CHAPTER',title:'A hobby.<br>With a VIN.',body:'Exhaust replaced in 2022; transmission cooler work around 2022. Differential and transfer case oil in 2020. Timing belt at 200k. Owner-reported care; no receipts available. Sold as is for mechanics, handy owners and enthusiasts. Your socket set deserves a purpose.',label:'OWNER HISTORY / NO RECEIPTS',point:[500,450],crop:'55% 76%',scale:1}
];
const chapters=[0,2,4,5,3,6,1,7].map(i=>chapterNotes[i]);
const $=id=>document.getElementById(id);
const tour=$('tour'),slider=$('scrubber'),video=$('orbit-video'),poster=$('scene-poster');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let progress=0,last=-2,queued=false,videoReady=false,targetTime=0,frames=[],frameIndex=-1;
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
fetch('assets/rotation-frames.json').then(r=>r.ok?r.json():null).then(m=>{if(m?.ready&&Array.isArray(m.frames)&&m.frames.length>1&&m.frames.every(f=>typeof f.src==='string'&&f.src.startsWith('assets/'))){Promise.all(m.frames.map(f=>new Promise(resolve=>{const im=new Image();im.onload=async()=>{try{await im.decode();resolve(f)}catch{resolve(null)}};im.onerror=()=>resolve(null);im.src=f.src}))).then(loaded=>{if(loaded.every(Boolean)){frames=loaded;render(progress)}})}}).catch(()=>{});
function updateDetail(n){
 const detail=frames.length&&!videoReady?(n===0?{point:[1050,505],label:'4.7L V8',src:'assets/gallery/06-engine-source.jpg',size:'cover',position:'center'}:n===1?{point:[1350,676],label:'KM3 · 2019',src:'assets/gallery/07-tire-source.jpg',size:'cover',position:'center'}:n===3?{point:[1210,392],label:'NO SPOILER'}:n===5?{point:[1280,505],label:'HORN BUTTON',src:'assets/gallery/01-horn-button-source.jpg',size:'280%',position:'63% 25%'}:null):null;
 $('inspection-detail').hidden=!detail;
 $('inspection-detail').dataset.detail=String(n);
 if(!detail)return;
 const img=$('tour-image'),pin=$('orbit-pin'),r=img.getBoundingClientRect(),base=pin.getBoundingClientRect();
 const iw=img.naturalWidth,ih=img.naturalHeight;if(!iw||!ih)return;
 const scale=Math.max(r.width/iw,r.height/ih),left=r.left-base.left+(r.width-iw*scale)/2,top=r.top-base.top+(r.height-ih*scale)/2;
 const x=left+detail.point[0]*scale,y=top+detail.point[1]*scale;
 const bubble=$('bubble');
 // Keep the tire detail near the rear wheel; the engine detail needs no tether.
 ['left','top','right'].forEach(property=>bubble.style.removeProperty(property));
 if(n===1){
  const width=bubble.offsetWidth,height=bubble.offsetHeight,gap=innerWidth<=700?34:46;
  bubble.style.left=`${Math.max(16,Math.min(base.width-width-16,x-width/2))}px`;
  bubble.style.right='auto';bubble.style.top=`${Math.max(16,y-height-gap)}px`;
 }
 if(innerWidth<=700){
  const copyBottom=document.querySelector('.tour-copy').getBoundingClientRect().bottom-base.top;
  const currentTop=bubble.getBoundingClientRect().top-base.top;
  const targetTop=Math.max(currentTop,copyBottom+16);
  const controlsTop=document.querySelector('.orbit-bottom').getBoundingClientRect().top-base.top;
  if(targetTop+bubble.offsetHeight>controlsTop-16){$('inspection-detail').hidden=true;return}
  bubble.style.top=`${targetTop}px`;
 }
 const br=bubble.getBoundingClientRect(),bx=br.left-base.left+br.width/2,by=br.top-base.top+br.height;
 $('leader-path').setAttribute('d',n===1?`M ${x} ${y} L ${bx} ${by}`:`M ${x} ${y} L ${bx-25} ${by+20} L ${bx} ${by}`);
 $('leader-point').setAttribute('cx',x);$('leader-point').setAttribute('cy',y);
 const zoom=br.width/(n===1?240:330);
 if(detail.src){$('bubble-photo').style.backgroundImage=`url('${detail.src}')`;$('bubble-photo').style.backgroundSize=detail.size;$('bubble-photo').style.backgroundPosition=detail.position;$('bubble-label').textContent=detail.label;return}
 $('bubble-photo').style.backgroundImage=`url('${frames[frameIndex].src}')`;
 $('bubble-photo').style.backgroundSize=`${iw*zoom}px ${ih*zoom}px`;
 $('bubble-photo').style.backgroundPosition=`${br.width/2-detail.point[0]*zoom}px ${br.height/2-detail.point[1]*zoom}px`;
 $('bubble-label').textContent=detail.label;
}
function render(p,forceDetail=false){
 progress=clamp(p);const op=orbitProgress(),n=progress<introFraction?-1:Math.min(7,Math.floor(op*8));
 slider.value=Math.round(progress*1000);slider.setAttribute('aria-valuetext',n<0?'Introduction':`Chapter ${n+1} of 8: ${chapters[n].tag.toLowerCase()}`);
 $('tour-progress').textContent=videoReady||frames.length?(frames.length&&!videoReady?Math.min(8,Math.floor(op*8))*45:Math.round(op*360))+'°':String(Math.round(progress*100)).padStart(2,'0')+'%';
 const chapterChanged=n!==last;let frameChanged=false;
 if(chapterChanged){const intro=n<0;$('launch').hidden=!intro;$('walkaround').hidden=intro;$('orbit-pin').classList.toggle('inspecting',!intro);$('tour-mode').textContent=intro?'ONE TRUCK. SEVERAL WEEKENDS.':'THE HONEST WALKAROUND';
 if(!intro){const c=chapters[n];$('chapter').textContent=`0${n+1} / 08`;$('tag').textContent=c.tag;$('tour-title').innerHTML=c.title;$('tour-body').textContent=c.body;window.lcMotion?.chapter(n)}
 Array.from($('chapter-dots').children).forEach((b,i)=>b.setAttribute('aria-current',String(i===n)));$('previous').disabled=intro;$('next').disabled=n===7;last=n;
 }
 if(videoReady){targetTime=op*Math.max(0,video.duration-.04);seekVideo()}
 else if(frames.length){const index=Math.min(frames.length-1,Math.floor(op*(frames.length-1)));if(index!==frameIndex){frameChanged=true;if(window.lcMotion)window.lcMotion.frame(frames[index].src);else $('tour-image').src=frames[index].src;$('orbit-pin').style.setProperty('--orbit-image',`url("${frames[index].src}")`);$('orbit-pin').dataset.frame=String(index);frameIndex=index}slider.setAttribute('aria-valuetext',`${frames[index].angle} degrees, ${frames[index].view}${n<0?'':`, ${chapters[n].tag.toLowerCase()}`}`)}
 if(chapterChanged||frameChanged||forceDetail)updateDetail(n);
}
function scrollProgress(){const rect=tour.getBoundingClientRect(),distance=tour.offsetHeight-innerHeight;return distance>0?-rect.top/distance:progress}
function onScroll(){queued=false;if(!reduced.matches)render(scrollProgress())}
function setProgress(p){p=clamp(p);if(!reduced.matches)window.scrollTo({top:tour.offsetTop+p*(tour.offsetHeight-innerHeight),behavior:'instant'});render(p)}
function go(i){i=Math.max(-1,Math.min(7,i));setProgress(i<0?0:introFraction+(i+.15)/8*(1-introFraction))}
slider.addEventListener('input',()=>setProgress(Number(slider.value)/1000));
$('start-tour').addEventListener('click',()=>{go(0);$('tour-title').focus({preventScroll:true})});$('previous').addEventListener('click',()=>{go(last-1);if($('previous').disabled)$('start-tour').focus({preventScroll:true})});$('next').addEventListener('click',()=>{go(last+1);if($('next').disabled)$('tour-title').focus({preventScroll:true})});
window.addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(onScroll)}},{passive:true});window.addEventListener('resize',()=>render(reduced.matches?progress:scrollProgress(),true));
$('tour-image').addEventListener('load',()=>updateDetail(last));
reduced.addEventListener('change',()=>{if(!reduced.matches)onScroll()});render(0);onScroll();
