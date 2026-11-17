// Judge Dean LLC — settings panels share the pause they acquire, never a later one.
export class PanelPause {
 constructor({isPaused,onPause,onResume,onHold=onPause}){
  this.isPaused=isPaused;this.onPause=onPause;this.onResume=onResume;this.onHold=onHold;
  this.owners=new Set();this.resume=false;
 }
 get active(){return this.owners.size>0;}
 // A map/route dialog taking over needs the drive state before this panel,
 // rather than mistaking its temporary pause for an explicit player pause.
 get underlyingPaused(){return this.active?!this.resume:this.isPaused();}
 open(id){
  if(this.owners.has(id))return;
  if(!this.active)this.resume=!this.isPaused();
  this.owners.add(id);this.onPause();
 }
 close(id){
  if(!this.owners.delete(id)||this.active)return;
  const resume=this.resume;this.resume=false;
  if(resume)this.onResume();else this.onHold();
 }
 suspend(){this.resume=false;}
 clear(){this.owners.clear();this.resume=false;}
}
