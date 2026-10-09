import assert from 'node:assert/strict';
import {createKeyboardControls} from './keyboard.mjs';
const keys=new Set(), state={loaded:true,paused:false,preview:false};
let focused=0,cancelled=0,ranges=0,boards=0,locks=0,recenters=0;const looks=[];
const controls=createKeyboardControls({keys,state:()=>state,focus:()=>focused++,cancelCruise:()=>cancelled++,pause:value=>{state.paused=value;keys.clear()},range:()=>ranges++,recover:()=>boards++,lock:()=>locks++,look:code=>looks.push(code),recenter:()=>recenters++});
const target=kind=>({isContentEditable:kind==='editable',closest:selector=>selector.includes(kind)?{}:null});
function press(code,options={}) {const event={code,target:target('canvas'),prevented:false,preventDefault(){this.prevented=true},...options};controls.keydown(event);return event;}
for(const code of ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']) {
  assert.equal(press(code,{target:target('button')}).prevented,true,code+' works from a focused HUD button');
  assert(keys.has(code)); controls.keyup({code}); assert(!keys.has(code));
}
press('KeyW');press('ArrowLeft');assert(keys.has('KeyW')&&keys.has('ArrowLeft'),'simultaneous throttle and camera orbit');
controls.keyup({code:'KeyW'});assert(!keys.has('KeyW')&&keys.has('ArrowLeft'));keys.clear();
press('Space');assert(keys.has('Space'));controls.keyup({code:'Space'});
assert.equal(cancelled,2,'WASD reverse and brake cancel cruise; camera arrows do not');
assert(looks.includes('ArrowUp')&&looks.includes('ArrowDown')&&looks.includes('ArrowLeft')&&looks.includes('ArrowRight'));
const lookCount=looks.length;press('ArrowLeft',{repeat:true});assert.equal(looks.length,lookCount,'OS key repeats do not add extra camera nudges');keys.clear();
press('KeyC');press('KeyC',{repeat:true});assert.equal(recenters,1,'Camera reset does not repeat');
assert.equal(press('Space',{target:target('button')}).prevented,false,'Space still activates buttons');
for(const kind of ['input','textarea','select','editable']) {assert.equal(press('KeyW',{target:target(kind)}).prevented,false);assert.equal(press('KeyK',{target:target(kind)}).prevented,false);assert.equal(press('ArrowUp',{target:target(kind)}).prevented,false);assert.equal(press('KeyC',{target:target(kind)}).prevented,false);}
for(const modifier of ['ctrlKey','metaKey','altKey','isComposing','defaultPrevented']) assert.equal(press('KeyW',{[modifier]:true}).prevented,false);
press('KeyK');press('KeyK',{repeat:true});assert.equal(locks,1);
press('KeyL');press('KeyL',{repeat:true});press('KeyR');press('KeyR',{repeat:true});assert.equal(ranges,1);assert.equal(boards,1);
press('Escape');assert(state.paused);press('Escape',{repeat:true});assert(state.paused,'holding Escape does not toggle repeatedly');
press('KeyW');press('KeyL');press('KeyK');assert.equal(locks,1);assert.equal(keys.size,0);assert.equal(ranges,1,'paused controls do not drive or shift');
press('Escape');assert(!state.paused);
for(const flag of ['preview','loaded']) {state[flag]=flag==='preview';assert.equal(press('KeyW').prevented,false);state[flag]=flag==='loaded';}
assert(focused>=11);console.log('Keyboard controls passed: WASD driving, arrow camera, recenter, HUD focus, simultaneous inputs, release, shortcuts, pause and preview guards.');
