import {shore} from './terrain.mjs';
import {riverProfile} from './expedition.mjs';
import {checkpointPose} from './rollover.mjs';
const lines=[
 'Rusty: No snorkel. No propeller. Still you persisted. Back on the beach, Captain Land Cruiser.',
 'Rusty: It says LAND Cruiser. The clue was doing some heavy lifting. Back to dry sand.',
 'Rusty: Congratulations. You found the one terrain not covered by “all-terrain.” Beach privileges restored.'
];
// Require actual immersion offshore; river fords and wave-washed sand are playable.
export class OceanRecovery{
 constructor(){this.rescues=0;this.reset()}
 reset(){this.submergedFor=0;this.grace=2;this.triggered=false}
 update(dt,{position,waterHeight,groundHeight}){
  if(!Number.isFinite(dt)||dt<=0||this.triggered)return false;
  const step=Math.min(dt,.1);this.grace=Math.max(0,this.grace-step);
  if(this.grace>0)return false;
  const deep=position.x-shore(position.z)<-9&&waterHeight-groundHeight>1.15&&position.y<waterHeight+.55;
  this.submergedFor=deep?this.submergedFor+step:0;
  if(this.submergedFor<.8)return false;
  this.triggered=true;return true;
 }
 message(){return lines[this.rescues++%lines.length]}
}
export function beachRecoveryPose(position,heightAt){
 // Stay near the player's coastline, but avoid respawning in the river mouth.
 let z=position.z;
 for(const offset of [0,48,-48,96,-96]){const candidate=position.z+offset,x=shore(candidate)+19;if(riverProfile(x,candidate).influence<.01){z=candidate;break}}
 const x=shore(z)+19,start={x,z,name:'Dry sand'},target={x:shore(z-40)+19,z:z-40};
 return checkpointPose({checkpoint:()=>start,target:()=>target},heightAt);
}
