// Judge Dean LLC — keep occasional actions out of the portrait driving view.
export function createHudMenu(toggle,options,{onOpen=()=>{}}={}){
 const media=matchMedia('(max-width:700px) and (orientation:portrait)');
 const toolbar=toggle.parentElement;
 function close({focus=false}={}){
  toolbar.classList.remove('menu-open');toggle.setAttribute('aria-expanded','false');
  if(focus)toggle.focus({preventScroll:true});
 }
 function activate(){
  if(toggle.getAttribute('aria-expanded')==='true')close();
  else{toolbar.classList.add('menu-open');toggle.setAttribute('aria-expanded','true');onOpen()}
 }
 function outside(event){if(!toolbar.contains(event.target))close()}
 function escape(event){
  if(event.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true'){
   event.preventDefault();event.stopImmediatePropagation();close({focus:true});
  }
 }
 function choose(event){if(event.target.closest('button'))close()}
 function resize(){if(!media.matches)close()}
 toggle.addEventListener('click',activate);options.addEventListener('click',choose);
 document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape,true);
 media.addEventListener('change',resize);
 return {close,dispose(){toggle.removeEventListener('click',activate);options.removeEventListener('click',choose);document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape,true);media.removeEventListener('change',resize)}};
}
