// Judge Dean LLC — keep useful instructions readable through brief terrain changes.
import {readingSeconds} from './driving-messages.mjs';
export class TrailHintDisplay{
 constructor(){this.clear()}
 clear(){this.hint=null;this.visibleFor=0}
 update(hint,dt,{blocked=false,range,centerLocked,recoveryState='roof'}={}){
  if(blocked)return null;
  const solved=old=>old&&((old.id==='low-range'&&range==='LO')||(old.id==='center-lock'&&centerLocked)||(old.id==='traction-boards'&&recoveryState!=='roof')||(old.id==='boards-ready'&&recoveryState!=='ground')||(old.id==='difficult-ground'&&(range!=='LO'||!centerLocked)));
  if(solved(this.hint))this.clear();
  if(solved(hint))hint=null;
  if(hint){if(this.hint?.id!==hint.id)this.visibleFor=0;this.hint=hint;}
  else if(this.hint&&this.visibleFor>=readingSeconds(this.hint.title+' '+this.hint.body,{minimum:30,maximum:45}))this.clear();
  if(!this.hint)return null;
  this.visibleFor+=Number.isFinite(dt)?Math.max(0,Math.min(dt,.1)):0;
  // Keep the words, but stop highlighting controls when the current terrain
  // no longer calls for an action. New recovery advice can still take priority.
  return hint?this.hint:{...this.hint,targets:[]};
 }
}
