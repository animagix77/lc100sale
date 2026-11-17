// Judge Dean LLC — stable rendering quality; physics and HUD never change tiers.
export const GRAPHICS_KEY='com.judgedeanllc.lc100.graphics.v1';
export const GRAPHICS_MODES=['auto','smooth','detail'];
export function readGraphicsMode(storage){try{const value=storage?.getItem(GRAPHICS_KEY);return GRAPHICS_MODES.includes(value)?value:'auto';}catch{return 'auto';}}
export class AdaptiveQuality{
 constructor({mobile=false,pixelRatio=1,mode='auto',storage=null,onChange=()=>{}}={}){
  this.mobile=mobile;this.pixelRatio=Math.max(.5,pixelRatio);this.storage=storage;this.onChange=onChange;this.mode=GRAPHICS_MODES.includes(mode)?mode:'auto';this.level=2;this.reset();
 }
 reset(){this.seconds=0;this.samples=[];this.slow=0;this.fast=0;this.cooldown=0;}
 get ratio(){const max=Math.min(this.pixelRatio,this.mobile?1.2:1.6),floor=Math.min(max,this.mobile?.7:.8);return this.mode==='detail'?max:this.mode==='smooth'?Math.max(floor,max*.72):Math.max(floor,max*[.62,.78,.9,1][this.level]);}
 setMode(mode){if(!GRAPHICS_MODES.includes(mode))return false;this.mode=mode;this.level=2;this.reset();try{this.storage?.setItem(GRAPHICS_KEY,mode);}catch{}this.onChange(this.ratio,this.mode);return true;}
 sample(seconds){
  if(this.mode!=='auto'||!Number.isFinite(seconds)||seconds<=0)return false;
  // Pause/visibility explicitly reset observations. Bound an isolated long
  // interval, while still reacting to devices persistently below four fps.
  seconds=Math.min(seconds,.25);
  this.seconds+=seconds;this.cooldown=Math.max(0,this.cooldown-seconds);this.samples.push(seconds*1000);
  if(this.seconds<2)return false;
  const sorted=this.samples.sort((a,b)=>a-b),p80=sorted[Math.floor((sorted.length-1)*.8)],elapsed=this.seconds;
  this.samples=[];this.seconds=0;
  if(this.cooldown>0)return false;
  this.slow=p80>24?this.slow+elapsed:0;this.fast=p80<18?this.fast+elapsed:0;
  let next=this.level;if(this.slow>=4&&next>0)next--;else if(this.fast>=16&&next<3)next++;
  if(next===this.level)return false;
  this.level=next;this.slow=this.fast=0;this.cooldown=6;this.onChange(this.ratio,this.mode);return true;
 }
}

// Discretionary scenery shares one measured allowance after collision terrain.
// Atomic installs may exceed it; subsequent work then waits until the next frame.
export class StreamingBudget{
 constructor({milliseconds=4.5,clock=()=>performance.now()}={}){this.milliseconds=milliseconds;this.clock=clock;this.start=0;this.total=0;}
 begin(){this.start=this.clock();this.total=0;}
 remaining(max=Infinity){return Math.max(0,Math.min(max,this.milliseconds-this.total));}
 measure(work){const start=this.clock();const result=work();this.total+=this.clock()-start;return result;}
 run(max,work,{reserve=0}={}){const budget=Math.max(0,Math.min(max,this.remaining()-reserve));if(budget<.15)return false;this.measure(()=>work(budget));return true;}
}
