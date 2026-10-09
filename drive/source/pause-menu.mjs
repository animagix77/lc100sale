// Keep the reference appropriate to the input device until the player chooses.
export function createPauseMenu(dialog,{onResume}){
 const media=matchMedia('(any-pointer: coarse), (max-width: 700px)');
 let chosen=false;
 function mode(value){
  for(const button of dialog.querySelectorAll('[data-controls-mode]'))button.setAttribute('aria-pressed',String(button.dataset.controlsMode===value));
  for(const panel of dialog.querySelectorAll('[data-controls-panel]'))panel.hidden=panel.dataset.controlsPanel!==value;
 }
 mode(media.matches?'touch':'keyboard');
 for(const button of dialog.querySelectorAll('[data-controls-mode]'))button.addEventListener('click',()=>{chosen=true;mode(button.dataset.controlsMode)});
 media.addEventListener('change',()=>{if(!chosen)mode(media.matches?'touch':'keyboard')});
 dialog.addEventListener('cancel',event=>{event.preventDefault();onResume()});
 return {
  open(){if(!dialog.open){dialog.showModal();dialog.querySelector('.pause-content').scrollTop=0;dialog.querySelector('#resume').focus({preventScroll:true})}},
  close(){if(dialog.open)dialog.close()}
 };
}
