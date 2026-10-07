(() => {
 const section=document.getElementById('test-drive'),trigger=document.getElementById('open-drive'),dialog=document.getElementById('drive-dialog'),frame=document.getElementById('drive-frame'),preview=document.getElementById('drive-preview-frame'),stage=document.querySelector('.drive-preview-stage'),motion=matchMedia('(prefers-reduced-motion: reduce)');
 let overflow='',visible=false,ready=false,unloadTimer;
 const send=active=>preview.contentWindow?.postMessage({type:'lc100:preview-active',active},location.origin);
 function unload(){clearTimeout(unloadTimer);ready=false;stage.classList.remove('is-live');stage.dataset.previewState='unloaded';preview.removeAttribute('src');preview.src='about:blank'}
 function sync(){section.querySelector('.drive-hint').textContent=motion.matches?'Take the wheel · Keyboard or touch controls':'Live beach scene · Take the wheel with keyboard or touch';const active=visible&&!document.hidden&&!dialog.open&&!motion.matches;stage.dataset.previewState=active?(ready?'playing':'loading'):'paused';if(active){clearTimeout(unloadTimer);if(!preview.getAttribute('src')||preview.getAttribute('src')==='about:blank')preview.src='drive/index.html?v=grass-trails-1&preview=1';if(ready)send(true)}else{send(false);{clearTimeout(unloadTimer);unloadTimer=setTimeout(unload,dialog.open||motion.matches?0:12000)}}}
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync()},{threshold:0}).observe(stage);
 document.addEventListener('visibilitychange',sync);motion.addEventListener('change',sync);
 trigger.addEventListener('click',()=>{overflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';dialog.showModal();unload();frame.src='drive/index.html?v=grass-trails-1';frame.focus()});
 document.getElementById('close-drive').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{frame.src='about:blank';document.documentElement.style.overflow=overflow;trigger.focus({preventScroll:true});sync()});
 window.addEventListener('message',event=>{if(event.origin!==location.origin)return;if(event.source===preview.contentWindow&&event.data?.type==='lc100:preview-ready'){ready=true;stage.classList.add('is-live');sync()}if(event.source===frame.contentWindow&&event.data?.type==='lc100:drive-close'&&dialog.open)dialog.close()});
})();
