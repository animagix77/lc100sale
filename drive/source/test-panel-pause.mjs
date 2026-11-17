// Judge Dean LLC — panel handoffs must never release a vehicle on a slope.
import assert from 'node:assert/strict';
import {PanelPause} from './panel-pause.mjs';
import {createHudMenu} from './hud-menu.mjs';
import {createWeatherUI} from './weather-ui.mjs';

let paused=false,resumes=0,holds=0;
const ownership=new PanelPause({isPaused:()=>paused,onPause:()=>paused=true,onResume:()=>{paused=false;resumes++},onHold:()=>{paused=true;holds++}});
ownership.open('hud');assert(paused);ownership.open('radio');ownership.close('hud');assert(paused,'Radio inherits the pause before the HUD closes');assert.equal(resumes,0);
assert(!ownership.underlyingPaused,'Map/route handoff preserves the active drive underneath a utility panel');
ownership.close('radio');assert(!paused);assert.equal(resumes,1);ownership.close('radio');assert.equal(resumes,1,'Repeated close does not resume twice');
paused=true;ownership.open('weather');ownership.close('weather');assert(paused);assert.equal(holds,1,'A panel opened while paused returns to the paused state');
assert(ownership.underlyingPaused);
paused=false;ownership.open('hud');ownership.suspend();ownership.close('hud');assert(paused,'Blur revokes automatic resume');
paused=false;ownership.open('settings');ownership.clear();ownership.close('settings');assert(paused,'A late close after explicit pause cannot resume');

class Element {
 constructor(){this.events={};this.attrs={};this.hidden=true;this.style={};this.classList={add(){},remove(){}};this.focuses=0;}
 addEventListener(name,fn){(this.events[name]??=[]).push(fn)}
 removeEventListener(name,fn){this.events[name]=(this.events[name]||[]).filter(f=>f!==fn)}
 fire(name,event={}){for(const fn of this.events[name]||[])fn(event)}
 setAttribute(name,value){this.attrs[name]=value}getAttribute(name){return this.attrs[name]??null}
 focus(){this.focuses++}contains(target){return target===this||target?.parentElement===this}
}
const documentMock=new Element();documentMock.hidden=false;globalThis.document=documentMock;
const media=new Element();media.matches=true;globalThis.matchMedia=()=>media;
const toggle=new Element(),options=new Element(),toolbar=new Element();toggle.parentElement=toolbar;options.parentElement=toolbar;
const hud=createHudMenu(toggle,options,{onOpen:()=>ownership.open('hud'),onClose:()=>ownership.close('hud')});
paused=false;toggle.fire('click');assert(paused);assert.equal(toggle.getAttribute('aria-expanded'),'true');
ownership.open('radio');options.fire('click',{target:{closest:()=>({})}});assert(paused);assert.equal(toggle.getAttribute('aria-expanded'),'false');ownership.close('radio');assert(!paused);
toggle.fire('click');let prevented=false,stopped=false;documentMock.fire('keydown',{key:'Escape',preventDefault(){prevented=true},stopImmediatePropagation(){stopped=true}});assert(prevented&&stopped);assert(!paused);assert.equal(toggle.focuses,1);
toggle.fire('click');ownership.clear();hud.close({notify:false});assert(paused,'Explicit pause silently dismisses the HUD');
toggle.fire('click');documentMock.fire('pointerdown',{target:new Element()});assert(paused,'Opening from a paused state never resumes on outside dismissal');
hud.dispose();assert.equal(documentMock.events.pointerdown.length,0);assert.equal(documentMock.events.keydown.length,0);

const ids=['weather','weather-panel','weather-status','weather-expedition','weather-clock','weather-sunset','weather-local','weather-close','view'];
const els=Object.fromEntries(ids.map(id=>[id,new Element()]));documentMock.getElementById=id=>els[id];
const weatherChanges=[],weatherPanels=[];
const weather=createWeatherUI(state=>weatherChanges.push(state),{onPanelChange:open=>{weatherPanels.push(open);if(open)ownership.open('weather');else ownership.close('weather')}});
assert.equal(els.weather.textContent,'Weather');assert.equal(weatherChanges.length,0,'Expedition weather remains driven by the route');
paused=false;els.weather.fire('click');assert(paused);assert(!els['weather-panel'].hidden);
els['weather-sunset'].fire('click');assert.equal(els.weather.textContent,'Weather','The action label stays stable across mode changes');assert.equal(els.weather.title,'Always sunset');assert.equal(weatherChanges.at(-1).mode,'sunset');
els['weather-expedition'].fire('click');assert.equal(els.weather.textContent,'Weather');assert(weather.expedition);assert.equal(els['weather-expedition'].getAttribute('aria-pressed'),'true');
els['weather-close'].fire('click');assert(!paused);assert.deepEqual(weatherPanels,[true,false]);
els.weather.fire('click');ownership.clear();weather.closePanel({focus:false,notify:false});assert(paused);assert.deepEqual(weatherPanels,[true,false,true],'Silent external closing does not return stale resume ownership');
weather.dispose();
console.log('Utility panels: nested pause handoff, repeated close, explicit pause/blur, HUD outside/Escape dismissal, weather modes and disposal passed.');
