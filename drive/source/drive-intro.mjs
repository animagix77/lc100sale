// Native dialog supplies focus containment; gameplay remains gated until Start.
export function createDriveIntro(dialog,start,{onStart,onExit}){
 let ready=false,started=false;
 const begin=()=>{if(!ready||started)return;started=true;dialog.close();onStart()};
 const cancel=e=>e.preventDefault(),leave=()=>onExit();
 start.disabled=true;start.textContent='Getting the keys…';dialog.addEventListener('cancel',cancel);start.addEventListener('click',begin);
 const exit=dialog.querySelector('[data-intro-exit]');exit.addEventListener('click',leave);dialog.showModal();
 return {ready(){ready=true;start.disabled=false;start.textContent='Fine. Give me the keys.';dialog.querySelector('[data-intro-status]').textContent='Beach ready. Judgment optional.'},fail(){dialog.querySelector('[data-intro-status]').textContent='The beach couldn’t load. Try a recent browser with graphics acceleration.'},dispose(){dialog.removeEventListener('cancel',cancel);start.removeEventListener('click',begin);exit.removeEventListener('click',leave);if(dialog.open)dialog.close()}};
}
