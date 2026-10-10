import assert from 'node:assert/strict';
import {LANDMARKS} from './expedition.mjs';
import {WaypointRoute,WAYPOINT_COUNT} from './waypoints.mjs';
import {ExpeditionMap,createMapViewport,projectMapPoint,clampMapMarker,mapHeadingVector,getMapProgress,layoutOverviewGates} from './expedition-map.mjs';

const close=(actual,expected,message)=>assert(Math.abs(actual-expected)<1e-7,message||`${actual} != ${expected}`);
const position={x:-14,z:0},target={x:-18,z:-60};
const view=createMapViewport(position,target,220,180);
const player=projectMapPoint(position,view),goal=projectMapPoint(target,view);
assert(goal.y<player.y,'North is up');
assert(goal.x<player.x,'West is left');
assert(Math.hypot(player.x-goal.x,player.y-goal.y)>60,'Nearby targets are legible, not reduced to full-route size');
assert(player.x>20&&player.x<200&&player.y>20&&player.y<160,'Player remains visible');
const translatedView=createMapViewport({x:position.x+1e7,z:position.z-1e7},{x:target.x+1e7,z:target.z-1e7},220,180);
const translatedPlayer=projectMapPoint({x:position.x+1e7,z:position.z-1e7},translatedView);
close(translatedPlayer.x,player.x);close(translatedPlayer.y,player.y);

for(const [heading,x,y] of [[0,0,-1],[Math.PI/2,-1,0],[Math.PI,0,1],[-Math.PI/2,1,0]]){
 const vector=mapHeadingVector(heading);close(vector.x,x);close(vector.y,y);
 const rotated=mapHeadingVector(heading,{rotation:Math.PI/2});close(rotated.x,-y);close(rotated.y,x);
}
const remote={x:10000,z:-6000},remoteView=createMapViewport(position,remote,150,145);
const distantPoint=projectMapPoint(remote,remoteView),edge=clampMapMarker(distantPoint,remoteView,24);
assert(edge.clipped);assert(edge.x>=24&&edge.x<=126&&edge.y>=24&&edge.y<=121);
close((edge.x-75)/(edge.y-72.5),(distantPoint.x-75)/(distantPoint.y-72.5),'Edge cue preserves target bearing');
assert(!clampMapMarker({x:75,y:72.5},remoteView).clipped);
const farPlayer=projectMapPoint(position,remoteView);assert(farPlayer.x>=17&&farPlayer.x<=133&&farPlayer.y>=17&&farPlayer.y<=128,'Far targets cannot zoom the truck out of the local map');

for(const [width,height] of [[640,500],[350,642],[320,410],[760,220]]){
 const overview=createMapViewport(position,target,width,height,{overview:true});
 for(const point of LANDMARKS){const p=projectMapPoint(point,overview);assert(p.x>20&&p.x<width-20&&p.y>20&&p.y<height-20,'All route gates fit the overview')}
 const other=createMapViewport(remote,position,width,height,{overview:true});assert.deepEqual(other,overview,'Overview remains stable during off-route exploration');
 assert.equal(overview.rotation,width/height>2.1?Math.PI/4:0,'Only wide overview maps rotate');
 const origin=projectMapPoint(position,overview),north=projectMapPoint({x:position.x,z:position.z-10},overview);
 if(overview.rotation){assert(north.x>origin.x&&north.y<origin.y,'North points diagonally up-right in the wide overview');const base=projectMapPoint(LANDMARKS[0],overview),summit=projectMapPoint(LANDMARKS[15],overview);assert(summit.x-base.x>width*.45,'Wide maps use the available width for the ascent')}else{close(north.x,origin.x);assert(north.y<origin.y)}
 if(width===350){const xs=LANDMARKS.map(point=>projectMapPoint(point,overview).x);assert(Math.max(...xs)-Math.min(...xs)>width*.78,'Phone overview uses the available width for the expanded route');}
 for(let completed=0;completed<WAYPOINT_COUNT;completed++){
  const progress={completed,nextLeg:completed+1},goal=projectMapPoint(LANDMARKS[progress.nextLeg],overview),layout=layoutOverviewGates(overview,progress,goal);
  const circles=[{...goal,r:14},...layout.map(gate=>gate.spot)];assert.equal(circles.length,WAYPOINT_COUNT,'Every gate gets a readable badge');
  for(let i=0;i<circles.length;i++)for(let j=i+1;j<circles.length;j++)assert(Math.hypot(circles[i].x-circles[j].x,circles[i].y-circles[j].y)>circles[i].r+circles[j].r,'Gate numbers do not overlap at any leg');
 }
}

const route=new WaypointRoute();
assert.deepEqual(getMapProgress(route),{passed:0,completed:0,lap:1,nextLeg:1});
route.passed=route.next=WAYPOINT_COUNT;assert.deepEqual(getMapProgress(route),{passed:WAYPOINT_COUNT,completed:WAYPOINT_COUNT,lap:1,nextLeg:WAYPOINT_COUNT});
assert.equal(route.target().leg,getMapProgress(route).nextLeg,'Map retains camp at completion');

function fakeCanvas(width,height){
 const calls=[],context=new Proxy({measureText:text=>({width:String(text).length*6})},{get:(object,key)=>key in object?object[key]:(...args)=>calls.push([key,...args])});
 let pixelWidth=300,pixelHeight=150,writes=0;
 return {clientWidth:width,clientHeight:height,calls,getContext:()=>context,get width(){return pixelWidth},set width(value){pixelWidth=value;writes++},get height(){return pixelHeight},set height(value){pixelHeight=value;writes++},get writes(){return writes}};
}
const previousDpr=Object.getOwnPropertyDescriptor(globalThis,'devicePixelRatio');
try{
 Object.defineProperty(globalThis,'devicePixelRatio',{value:2,configurable:true});
 const mini=fakeCanvas(220,180),overview=fakeCanvas(640,500),map=new ExpeditionMap(mini,{overviewCanvas:overview});
 assert(map.draw(position,Math.PI/2,route,{force:true}));assert.equal(mini.width,440);assert.equal(mini.height,360);
 assert(mini.calls.some(([name,angle])=>name==='rotate'&&Math.abs(angle+Math.PI/2)<1e-7),'Rendered truck arrow uses actual vehicle heading');
 assert.equal(mini.writes,2);map.draw(position,0,route,{force:true});assert.equal(mini.writes,2,'Stable CSS size does not reset the canvas backing store');
 mini.clientWidth=260;map.draw(position,0,route,{force:true});assert.equal(mini.width,520);assert.equal(mini.height,360);assert.equal(mini.writes,3);
 Object.defineProperty(globalThis,'devicePixelRatio',{value:3,configurable:true});map.draw(position,0,route,{force:true});assert.equal(mini.width,780);assert.equal(mini.height,540);
 map.lastDraw=performance.now();assert.equal(map.draw(position,0,route),false,'Retained map respects its 12 Hz budget');
 assert(map.draw(position,0,route,{overview:true}),'Opening the overview draws immediately');assert.equal(overview.width,1920);assert.equal(overview.height,1500);
 const fullWrites=overview.writes;map.draw(position,0,route,{overview:true,force:true});assert.equal(overview.writes,fullWrites);
 for(const [width,height] of [[350,642],[320,410],[640,500],[760,220]]){
  overview.clientWidth=width;overview.clientHeight=height;
  for(let completed=0;completed<WAYPOINT_COUNT;completed++){
   route.passed=route.next=completed;overview.calls.length=0;map.draw(position,0,route,{overview:true,force:true});
   const labels=overview.calls.filter(([name,text])=>name==='fillText'&&['BEACH','DUNES','GRASS','RIVER','MUD','SNOW','VOLCANIC RIDGE','CANYON'].includes(text));
   const numbers=overview.calls.filter(([name,text])=>name==='fillText'&&/^\d+$/.test(text));
   assert.equal(labels.length,8);assert.equal(numbers.length,WAYPOINT_COUNT);
   if(width===760)assert(overview.calls.filter(([name,angle])=>name==='rotate'&&Math.abs(angle-Math.PI/4)<1e-7).length>=2,'Both north arrow and truck heading follow the wide overview rotation');
   for(let i=0;i<numbers.length;i++)for(let j=i+1;j<numbers.length;j++){
    const [,a,ax,ay]=numbers[i],[,b,bx,by]=numbers[j],radiusA=Number(a)===completed+1?14:9.5,radiusB=Number(b)===completed+1?14:9.5;
    assert(Math.hypot(ax-bx,ay-by)>radiusA+radiusB,`${width}px: numbered gates ${a} and ${b} remain distinct beside region labels`);
   }
   for(const [,number,x,y] of numbers)for(const [,name,lx,ly] of labels){
    const halfWidth=name.length*3+4,nearX=Math.max(lx-halfWidth,Math.min(lx+halfWidth,x)),nearY=Math.max(ly-8,Math.min(ly+8,y));
    assert(Math.hypot(x-nearX,y-nearY)>(Number(number)===completed+1?14:9.5),`${width}px: gate ${number} clears ${name}`);
   }
  }
 }
 assert.equal(map.draw({x:NaN,z:0},0,route,{force:true}),false,'Invalid world coordinates do not reach the canvas');
 const hidden=fakeCanvas(0,0);assert.equal(new ExpeditionMap(hidden).draw(position,0,route,{force:true}),false);assert.equal(hidden.writes,0,'Hidden canvases retain their backing store');
}finally{
 if(previousDpr)Object.defineProperty(globalThis,'devicePixelRatio',previousDpr);else delete globalThis.devicePixelRatio;
}
console.log('Expedition map: local and overview coordinates, actual heading, edge bearings, floating origin, finite camp destination, DPR resize and retained 12 Hz rendering passed.');

// Portrait's global route must fit the circle, including corners that a square
// overview would clip. Off-route markers stay on its rim with the right bearing.
for(const size of [96,108,120]){
 const globe=createMapViewport(position,target,size,size,{compact:true});
 for(const point of LANDMARKS){const p=projectMapPoint(point,globe);assert(Math.hypot(p.x-size/2,p.y-size/2)<=size/2-15,'Entire route fits inside round portrait map')}
 const off=clampMapMarker({x:900,y:-800},globe,10);
 close(Math.hypot(off.x-size/2,off.y-size/2),size/2-10);
 close((off.x-size/2)/(off.y-size/2),(900-size/2)/(-800-size/2));
 assert.deepEqual(createMapViewport(remote,position,size,size,{compact:true}),globe);
}
const roundCanvas=fakeCanvas(108,108),fullCanvas=fakeCanvas(350,642);
const roundMap=new ExpeditionMap(roundCanvas,{overviewCanvas:fullCanvas,compact:()=>true});
assert(roundMap.draw(position,0,new WaypointRoute(),{overview:true,force:true}));
assert(roundCanvas.calls.some(([name])=>name==='clip'),'Round overview clips scenery to its circle');
assert.equal(roundCanvas.calls.filter(([name])=>name==='fillText').length,1,'Tiny map avoids cluttered gate and region labels');
assert(fullCanvas.calls.filter(([name,text])=>name==='fillText'&&/^\d+$/.test(text)).length===WAYPOINT_COUNT,'Expanded map retains all numbered gates');
console.log('Portrait map: full-route circular fit, off-route bearing, restrained labels and detailed expanded map passed.');
