import assert from 'node:assert/strict';
import {TrailNarrator} from './trail-narrator.mjs';
const dt=1/60,step=(n,s,count)=>{const lines=[];for(let i=0;i<count;i++){const line=n.update(dt,s);if(line)lines.push(line)}return lines};
const ready=()=>{const n=new TrailNarrator();step(n,{biome:'beach'},960);return n};
{
 const n=ready(),lines=step(n,{biome:'beach',speed:10,impacts:[{energy:.95}]},60*100);assert(lines.length>=1&&lines.length<=3,'Continuous bumps cannot spam writing');assert.notEqual(lines[0],lines[1]);
}
{
 const n=ready();assert.equal(step(n,{biome:'grass',stuck:true,canSpeak:false},60*20).length,0,'Existing callouts take priority');assert.equal(step(n,{biome:'grass',stuck:true},60).length,0,'Expired observations are not read late');
}
{
 const n=ready();step(n,{biome:'river',waterContact:1},120);const lines=step(n,{biome:'river',waterContact:0},100);assert.equal(lines.length,1);assert.match(lines[0],/Out of the water/);n.resetContext();assert.equal(step(n,{biome:'river'},120).length,0,'A teleport is not a river exit');
}
{
 const n=ready();step(n,{biome:'beach',waterContact:1},10);assert.equal(step(n,{biome:'beach',waterContact:0},100).length,0,'A momentary splash does not count as a crossing');
}
{
 const n=ready();const lines=step(n,{biome:'beach',rain:.85},60*120);assert.equal(lines.length,1,'Persistent rain is observed once, not on a timer');
}
{
 const n=ready();assert.match(step(n,{biome:'grass',stuck:true},60)[0],/parking space/);assert.equal(n.update(0,{}),null);assert.equal(n.update(NaN,{}),null);
}
console.log('Trail narrator: pacing, variety, crossing detection, rain, priority, stale-event expiry and reset passed.');
