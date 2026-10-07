const DEAD_ZONE = .14;
const BRAKE_KEYS = new Set(['Space', 'Enter']);

// A fixed-origin stick keeps steering predictable while a second finger brakes.
export function createTouchControls({joystick, knob, ebrake, enabled = () => true, onChange = () => {}}) {
  const state = {gas: 0, reverse: 0, turn: 0, handbrake: false};
  const listeners = [], brakeKeys = new Set();
  let stickPointer = null, brakePointer = null, geometry = null, disposed = false;
  const canDrive = () => !disposed && (typeof enabled === 'function' ? enabled() : enabled);
  const touchActions = [joystick, ebrake].map(element => [element, element.style.getPropertyValue('touch-action')]);
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
    change({gas: 0, reverse: 0, turn: 0});
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
  function reset() { stopStick(); stopBrake(); }

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
    if (brakeKeys.has(e.code)) e.preventDefault();
  });
  listen(ebrake.ownerDocument || ebrake, 'keyup', e => {
    if (!brakeKeys.has(e.code)) return;
    e.preventDefault(); brakeKeys.delete(e.code); updateBrake();
  });
  if (ebrake.ownerDocument?.defaultView) listen(ebrake.ownerDocument.defaultView, 'blur', reset);
  else listen(ebrake, 'blur', () => { brakeKeys.clear(); updateBrake(); });
  for (const element of [joystick, ebrake]) listen(element, 'contextmenu', e => e.preventDefault());
  position(0, 0); updateBrake();

  function dispose() {
    if (disposed) return;
    disposed = true; reset();
    for (const [element, type, listener] of listeners) element.removeEventListener(type, listener);
    for (const [element, original] of touchActions) {
      if (original) element.style.setProperty('touch-action', original);
      else element.style.removeProperty('touch-action');
    }
  }
  return {state, reset, dispose};
}
