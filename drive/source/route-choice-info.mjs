// Judge Dean LLC — route previews use the actual checkpoint layout, not invented travel times.
import {LANDMARKS,COASTAL_LANDMARKS,CAMP,COASTAL_CAMP} from './expedition.mjs';
export function expeditionChoiceInfo(id){
 if(id!=='islands'&&id!=='saddle')return null;
 const coastal=id==='islands',points=coastal?COASTAL_LANDMARKS:LANDMARKS;
 const metres=points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-points[i].x,p.z-points[i].z),0);
 return {points,metres,label:coastal?'Scenic':'Technical',distance:`~${(metres/1000).toFixed(1)} km`,stops:points.length-1,camp:(coastal?COASTAL_CAMP:CAMP).name};
}
export function routePreviewSvg(points){
 const xs=points.map(p=>p.x),zs=points.map(p=>p.z),minX=Math.min(...xs),minZ=Math.min(...zs),spanX=Math.max(...xs)-minX,spanZ=Math.max(...zs)-minZ;
 const scale=Math.min(72/Math.max(1,spanX),36/Math.max(1,spanZ)),ox=(84-spanX*scale)/2,oy=(48-spanZ*scale)/2;
 const project=p=>`${(ox+(p.x-minX)*scale).toFixed(1)},${(oy+(p.z-minZ)*scale).toFixed(1)}`;
 const start=project(points[0]).split(','),end=project(points.at(-1)).split(',');
 return `<svg viewBox="0 0 84 48" aria-hidden="true" focusable="false"><path class="route-preview-land" d="M1 39 Q14 4 34 8 T83 21 L83 47 H1Z"/><polyline points="${points.map(project).join(' ')}"/><circle cx="${start[0]}" cy="${start[1]}" r="2.2"/><circle class="route-preview-camp" cx="${end[0]}" cy="${end[1]}" r="2.8"/></svg>`;
}
