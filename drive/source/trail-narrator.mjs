const lines={
 stuck:[
  'Rusty: Congratulations. You’ve excavated a parking space. Try reverse, low range, or the orange admission-of-defeat boards.',
  'Rusty: The tyres are moving. The scenery isn’t. A strong argument for trying reverse.',
  'Rusty: You are now the roadside attraction. Boards out before someone takes a photo.'
 ],
 bump:[
  'Rusty: That was the suspension. Your spine would like a word about your line choice.',
  'Rusty: Excellent rock identification. Next time, try your eyes.',
  'Rusty: Cupholders: tested. Coffee: everywhere.'
 ],
 rain:[
  'Rusty: Complimentary rinse cycle. The mud has declined to participate.',
  'Rusty: Rain. Because apparently the trail wasn’t enough of a personality test.'
 ],
 waterExit:[
  'Rusty: Out of the water. Now dripping with confidence and several litres of poor judgment.',
  'Rusty: River crossed. Undercarriage washed. Interior laundry status: unconfirmed.'
 ],
 grass:[
  'Rusty: Scenic meadow. Please resist the urge to call this a shortcut.',
  'Rusty: Lovely view. The windscreen also works when you stop looking at the map.'
 ],
 snow:['Rusty: Winter wonderland. Summer tyre pressures. An interesting management decision.'],
 volcanic:['Rusty: Lava overlook. Finally, somewhere hotter than the argument about how many cars you own.'],
 dunes:['Rusty: Beautiful dunes. A terrible place to discover you packed optimism instead of a shovel.'],
 mud:['Rusty: This is what the brochure meant by “character.” Your floor mats call it something else.']
};
const cooldowns={stuck:65,bump:48,rain:100,waterExit:50,grass:130,snow:130,volcanic:130,dunes:130,mud:130};
export class TrailNarrator{
 constructor(){this.clock=0;this.last=new Map();this.indices=new Map();this.nextSpeech=15;this.resetContext()}
 resetContext(){this.previousBiome=null;this.wasStuck=false;this.rainingFor=0;this.rainAnnounced=false;this.wetFor=0;this.dryFor=0;this.crossing=false;this.pending=[]}
 offer(key,priority=0){
  if(this.clock-(this.last.get(key)??-Infinity)<cooldowns[key]||this.pending.some(p=>p.key===key))return;
  this.pending.push({key,priority,expires:this.clock+10});
 }
 update(dt,{biome,stuck=false,waterContact=0,speed=0,rain=0,impacts=[],canSpeak=true}){
  if(!Number.isFinite(dt)||dt<=0)return null;
  dt=Math.min(dt,.1);this.clock+=dt;
  if(stuck&&!this.wasStuck)this.offer('stuck',4);this.wasStuck=stuck;
  if(Math.abs(speed)>1.5&&impacts.some(p=>p.energy>.6))this.offer('bump',2);
  this.rainingFor=rain>.45?this.rainingFor+dt:0;
  if(rain<.2)this.rainAnnounced=false;
  if(this.rainingFor>3&&!this.rainAnnounced){this.offer('rain',1);this.rainAnnounced=true}
  if(waterContact>.25){this.wetFor+=dt;this.dryFor=0;if(this.wetFor>1.2)this.crossing=true}
  else{this.dryFor+=dt;if(this.crossing&&this.dryFor>.7){this.offer('waterExit',3);this.crossing=false;this.wetFor=0}else if(this.dryFor>1)this.wetFor=0}
  if(biome!==this.previousBiome){if(lines[biome])this.offer(biome);this.previousBiome=biome}
  this.pending=this.pending.filter(p=>p.expires>this.clock);
  if(!canSpeak||this.clock<this.nextSpeech||!this.pending.length)return null;
  this.pending.sort((a,b)=>b.priority-a.priority);const {key}=this.pending.shift(),index=this.indices.get(key)||0;
  this.indices.set(key,index+1);this.last.set(key,this.clock);this.nextSpeech=this.clock+24;
  // Let the next observation happen naturally, rather than draining a joke queue.
  this.pending.length=0;return lines[key][index%lines[key].length];
 }
}
