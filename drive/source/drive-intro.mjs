// Native dialog supplies focus containment; gameplay remains gated until Start.
export function createDriveIntro(dialog,start,{onStart,onExit}){
 let ready=false,started=false,failed=false,percent=0;
 const label=start.querySelector('[data-intro-label]'),meter=dialog.querySelector('[data-intro-progress]'),status=dialog.querySelector('[data-intro-status]');
 const progress=(value,message)=>{if(ready||failed||!Number.isFinite(value))return;percent=Math.max(percent,Math.min(99,Math.round(value)));start.style.setProperty('--load-progress',percent+'%');label.textContent=`Getting the keys… ${percent}%`;meter.setAttribute('aria-valuenow',String(percent));if(message)status.textContent=message};
 const begin=()=>{if(!ready||started)return;started=true;dialog.close();onStart()};
 const cancel=e=>e.preventDefault(),leave=()=>onExit();
 start.disabled=true;progress(0);dialog.addEventListener('cancel',cancel);start.addEventListener('click',begin);
 const exit=dialog.querySelector('[data-intro-exit]');exit.addEventListener('click',leave);dialog.showModal();
 return {progress,ready(){if(failed)return;ready=true;start.style.setProperty('--load-progress','100%');meter.setAttribute('aria-valuenow','100');start.disabled=false;label.textContent='Fine. Give me the keys.';status.textContent='Beach ready. Judgment optional.'},fail(){failed=true;start.disabled=true;label.textContent='Keys unavailable';status.textContent='The beach couldn’t load. Try a recent browser with graphics acceleration.'},dispose(){dialog.removeEventListener('cancel',cancel);start.removeEventListener('click',begin);exit.removeEventListener('click',leave);if(dialog.open)dialog.close()}};
}
