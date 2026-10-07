// Registered photographic planes: mouse movement on desktop, device tilt on touch.
// The original photograph remains the accessible and reduced-motion fallback.
(() => {
 const figure=document.querySelector('#photo-15-beach-penthouse');
 const photo=figure?.querySelector('.photo-open');
 if(!photo)return;
 const motion=matchMedia('(prefers-reduced-motion:no-preference)');
 const pointer=matchMedia('(hover:hover) and (pointer:fine)');
 const coarse=matchMedia('(any-pointer:coarse)');
 const planes=[['sky',3,2],['dunes',7,6],['contact',15,12],['camp',15,12],['foreground',25,25]];
 const sensor=window.DeviceOrientationEvent;
 const needsPermission=typeof sensor?.requestPermission==='function';
 const touchSensor=()=>!!sensor&&(navigator.maxTouchPoints>0||coarse.matches)&&window.isSecureContext;
 let permission=needsPermission?'prompt':'granted',wanted=true,listening=false,sensorSeen=false,baseline=null,watchdog=0;
 let stage=null,images=[],loading=false,ready=false,visible=false,frame=0,last=0;
 let x=0,y=0,targetX=0,targetY=0,measure=true,width=0,height=0,input='pointer';
 let control=null,status=null,pending=false,failed=false;
 const clamp=value=>Math.max(-1,Math.min(1,value));
 const angleDifference=(a,b)=>((a-b+540)%360)-180;
 const screenAngle=()=>Number(screen.orientation?.angle??window.orientation??0);
 function queue(){if(!frame&&ready&&visible&&motion.matches&&!document.hidden)frame=requestAnimationFrame(tick);}
 function neutral(){targetX=targetY=0;baseline=null;queue();}
 function reset(){
  targetX=targetY=x=y=0;baseline=null;cancelAnimationFrame(frame);frame=0;last=0;measure=true;
  images.forEach(img=>img.style.removeProperty('transform'));
 }
 function refresh(){measure=true;queue();}
 function setInput(next){input=next;if(stage)stage.dataset.input=input;}
 function tick(time){
  frame=0;
  if(!ready||!visible||!motion.matches||document.hidden){reset();return;}
  if(measure){const rect=photo.getBoundingClientRect();width=rect.width;height=rect.height;measure=false;}
  const dt=last?Math.min(time-last,48):16;last=time;
  const ease=1-Math.exp(-dt/160);x+=(targetX-x)*ease;y+=(targetY-y)*ease;
  // Share the crop and scale; constrain travel to the available overscan so
  // tilting a narrow phone never uncovers a strip of the fallback photograph.
  const scale=1.1,limitX=Math.max(0,width*(scale-1)/2-2),limitY=Math.max(0,height*(scale-1)/2-2);
  const gainX=Math.min(1,limitX/25),gainY=Math.min(1,limitY/25);
  images.forEach((img,i)=>{
   const [,dx,dy]=planes[i];
   img.style.transform=`translate3d(${(-x*dx*gainX).toFixed(3)}px,${(-y*dy*gainY).toFixed(3)}px,0) scale(${scale})`;
  });
  if(Math.abs(targetX-x)+Math.abs(targetY-y)>.001)frame=requestAnimationFrame(tick);else last=0;
 }
 function updateControl(){
  if(!control)return;
  control.hidden=!ready||!touchSensor()||!motion.matches;
  control.disabled=pending;
  const active=wanted&&sensorSeen&&permission==='granted';
  control.setAttribute('aria-pressed',String(active));
  control.textContent=pending?'Enabling…':active?'Tilt on':failed?'Try tilt':'Enable tilt';
  control.setAttribute('aria-label',active?'Turn off device tilt parallax':'Enable device tilt parallax');
  control.title=active?'Tilt your device to explore the photo. Tap to turn off.':'Use your device’s motion sensors to explore the photo';
 }
 function stopSensor(){
  window.removeEventListener('deviceorientation',onOrientation);listening=false;
  clearTimeout(watchdog);watchdog=0;baseline=null;
 }
 function syncSensor(){
  const active=ready&&visible&&motion.matches&&!document.hidden&&touchSensor()&&wanted&&permission==='granted';
  if(!active){stopSensor();updateControl();return;}
  if(!listening){
   baseline=null;listening=true;window.addEventListener('deviceorientation',onOrientation,{passive:true});
   watchdog=setTimeout(()=>{
    if(!listening||baseline)return;
    failed=true;wanted=false;stopSensor();neutral();
    if(status)status.textContent='Tilt isn’t available right now. The photo still opens normally.';
    updateControl();
   },2500);
  }
  updateControl();
 }
 function onOrientation(event){
  if(!listening||!visible||document.hidden||!motion.matches||!Number.isFinite(event.beta)||!Number.isFinite(event.gamma))return;
  const angle=screenAngle();
  if(!baseline||baseline.angle!==angle)baseline={beta:event.beta,gamma:event.gamma,angle};
  clearTimeout(watchdog);watchdog=0;
  if(!sensorSeen||failed){sensorSeen=true;failed=false;if(status)status.textContent='';updateControl();}
  // Calibrate to the way the person is holding the device, then rotate those
  // relative angles into the current portrait/landscape screen axes.
  const beta=angleDifference(event.beta,baseline.beta),gamma=angleDifference(event.gamma,baseline.gamma),r=angle*Math.PI/180;
  const horizontal=gamma*Math.cos(r)+beta*Math.sin(r),vertical=beta*Math.cos(r)-gamma*Math.sin(r);
  const response=(degrees,range)=>Math.abs(degrees)<.35?0:clamp(degrees/range);
  targetX=response(horizontal,18);targetY=response(vertical,22);setInput('tilt');queue();
 }
 function createControl(){
  if(control||!sensor)return;
  control=document.createElement('button');control.type='button';control.className='camp-tilt-control';
  status=document.createElement('span');status.className='camp-tilt-status';status.id='camp-tilt-status';status.setAttribute('role','status');
  control.setAttribute('aria-describedby',status.id);figure.append(control,status);
  control.addEventListener('click',async()=>{
   if(pending)return;
   if(wanted&&sensorSeen&&permission==='granted'){wanted=false;stopSensor();neutral();updateControl();return;}
   pending=true;failed=false;status.textContent='';updateControl();
   try{
    // iOS requires this call directly inside the user's tap, before awaiting
    // image downloads or doing any other asynchronous work.
    if(needsPermission)permission=await sensor.requestPermission();
    if(permission!=='granted'){
     wanted=false;failed=true;status.textContent='Motion access was not enabled. The photo still opens normally.';
    }else{wanted=true;sensorSeen=false;neutral();syncSensor();}
   }catch{wanted=false;failed=true;status.textContent='Couldn’t enable tilt. The photo still opens normally.';}
   finally{pending=false;syncSensor();updateControl();}
  });
  updateControl();
 }
 async function load(){
  if(loading||ready||!motion.matches)return;loading=true;
  const next=document.createElement('span');next.className='camp-depth';next.setAttribute('aria-hidden','true');
  try{
   await Promise.all(planes.map(async([name])=>{
    const img=new Image();img.alt='';img.draggable=false;img.className=`camp-plane camp-${name}`;img.decoding='async';img.src=`assets/camp-parallax/${name}.${name==='contact'?'svg':'webp'}`;next.append(img);await img.decode();
   }));
   stage=next;images=[...next.querySelectorAll('img')];stage.dataset.input=input;photo.append(stage);ready=true;
   photo.classList.toggle('camp-depth-ready',motion.matches);createControl();syncSensor();refresh();
  }catch{next.remove();}finally{loading=false;}
 }
 photo.addEventListener('pointermove',event=>{
  if(event.pointerType!=='mouse'||!pointer.matches||!motion.matches||input==='tilt'&&wanted)return;
  setInput('pointer');const rect=photo.getBoundingClientRect();width=rect.width;height=rect.height;
  targetX=clamp(2*(event.clientX-rect.left)/rect.width-1);targetY=clamp(2*(event.clientY-rect.top)/rect.height-1);queue();
 },{passive:true});
 photo.addEventListener('pointerleave',()=>{if(input==='pointer'){targetX=targetY=0;queue();}});
 photo.addEventListener('dragstart',event=>{if(ready&&motion.matches&&input==='pointer')event.preventDefault();});
 photo.addEventListener('blur',()=>{if(input==='pointer'){targetX=targetY=0;queue();}});
 const preload=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))load();},{rootMargin:'400px'});
 const visibility=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){load();refresh();}else reset();syncSensor();});
 preload.observe(photo);visibility.observe(photo);
 motion.addEventListener('change',()=>{reset();photo.classList.toggle('camp-depth-ready',ready&&motion.matches);if(motion.matches&&visible){load();refresh();}syncSensor();});
 coarse.addEventListener('change',syncSensor);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();else refresh();syncSensor();});
 const reorient=()=>{neutral();refresh();};
 screen.orientation?.addEventListener('change',reorient);
 window.addEventListener('orientationchange',reorient,{passive:true});
 window.addEventListener('resize',refresh,{passive:true});
})();
