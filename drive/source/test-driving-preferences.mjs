// Judge Dean LLC — route facts and storage fallback stay honest and independent of saved expeditions.
import assert from 'node:assert/strict';
import {TOUCH_LAYOUT_KEY,readTouchLayout,saveTouchLayout} from './driving-preferences.mjs';
import {expeditionChoiceInfo,routePreviewSvg} from './route-choice-info.mjs';
import {WaypointRoute} from './waypoints.mjs';
const data=new Map([['com.judgedeanllc.lc100.expedition.v1','existing journey']]),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
assert.equal(readTouchLayout(storage),'joystick');assert(saveTouchLayout(storage,'pedals'));assert.equal(data.get(TOUCH_LAYOUT_KEY),'pedals');assert.equal(readTouchLayout(storage),'pedals');assert.equal(data.get('com.judgedeanllc.lc100.expedition.v1'),'existing journey');
data.set(TOUCH_LAYOUT_KEY,'malformed');assert.equal(readTouchLayout(storage),'joystick');const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};assert.equal(readTouchLayout(blocked),'joystick');assert.equal(saveTouchLayout(blocked,'pedals'),false);assert.equal(saveTouchLayout(null,'pedals'),false);
for(const id of ['saddle','islands']){const route=new WaypointRoute();route.choose('dunes',id);const info=expeditionChoiceInfo(id);assert.equal(info.stops,route.count);assert.equal(info.camp,route.camp.name);assert.deepEqual(info.points,route.points);assert(info.metres>500);const svg=routePreviewSvg(info.points);assert.equal(svg.match(/<polyline points="([^"]+)/)[1].split(' ').length,route.points.length);assert(!svg.includes('NaN'));}
assert(expeditionChoiceInfo('saddle').metres>expeditionChoiceInfo('islands').metres);assert.equal(expeditionChoiceInfo('mud'),null);
console.log('Driving preferences: storage denial and invalid values preserve usable defaults; existing saves untouched; preview route distances, stops and geometry match actual itineraries.');
