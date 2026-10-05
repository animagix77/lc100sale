(() => {
 const trigger=document.getElementById('open-drive'),dialog=document.getElementById('drive-dialog'),frame=document.getElementById('drive-frame');let overflow='';
 trigger.addEventListener('click',()=>{overflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';dialog.showModal();frame.src='drive/index.html?v=beach-drive-1';frame.focus()});
 document.getElementById('close-drive').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{frame.src='about:blank';document.documentElement.style.overflow=overflow;trigger.focus({preventScroll:true})});
 window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===frame.contentWindow&&event.data?.type==='lc100:drive-close'&&dialog.open)dialog.close()});
})();
