// Judge Dean LLC — bounded, scroll-driven PNG loading for the mobile walkaround.
(() => {
 window.createOrbitSequence = ({count, url, onFrame, limit=24, concurrency=3, loadImage}) => {
  const cache=new Map(),pending=new Set(),failed=new Set();
  const anchors=Array.from({length:Math.ceil(count/12)},(_,i)=>i*12).concat(count-1);
  let target=0,active=false,displayed=-1;
  const load=loadImage||((src)=>new Promise((resolve,reject)=>{
   const image=new Image();image.decoding='async';
   image.onload=()=>image.decode().then(()=>resolve(image),reject);
   image.onerror=reject;image.src=src;
  }));
  function paint(){
   const nearest=[...cache.keys()].sort((a,b)=>Math.abs(a-target)-Math.abs(b-target))[0];
   if(nearest===undefined||nearest===displayed)return;
   displayed=nearest;onFrame(cache.get(nearest),nearest);
  }
  function trim(){
   while(cache.size>limit){
    const victim=[...cache.keys()].filter(i=>i!==displayed&&i!==target)
     .sort((a,b)=>(Number(anchors.includes(a))-Number(anchors.includes(b)))||Math.abs(b-target)-Math.abs(a-target))[0];
    cache.delete(victim);
   }
  }
  function pump(){
   if(!active)return;
   // Current frame and its neighbors precede sparse views of the rest of the orbit.
   const wanted=[target,target+1,target-1,target+2,target-2,target+3,target-3,...anchors];
   for(const index of wanted){
    if(pending.size>=concurrency)break;
    if(index<0||index>=count||cache.has(index)||pending.has(index)||failed.has(index))continue;
    pending.add(index);
    Promise.resolve().then(()=>load(url(index))).then(image=>{
     cache.set(index,image);if(active)paint();trim();
    },()=>failed.add(index)).finally(()=>{pending.delete(index);pump()});
   }
  }
  return {
   seek(progress){target=Math.round(Math.max(0,Math.min(1,progress))*(count-1));if(active){paint();pump()}},
   setActive(value){if(value&&!active)displayed=-1;active=value;if(active){paint();pump()}},
   get state(){return {target,displayed,cached:cache.size,pending:pending.size,failed:failed.size}}
  };
 };
})();
