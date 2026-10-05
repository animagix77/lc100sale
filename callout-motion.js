// A callout builds from its anchor outward; outgoing strokes keep travelling forward.
(()=>{
 const panel=document.getElementById('inspection-detail');
 const bubble=document.getElementById('bubble');
 const leader=document.getElementById('leader-path');
 const preference=matchMedia('(prefers-reduced-motion: reduce)');
 if(!panel||!bubble||!leader||!bubble.animate)return;
 const ns='http://www.w3.org/2000/svg';
 const ring=document.createElementNS(ns,'svg');
 ring.setAttribute('viewBox','0 0 100 100');ring.setAttribute('aria-hidden','true');
 ring.classList.add('callout-ring');
 // Start at six o'clock, where the leader meets the lens. Clockwise throughout.
 ring.innerHTML='<circle cx="50" cy="50" r="49.5" pathLength="1" transform="rotate(90 50 50)"/>';
 bubble.append(ring);leader.setAttribute('pathLength','1');
 panel.classList.add('callout-motion');
 const parts=root=>[root.querySelector('.leader circle'),root.querySelector('.leader path'),root.querySelector('.callout-ring circle'),root.querySelector('.bubble-photo'),root.querySelector('.bubble-video'),root.querySelector('.bubble>span')];
 let current=null,ghost=null,animations=[];
 function cancelEntry(){animations.forEach(a=>a.cancel());animations=[];}
 function animate(node,frames,duration,delay=0){
  const a=node.animate(frames,{duration,delay,easing:'cubic-bezier(.4,0,.2,1)',fill:'both'});
  return a;
 }
 function exit(){
  if(current===null||panel.hidden||preference.matches)return;
  ghost?.remove();ghost=null;
  const old=panel.cloneNode(true),sources=parts(panel),targets=parts(old);
  old.removeAttribute('id');old.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
  old.querySelectorAll('button').forEach(n=>n.remove());
  old.classList.add('callout-outgoing');old.setAttribute('aria-hidden','true');old.inert=true;
  old.dataset.motion='exiting';
  const canvas=old.querySelector('canvas');
  if(!canvas.hidden)canvas.getContext('2d').drawImage(panel.querySelector('canvas'),0,0);
  // Sample the current build so interrupting an entrance never flashes a complete lens.
  const states=sources.map(node=>{const s=getComputedStyle(node);return {opacity:s.opacity,strokeDashoffset:s.strokeDashoffset}});
  document.getElementById('orbit-pin').append(old);ghost=old;
  const exits=targets.map((node,i)=>{
   const state=states[i];
   if(i===1||i===2){
    node.style.opacity=state.opacity;
    // Finish any partial draw, then trim from the same start point (never retract).
    return animate(node,[{strokeDashoffset:state.strokeDashoffset},{strokeDashoffset:'0',offset:.25},{strokeDashoffset:'-1'}],i===1?340:420,i===1?40:140);
   }
   return animate(node,[{opacity:state.opacity},{opacity:0}],i===0?130:160);
  });
  Promise.all(exits.map(a=>a.finished.catch(()=>{}))).then(()=>{old.remove();if(ghost===old)ghost=null});
 }
 window.lcCallout={
  prepare(next){
   if(next===current)return;
   exit();cancelEntry();current=null;
   panel.dataset.motion='pending';
  },
  show(next){
   // Match the ring's start to the leader's actual attachment, including side callouts.
   const path=leader.getPointAtLength(leader.getTotalLength());
   const base=document.getElementById('orbit-pin').getBoundingClientRect(),r=bubble.getBoundingClientRect();
   const angle=Math.atan2(path.y-(r.top-base.top+r.height/2),path.x-(r.left-base.left+r.width/2))*180/Math.PI;
   ring.firstElementChild.setAttribute('transform',`rotate(${angle} 50 50)`);
   if(next===current)return;
   current=next;panel.dataset.motion='entering';
   if(preference.matches){panel.dataset.motion='visible';return;}
   const [dot,line,outline,photo,video,label]=parts(panel);
   animations=[
    animate(dot,[{opacity:0},{opacity:1}],150),
    animate(line,[{strokeDashoffset:'1'},{strokeDashoffset:'0'}],340,130),
    animate(outline,[{strokeDashoffset:'1'},{strokeDashoffset:'0'}],440,450),
    animate(photo,[{opacity:0},{opacity:1}],300,900),
    animate(video,[{opacity:0},{opacity:1}],300,900),
    animate(label,[{opacity:0},{opacity:1}],220,1000)
   ];
   const entry=animations;
   Promise.all(entry.map(a=>a.finished.catch(()=>{}))).then(()=>{
    if(animations!==entry)return;
    panel.dataset.motion='visible';cancelEntry();
   });
  }
 };
 preference.addEventListener('change',()=>{
  if(!preference.matches)return;
  cancelEntry();ghost?.remove();ghost=null;panel.dataset.motion='visible';
 });
})();
