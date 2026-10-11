const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Physics-time triggers prevent frame-rate-dependent chatter and repeated parked impacts.
export class ContactFeedback{
 constructor(){this.reset(0)}
 reset(time){this.previous=[];this.wheelAt=[0,0,0,0];this.bodyAt=new Map();this.globalAt=time+.75;this.crashAt=time+.75;}
 sample(time,dt,wheels,speed,verticalSpeed,hits=[]){
  const out=[];
  // A substantial chassis impact has its own cooldown, so a tyre thump in the
  // same solver step cannot swallow it. Scrapes and gravel never become crashes.
  let crash;for(const hit of hits)if(hit.source==='chassis'&&hit.impulse>=900&&hit.closing>=2.5&&(!crash||hit.impulse>crash.impulse))crash=hit;
  if(crash&&time>=this.crashAt){out.push({kind:crash.kind,source:'chassis',crash:true,energy:clamp(crash.impulse/6500,.2,1),pan:clamp(crash.pan||0,-.8,.8)});this.bodyAt.set(crash.id,time+.5);this.crashAt=time+.5;this.globalAt=time+.08;}
  wheels.forEach((w,i)=>{const old=this.previous[i];this.previous[i]={...w};if(!old||!w.contact)return;
   const compression=old.contact?Math.max(0,(old.length-w.length)/Math.max(dt,.001)):0,landing=!old.contact?Math.max(0,-verticalSpeed):0;
   const crossing=w.kind!=='sand'&&old.kind!==w.kind&&Math.abs(speed)>.65;
   const energy=clamp(Math.max(compression/5,landing/6,crossing?Math.abs(speed)/8:0),0,1);
   if(energy<.13||time<this.wheelAt[i]||time<this.globalAt)return;
   out.push({kind:w.kind==='sand'?'suspension':w.kind,energy,pan:i%2?.65:-.65});this.wheelAt[i]=time+.24;this.globalAt=time+.055;
  });
  for(const hit of hits){const pebble=hit.source==='pebble';if(hit.impulse<(pebble?.025:220)||hit.closing<(pebble?.15:.65)||time<(this.bodyAt.get(hit.id)||0)||time<this.globalAt)continue;
   out.push({kind:hit.kind,source:hit.source,energy:clamp(hit.impulse/(pebble?15:2500),pebble?.02:.18,pebble?.35:1),pan:clamp(hit.pan||0,-.8,.8)});this.bodyAt.set(hit.id,time+(pebble?.20:.35));this.globalAt=time+.08;

  }
  while(this.bodyAt.size>32)this.bodyAt.delete(this.bodyAt.keys().next().value);
  return out;
 }
}
