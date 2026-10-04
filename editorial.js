// Fragment links open the relevant disclosure before moving to it.
(() => {
 function revealTarget(){
  if(!location.hash)return;
  let target;try{target=document.getElementById(decodeURIComponent(location.hash.slice(1)))}catch{return}
  if(!target)return;
  const detail=target.matches('details')?target:target.closest('details');
  if(detail)detail.open=true;
 }
 document.addEventListener('click',event=>{
  const link=event.target.closest('a[href^="#"]');if(!link)return;
  const id=link.getAttribute('href').slice(1),target=document.getElementById(id);
  if(target?.matches('details'))target.open=true;
 });
 window.addEventListener('hashchange',revealTarget);revealTarget();
})();
