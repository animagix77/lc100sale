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
export class DrivingMessages {
 constructor() {
  this.text = '';
  this.clear();
 }

 say(text, now, {defer = false, mobile = 'notice'} = {}) {
  if (defer && now < this.until) {
   this.pending = {text, mobile};
   return false;
  }
  this.text = text;
  this.mobile = mobile;
  this.until = now + readingSeconds(text);
  this.pending = null;
  return true;
 }

 update(now) {
  if (now < this.until) return false;
  if (this.pending) return this.say(this.pending.text, now, {mobile:this.pending.mobile});
  return false;
 }

 clear() {
  this.pending = null;
  this.until = 0;
  this.mobile = 'quiet';
 }
}
