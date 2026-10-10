// Judge Dean LLC — dialog actions and pause ownership regressions.
import assert from 'node:assert/strict';
import {JourneyRoutePrompts,JourneyPauseIntent,campReadiness,engineReadout,createJourneyUI} from './journey-ui.mjs';
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
 getBoundingClientRect(){return {left:100,right:500,top:100,bottom:500};}
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
ui.open();ui.suspendResume();click('Continue');assert.deepEqual(route.choices,{dunes:'saddle'},'First Continue never preselects the later fork');assert.equal(saves,1,'Reviewing the first route preserves its selection');assert.equal(resumed,false,'External suspension cannot resume on modal close');
const prompts=new JourneyRoutePrompts();route.next=0;assert.equal(prompts.take(route,{opening:true}).id,'dunes');assert.equal(prompts.take(route,{opening:true}),null,'Opening prompt appears once');route.next=2;assert.equal(prompts.take(route),null,'The early fork does not interrupt driving');route.next=20;assert.equal(prompts.take(route),null,'Later fork stays hidden until arrival');
ui.open();assert(!nodes().some(n=>n.dataset.route),'Between junctions there are no premature choices');click('Continue');
route.next=21;route.choices.return='bank';assert.equal(prompts.take(route).id,'return','Even a previously saved future choice can be reviewed at the junction');assert.equal(prompts.take(route),null,'Later prompt does not reopen every frame');ui.open();assert.equal(nodes().filter(n=>n.dataset.route).length,2);assert(texts().includes('The last valley'));assert(!texts().includes('Dune climb'));assert(!texts().includes('Coastal shelf'));click('Continue');assert.equal(route.choices.return,'bank','Arrival preserves an existing future selection');
route.choices={};prompts.reset();route.next=0;assert.equal(prompts.take(route,{opening:true}).id,'dunes','Restart resets one-time prompts');ui.open();assert.equal(nodes().filter(n=>n.dataset.route).length,2);assert(!texts().includes('Mud trail'));click('Continue');assert.deepEqual(route.choices,{dunes:'saddle'});route.next=21;ui.open();click('Continue');assert.deepEqual(route.choices,{dunes:'saddle',return:'mud'},'Later default saves only when its own decision is confirmed');
paused=false;route.next=route.count;speed=2;ui.open();const pitch=click('Place Shiftpod-style tent');assert(pitch.disabled);assert.equal(places,0);assert(ui.dialog.open);assert(texts().some(t=>t.startsWith('Brake to a stop')));assert.equal(ui.dialog.children[3],pitch,'Camp action precedes route history');click('Back to driving');
speed=0;ui.open();assert(!nodes().find(n=>n.textContent==='Place Shiftpod-style tent').disabled);assert(nodes().find(n=>n.tag==='details'),'Historical routes are collapsed details');click('Start a new expedition');assert.equal(restarts,0);assert(texts().some(t=>t.includes('removes your tent and campfire')));click('Keep this expedition');assert.equal(restarts,0);click('Start a new expedition');ui.dialog.listeners.cancel({preventDefault(){}});assert.equal(restarts,0,'Escape cancels reset confirmation');click('Start a new expedition');click('Reset and start at Base camp');assert.equal(restarts,1);assert(!ui.dialog.open);
assert.equal(campReadiness({complete:true,distance:0,tent:true,fire:false}).objective,'Next: Light the campfire');
assert.equal(campReadiness({complete:true,distance:0,tent:true,fire:true}).objective,'Camp ready · Explore or relax');
paused=false;camp.tent={x:154,z:40,y:5,yaw:0};ui.open();assert.equal(ui.dialog.children[3].textContent,'Light campfire','Lighting the fire is the next action after pitching');assert(texts().includes('Your shelter is pitched. Light the fire when you are ready.'));ui.suspendResume();click('Move tent');assert.equal(resumed,true,'Explicit placement resumes the selected active mode after external suspension');assert.equal(places,1);assert(!paused);
ui.open();ui.suspendResume();document.hidden=true;click('Move tent');assert.equal(places,1,'Hidden document cannot start placement');assert(ui.dialog.open);document.hidden=false;click('Keep exploring');assert.equal(resumed,false,'Ordinary close still preserves external suspension');
camp.fire=true;physics.fording={exposure:0,depth:0,stalled:false};ui.update(physics);assert.equal(document.getElementById('camp-objective').textContent,'Camp ready · Explore or relax');
// Backdrop clicks behave like Continue, while padding and drag-out gestures stay open.
route.next=0;route.choices={};paused=false;ui.open();
const pointer=(x,y,target=ui.dialog)=>({clientX:x,clientY:y,target});
const outside=pointer(30,30),inside=pointer(120,120);
ui.dialog.listeners.pointerdown(inside);ui.dialog.listeners.click(inside);assert(ui.dialog.open,'Dialog padding is not the backdrop');
ui.dialog.listeners.pointerdown(inside);ui.dialog.listeners.click(outside);assert(ui.dialog.open,'Dragging out of a route card cannot dismiss');
ui.dialog.listeners.pointerdown(outside);ui.dialog.listeners.click(outside);assert(!ui.dialog.open&&resumed);assert.deepEqual(route.choices,{dunes:'saddle'},'Outside confirmation saves only the displayed default');
ui.open();nodes().find(n=>n.dataset.route==='dunes:shelf').click();ui.dialog.listeners.pointerdown(outside);ui.dialog.listeners.click(outside);assert.equal(route.choices.dunes,'shelf');assert(!ui.dialog.open&&resumed,'Outside confirmation preserves the selected alternative');
ui.open();ui.suspendResume();ui.dialog.listeners.pointerdown(outside);ui.dialog.listeners.click(outside);assert.equal(resumed,false,'Backdrop respects external pause ownership');
route.next=route.count;ui.open();click('Start a new expedition');ui.dialog.listeners.pointerdown(outside);ui.dialog.listeners.click(outside);assert.equal(restarts,1,'Outside reset confirmation never resets progress');assert(ui.dialog.open);assert(!texts().includes('Start a new expedition?'));
ui.dispose();delete globalThis.document;
console.log('Journey UI: focused/default forks, camp readiness and ordering, two-step restart, pause ownership and actual reverse display passed.');
