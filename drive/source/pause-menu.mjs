// Judge Dean LLC — driving reference and a deliberate, cancellable restart.
export function createPauseMenu(dialog,{onResume,onRestart}){
 const media=matchMedia('(any-pointer: coarse), (max-width: 700px)');
 const overview=dialog.querySelectorAll('[data-pause-overview]'),confirmation=dialog.querySelector('[data-pause-restart]');
 const restart=dialog.querySelector('#restart-expedition'),keep=dialog.querySelector('#restart-cancel'),confirm=dialog.querySelector('#restart-confirm');
 let chosen=false,confirming=false,backdropPress=false;
 function showConfirmation(value,{focus=true}={}){
  confirming=value;backdropPress=false;
  for(const section of overview)section.hidden=value;
  confirmation.hidden=!value;
  dialog.classList.toggle('confirming-restart',value);
  dialog.setAttribute('aria-labelledby',value?'restart-title':'pause-title');
  dialog.setAttribute('aria-describedby',value?'restart-description':'pause-lead');
  if(focus)(value?keep:restart).focus({preventScroll:true});
 }
 function dismiss(){if(confirming)showConfirmation(false);else onResume();}
 function mode(value){
  for(const button of dialog.querySelectorAll('[data-controls-mode]'))button.setAttribute('aria-pressed',String(button.dataset.controlsMode===value));
  for(const panel of dialog.querySelectorAll('[data-controls-panel]'))panel.hidden=panel.dataset.controlsPanel!==value;
 }
 mode(media.matches?'touch':'keyboard');
 for(const button of dialog.querySelectorAll('[data-controls-mode]'))button.addEventListener('click',()=>{chosen=true;mode(button.dataset.controlsMode)});
 media.addEventListener('change',()=>{if(!chosen)mode(media.matches?'touch':'keyboard')});
 restart.addEventListener('click',()=>{if(dialog.open)showConfirmation(true)});
 keep.addEventListener('click',()=>showConfirmation(false));
 confirm.addEventListener('click',()=>{
  if(!dialog.open||!confirming)return;
  showConfirmation(false,{focus:false});dialog.close();onRestart();
 });
 // Escape is also a global driving shortcut. Contain it here before it can
 // resume the vehicle behind a restart confirmation.
 dialog.addEventListener('keydown',event=>{
  if(event.code!=='Escape')return;
  event.preventDefault();event.stopPropagation();if(!event.repeat)dismiss();
 });
 dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss()});
 const outside=event=>{if(event.target!==dialog)return false;const r=dialog.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;};
 dialog.addEventListener('pointerdown',event=>{backdropPress=outside(event)});
 dialog.addEventListener('pointercancel',()=>{backdropPress=false});
 dialog.addEventListener('click',event=>{const cancel=confirming&&backdropPress&&outside(event);backdropPress=false;if(cancel)showConfirmation(false)});
 return {
  open(){if(!dialog.open){showConfirmation(false,{focus:false});dialog.showModal();dialog.querySelector('.pause-content').scrollTop=0;dialog.querySelector('#resume').focus({preventScroll:true})}},
  close(){if(dialog.open)dialog.close();showConfirmation(false,{focus:false})}
 };
}
