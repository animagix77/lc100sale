import assert from 'node:assert/strict';
import {createTouchControls} from './touch-controls.mjs';

class Element {
  constructor(rect = {left: 10, top: 20, width: 160, height: 160}) {
    this.rect = rect; this.listeners = new Map(); this.captures = new Set(); this.attributes = new Map();
    const styles = new Map(), classes = new Set();
    this.style = {setProperty: (key, value) => styles.set(key, value), getPropertyValue: key => styles.get(key) || '', removeProperty: key => styles.delete(key)};
    this.classList = {add: key => classes.add(key), remove: key => classes.delete(key), contains: key => classes.has(key), toggle: (key, active) => active ? classes.add(key) : classes.delete(key)};
  }
  getBoundingClientRect() { return this.rect; }
  setAttribute(key, value) { this.attributes.set(key, value); }
  addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(listener); }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); this.emit('lostpointercapture', {pointerId: id}); }
  emit(type, properties = {}) {
    const e = {pointerId: 1, button: 0, clientX: 90, clientY: 100, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...properties};
    for (const listener of this.listeners.get(type) || []) listener(e);
    return e;
  }
}
const joystick = new Element(), knob = new Element({left: 60, top: 70, width: 60, height: 60}), ebrake = new Element();
const keyboardDocument = new Element(), browserWindow = new Element();
keyboardDocument.defaultView = browserWindow; ebrake.ownerDocument = keyboardDocument;
let enabled = true; const changes = [];
const controller = createTouchControls({joystick, knob, ebrake, enabled: () => enabled, onChange: value => changes.push(value)});
const {state} = controller;
const neutral = () => assert.deepEqual(state, {gas: 0, reverse: 0, turn: 0, handbrake: false});
const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-9, `${actual} ≈ ${expected}`);
neutral(); assert.equal(joystick.style.getPropertyValue('touch-action'), 'none');
assert(joystick.emit('pointerdown').defaultPrevented); assert(joystick.captures.has(1));
assert(joystick.classList.contains('is-active'));
joystick.emit('pointermove', {clientY: 94}); neutral(); assert.equal(changes.length, 0, 'dead-zone motion does not create input');
joystick.emit('pointermove', {clientY: 71.5}); near(state.gas, .5); assert.equal(state.reverse, 0);
assert.equal(joystick.style.getPropertyValue('--stick-y'), '-28.5px');
joystick.emit('pointermove', {clientY: -900}); near(state.gas, 1);
assert.equal(joystick.style.getPropertyValue('--stick-y'), '-50px');
joystick.emit('pointermove', {clientX: 140, clientY: 50}); near(state.gas, Math.SQRT1_2); near(state.turn, -Math.SQRT1_2);
near(Math.hypot(parseFloat(joystick.style.getPropertyValue('--stick-x')), parseFloat(joystick.style.getPropertyValue('--stick-y'))), 50);
const beforeForeign = {...state};
joystick.emit('pointerdown', {pointerId: 2, clientY: 200});
joystick.emit('pointermove', {pointerId: 2, clientY: 200});
joystick.emit('pointerup', {pointerId: 2}); assert.deepEqual(state, beforeForeign, 'another finger cannot steal or end steering');
assert(ebrake.emit('pointerdown', {pointerId: 2}).defaultPrevented); assert(state.handbrake);
assert.equal(ebrake.attributes.get('aria-pressed'), 'true'); assert.equal(state.gas, beforeForeign.gas, 'brake and stick use independent fingers');
ebrake.emit('pointercancel', {pointerId: 99}); assert(state.handbrake, 'foreign pointer cancellation does not end braking');
joystick.emit('pointercancel'); assert.equal(state.gas, 0); assert.equal(state.turn, 0); assert(state.handbrake);
assert.equal(joystick.style.getPropertyValue('--stick-x'), '0px'); assert(!joystick.captures.size);
ebrake.emit('pointerup', {pointerId: 2}); neutral(); assert(!ebrake.captures.size);
assert.equal(ebrake.attributes.get('aria-pressed'), 'false');
joystick.emit('pointerdown', {clientX: 40, clientY: 100}); near(state.turn, 1);
joystick.emit('pointermove', {clientX: 90, clientY: 150}); near(state.reverse, 1); assert.equal(state.gas, 0);
joystick.emit('lostpointercapture'); neutral();
joystick.emit('pointerdown', {clientY: 50}); ebrake.emit('pointerdown', {pointerId: 2});
controller.reset(); neutral(); assert(!joystick.captures.size && !ebrake.captures.size);
joystick.emit('pointermove', {clientY: 50}); neutral();
assert(!joystick.classList.contains('is-active') && !ebrake.classList.contains('is-active'));
enabled = false;
assert(!joystick.emit('pointerdown', {clientY: 50}).defaultPrevented);
assert(!ebrake.emit('pointerdown').defaultPrevented); neutral();
enabled = true; joystick.emit('pointerdown', {clientY: 50}); enabled = false;
joystick.emit('pointermove', {clientY: 20}); neutral(); assert(!joystick.captures.size, 'disabling during a drag clears input');
enabled = true;
assert(!joystick.emit('pointerdown', {button: 2}).defaultPrevented); neutral();
assert(ebrake.emit('keydown', {code: 'Space'}).defaultPrevented); assert(state.handbrake);
assert(keyboardDocument.emit('keydown', {code: 'Space', repeat: true}).defaultPrevented, 'repeating a held e-brake key cannot become the canvas foot brake');
ebrake.emit('keydown', {code: 'Space', repeat: true}); ebrake.emit('keydown', {code: 'Enter'});
keyboardDocument.emit('keyup', {code: 'Space'}); assert(state.handbrake, 'another held brake key still applies');
ebrake.emit('blur'); assert(state.handbrake, 'moving focus to the driving canvas keeps the held brake');
keyboardDocument.emit('keyup', {code: 'Enter'}); neutral();
ebrake.emit('pointerdown', {pointerId: 7}); ebrake.emit('keydown', {code: 'Space'});
ebrake.emit('blur'); assert(state.handbrake, 'keyboard blur cannot release an active brake finger');
keyboardDocument.emit('keyup', {code: 'Space'}); assert(state.handbrake, 'key release cannot release an active brake finger');
ebrake.emit('pointerup', {pointerId: 7}); neutral();
ebrake.emit('keydown', {code: 'Space'}); joystick.emit('pointerdown', {clientY: 50});
browserWindow.emit('blur'); neutral(); assert(!joystick.captures.size, 'leaving the window clears held keys and pointers');
assert(!keyboardDocument.emit('keydown', {code: 'Space'}).defaultPrevented, 'regular canvas braking keeps its keyboard input');
assert(!keyboardDocument.emit('keyup', {code: 'Space'}).defaultPrevented, 'unrelated button key releases keep native activation');
assert(!keyboardDocument.emit('keyup', {code: 'Enter'}).defaultPrevented);
assert(!ebrake.emit('keydown', {code: 'KeyW'}).defaultPrevented);
assert(!ebrake.emit('keydown', {code: 'Space', ctrlKey: true}).defaultPrevented); neutral();
assert(joystick.emit('contextmenu').defaultPrevented); assert(ebrake.emit('contextmenu').defaultPrevented);
joystick.emit('pointerdown', {clientY: 50}); ebrake.emit('pointerdown', {pointerId: 2});
controller.dispose(); controller.dispose(); neutral();
assert.equal(joystick.style.getPropertyValue('touch-action'), '');
assert([...joystick.listeners.values(), ...ebrake.listeners.values(), ...keyboardDocument.listeners.values(), ...browserWindow.listeners.values()].every(set => set.size === 0));
joystick.emit('pointerdown', {clientY: 50}); ebrake.emit('pointerdown'); neutral();
assert(changes.every(change => Object.keys(change).length === 4));
console.log('Touch controls passed: analog travel, dead zone, radial limits, direction, multitouch brake, cancellation, keyboard hold, guard, reset and disposal.');
