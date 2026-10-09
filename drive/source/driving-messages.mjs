// Judge Dean LLC — reading time while attention is shared with driving.
export function readingSeconds(text,{minimum=18,maximum=32}={}){
 const words=String(text).trim().split(/\s+/).filter(Boolean).length;
 return Math.min(maximum,Math.max(minimum,6+words*.65));
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
