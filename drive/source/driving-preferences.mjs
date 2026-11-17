// Judge Dean LLC — optional precise touch controls and a single driving settings surface.
export const TOUCH_LAYOUT_KEY='com.judgedeanllc.lc100.touch-layout.v1';
export function readTouchLayout(storage){try{return storage?.getItem(TOUCH_LAYOUT_KEY)==='pedals'?'pedals':'joystick';}catch{return 'joystick';}}
export function saveTouchLayout(storage,mode){try{if(typeof storage?.setItem!=='function')return false;storage.setItem(TOUCH_LAYOUT_KEY,mode==='pedals'?'pedals':'joystick');return true;}catch{return false;}}
function defaultStorage(){try{return localStorage;}catch{return null;}}

function modalControls(dialog,{onOpen=()=>{},onClose=()=>{}}){
 const events=[];let backdrop=false;
 const listen=(e,type,fn)=>{e.addEventListener(type,fn);events.push(()=>e.removeEventListener(type,fn));};
 const outside=e=>{if(e.target!==dialog)return false;const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
 const close=({focus=true,notify=true}={})=>{if(!dialog.open)return;dialog.close();if(notify)onClose();if(focus)dialog.ownerDocument?.getElementById('view')?.focus({preventScroll:true});};
 const open=()=>{if(dialog.open)return;onOpen();dialog.showModal();};
 listen(dialog,'cancel',e=>{e.preventDefault();close();});
 listen(dialog,'pointerdown',e=>{backdrop=outside(e);});
 listen(dialog,'pointercancel',()=>{backdrop=false;});
 listen(dialog,'click',e=>{const dismiss=backdrop&&outside(e);backdrop=false;if(dismiss)close();});
 return {open,close,listen,dispose(){for(const remove of events)remove();}};
}

export function createDrivingPreferences({controls,onOpen=()=>{},onClose=()=>{},onQuality=()=>{},qualityMode='auto',storage=defaultStorage(),doc=document}){
 const dialog=doc.getElementById('driving-settings'),trigger=doc.getElementById('settings');
 const modal=modalControls(dialog,{onOpen,onClose});
 const choices=Array.from(dialog.querySelectorAll('[data-touch-layout]'));
 function choose(mode,persist=true){
  const chosen=controls.setMode(mode);
  for(const b of choices)b.setAttribute('aria-pressed',String(b.dataset.touchLayout===chosen));
  doc.getElementById('touch-layout-note').textContent=chosen==='pedals'?'Left thumb steers. On the right, hold a pedal lower for gentle input and slide upward for more. Brake slows you down, then reverses.':'One thumb drives: up for gas, down to brake then reverse, sideways to steer. Release to coast.';
  if(persist&&!saveTouchLayout(storage,chosen))doc.getElementById('touch-layout-note').textContent+=' This choice applies for this visit; browser storage is unavailable.';
 }
 choose(readTouchLayout(storage),false);
 for(const b of choices)modal.listen(b,'click',()=>choose(b.dataset.touchLayout));
 const quality=doc.getElementById('graphics-quality');quality.value=qualityMode;
 modal.listen(quality,'change',()=>onQuality(quality.value));
 modal.listen(trigger,'click',modal.open);modal.listen(doc.getElementById('settings-close'),'click',modal.close);
 return {...modal,dialog};
}

// A short driving hint opens a full, parked reading surface without changing
// the camera clearance or removing the minimap from the driving layout.
export function createTrailAdviceReader({onOpen=()=>{},onClose=()=>{},doc=document}={}){
 const dialog=doc.getElementById('advice-dialog'),modal=modalControls(dialog,{onOpen,onClose});
 modal.listen(doc.getElementById('advice-close'),'click',modal.close);
 return {...modal,dialog,open({title,body}){
  doc.getElementById('advice-title').textContent=title;
  doc.getElementById('advice-body').textContent=body;modal.open();
 }};
}
