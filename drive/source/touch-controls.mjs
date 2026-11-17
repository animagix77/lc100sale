const DEAD_ZONE = .14;
const BRAKE_KEYS = new Set(['Space', 'Enter']);

// A fixed-origin stick keeps steering predictable while a second finger brakes.
export function createTouchControls({joystick, knob, ebrake, accelerator = null, serviceBrake = null, mode = 'joystick', enabled = () => true, onChange = () => {}}) {
  const state = {gas: 0, reverse: 0, turn: 0, handbrake: false};
  const listeners = [], brakeKeys = new Set();
  let stickPointer = null, brakePointer = null, geometry = null, disposed = false;
  let controlMode = mode === 'pedals' && accelerator && serviceBrake ? 'pedals' : 'joystick';
  const pedals = [accelerator, serviceBrake].filter(Boolean).map((element, index) => ({element, channel:index ? 'reverse' : 'gas', pointer:null, amount:0, rect:null, keys:new Set()}));
  const canDrive = () => !disposed && (typeof enabled === 'function' ? enabled() : enabled);
  const touchActions = [joystick, ebrake, ...pedals.map(p=>p.element)].map(element => [element, element.style.getPropertyValue('touch-action')]);
  for (const [element] of touchActions) element.style.setProperty('touch-action', 'none');

  function listen(element, type, listener) {
    element.addEventListener(type, listener, {passive: false});
    listeners.push([element, type, listener]);
  }
  function change(next) {
    let changed = false;
    for (const [key, value] of Object.entries(next)) {
      if (state[key] !== value) { state[key] = value; changed = true; }
    }
    if (changed) onChange({...state});
  }
  function position(x, y) {
    joystick.style.setProperty('--stick-x', `${x}px`);
    joystick.style.setProperty('--stick-y', `${y}px`);
  }
  function capture(element, id) {
    try { element.setPointerCapture(id); } catch { /* Detached UI or an already-cancelled pointer. */ }
  }
  function release(element, id) {
    if (id === null) return;
    try { if (element.hasPointerCapture(id)) element.releasePointerCapture(id); } catch { /* Capture may already be gone. */ }
  }
  function updateStick(e) {
    const dx = e.clientX - geometry.x, dy = e.clientY - geometry.y;
    if(controlMode === 'pedals') {
      const raw = Math.max(-1,Math.min(1,dx / geometry.radius));
      const amount = Math.max(0,(Math.abs(raw)-DEAD_ZONE)/(1-DEAD_ZONE));
      position(raw * geometry.radius,0); change({turn:-Math.sign(raw)*amount || 0}); return;
    }
    const distance = Math.hypot(dx, dy), radius = geometry.radius;
    const clamp = distance > radius ? radius / distance : 1;
    position(dx * clamp, dy * clamp);
    const amount = Math.max(0, (Math.min(1, distance / radius) - DEAD_ZONE) / (1 - DEAD_ZONE));
    const scale = distance > 0 ? amount / distance : 0;
    const turn = -dx * scale, vertical = -dy * scale;
    change({turn: turn || 0, gas: Math.max(0, vertical), reverse: Math.max(0, -vertical)});
  }
  function stopStick() {
    const id = stickPointer;
    stickPointer = null; geometry = null;
    joystick.classList.remove('is-active'); position(0, 0);
    change(controlMode === 'pedals' ? {turn:0} : {gas: 0, reverse: 0, turn: 0});
    release(joystick, id);
  }
  function updateBrake() {
    const active = brakePointer !== null || brakeKeys.size > 0;
    ebrake.classList.toggle('is-active', active);
    ebrake.setAttribute('aria-pressed', String(active));
    change({handbrake: active});
  }
  function stopBrake() {
    const id = brakePointer;
    brakePointer = null; brakeKeys.clear(); updateBrake();
    release(ebrake, id);
  }
  function updatePedals() {
    const gas=pedals.find(p=>p.channel==='gas')?.amount || 0, reverse=pedals.find(p=>p.channel==='reverse')?.amount || 0;
    // The service brake wins when both pedals are held; releasing it restores
    // the still-held accelerator without a new touch or a stuck input.
    if(controlMode==='pedals')change({gas:reverse>0?0:gas,reverse});
    for(const p of pedals){p.element.classList.toggle('is-active',p.amount>0);p.element.setAttribute('aria-pressed',String(p.amount>0));p.element.style.setProperty('--pedal-fill',`${p.amount*100}%`);}
  }
  function stopPedal(p,clearKeys=false) { const id=p.pointer;p.pointer=null;p.rect=null;if(clearKeys)p.keys.clear();p.amount=p.keys.size?1:0;release(p.element,id);updatePedals(); }
  function reset() { stopStick(); stopBrake(); for(const p of pedals)stopPedal(p,true); }
  function setMode(next) {
    reset();controlMode=next==='pedals'&&pedals.length===2?'pedals':'joystick';
    joystick.setAttribute('aria-label',controlMode==='pedals'?'Steering control':'Driving joystick');
    joystick.ownerDocument?.getElementById('game')?.setAttribute('data-touch-mode',controlMode);
    const doc=joystick.ownerDocument, split=controlMode==='pedals';
    const help=doc?.getElementById('joystick-help');if(help)help.textContent=split?'Drag left or right to steer. Use the right pedals to accelerate or brake then reverse. Press lower for gentle input and slide upward for more. E-brake brakes the rear wheels. Release to coast. Drag the scenery to look around; the camera returns after five seconds.':'Drag up to accelerate, down to brake then reverse, and sideways to steer. A smaller movement gives gentler input. E-brake brakes the rear wheels. Release to coast. WASD also drives. Drag the scenery to look around; the camera returns after five seconds. Arrow keys also orbit the camera; C recenters it.';
    const helpText={
      'pause-touch-title':split?'Left thumb steers. Right thumb drives.':'Left thumb drives.',
      'pause-touch-note':split?'Press lower on a pedal for gentle input; slide upward for more.':'Small movements. Gentle inputs.',
      'pause-touch-pedals-label':split?'Right pedals':'Up / down',
      'pause-touch-pedals-action':split?'GAS accelerates. BRAKE slows, then reverses.':'Gas / brake, then reverse'
    };
    for(const [id,text] of Object.entries(helpText)){const target=doc?.getElementById(id);if(target)target.textContent=text;}
    return controlMode;
  }

  listen(joystick, 'pointerdown', e => {
    if (!canDrive() || stickPointer !== null || (e.button !== undefined && e.button !== 0)) return;
    e.preventDefault();
    const rect = joystick.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    const knobRect = knob?.getBoundingClientRect();
    const knobSize = knobRect ? Math.max(knobRect.width, knobRect.height) : size * .36;
    geometry = {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, radius: Math.max(1, (size - knobSize) / 2)};
    stickPointer = e.pointerId;
    joystick.classList.add('is-active');
    capture(joystick, stickPointer); updateStick(e);
  });
  listen(joystick, 'pointermove', e => {
    if (e.pointerId !== stickPointer) return;
    e.preventDefault();
    if (!canDrive()) { reset(); return; }
    updateStick(e);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    listen(joystick, type, e => {
      if (e.pointerId !== stickPointer) return;
      e.preventDefault(); stopStick();
    });
  }
  listen(ebrake, 'pointerdown', e => {
    if (!canDrive() || brakePointer !== null || (e.button !== undefined && e.button !== 0)) return;
    e.preventDefault(); brakePointer = e.pointerId;
    capture(ebrake, brakePointer); updateBrake();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    listen(ebrake, type, e => {
      if (e.pointerId !== brakePointer) return;
      e.preventDefault(); const id = brakePointer; brakePointer = null;
      updateBrake(); release(ebrake, id);
    });
  }
  listen(ebrake, 'keydown', e => {
    if (!canDrive() || !BRAKE_KEYS.has(e.code) || e.metaKey || e.ctrlKey || e.altKey || e.isComposing || e.defaultPrevented) return;
    e.preventDefault(); brakeKeys.add(e.code); updateBrake();
  });
  // Driving keys move focus to the canvas. Keep a held brake until its key is
  // released anywhere in this document, rather than dropping it on focus transfer.
  if (ebrake.ownerDocument) listen(ebrake.ownerDocument, 'keydown', e => {
    if (brakeKeys.has(e.code)||pedals.some(p=>p.keys.has(e.code))) e.preventDefault();
  });
  listen(ebrake.ownerDocument || ebrake, 'keyup', e => {
    if (!brakeKeys.has(e.code)) return;
    e.preventDefault(); brakeKeys.delete(e.code); updateBrake();
  });
  if (ebrake.ownerDocument?.defaultView) listen(ebrake.ownerDocument.defaultView, 'blur', reset);
  else listen(ebrake, 'blur', () => { brakeKeys.clear(); updateBrake(); });
  for(const p of pedals){
    const amountAt=e=>Math.max(.15,Math.min(1,1-(e.clientY-p.rect.top)/p.rect.height));
    listen(p.element,'pointerdown',e=>{
      if(!canDrive()||controlMode!=='pedals'||p.pointer!==null||(e.button!==undefined&&e.button!==0))return;
      e.preventDefault();p.rect=p.element.getBoundingClientRect();p.pointer=e.pointerId;p.amount=amountAt(e);capture(p.element,p.pointer);updatePedals();
    });
    listen(p.element,'pointermove',e=>{if(e.pointerId!==p.pointer)return;e.preventDefault();if(!canDrive()){reset();return;}p.amount=amountAt(e);updatePedals();});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(p.element,type,e=>{if(e.pointerId!==p.pointer)return;e.preventDefault();stopPedal(p);});
    listen(p.element,'keydown',e=>{if(!canDrive()||controlMode!=='pedals'||!BRAKE_KEYS.has(e.code)||e.metaKey||e.ctrlKey||e.altKey||e.isComposing)return;e.preventDefault();p.keys.add(e.code);p.amount=1;updatePedals();});
    listen(p.element.ownerDocument||p.element,'keyup',e=>{if(!p.keys.has(e.code))return;e.preventDefault();p.keys.delete(e.code);if(!p.keys.size&&p.pointer===null)p.amount=0;updatePedals();});
  }
  for (const element of [joystick, ebrake,...pedals.map(p=>p.element)]) listen(element, 'contextmenu', e => e.preventDefault());
  position(0, 0); updateBrake();
  setMode(controlMode);

  function dispose() {
    if (disposed) return;
    disposed = true; reset();
    for (const [element, type, listener] of listeners) element.removeEventListener(type, listener);
    for (const [element, original] of touchActions) {
      if (original) element.style.setProperty('touch-action', original);
      else element.style.removeProperty('touch-action');
    }
  }
  return {state, reset, dispose, setMode, get mode(){return controlMode;}};
}
