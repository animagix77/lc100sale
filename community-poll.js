// Shared totals live on the server. Browser storage holds only an anonymous voter token.
(() => {
 const root=document.getElementById('verdict');if(!root)return;
 const endpoint=location.hostname==='127.0.0.1'?'http://127.0.0.1:8767/api/poll':'https://lc100-community-vote.binhthere.chatgpt.site/api/poll';
 const status=document.getElementById('poll-status'),results=document.getElementById('poll-results');
 const choices=[...root.querySelectorAll('[data-vote]')],show=document.getElementById('poll-show-results'),retry=document.getElementById('poll-retry');
 let voter,ready=false,busy=false,latest=null,storageWorks=true;
 try{voter=localStorage.getItem('lc100-voter-v1');if(!/^[0-9a-f-]{36}$/i.test(voter||'')){voter=crypto.randomUUID();localStorage.setItem('lc100-voter-v1',voter)}}catch{voter=crypto.randomUUID();storageWorks=false}
 function controls(){choices.forEach(b=>b.disabled=busy||!ready);show.disabled=busy||!ready;retry.disabled=busy;root.setAttribute('aria-busy',String(busy))}
 function draw(data){
  latest=data;choices.forEach(b=>{const selected=b.dataset.vote===data.choice;b.setAttribute('aria-pressed',String(selected));b.querySelector('.poll-vote-label').textContent=selected?'Your vote ✓':`Vote ${b.dataset.vote} ↗`});
  for(const choice of ['sell','keep']){const count=data.counts[choice],pct=data.total?Math.round(count/data.total*100):0;document.getElementById(choice+'-percent').textContent=data.total?pct+'%':'—';document.getElementById(choice+'-bar').style.width=pct+'%';document.getElementById(choice+'-count').textContent=count+' '+(count===1?'vote':'votes')}
  document.getElementById('poll-total').textContent=data.total?`${data.total} community ${data.total===1?'vote':'votes'}. The driveway awaits its verdict.`:'No votes yet. Democracy starts in the driveway.';
 }
 function reveal(scroll=false){results.hidden=false;show.hidden=true;if(scroll)requestAnimationFrame(()=>results.scrollIntoView({block:"nearest",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"}))}
 async function request(choice){
  if(busy)return;busy=true;controls();retry.hidden=true;status.textContent=choice?'Sending your vote…':'Checking the community vote…';
  try{
   const response=await fetch(endpoint,{method:choice?'POST':'GET',mode:'cors',credentials:'omit',headers:{'X-Voter-ID':voter,...(choice?{'Content-Type':'application/json'}:{})},...(choice?{body:JSON.stringify({choice})}:{}),signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error('unavailable');const data=await response.json();
   if(!Number.isSafeInteger(data.total)||data.total<0||!['keep','sell'].every(k=>Number.isSafeInteger(data.counts?.[k])&&data.counts[k]>=0)||data.total!==data.counts.keep+data.counts.sell)throw Error('invalid tally');
   ready=true;draw(data);if(choice||data.choice)reveal(!!choice);
   status.textContent=choice?(choice==='sell'?'Vote saved. My wife would like to buy you a coffee.':'Vote saved. The boys thank you. My wife has questions.'):(data.choice?'Your vote is saved. Changed your mind? Pick the other side.':'Pick a side. No sign-in, names or emails.');
   if(!storageWorks)status.textContent+=' Browser storage is unavailable, so this device may not remember your vote after you leave.';
  }catch{status.textContent=choice?'Couldn’t confirm your vote. Try again; a retry won’t count twice.':'The ballot box is taking a breather. Please try again.';retry.hidden=false;retry.dataset.choice=choice||''}
  finally{busy=false;controls()}
 }
 choices.forEach(button=>button.addEventListener('click',()=>request(button.dataset.vote)));
 show.addEventListener('click',()=>{if(latest)reveal(true)});retry.addEventListener('click',()=>request(retry.dataset.choice||undefined));
 if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();request()}},{rootMargin:'300px'});observer.observe(root)}else request();
})();
