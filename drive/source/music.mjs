// Opt-in soundtrack. The file is not requested until the listener presses Music.
export function createMusic(button,focus){
 const media=document.createElement('audio');media.id='soundtrack';media.preload='none';media.loop=true;media.hidden=true;document.body.append(media);
 let ctx,gain,on=false,paused=false,disposed=false,version=0,timer;
 const label=()=>{button.textContent=on?'Music on':'Music off';button.setAttribute('aria-pressed',String(on));button.title=on?'No Particular Hurry · original instrumental · click to mute':'Play No Particular Hurry · original instrumental'};
 function quiet(seconds=.35){clearTimeout(timer);if(!ctx){media.pause();return}gain.gain.cancelScheduledValues(ctx.currentTime);gain.gain.setTargetAtTime(0,ctx.currentTime,seconds/4);timer=setTimeout(()=>{media.pause();ctx.suspend().catch(()=>{})},seconds*1000)}
 async function play(){const request=++version;clearTimeout(timer);try{
  if(!ctx){ctx=new AudioContext();gain=ctx.createGain();gain.gain.value=0;ctx.createMediaElementSource(media).connect(gain);gain.connect(ctx.destination);media.src='no-particular-hurry.m4a';}
  await Promise.all([ctx.resume(),media.play()]);
  if(request!==version||!on||paused||disposed){if(!on||paused||disposed)quiet(.1);return}
  gain.gain.cancelScheduledValues(ctx.currentTime);gain.gain.setTargetAtTime(.52,ctx.currentTime,.25);
 }catch{if(request!==version||disposed)return;on=false;quiet(.1);label();button.textContent='Retry music';button.title='Music could not start. Click to retry.'}}
 button.addEventListener('click',()=>{if(disposed)return;on=!on;label();if(on&&!paused)void play();else{version++;quiet()}focus()});label();
 return {pause(value){paused=value;if(!on)return;if(value){version++;quiet(.15)}else void play()},dispose(){disposed=true;version++;clearTimeout(timer);media.pause();media.removeAttribute('src');media.load();media.remove();ctx?.close().catch(()=>{})}};
}
