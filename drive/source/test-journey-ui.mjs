// Judge Dean LLC — dialog actions and pause ownership regressions.
import assert from 'node:assert/strict';
import {JourneyPauseIntent,campReadiness,engineReadout,createJourneyUI} from './journey-ui.mjs';
import {WaypointRoute} from './waypoints.mjs';
import {CampState} from './camp.mjs';
const intent=new JourneyPauseIntent();intent.open(false);intent.open(true);assert(intent.close());intent.open(true);assert(!intent.close());intent.open(false);intent.suspend();assert(!intent.close());intent.open(false);assert(!intent.close(true));assert(!intent.close());
assert(!campReadiness({complete:false,distance:0}).ready);assert(!campReadiness({complete:true,distance:31}).near);assert(!campReadiness({complete:true,distance:0,speed:2}).ready);assert(campReadiness({complete:true,distance:0,speed:.1}).ready);
const physics={range:'HI',controls:{reverse:1},lighting:{reversing:false},powertrain:{gear:2,rpm:2200}};assert.equal(engineReadout(physics),'HI · 2 · 2200 RPM','Braking from forward motion is not reverse gear');physics.lighting.reversing=true;assert.equal(engineReadout(physics),'HI · R · 2200 RPM');
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.attrs={};this.listeners={};this.textContent='';this.open=false;this.disabled=false;}
 append(...items){this.children.push(...items);}
 replaceChildren(...items){this.children=[...items];}
 set innerHTML(html){this.children=[];for(const m of html.matchAll(/<(button|span|p|section)[^>]*\bid="([^"]+)"[^>]*>/g)){const e=new Element(m[1]);e.id=m[2];this.append(e);}}
 setAttribute(k,v){this.attrs[k]=v;}
 addEventListener(k,fn){this.listeners[k]=fn;}
 querySelectorAll(selector){const nodes=this.children.flatMap(n=>[n,...n.querySelectorAll('*')]);if(selector==='*')return nodes;if(selector==='[data-move]')return [];if(selector.startsWith('[data-route=')){const value=selector.match(/"([^"]+)"/)[1];return nodes.filter(n=>n.dataset.route===value);}return [];}
 querySelector(selector){return this.querySelectorAll(selector)[0];}
 showModal(){this.open=true;}
 close(){this.open=false;}
 focus(){}
 remove(){}
 click(){if(!this.disabled)(this.onclick||this.listeners.click)?.({currentTarget:this});}
}
const body=new Element('body'),game=new Element('section');game.id='game';body.append(game);
globalThis.document={body,hidden:false,createElement:tag=>new Element(tag),getElementById:id=>[body,...body.querySelectorAll('*')].find(e=>e.id===id)};
let paused=false,resumed=null,saves=0,restarts=0,places=0,distance=0,speed=0;
const route=new WaypointRoute(),camp=new CampState();route.next=2;
const ui=createJourneyUI({route,camp,context:()=>({paused,camp:campReadiness({complete:route.complete,distance,speed,tent:!!camp.tent,fire:camp.fire})}),onPause:()=>{paused=true;},onResume:resume=>{resumed=resume;paused=!resume;},onSave:()=>saves++,onPlace:()=>places++,onConfirm(){},onCancel(){},onRotate(){},onFire(){},onCamera(){},onRestart:()=>restarts++});
const nodes=()=>ui.dialog.querySelectorAll('*'),texts=()=>nodes().map(n=>n.textContent),click=text=>{const b=nodes().find(n=>n.tag==='button'&&n.textContent===text);assert(b,`Missing ${text}`);b.click();return b;};
ui.open({forkId:'dunes'});assert(ui.dialog.open);assert.deepEqual(route.choices,{},'Opening a fork does not commit the default');assert(texts().includes('Select a route below.'));assert(!texts().includes('The last valley'),'Automatic fork prompt focuses on the current fork');assert.equal(texts().filter(t=>t==='Across the dunes').length,1,'Focused fork has one heading');click('Continue');assert.equal(route.choices.dunes,'saddle');assert.equal(saves,1);assert.equal(resumed,true);
ui.open();ui.suspendResume();click('Continue');assert.equal(resumed,false,'External suspension cannot resume on modal close');
paused=false;route.next=route.count;speed=2;ui.open();const pitch=click('Place Shiftpod-style tent');assert(pitch.disabled);assert.equal(places,0);assert(ui.dialog.open);assert(texts().some(t=>t.startsWith('Brake to a stop')));assert.equal(ui.dialog.children[3],pitch,'Camp action precedes route history');click('Back to driving');
speed=0;ui.open();assert(!nodes().find(n=>n.textContent==='Place Shiftpod-style tent').disabled);assert(nodes().find(n=>n.tag==='details'),'Historical routes are collapsed details');click('Start a new expedition');assert.equal(restarts,0);assert(texts().some(t=>t.includes('removes your tent and campfire')));click('Keep this expedition');assert.equal(restarts,0);click('Start a new expedition');ui.dialog.listeners.cancel({preventDefault(){}});assert.equal(restarts,0,'Escape cancels reset confirmation');click('Start a new expedition');click('Reset and start at Base camp');assert.equal(restarts,1);assert(!ui.dialog.open);
assert.equal(campReadiness({complete:true,distance:0,tent:true,fire:false}).objective,'Next: Light the campfire');
assert.equal(campReadiness({complete:true,distance:0,tent:true,fire:true}).objective,'Camp ready · Explore or relax');
paused=false;camp.tent={x:154,z:40,y:5,yaw:0};ui.open();assert.equal(ui.dialog.children[3].textContent,'Light campfire','Lighting the fire is the next action after pitching');assert(texts().includes('Your shelter is pitched. Light the fire when you are ready.'));ui.suspendResume();click('Move tent');assert.equal(resumed,true,'Explicit placement resumes the selected active mode after external suspension');assert.equal(places,1);assert(!paused);
ui.open();ui.suspendResume();document.hidden=true;click('Move tent');assert.equal(places,1,'Hidden document cannot start placement');assert(ui.dialog.open);document.hidden=false;click('Keep exploring');assert.equal(resumed,false,'Ordinary close still preserves external suspension');
camp.fire=true;physics.fording={exposure:0,depth:0,stalled:false};ui.update(physics);assert.equal(document.getElementById('camp-objective').textContent,'Camp ready · Explore or relax');
ui.dispose();delete globalThis.document;
console.log('Journey UI: focused/default forks, camp readiness and ordering, two-step restart, pause ownership and actual reverse display passed.');
