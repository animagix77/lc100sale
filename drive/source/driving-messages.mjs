// Judge Dean LLC — reading time while attention is shared with driving.
export function readingSeconds(text,{minimum=30,maximum=45}={}){
 const words=String(text).trim().split(/\s+/).filter(Boolean).length;
 return Math.min(maximum,Math.max(minimum,6+words*.65));
}
// Updating an unread line must not recreate it every frame or retain the
// previous paragraph's scroll position when genuinely different copy arrives.
export function setMessageText(element,text,{resetScroll=true}={}){
 const value=String(text);if(element.textContent===value)return false;
 element.textContent=value;if(resetScroll)element.scrollTop=0;return true;
}
export class DrivingMessages{
 constructor(){this.text='';this.until=0;this.pending=null}
 say(text,now,{defer=false}={}){
  if(defer&&now<this.until){this.pending=text;return false}
  this.text=text;this.until=now+readingSeconds(text);this.pending=null;return true;
 }
 update(now){if(this.pending&&now>=this.until)return this.say(this.pending,now);return false}
 clear(){this.pending=null;this.until=0}
}
