import {LANDMARKS,BRANCH_PATHS,ROUTE_FORKS,riverZ,VOLCANO} from './expedition.mjs';
import {lavaCrossingPoint} from './lava-crossing.mjs';

const GATES=LANDMARKS.length-1,TAU=Math.PI*2;
// Match the two molten reaches, leaving the solid causeway beneath the trail.
const LAVA_PATHS=[-1,1].map(side=>Array.from({length:25},(_,i)=>lavaCrossingPoint(side*(4.35+i/24*78.4))));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const finitePoint=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.z);
const shore=z=>-36+8*Math.sin(z*.006)+3*Math.sin(z*.019);
const REGIONS=[
 ['BEACH',20,104],['DUNES',110,-93],['GRASS',229,-217],
 ['RIVER',361,-338],['MUD',447,-177],['SNOW',246,-661],['VOLCANIC RIDGE',592,-762],['CANYON',712,-472]
];

// Coordinates stay in world space, including after the physics origin rebases.
export function createMapViewport(position,target,width,height,{overview=false,compact=false}={}){
 width=Math.max(1,width);height=Math.max(1,height);
 if(compact){
  // Fit the entire expedition inside the circular map, not its square bounds.
  // A stable world overview does not jump around when the truck leaves the trail.
  const points=[...LANDMARKS,VOLCANO],centerX=311,centerZ=-340;
  const radius=Math.max(...points.map(p=>Math.hypot(p.x-centerX,p.z-centerZ)));
  return {width,height,centerX,centerZ,round:true,scale:Math.max(1,Math.min(width,height)/2-16)/radius};
 }
 if(overview){
  const padding=Math.min(27,Math.max(18,width*.055),Math.max(18,height*.055)),minX=-41,maxX=Math.max(663,...LANDMARKS.map(p=>p.x+40)),minZ=-785,maxZ=104,rotation=width/height>2.1?Math.PI/4:0;
  if(rotation){
   // Fit the actual diagonal ascent, not the corners of its old bounding box.
   const cos=Math.cos(rotation),sin=Math.sin(rotation),points=[...LANDMARKS,VOLCANO].map(p=>({u:p.x*cos-p.z*sin,v:p.x*sin+p.z*cos}));
   const minU=Math.min(...points.map(p=>p.u))-30,maxU=Math.max(...points.map(p=>p.u))+30,minV=Math.min(...points.map(p=>p.v))-25,maxV=Math.max(...points.map(p=>p.v))+25,u=(minU+maxU)/2,v=(minV+maxV)/2;
   return {width,height,rotation,centerX:u*cos+v*sin,centerZ:-u*sin+v*cos,scale:Math.min((width-padding*2)/(maxU-minU),(height-padding*2)/(maxV-minV))};
  }
  return {width,height,rotation,centerX:(minX+maxX)/2,centerZ:(minZ+maxZ)/2,scale:Math.min((width-padding*2)/(maxX-minX),(height-padding*2)/(maxZ-minZ))};
 }
 const dx=target.x-position.x,dz=target.z-position.z,distance=Math.hypot(dx,dz);
 const lookAhead=Math.min(distance*.32,45),fraction=distance?lookAhead/distance:0;
 const span=clamp(distance*1.45,115,230);
 return {width,height,centerX:position.x+dx*fraction,centerZ:position.z+dz*fraction,scale:Math.max(1,Math.min(width-42,height-45))/span};
}

export function projectMapPoint(point,viewport){
 const dx=point.x-viewport.centerX,dz=point.z-viewport.centerZ,cos=Math.cos(viewport.rotation||0),sin=Math.sin(viewport.rotation||0);
 return {x:viewport.width/2+(dx*cos-dz*sin)*viewport.scale,y:viewport.height/2+(dx*sin+dz*cos)*viewport.scale};
}

// Intersect a ray with the inset canvas edge rather than independently clamping
// axes, so a remote waypoint still indicates its correct bearing.
export function clampMapMarker(point,viewport,padding=22){
 const cx=viewport.width/2,cy=viewport.height/2,dx=point.x-cx,dy=point.y-cy;
 const rx=Math.max(1,cx-padding),ry=Math.max(1,cy-padding);
 const fraction=viewport.round?Math.min(1,Math.min(rx,ry)/(Math.hypot(dx,dy)||1)):Math.min(1,dx?rx/Math.abs(dx):Infinity,dy?ry/Math.abs(dy):Infinity);
 return {x:cx+dx*fraction,y:cy+dy*fraction,clipped:fraction<1,angle:Math.atan2(dy,dx)};
}

// Vehicle yaw is positive toward -x; north on the map is world -z.
export const mapHeadingVector=(heading,{rotation=0}={})=>({x:Math.sin(rotation-heading),y:-Math.cos(rotation-heading)});

export function getMapProgress(route){
 const passed=Math.max(0,Math.floor(Number(route?.passed)||0));
 return {passed,completed:Math.min(passed,GATES),lap:1,nextLeg:Math.min(passed+1,GATES)};
}

function path(ctx,points,viewport){
 ctx.beginPath();points.forEach((point,index)=>{const p=projectMapPoint(point,viewport);index?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)});
}
function circle(ctx,x,y,radius,fill,stroke){
 ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.fillStyle=fill;ctx.fill();
 if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}
}
function arrow(ctx,x,y,heading,size=9,viewport={}){
 const forward=mapHeadingVector(heading,viewport);
 ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(forward.x,-forward.y));ctx.beginPath();
 ctx.moveTo(0,-size);ctx.lineTo(size*.68,size*.72);ctx.lineTo(0,size*.36);ctx.lineTo(-size*.68,size*.72);ctx.closePath();
 ctx.fillStyle='#fffaf0';ctx.strokeStyle='#112d28';ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.fill();ctx.stroke();ctx.restore();
}
function targetMarker(ctx,point,leg,{overview=false}={}){
 const radius=overview?11:10;
 if(point.clipped){
  ctx.save();ctx.translate(point.x,point.y);ctx.rotate(point.angle);ctx.beginPath();ctx.moveTo(18,0);ctx.lineTo(11,-4);ctx.lineTo(11,4);ctx.closePath();ctx.fillStyle='#ffd397';ctx.fill();ctx.restore();
 }
 ctx.lineWidth=2;circle(ctx,point.x,point.y,radius+3,'#172e27');circle(ctx,point.x,point.y,radius,'#ffd397','#fff0d2');
 ctx.fillStyle='#25392e';ctx.font=`800 ${overview?12:11}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(leg),point.x,point.y+.3);
}
function scaleDistance(maximum){
 const exponent=10**Math.floor(Math.log10(maximum));
 return [5,2,1].map(n=>n*exponent).find(n=>n<=maximum)||exponent/2;
}
function decorations(ctx,viewport,overview){
 const {width,height,scale}=viewport;
 ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
 // Only the wide overview rotates; the north arrow follows that projection.
 ctx.fillStyle='#102b25';ctx.fillRect(9,9,24,37);
 ctx.fillStyle='#fff1d2';ctx.font='800 10px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('N',21,17);
 ctx.save();ctx.translate(21,32);ctx.rotate(viewport.rotation||0);ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(-5,6);ctx.lineTo(0,3);ctx.lineTo(5,6);ctx.closePath();ctx.fill();ctx.restore();
 const metres=scaleDistance((overview?80:Math.min(52,width*.3))/scale),length=metres*scale,x=13,y=height-14;
 ctx.fillStyle='#102b25';ctx.fillRect(x-5,y-22,length+10,29);
 ctx.strokeStyle='#ede1c7';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,y-4);ctx.lineTo(x,y);ctx.lineTo(x+length,y);ctx.lineTo(x+length,y-4);ctx.stroke();
 ctx.fillStyle='#ede1c7';ctx.font='600 10px system-ui,sans-serif';ctx.textAlign='left';ctx.fillText(`${metres>=1000?`${metres/1000} km`:`${metres} m`}`,x,y-12);
 ctx.restore();
}

function landscape(ctx,viewport,overview,compact=false){
 const {width,height,scale,centerX,centerZ}=viewport;
 ctx.fillStyle=compact?'#213c3266':'#213c32';ctx.fillRect(0,0,width,height);
 ctx.lineCap='round';ctx.lineJoin='round';
 // Broad region tints give context without sampling the terrain each frame.
 const colors={beach:'#766044',dunes:'#92794c',grass:'#466047',river:'#41695d',snow:'#899591',mud:'#665343',volcanic:'#6c5550'};
 ctx.globalAlpha=.32;
 for(let i=1;i<LANDMARKS.length;i++){
  const a=LANDMARKS[i-1],b=LANDMARKS[i];ctx.strokeStyle=colors[b.biome];ctx.lineWidth=Math.max(18,scale*90);path(ctx,[a,b],viewport);ctx.stroke();
 }
 ctx.globalAlpha=1;
 const cos=Math.abs(Math.cos(viewport.rotation||0)),sin=Math.abs(Math.sin(viewport.rotation||0)),halfX=(width*cos+height*sin)/(2*scale),halfZ=(width*sin+height*cos)/(2*scale);
 const topZ=centerZ-halfZ,bottomZ=centerZ+halfZ,coast=[];
 for(let i=0;i<=40;i++){const z=topZ+(bottomZ-topZ)*i/40;coast.push({x:shore(z),z})}
 path(ctx,[{x:centerX-halfX,z:topZ},...coast,{x:centerX-halfX,z:bottomZ}],viewport);ctx.closePath();ctx.fillStyle=compact?'#1b465466':'#1b4654';ctx.fill();
 path(ctx,coast,viewport);ctx.strokeStyle='#a89365';ctx.lineWidth=Math.max(2,Math.min(8,scale*11));ctx.stroke();
 const river=[];for(let x=-60;x<=520;x+=8)river.push({x,z:riverZ(x)});
 path(ctx,river,viewport);ctx.strokeStyle='#192f2c';ctx.lineWidth=Math.max(5,scale*16);ctx.stroke();ctx.strokeStyle='#77aeb9';ctx.lineWidth=Math.max(2.5,scale*9);ctx.stroke();
 const bridge=[{x:665,z:-500},{x:665,z:-440}];path(ctx,[{x:575,z:-470},{x:790,z:-470}],viewport);ctx.strokeStyle='#365b66';ctx.lineWidth=Math.max(4,scale*20);ctx.stroke();path(ctx,bridge,viewport);ctx.strokeStyle='#f1dfbd';ctx.lineWidth=Math.max(2,scale*5);ctx.stroke();
 for(const channel of LAVA_PATHS){
  path(ctx,channel,viewport);ctx.strokeStyle='#463630';ctx.lineWidth=Math.max(4,Math.min(10,scale*13));ctx.stroke();ctx.strokeStyle='#bd6a49';ctx.lineWidth=Math.max(2,Math.min(6,scale*8));ctx.stroke();
 }
 if(overview){
  const p=projectMapPoint(VOLCANO,viewport);ctx.fillStyle='#b16d53';ctx.beginPath();ctx.moveTo(p.x,p.y-12);ctx.lineTo(p.x-12,p.y+9);ctx.lineTo(p.x+12,p.y+9);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#efaa76';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x-3,p.y-6);ctx.lineTo(p.x,p.y-12);ctx.lineTo(p.x+4,p.y-5);ctx.stroke();
 }
}

function routeLine(ctx,viewport,progress,points=LANDMARKS){
 for(const branch of [...BRANCH_PATHS,...ROUTE_FORKS.map(f=>LANDMARKS.slice(f.at,Math.max(...Object.keys(f.options[1].replacements).map(Number))+2))]){path(ctx,branch,viewport);ctx.setLineDash([4,5]);ctx.lineWidth=2;ctx.strokeStyle="#a1b8a0";ctx.stroke();ctx.setLineDash([])}
 path(ctx,points,viewport);ctx.lineWidth=7;ctx.strokeStyle='#102922';ctx.stroke();ctx.lineWidth=3;ctx.strokeStyle='#cfbd94';ctx.stroke();
 if(progress.completed){path(ctx,points.slice(0,progress.completed+1),viewport);ctx.strokeStyle='#82c7a0';ctx.lineWidth=3.5;ctx.stroke()}
 if(progress.completed>=points.length-1)return;path(ctx,[points[progress.completed],points[progress.completed+1]],viewport);ctx.strokeStyle='#ffcf88';ctx.lineWidth=4;ctx.stroke();
}

function regionLabels(ctx,viewport){
 ctx.font=`700 ${viewport.width<380?10:11}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
 const bounds=[],gates=LANDMARKS.slice(1).map(p=>projectMapPoint(p,viewport));
 for(const [name,x,z] of REGIONS){
  const p=projectMapPoint({x,z},viewport),width=ctx.measureText(name).width+8,offsets=[[0,0]];
  for(const distance of [16,28,42,60,82,110])for(const [dx,dy] of [[1,0],[-1,0],[0,-1],[0,1],[.707,-.707],[-.707,.707],[.707,.707],[-.707,-.707]])offsets.push([dx*distance,dy*distance]);
  const candidates=offsets.map(([dx,dy])=>({x:clamp(p.x+dx-width/2,8,viewport.width-width-8),y:clamp(p.y+dy-8,8,viewport.height-24),width,height:16}));
  const box=candidates.find(b=>gates.every(gate=>Math.hypot(gate.x-clamp(gate.x,b.x,b.x+b.width),gate.y-clamp(gate.y,b.y,b.y+b.height))>16)&&bounds.every(other=>b.x+b.width+5<other.x||b.x>other.x+other.width+5||b.y+b.height+5<other.y||b.y>other.y+other.height+5))||candidates[0];
  bounds.push(box);
  const cx=box.x+box.width/2,cy=box.y+box.height/2;
  if(Math.hypot(cx-p.x,cy-p.y)>22){ctx.strokeStyle='#78917b';ctx.lineWidth=.75;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(cx,cy);ctx.stroke()}
  ctx.fillStyle='#172f27';ctx.fillRect(box.x,box.y,box.width,box.height);ctx.fillStyle='#e1d2b3';ctx.fillText(name,cx,cy);
 }
 return bounds;
}

// A few gates sit close together around the ford. Move their numbered badges
// with short leader lines so each gate remains readable on a phone overview.
export function layoutOverviewGates(viewport,progress,target,regions=[],player=null,points=LANDMARKS){
 const occupied=[{x:target.x,y:target.y,r:14},...(player?[{x:player.x,y:player.y,r:13}]:[])],radius=9.5;
 const gates=points.slice(1).map((p,index)=>({point:projectMapPoint(p,viewport),leg:index+1,complete:index<progress.completed}));
 const layout=[];
 for(const gate of gates){
  if(gate.leg===progress.nextLeg)continue;
  const p=gate.point,offsets=[[0,0]];
  for(const distance of [15,24,34,44,60,78])for(const [x,y] of [[1,0],[-1,0],[0,1],[0,-1],[.707,.707],[-.707,-.707],[-.707,.707],[.707,-.707]])offsets.push([x*distance,y*distance]);
  const spot=offsets.map(([x,y])=>({x:p.x+x,y:p.y+y,r:radius})).find(v=>v.x>radius+4&&v.x<viewport.width-radius-4&&v.y>radius+4&&v.y<viewport.height-radius-4&&occupied.every(o=>Math.hypot(v.x-o.x,v.y-o.y)>v.r+o.r+2)&&regions.every(box=>Math.hypot(v.x-clamp(v.x,box.x,box.x+box.width),v.y-clamp(v.y,box.y,box.y+box.height))>radius+3))||{...p,r:radius};
  occupied.push(spot);layout.push({...gate,spot});
 }
 return layout;
}
function overviewGates(ctx,viewport,progress,target,regions,player,points=LANDMARKS){
 ctx.font='700 10px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
 for(const gate of layoutOverviewGates(viewport,progress,target,regions,player,points)){
  const p=gate.point,spot=gate.spot,radius=spot.r;
  if(spot.x!==p.x||spot.y!==p.y){ctx.strokeStyle='#e2d1ad';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(spot.x,spot.y);ctx.stroke();circle(ctx,p.x,p.y,2,'#f1e2c1')}
  ctx.lineWidth=1.5;circle(ctx,spot.x,spot.y,radius,gate.complete?'#82c7a0':'#20382e',gate.complete?'#a9e3bc':'#b7ad8f');ctx.fillStyle=gate.complete?'#18362a':'#eee5d0';ctx.fillText(String(gate.leg),spot.x,spot.y+.3);
 }
}

export class ExpeditionMap{
 constructor(canvas,{overviewCanvas=null,compact=()=>globalThis.matchMedia?.('(max-width:1050px) and (orientation:portrait)').matches??false}={}){
  this.compact=compact;
  this.canvas=canvas;this.overviewCanvas=overviewCanvas;this.surfaces=new Map();this.lastDraw=-Infinity;this.overviewVisible=false;
 }
 prepare(canvas){
  if(!canvas)return null;
  // Read CSS dimensions, never the backing dimensions: DPR must not compound.
  const width=canvas.clientWidth,height=canvas.clientHeight;if(!width||!height)return null;
  const dpr=Math.max(1,globalThis.devicePixelRatio||1),pixelWidth=Math.round(width*dpr),pixelHeight=Math.round(height*dpr);
  let surface=this.surfaces.get(canvas);
  if(!surface){const ctx=canvas.getContext('2d');if(!ctx)return null;surface={ctx};this.surfaces.set(canvas,surface)}
  if(canvas.width!==pixelWidth)canvas.width=pixelWidth;
  if(canvas.height!==pixelHeight)canvas.height=pixelHeight;
  surface.ctx.setTransform(pixelWidth/width,0,0,pixelHeight/height,0,0);
  return {...surface,width,height};
 }
 draw(position,heading,route,{overview=false,force=false}={}){
  if(!finitePoint(position))return false;
  const now=globalThis.performance?.now?.()??Date.now();
  if(!force&&overview===this.overviewVisible&&now-this.lastDraw<1000/12)return false;
  const target=route.target();if(!finitePoint(target))return false;
  const progress=getMapProgress(route);let rendered=false;
  for(const [canvas,full] of [[this.canvas,false],...(overview?[[this.overviewCanvas,true]]:[])]){
   const surface=this.prepare(canvas);if(!surface)continue;
   const compact=!full&&this.compact();
   const {ctx,width,height}=surface,viewport=createMapViewport(position,target,width,height,{overview:full,compact});
   ctx.save();ctx.clearRect(0,0,width,height);
   if(compact){ctx.beginPath();ctx.arc(width/2,height/2,Math.min(width,height)/2,0,TAU);ctx.clip()}
   landscape(ctx,viewport,full,compact);
   if(compact){
    path(ctx,route.points||LANDMARKS,viewport);ctx.lineWidth=2;ctx.strokeStyle='#e6d2a8';ctx.stroke();
    if(progress.completed){path(ctx,(route.points||LANDMARKS).slice(0,progress.completed+1),viewport);ctx.strokeStyle='#85ddb1';ctx.stroke()}
    const goal=clampMapMarker(projectMapPoint(target,viewport),viewport,12),player=clampMapMarker(projectMapPoint(position,viewport),viewport,10);
    ctx.lineWidth=1.5;circle(ctx,goal.x,goal.y,4,'#ffbe7e','#15372c');
    circle(ctx,player.x,player.y,7,'#10292199');arrow(ctx,player.x,player.y,Number.isFinite(heading)?heading:0,5.5,viewport);
    ctx.font='700 9px system-ui,sans-serif';ctx.fillStyle='#fff1d2';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('N',width/2,9);
    ctx.restore();rendered=true;continue;
   }
   routeLine(ctx,viewport,progress,route.points||LANDMARKS);
   const goal=clampMapMarker(projectMapPoint(target,viewport),viewport,24),player=clampMapMarker(projectMapPoint(position,viewport),viewport,17);
   if(full){const regions=regionLabels(ctx,viewport);overviewGates(ctx,viewport,progress,goal,regions,player,route.points||LANDMARKS)}
   else{
    ctx.strokeStyle='#efd099';ctx.globalAlpha=.6;ctx.lineWidth=1.5;ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(player.x,player.y);ctx.lineTo(goal.x,goal.y);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
    for(let i=1;i<LANDMARKS.length;i++){if(i===progress.nextLeg)continue;const p=projectMapPoint((route.points||LANDMARKS)[i],viewport);circle(ctx,p.x,p.y,2.5,i<=progress.completed?'#a4d9b5':'#e1d2b2')}
   }
   decorations(ctx,viewport,full);targetMarker(ctx,goal,target.leg||progress.nextLeg,{overview:full});
   circle(ctx,player.x,player.y,12,'#10292199');arrow(ctx,player.x,player.y,Number.isFinite(heading)?heading:0,full?10:9,viewport);
   ctx.restore();rendered=true;
  }
  if(rendered){this.lastDraw=now;this.overviewVisible=overview}return rendered;
 }
}
